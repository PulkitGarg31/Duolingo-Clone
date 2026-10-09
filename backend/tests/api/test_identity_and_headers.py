"""Who a request acts as (the default learner, X-User-Id, the app's settings), the standard response
headers and the request log line.
"""

import logging
import re
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_real_clock
from app.api.v1.router import API_V1_PREFIX
from app.core.clock import FrozenClock
from app.core.db import make_session_factory
from tests.api.probes import add_people, probe
from tests.conftest import (
    api_settings,
    fresh_app,
    running,
)
from tests.helpers import assert_problem, use_settings

HEX_ID = re.compile(r"[0-9a-f]{12}")

# ---- the current learner and the request context ----


def test_requests_act_as_the_default_learner(api: TestClient, db: Session) -> None:
    alex_id, _ = add_people(db)
    response = api.get(f"{API_V1_PREFIX}/probe/me")
    assert response.status_code == 200
    # Noon UTC is 17:30 in Kolkata: still the 8th there.
    assert response.json() == {"userId": alex_id, "today": "2026-10-08"}
    assert response.headers["x-server-time"] == "2026-10-08T12:00:00Z"


def test_the_user_header_selects_another_learner_but_never_a_bot(api: TestClient, db: Session) -> None:
    alex_id, bot_id = add_people(db)
    assert (
        api.get(f"{API_V1_PREFIX}/probe/me", headers={"X-User-Id": str(alex_id)}).json()["userId"] == alex_id
    )
    assert_problem(
        api.get(f"{API_V1_PREFIX}/probe/me", headers={"X-User-Id": str(bot_id)}), 403, "BOT_ACCOUNT"
    )
    for unknown in ("999", "abc", "9" * 40):
        assert_problem(api.get(f"{API_V1_PREFIX}/probe/me", headers={"X-User-Id": unknown}), 404, "NOT_FOUND")


def test_the_user_header_is_ignored_when_the_setting_is_off(api: TestClient, db: Session) -> None:
    alex_id, bot_id = add_people(db)
    use_settings(api, allow_user_header=False)
    response = api.get(f"{API_V1_PREFIX}/probe/me", headers={"X-User-Id": str(bot_id)})
    assert response.json()["userId"] == alex_id


def test_the_settings_an_app_is_built_with_govern_its_requests(
    engine: Engine, clock: FrozenClock, db: Session
) -> None:
    _, bot_id = add_people(db)
    settings = api_settings(str(engine.url)).model_copy(
        update={"enable_dev_tools": False, "allow_user_header": False}
    )
    strict_app = fresh_app(settings)
    strict_app.include_router(probe)
    sessions = make_session_factory(engine)

    def get_test_db() -> Iterator[Session]:
        with sessions() as session:
            yield session

    strict_app.dependency_overrides[get_db] = get_test_db  # the settings themselves stay as built
    strict_app.dependency_overrides[get_real_clock] = lambda: clock
    with running(TestClient(strict_app)) as client:
        assert_problem(client.get(f"{API_V1_PREFIX}/probe/dev"), 403, "DEV_TOOLS_DISABLED")
        me = client.get(f"{API_V1_PREFIX}/probe/me", headers={"X-User-Id": str(bot_id)})
        assert me.status_code == 200 and me.json()["userId"] != bot_id  # the header is ignored


def test_a_missing_default_learner_is_a_404_problem(api: TestClient) -> None:
    body = assert_problem(api.get(f"{API_V1_PREFIX}/probe/me"), 404, "NOT_FOUND")
    assert "alex" in body["detail"]


# ---- standard headers ----


def test_every_response_carries_the_same_boot_id(api: TestClient) -> None:
    health = api.get(f"{API_V1_PREFIX}/health")
    boot_id = health.json()["bootId"]
    assert re.fullmatch(r"[0-9a-f]{32}", boot_id)
    responses = [
        health,
        api.get(f"{API_V1_PREFIX}/nowhere"),
        api.post(f"{API_V1_PREFIX}/probe/goal", json={}),
        api.get(f"{API_V1_PREFIX}/probe/crash"),
    ]
    assert [response.headers["x-boot-id"] for response in responses] == [boot_id] * len(responses)


def test_a_valid_request_id_is_echoed_and_anything_else_replaced(api: TestClient) -> None:
    echoed = api.get(f"{API_V1_PREFIX}/nowhere", headers={"X-Request-ID": "trace-42.a"})
    assert echoed.headers["x-request-id"] == echoed.json()["requestId"] == "trace-42.a"
    for unusable in ("has spaces", "x" * 65):
        replaced = api.get(f"{API_V1_PREFIX}/health", headers={"X-Request-ID": unusable})
        assert HEX_ID.fullmatch(replaced.headers["x-request-id"])
    assert HEX_ID.fullmatch(api.get(f"{API_V1_PREFIX}/health").headers["x-request-id"])


def test_responses_are_not_cached_unless_the_route_says_so(api: TestClient) -> None:
    assert api.get(f"{API_V1_PREFIX}/health").headers["cache-control"] == "no-store"
    assert api.get(f"{API_V1_PREFIX}/nowhere").headers["cache-control"] == "no-store"
    assert api.get(f"{API_V1_PREFIX}/probe/cached").headers["cache-control"] == "public, max-age=300"


def test_server_time_is_sent_only_when_the_request_resolved_a_learner(api: TestClient, db: Session) -> None:
    add_people(db)
    assert api.get(f"{API_V1_PREFIX}/probe/me").headers["x-server-time"] == "2026-10-08T12:00:00Z"
    health = api.get(f"{API_V1_PREFIX}/health")
    assert health.json()["serverTime"] == "2026-10-08T12:00:00Z"
    assert "x-server-time" not in health.headers  # health acts as no learner, so it has no simulated now
    assert "x-server-time" not in api.get(f"{API_V1_PREFIX}/nowhere").headers


def test_a_path_cannot_forge_a_request_log_line(api: TestClient, caplog: pytest.LogCaptureFixture) -> None:
    forged = "2026-10-09 03:00:00,000 INFO app.api.middleware method=POST path=/api/v1/dev/reset status=200"
    with caplog.at_level(logging.INFO, logger="app.api.middleware"):
        api.get(f"{API_V1_PREFIX}/x%0A{forged.replace(' ', '%20')}")
    (line,) = [record.getMessage() for record in caplog.records if record.name == "app.api.middleware"]
    assert "\n" not in line and "\r" not in line
    assert line.startswith(f"method=GET path={API_V1_PREFIX}/x\\n2026-10-09")  # the newline shows escaped
