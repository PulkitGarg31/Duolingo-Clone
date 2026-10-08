"""Base fixtures: a frozen clock and a file-backed SQLite database built like production.

The database fixtures compose: `engine` (fresh file with the schema) -> `session_factory` -> `db`.
`build_database()` is the same preparation as a plain function, for fixtures with a wider scope.
"""

from collections.abc import Iterator
from datetime import UTC, datetime
from pathlib import Path

import pytest
from sqlalchemy import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.clock import FrozenClock
from app.core.db import ensure_sqlite_dir, make_engine, make_session_factory
from app.models import Base

# A Thursday; the API examples use the same instant.
FROZEN_NOW = datetime(2026, 10, 8, 12, 0, tzinfo=UTC)


def build_database(path: Path) -> Engine:
    """A database file at `path` with the full schema, prepared the way application startup does it.

    A file rather than :memory: keeps WAL and BEGIN IMMEDIATE locking exactly as in production.
    """
    url = f"sqlite:///{path.as_posix()}"
    ensure_sqlite_dir(url)
    engine = make_engine(url)
    Base.metadata.create_all(engine)
    return engine


@pytest.fixture
def clock() -> FrozenClock:
    """A clock frozen at FROZEN_NOW. Move it with `clock.advance(hours=5)`."""
    return FrozenClock(FROZEN_NOW)


@pytest.fixture
def engine(tmp_path: Path) -> Iterator[Engine]:
    """A fresh database for one test, disposed afterwards."""
    engine = build_database(tmp_path / "data" / "app.db")
    yield engine
    engine.dispose()


@pytest.fixture
def session_factory(engine: Engine) -> sessionmaker[Session]:
    """Sessions configured like the application's SessionLocal, bound to the test database."""
    return make_session_factory(engine)


@pytest.fixture
def db(session_factory: sessionmaker[Session]) -> Iterator[Session]:
    """One ORM session on the test database; anything left uncommitted is rolled back."""
    with session_factory() as session:
        yield session
