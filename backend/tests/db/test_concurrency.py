"""Write serialization: with BEGIN IMMEDIATE, concurrent transactions queue instead of colliding.

The lost-update counter shows the mechanism on a bare table. The API races show what it buys: two
requests completing the same session, or buying with the same Idempotency-Key, at the same moment,
still pay exactly once. Should two purchases ever get past the key lookup together, the unique key is
the backstop and the second one replays the first.
"""

import threading
import time
from collections.abc import Callable, Iterator
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import httpx2
import pytest
import sqlalchemy as sa
from fastapi.testclient import TestClient
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session, sessionmaker

from app.core.clock import FrozenClock
from app.domain.enums import GemReason
from app.models import AppState, GemTransaction, Purchase, XpEvent
from app.repositories import ledger_repo
from app.repositories.ledger_repo import purchase_by_key
from tests.conftest import assert_invariants_hold, make_client, running
from tests.helpers import API, answer_items, buy, get_me, node_at, start_session

THREADS = 2
INCREMENTS_PER_THREAD = 50


def test_concurrent_read_modify_write_loses_no_updates(
    session_factory: sessionmaker[Session], clock: FrozenClock
) -> None:
    with session_factory() as db:
        db.add(AppState(id=1, seeded_at=clock.now(), seed_version="test"))
        db.commit()

    start_together = threading.Barrier(THREADS)
    errors: list[Exception] = []

    def increment_many_times() -> None:
        try:
            start_together.wait()
            with session_factory() as db:
                for _ in range(INCREMENTS_PER_THREAD):
                    # The lost-update shape: read, compute in Python, write back. The pause invites the
                    # other thread in between; the write lock taken at BEGIN keeps it out.
                    offset = db.scalar(sa.select(AppState.clock_offset_seconds))
                    time.sleep(0.001)
                    db.execute(sa.update(AppState).values(clock_offset_seconds=offset + 1))
                    db.commit()
        except Exception as error:  # reported by the assertion below, on the test thread
            errors.append(error)

    threads = [threading.Thread(target=increment_many_times) for _ in range(THREADS)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert errors == []
    with session_factory() as db:
        assert db.scalar(sa.select(AppState.clock_offset_seconds)) == THREADS * INCREMENTS_PER_THREAD


# ---- races through the API ----


@pytest.fixture
def clients(seeded_engine: Engine, clock: FrozenClock) -> Iterator[tuple[TestClient, TestClient]]:
    """Two clients of one app on a copy of the seeded demo, like two browser tabs.

    Once the test is over, the invariants must hold.
    """
    with running(make_client(seeded_engine, clock)) as first, running(TestClient(first.app)) as second:
        yield first, second
    assert_invariants_hold(seeded_engine, clock)


def at_the_same_moment(*calls: Callable[[], httpx2.Response]) -> list[httpx2.Response]:
    """Run each call on its own thread, all released together, and return their responses in order."""
    released = threading.Barrier(len(calls))

    def run(call: Callable[[], httpx2.Response]) -> httpx2.Response:
        released.wait()
        return call()

    with ThreadPoolExecutor(max_workers=len(calls)) as pool:
        return list(pool.map(run, calls))


def without_replay_flags(body: dict[str, object]) -> dict[str, object]:
    return {key: value for key, value in body.items() if key not in ("replayed", "me")}


def test_two_simultaneous_completions_pay_once(
    clients: tuple[TestClient, TestClient], seeded_engine: Engine
) -> None:
    tab, other_tab = clients
    session = start_session(tab, {"kind": "lesson", "nodeId": node_at(tab, 2, 2)})
    answer_items(tab, seeded_engine, session)
    path = f"{API}/sessions/{session['id']}/complete"

    responses = at_the_same_moment(lambda: tab.post(path), lambda: other_tab.post(path))

    assert [response.status_code for response in responses] == [200, 200]
    bodies = [response.json() for response in responses]
    assert sorted(body["replayed"] for body in bodies) == [False, True]
    assert without_replay_flags(bodies[0]) == without_replay_flags(bodies[1])  # one receipt
    with Session(seeded_engine) as db:
        lines = db.scalar(select(func.count()).where(XpEvent.session_id == session["id"]))
    assert lines == 2  # one set of XP lines: lesson and combo
    assert get_me(tab)["xp"]["total"] == 373 + 15


def test_two_simultaneous_purchases_with_one_key_charge_once(
    clients: tuple[TestClient, TestClient], seeded_engine: Engine
) -> None:
    tab, other_tab = clients
    key = str(uuid4())

    responses = at_the_same_moment(
        lambda: buy(tab, "streak_freeze", key=key), lambda: buy(other_tab, "streak_freeze", key=key)
    )

    assert sorted(response.status_code for response in responses) == [200, 201]
    bodies = [response.json() for response in responses]
    assert bodies[0]["id"] == bodies[1]["id"]
    assert sorted(body["replayed"] for body in bodies) == [False, True]
    with Session(seeded_engine) as db:
        bought = db.scalar(select(func.count()).where(Purchase.idempotency_key == key))
        paid = db.scalar(
            select(func.count()).where(
                GemTransaction.reason == GemReason.PURCHASE, GemTransaction.purchase_id == bodies[0]["id"]
            )
        )
    assert (bought, paid) == (1, 1)
    assert get_me(tab)["gems"] == 820 - 200


def test_the_unique_key_backstops_a_purchase_that_missed_the_lookup(
    clients: tuple[TestClient, TestClient], monkeypatch: pytest.MonkeyPatch
) -> None:
    tab, _ = clients
    key = str(uuid4())
    first = buy(tab, "xp_boost_15", key=key)  # a boost can always be bought again
    assert first.status_code == 201

    # The next lookup misses the purchase, as if both requests had looked before either inserted.
    lookups: list[str] = []

    def lookup_too_early(db: Session, user_id: int, idempotency_key: str) -> Purchase | None:
        lookups.append(idempotency_key)
        return None if len(lookups) == 1 else purchase_by_key(db, user_id, idempotency_key)

    monkeypatch.setattr(ledger_repo, "purchase_by_key", lookup_too_early)
    again = buy(tab, "xp_boost_15", key=key)

    assert (again.status_code, again.json()["id"], again.json()["replayed"]) == (
        200,
        first.json()["id"],
        True,
    )
    assert len(lookups) == 2  # the insert hit the unique key, and the replay looked again
    assert get_me(tab)["gems"] == 820 - 100
