"""Write serialization: with BEGIN IMMEDIATE, concurrent read-modify-write transactions queue."""

import threading
import time

import sqlalchemy as sa
from sqlalchemy.orm import Session, sessionmaker

from app.core.clock import FrozenClock
from app.models import AppState

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
