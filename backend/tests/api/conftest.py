"""Fixtures of the API tests: the app with the probe routes mounted (tests/api/probes.py)."""

from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine

from app.core.clock import FrozenClock
from tests.api.probes import probe
from tests.conftest import (
    assert_invariants_hold,
    fresh_app,
    running,
    use_database,
)


@pytest.fixture(scope="module")
def probe_client() -> Iterator[TestClient]:
    """A client of an app of its own with the probe routes mounted, shared by the tests of one module."""
    probe_app = fresh_app()
    probe_app.include_router(probe)
    with running(TestClient(probe_app)) as client:
        yield client


@pytest.fixture
def api(probe_client: TestClient, engine: Engine, clock: FrozenClock) -> Iterator[TestClient]:
    """The probe app on an empty database.

    Once the test is over, the invariants must hold on whatever it created.
    """
    probe_app = probe_client.app
    assert isinstance(probe_app, FastAPI)
    use_database(probe_app, engine, clock)
    yield probe_client
    assert_invariants_hold(engine, clock)
