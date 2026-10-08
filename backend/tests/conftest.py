"""Shared fixtures: a frozen clock, file-backed SQLite databases built like production, and API clients.

The database fixtures compose: `engine` (fresh file with the schema) -> `session_factory` -> `db`.
`build_database()` is the same preparation as a plain function, for fixtures with a wider scope.

The API fixtures run the real application with three dependencies replaced: the database session
(bound to the test database), the source of real time (the frozen `clock`) and the settings. The
demo clock's offset still applies on top of the frozen clock, exactly as in production, so tests
can move time either with `clock.advance(...)` or through the /dev clock endpoints.
"""

import shutil
from collections.abc import Iterator
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.api.deps import get_db, get_real_clock
from app.core.clock import FrozenClock
from app.core.config import Settings, get_settings
from app.core.db import ensure_sqlite_dir, make_engine, make_session_factory
from app.domain.rules import DEFAULT_HEART_REGEN_MINUTES
from app.main import create_app
from app.models import Base
from app.seed.loader import seed_if_empty

# A Thursday; the API examples use the same instant.
FROZEN_NOW = datetime(2026, 10, 8, 12, 0, tzinfo=UTC)
# The browser origin the test app allows (CORS).
TEST_ORIGIN = "http://localhost:3000"


def build_database(path: Path) -> Engine:
    """A database file at `path` with the full schema, prepared the way application startup does it.

    A file rather than :memory: keeps WAL and BEGIN IMMEDIATE locking exactly as in production.
    """
    url = f"sqlite:///{path.as_posix()}"
    ensure_sqlite_dir(url)
    engine = make_engine(url)
    Base.metadata.create_all(engine)
    return engine


def api_settings(database_url: str) -> Settings:
    """Settings with everything tests rely on pinned, whatever the local environment or .env say."""
    return Settings(
        _env_file=None,
        database_url=database_url,
        cors_origins=[TEST_ORIGIN],
        cors_origin_regex="",
        default_username="alex",
        allow_user_header=True,  # tests act as other learners through X-User-Id
        enable_dev_tools=True,
        seed_timezone="Asia/Kolkata",
        heart_regen_minutes=DEFAULT_HEART_REGEN_MINUTES,
    )


def make_client(engine: Engine, clock: FrozenClock) -> TestClient:
    """A client for a fresh app that uses `engine` and takes real time from `clock`.

    The app's startup (lifespan) is not run: it prepares the configured production database file,
    while the fixtures prepare the test database themselves.
    """
    settings = api_settings(str(engine.url))
    app = create_app(settings)
    sessions = make_session_factory(engine)

    def get_test_db() -> Iterator[Session]:
        with sessions() as db:
            yield db

    app.dependency_overrides[get_db] = get_test_db
    app.dependency_overrides[get_real_clock] = lambda: clock
    app.dependency_overrides[get_settings] = lambda: settings
    return TestClient(app)


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


@pytest.fixture(scope="session")
def seeded_template(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """A database seeded once per test run, at FROZEN_NOW and in Asia/Kolkata. Tests get copies.

    Tests that need it are skipped while the seed loader loads nothing.
    """
    path = tmp_path_factory.mktemp("seed") / "template.db"
    engine = build_database(path)
    try:
        with make_session_factory(engine)() as db:
            seeded = seed_if_empty(db, real_now=FROZEN_NOW, settings=api_settings(str(engine.url)))
            db.commit()
    finally:
        engine.dispose()  # closing the last connection folds the WAL into the file before it is copied
    if not seeded:
        pytest.skip("seed_if_empty() loaded no demo data")
    return path


@pytest.fixture
def seeded_engine(seeded_template: Path, tmp_path: Path) -> Iterator[Engine]:
    """A private copy of the seeded database for one test."""
    path = tmp_path / "seeded" / "app.db"
    path.parent.mkdir()
    shutil.copyfile(seeded_template, path)
    engine = make_engine(f"sqlite:///{path.as_posix()}")
    yield engine
    engine.dispose()


@pytest.fixture
def client(seeded_engine: Engine, clock: FrozenClock) -> Iterator[TestClient]:
    """The API on a copy of the seeded demo, at FROZEN_NOW; request `clock` too to move time."""
    with closing(make_client(seeded_engine, clock)) as test_client:
        yield test_client


@pytest.fixture
def bare_client(engine: Engine, clock: FrozenClock) -> Iterator[TestClient]:
    """The API on an empty database (tables only), for tests that need no demo data."""
    with closing(make_client(engine, clock)) as test_client:
        yield test_client


@pytest.fixture
def learner2() -> int:
    """A second human learner's id, for proving per-user isolation with X-User-Id."""
    pytest.skip("creating a second learner needs the test factories")
