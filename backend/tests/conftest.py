"""Shared fixtures: a frozen clock, file-backed SQLite databases built like production, and API clients.

The database fixtures compose: `engine` (fresh file with the schema) -> `session_factory` -> `db`.
`build_database()` is the same preparation as a plain function, for fixtures with a wider scope.

The API fixtures run the real application with three dependencies replaced: the database session
(bound to the test database), the source of real time (the frozen `clock`) and the settings. The
demo clock's offset still applies on top of the frozen clock, exactly as in production, so tests
can move time either with `clock.advance(...)` or through the /dev clock endpoints. After every
test that used an API client, the game's invariants (tests/invariants.py) must hold.
"""

import shutil
from collections.abc import AsyncIterator, Iterator
from contextlib import asynccontextmanager, closing, contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.api.deps import get_db, get_real_clock
from app.core.clock import FrozenClock
from app.core.config import Settings, get_settings
from app.core.db import ensure_sqlite_dir, make_engine, make_session_factory
from app.domain.rules import DEFAULT_HEART_REGEN_MINUTES
from app.main import create_app
from app.models import Base, User, UserStats
from app.repositories import system_repo
from app.seed.loader import seed_if_empty
from app.services import sync_service
from tests.factories import add_learner
from tests.invariants import check_invariants

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


@asynccontextmanager
async def _no_startup(_app: FastAPI) -> AsyncIterator[None]:
    """Replaces the app's startup, which prepares the configured production database: the fixtures
    prepare each test's database themselves."""
    yield


def use_database(app: FastAPI, engine: Engine, clock: FrozenClock) -> None:
    """Point the app at a test database and a frozen clock, with the test settings.

    This replaces every dependency override the app had, including settings a test changed.
    """
    settings = api_settings(str(engine.url))
    sessions = make_session_factory(engine)

    def get_test_db() -> Iterator[Session]:
        with sessions() as db:
            yield db

    app.dependency_overrides = {
        get_db: get_test_db,
        get_real_clock: lambda: clock,
        get_settings: lambda: settings,
    }


def fresh_app() -> FastAPI:
    """A fresh application whose startup is left to the fixtures; point it at a database first."""
    app = create_app(api_settings("sqlite://"))
    app.router.lifespan_context = _no_startup
    return app


def make_client(engine: Engine, clock: FrozenClock) -> TestClient:
    """A client for a fresh app that uses `engine` and takes real time from `clock`.

    Use it as a context manager (see `running`), so that all its requests share one event loop.
    """
    app = fresh_app()
    use_database(app, engine, clock)
    return TestClient(app)


@contextmanager
def running(client: TestClient) -> Iterator[TestClient]:
    """Run the client's requests on one event loop until the block ends, then close it.

    Without this, every request starts and stops an event loop of its own, which is slow.
    """
    with closing(client), client:
        yield client


def assert_invariants_hold(engine: Engine, clock: FrozenClock, *, zone_shifted: bool = False) -> None:
    """Bring every learner up to the current instant, as any request would, then check I1-I9.

    The current instant is the frozen real time plus the demo clock's offset. Catching up first
    matters when a test ends by moving time: the streak rule describes a settled streak.
    """
    settings = api_settings(str(engine.url))
    with make_session_factory(engine)() as db:
        now = clock.now() + timedelta(seconds=system_repo.offset_seconds(db))
        for learner in db.scalars(select(User).join(UserStats)):  # bots have no stats and never sync
            sync_service.bring_to_now(db, learner, now, settings)
        db.commit()
        problems = check_invariants(db, now, zone_shifted=zone_shifted)
    assert problems == [], "broken invariants:\n" + "\n".join(problems)


def _shifts_zones(request: pytest.FixtureRequest) -> bool:
    """Whether the test is marked as one that changes a learner's time zone."""
    return request.node.get_closest_marker("zone_shifted") is not None


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


@pytest.fixture(scope="session")
def shared_client() -> Iterator[TestClient]:
    """One app and one client for the API tests of the whole run.

    A new app compiles its routes on its first request, and a new client starts an event loop of
    its own: both are slow enough to matter when paid by every test. Each test still gets its own
    database, clock and settings: `client` and `bare_client` point the app at them. Tests that add
    routes, or need several clients, build their own with `make_client`.
    """
    with running(TestClient(fresh_app())) as shared:
        yield shared


@pytest.fixture
def client(
    shared_client: TestClient, seeded_engine: Engine, clock: FrozenClock, request: pytest.FixtureRequest
) -> Iterator[TestClient]:
    """The API on a copy of the seeded demo, at FROZEN_NOW; request `clock` too to move time.

    Once the test is over, the invariants must hold on its database.
    """
    app = shared_client.app
    assert isinstance(app, FastAPI)
    use_database(app, seeded_engine, clock)
    yield shared_client
    assert_invariants_hold(seeded_engine, clock, zone_shifted=_shifts_zones(request))


@pytest.fixture
def bare_client(
    shared_client: TestClient, engine: Engine, clock: FrozenClock, request: pytest.FixtureRequest
) -> Iterator[TestClient]:
    """The API on an empty database (tables only), for tests that need no demo data.

    Once the test is over, the invariants must hold on whatever it created.
    """
    app = shared_client.app
    assert isinstance(app, FastAPI)
    use_database(app, engine, clock)
    yield shared_client
    assert_invariants_hold(engine, clock, zone_shifted=_shifts_zones(request))


@pytest.fixture
def learner2(seeded_engine: Engine) -> int:
    """A second human learner on the seeded demo, with a fresh path and no history.

    Tests act as them with an X-User-Id header, which proves that learners never see each other's data.
    """
    with make_session_factory(seeded_engine)() as db:
        learner = add_learner(db, username="sam", joined_at=FROZEN_NOW)
        db.commit()
        return learner.id
