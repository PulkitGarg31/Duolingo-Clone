"""Random sequences of learner actions: no server error, and every invariant holds after every step.

Each walk is seeded, so a failure replays exactly. The actions mix the lesson loop (start, answer
right or wrong, skip, complete, quit), the shop, chests, league results and the demo tools (time
jumps and heart changes), in whatever order the dice give, including orders no screen would offer.
A refused action (409 or 422) is a normal outcome; a 5xx never is.
"""

import random
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import httpx2
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine

from app.core.clock import FrozenClock
from tests.conftest import assert_invariants_hold
from tests.helpers import API, answer_for, buy, load_exercises

STEPS = 30
SEEDS = (1, 2)
SHOP_ITEMS = ("heart_refill", "streak_freeze", "xp_boost_15", "unlimited_hearts")


@dataclass
class Walk:
    """The client, the database (for the right answers) and the dice of one random walk."""

    client: TestClient
    engine: Engine
    rng: random.Random

    def get(self, path: str) -> Any:
        return self.client.get(f"{API}{path}").json()

    def active_session(self) -> dict[str, Any] | None:
        active = self.get("/me")["activeSession"]
        return None if active is None else self.get(f"/sessions/{active['id']}")

    def node_ids(self, *, kind: str, states: set[str]) -> list[int]:
        units = self.get("/me/path")["units"]
        return [n["id"] for u in units for n in u["nodes"] if n["kind"] == kind and n["state"] in states]


def start_lesson(walk: Walk) -> httpx2.Response:
    current = walk.get("/me/path")["currentNodeId"]
    body = {"kind": "lesson", "nodeId": current} if current else {"kind": "practice"}
    return walk.client.post(f"{API}/sessions", json=body)


def start_practice(walk: Walk) -> httpx2.Response:
    return walk.client.post(f"{API}/sessions", json={"kind": "practice"})


def start_timed(walk: Walk) -> httpx2.Response:
    return walk.client.post(f"{API}/sessions", json={"kind": "timed"})


def start_legendary(walk: Walk) -> httpx2.Response:
    skills = walk.node_ids(kind="skill", states={"completed", "legendary"}) or [0]
    return walk.client.post(f"{API}/sessions", json={"kind": "legendary", "nodeId": walk.rng.choice(skills)})


def answer(walk: Walk, *, correct: bool) -> httpx2.Response:
    session = walk.active_session()
    if session is None or session["currentItemId"] is None:
        return walk.client.get(f"{API}/me")  # nothing to answer: a plain read stands in for the action
    item = next(item for item in session["items"] if item["id"] == session["currentItemId"])
    exercise = load_exercises(walk.engine, [item["exercise"]["id"]])[item["exercise"]["id"]]
    path = f"{API}/sessions/{session['id']}/items/{item['id']}/answer"
    return walk.client.put(path, json=answer_for(exercise, correct=correct))


def answer_right(walk: Walk) -> httpx2.Response:
    return answer(walk, correct=True)


def answer_wrong(walk: Walk) -> httpx2.Response:
    return answer(walk, correct=False)


def skip(walk: Walk) -> httpx2.Response:
    session = walk.active_session()
    if session is None or session["currentItemId"] is None:
        return walk.client.get(f"{API}/me")  # nothing to skip
    return walk.client.put(
        f"{API}/sessions/{session['id']}/items/{session['currentItemId']}/answer", json={"type": "skip"}
    )


def complete(walk: Walk) -> httpx2.Response:
    session = walk.active_session()
    return walk.client.post(f"{API}/sessions/{session['id'] if session else 0}/complete")


def finish(walk: Walk) -> httpx2.Response:
    """Answer whatever is left right, then complete: the only way a random walk earns rewards."""
    session = walk.active_session()
    if session is None:
        return complete(walk)
    items = {item["id"]: item for item in session["items"]}
    exercises = load_exercises(walk.engine, (item["exercise"]["id"] for item in items.values()))
    current = session["currentItemId"]
    while current is not None:
        exercise = exercises[items[current]["exercise"]["id"]]
        answered = walk.client.put(
            f"{API}/sessions/{session['id']}/items/{current}/answer", json=answer_for(exercise)
        )
        if answered.status_code != 200:  # blocked at 0 hearts, or past a timed deadline
            return answered
        current = answered.json()["session"]["currentItemId"]
    return walk.client.post(f"{API}/sessions/{session['id']}/complete")


def quit_session(walk: Walk) -> httpx2.Response:
    session = walk.active_session()
    return walk.client.post(f"{API}/sessions/{session['id'] if session else 0}/quit")


def shop(walk: Walk) -> httpx2.Response:
    return buy(walk.client, walk.rng.choice(SHOP_ITEMS))


def open_chest(walk: Walk) -> httpx2.Response:
    chests = walk.node_ids(kind="chest", states={"available", "locked", "completed"})
    return walk.client.post(f"{API}/me/chests/{walk.rng.choice(chests)}/claim")


def acknowledge_result(walk: Walk) -> httpx2.Response:
    pending = walk.get("/me")["pendingLeagueResult"]
    return walk.client.post(f"{API}/me/league/results/{pending['membershipId'] if pending else 0}/ack")


def jump_ahead(walk: Walk) -> httpx2.Response:
    return walk.client.post(f"{API}/dev/clock/advance", json={"minutes": walk.rng.randint(1, 12 * 60)})


def next_day(walk: Walk) -> httpx2.Response:
    return walk.client.post(f"{API}/dev/clock/next-day")


def set_hearts(walk: Walk) -> httpx2.Response:
    return walk.client.patch(f"{API}/dev/learner", json={"hearts": walk.rng.randint(0, 5)})


# Answering is the most common action, as it is in real use.
ACTIONS: tuple[Callable[[Walk], httpx2.Response], ...] = (
    start_lesson, start_lesson, start_practice, start_timed, start_legendary,
    answer_right, answer_right, answer_right, answer_right, answer_wrong, skip,
    complete, finish, finish, quit_session, shop, open_chest, acknowledge_result,
    jump_ahead, next_day, set_hearts,
)  # fmt: skip


@pytest.mark.parametrize("seed", SEEDS)
def test_random_actions_keep_every_invariant(
    client: TestClient, clock: FrozenClock, seeded_engine: Engine, seed: int
) -> None:
    walk = Walk(client, seeded_engine, random.Random(seed))
    for step in range(STEPS):
        action = walk.rng.choice(ACTIONS)
        response = action(walk)
        assert response.status_code < 500, f"step {step}, {action.__name__}: {response.text}"
        assert_invariants_hold(seeded_engine, clock)
