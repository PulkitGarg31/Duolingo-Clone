"""Request validation and RFC 9457 problem documents: invalid input of every kind (bodies, sizes,
ids in the URL), each application error, unknown routes, wrong methods and the 500 boundary.
"""

import json
import logging
from collections.abc import Iterator
from datetime import timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import TypeAdapter, ValidationError

from app.api.middleware import MAX_BODY_BYTES
from app.api.problems import MAX_FIELD_ERRORS, PROBLEM_JSON, problem_response
from app.api.v1.router import API_V1_PREFIX
from app.core.errors import (
    AppError,
    BodyTooLarge,
    ErrorCode,
    InternalError,
    OutOfHearts,
)
from app.schemas.dev import ClockAdvanceIn, DevLearnerPatchIn
from app.schemas.sessions import AnswerIn, StartSessionIn
from app.schemas.settings import SettingsPatchIn
from tests.api.probes import sample_errors
from tests.conftest import (
    TEST_ORIGIN,
)
from tests.helpers import PROBLEM_KEYS, assert_problem, use_settings

# ---- request validation rules ----


@pytest.mark.parametrize(
    ("payload", "valid"),
    [
        ({"kind": "lesson", "nodeId": 6}, True),
        ({"kind": "lesson"}, False),
        ({"kind": "legendary", "nodeId": 2}, True),
        ({"kind": "legendary"}, False),
        ({"kind": "practice"}, True),
        ({"kind": "practice", "nodeId": 2}, True),
        ({"kind": "timed"}, True),
        ({"kind": "timed", "nodeId": 2}, False),
        ({"kind": "review", "nodeId": 4}, False),
    ],
)
def test_a_session_start_needs_a_node_exactly_when_its_kind_does(
    payload: dict[str, Any], valid: bool
) -> None:
    if valid:
        StartSessionIn.model_validate(payload)
    else:
        with pytest.raises(ValidationError):
            StartSessionIn.model_validate(payload)


@pytest.mark.parametrize(
    ("payload", "valid"),
    [
        ({"type": "translate", "tileIds": [313, 315, 311]}, True),
        ({"type": "translate", "text": "I drink water"}, True),
        ({"type": "translate"}, False),
        ({"type": "translate", "tileIds": [313], "text": "I"}, False),
        ({"type": "translate", "tileIds": []}, False),
        ({"type": "type_answer", "text": ""}, False),
        ({"type": "type_answer", "text": "x" * 201}, False),
        ({"type": "match_pairs", "pairs": [{"leftId": 41, "rightId": 41}], "mistakes": 0}, True),
        ({"type": "match_pairs", "pairs": [], "mistakes": -1}, False),
        ({"type": "skip"}, True),
        ({"type": "skip", "optionId": 3}, False),
        ({"type": "cant_listen"}, True),
        ({"type": "hint"}, False),
    ],
)
def test_answer_payloads_are_checked_against_their_type(payload: dict[str, Any], valid: bool) -> None:
    adapter = TypeAdapter(AnswerIn)
    if valid:
        assert adapter.validate_python(payload).type == payload["type"]
    else:
        with pytest.raises(ValidationError):
            adapter.validate_python(payload)


def test_a_settings_patch_must_change_something_valid() -> None:
    patch = SettingsPatchIn.model_validate({"dailyGoalXp": 30, "theme": None, "timezone": "America/New_York"})
    assert patch.changes() == {"daily_goal_xp": 30, "timezone": "America/New_York"}
    for invalid in (
        {},
        {"theme": None},
        {"dailyGoalXp": 15},
        {"timezone": "Mars/Olympus_Mons"},
        {"mood": "happy"},
    ):
        with pytest.raises(ValidationError):
            SettingsPatchIn.model_validate(invalid)


@pytest.mark.parametrize(
    ("payload", "delta"),
    [
        ({"minutes": 1}, timedelta(minutes=1)),
        ({"hours": 5}, timedelta(hours=5)),
        ({"days": 2, "hours": 3}, timedelta(days=2, hours=3)),
        ({"days": 60}, timedelta(days=60)),
        ({}, None),
        ({"minutes": 0}, None),
        ({"days": 60, "minutes": 1}, None),
        ({"days": 61}, None),
        ({"hours": -1}, None),
    ],
)
def test_the_clock_moves_forward_by_one_minute_to_sixty_days(
    payload: dict[str, int], delta: timedelta | None
) -> None:
    if delta is None:
        with pytest.raises(ValidationError):
            ClockAdvanceIn.model_validate(payload)
    else:
        assert ClockAdvanceIn.model_validate(payload).delta == delta


def test_a_learner_patch_sets_hearts_or_gems_within_range() -> None:
    assert DevLearnerPatchIn.model_validate({"hearts": 0}).hearts == 0
    assert DevLearnerPatchIn.model_validate({"gems": 1320}).gems == 1320
    for invalid in ({}, {"hearts": 6}, {"hearts": -1}, {"gems": -5}):
        with pytest.raises(ValidationError):
            DevLearnerPatchIn.model_validate(invalid)


# ---- problem documents ----


def test_every_application_error_has_a_sample() -> None:
    def subclasses(cls: type[AppError]) -> Iterator[type[AppError]]:
        for subclass in cls.__subclasses__():
            yield subclass
            yield from subclasses(subclass)

    concrete = {cls for cls in subclasses(AppError) if hasattr(cls, "code")}
    samples = sample_errors()
    assert {type(error) for error in samples} == concrete
    assert {error.code for error in samples} == set(ErrorCode)


@pytest.mark.parametrize("error", sample_errors(), ids=lambda error: error.code.value)
def test_every_application_error_renders_as_a_problem_document(error: AppError) -> None:
    response = problem_response(error, instance="/api/v1/me", request_id="6f1c2a9e4b7d")
    body = json.loads(response.body)
    assert response.status_code == error.status
    assert response.media_type == PROBLEM_JSON
    assert set(body) == PROBLEM_KEYS | set(error.extra)
    assert body["type"] == "/problems/" + error.code.value.lower().replace("_", "-")
    assert body["code"] == error.code.value
    assert (body["status"], body["title"], body["detail"]) == (error.status, error.title, error.detail)
    assert (body["instance"], body["requestId"], body["errors"]) == ("/api/v1/me", "6f1c2a9e4b7d", [])


def test_extension_members_use_the_wire_formats() -> None:
    rendered = {
        error.code: json.loads(problem_response(error, instance="/x", request_id="r").body)
        for error in sample_errors()
    }
    assert rendered[ErrorCode.OUT_OF_HEARTS]["nextHeartAt"] == "2026-10-08T16:00:00Z"
    gems = rendered[ErrorCode.INSUFFICIENT_GEMS]
    assert (gems["requiredGems"], gems["balance"]) == (350, 120)
    assert rendered[ErrorCode.SESSION_NOT_ACTIVE]["sessionStatus"] == "failed"
    assert rendered[ErrorCode.SESSION_NOT_ACTIVE]["endReason"] == "too_many_mistakes"
    assert rendered[ErrorCode.SESSION_EXPIRED]["expiresAt"] == "2026-10-08T12:00:30Z"
    assert rendered[ErrorCode.ITEM_OUT_OF_ORDER]["currentItemId"] == 103
    # A member that is defined but has no value is sent as null rather than left out.
    no_heart_due = json.loads(
        problem_response(OutOfHearts(next_heart_at=None), instance="/x", request_id="r").body
    )
    assert no_heart_due["nextHeartAt"] is None


def test_a_conflict_is_a_409_problem_with_its_extension_members(api: TestClient) -> None:
    body = assert_problem(api.get(f"{API_V1_PREFIX}/probe/errors/OUT_OF_HEARTS"), 409, "OUT_OF_HEARTS")
    assert body["nextHeartAt"] == "2026-10-08T16:00:00Z"
    assert body["instance"] == f"{API_V1_PREFIX}/probe/errors/OUT_OF_HEARTS"
    assert body["errors"] == []


def test_an_invalid_body_is_a_422_listing_each_field_by_its_wire_name(api: TestClient) -> None:
    body = assert_problem(
        api.post(f"{API_V1_PREFIX}/probe/goal", json={"dailyGoalXp": 15}), 422, "VALIDATION_ERROR"
    )
    assert body["errors"] == [
        {"field": "body.dailyGoalXp", "message": "Input should be 10, 20, 30 or 50", "kind": "literal_error"}
    ]
    body = assert_problem(
        api.post(f"{API_V1_PREFIX}/probe/goal", json={"dailyGoalXp": 20, "dailyGoal": 20}),
        422,
        "VALIDATION_ERROR",
    )
    assert [error["field"] for error in body["errors"]] == ["body.dailyGoal"]
    assert body["errors"][0]["kind"] == "extra_forbidden"


def test_a_union_error_names_the_answer_type_in_its_path(api: TestClient) -> None:
    body = assert_problem(
        api.put(f"{API_V1_PREFIX}/probe/answer", json={"type": "type_answer"}), 422, "VALIDATION_ERROR"
    )
    assert body["errors"] == [
        {"field": "body.type_answer.text", "message": "Field required", "kind": "missing"}
    ]


def test_malformed_json_is_a_validation_error(api: TestClient) -> None:
    response = api.post(
        f"{API_V1_PREFIX}/probe/goal", content=b"{not json", headers={"Content-Type": "application/json"}
    )
    body = assert_problem(response, 422, "VALIDATION_ERROR")
    assert body["errors"][0]["kind"] == "json_invalid"


def test_a_large_invalid_body_gets_a_short_problem_with_its_first_errors(api: TestClient) -> None:
    every_tile_invalid = {"type": "translate", "tileIds": ["x"] * 9_000}  # about 45 KB
    response = api.put(f"{API_V1_PREFIX}/probe/answer", json=every_tile_invalid)
    body = assert_problem(response, 422, "VALIDATION_ERROR")
    assert len(body["errors"]) == MAX_FIELD_ERRORS
    assert body["errors"][0]["field"] == "body.translate.tileIds.0"
    assert len(response.content) < 5_000


def test_a_body_over_the_size_limit_is_refused_before_it_is_read(api: TestClient) -> None:
    oversized = {"type": "type_answer", "text": "x" * MAX_BODY_BYTES}
    body = assert_problem(api.put(f"{API_V1_PREFIX}/probe/answer", json=oversized), 422, "VALIDATION_ERROR")
    assert body["detail"] == BodyTooLarge.default_detail
    assert body["errors"] == []


def test_a_streamed_body_is_cut_off_at_the_size_limit(api: TestClient) -> None:
    def chunks() -> Iterator[bytes]:  # no Content-Length: the size is only known while reading
        yield b'{"type": "type_answer", "text": "'
        for _ in range(MAX_BODY_BYTES // 1024 + 1):
            yield b"x" * 1024
        yield b'"}'

    response = api.put(
        f"{API_V1_PREFIX}/probe/answer", content=chunks(), headers={"Content-Type": "application/json"}
    )
    body = assert_problem(response, 422, "VALIDATION_ERROR")
    assert body["detail"] == BodyTooLarge.default_detail


def test_bodies_also_accept_snake_case_and_answer_in_camel_case(api: TestClient) -> None:
    response = api.post(f"{API_V1_PREFIX}/probe/goal", json={"daily_goal_xp": 30})
    assert response.status_code == 200
    assert response.json() == {"dailyGoalXp": 30}


def test_an_unknown_route_is_a_404_problem(api: TestClient) -> None:
    body = assert_problem(api.get(f"{API_V1_PREFIX}/nowhere"), 404, "NOT_FOUND")
    assert body["instance"] == f"{API_V1_PREFIX}/nowhere"


def test_a_wrong_method_is_a_405_problem_that_names_the_allowed_ones(api: TestClient) -> None:
    response = api.post(f"{API_V1_PREFIX}/health")
    assert_problem(response, 405, "METHOD_NOT_ALLOWED")
    assert response.headers["allow"] == "GET"


@pytest.mark.parametrize("key", [None, "", "   ", "k" * 65])
def test_a_purchase_without_a_usable_idempotency_key_is_a_400_problem(
    api: TestClient, key: str | None
) -> None:
    headers = {} if key is None else {"Idempotency-Key": key}
    assert_problem(
        api.post(f"{API_V1_PREFIX}/probe/purchase", headers=headers), 400, "IDEMPOTENCY_KEY_REQUIRED"
    )


def test_a_usable_idempotency_key_reaches_the_handler(api: TestClient) -> None:
    key = "0d6c6f5e-55a8-4b6f-9a7e-2f0f4e3e7d11"
    response = api.post(f"{API_V1_PREFIX}/probe/purchase", headers={"Idempotency-Key": key})
    assert response.status_code == 200
    assert response.json() == {"key": key}


def test_dev_tools_answer_403_when_switched_off(api: TestClient) -> None:
    assert api.get(f"{API_V1_PREFIX}/probe/dev").status_code == 200
    use_settings(api, enable_dev_tools=False)
    assert_problem(api.get(f"{API_V1_PREFIX}/probe/dev"), 403, "DEV_TOOLS_DISABLED")


def test_an_unexpected_exception_is_a_generic_500_problem_that_keeps_cors_headers(
    api: TestClient, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.ERROR, logger="app"):
        response = api.get(f"{API_V1_PREFIX}/probe/crash", headers={"Origin": TEST_ORIGIN})
    body = assert_problem(response, 500, "INTERNAL_ERROR")
    assert body["detail"] == InternalError.default_detail  # never the exception text
    assert "probe failure" not in response.text
    assert response.headers["access-control-allow-origin"] == TEST_ORIGIN
    assert "X-Boot-Id" in response.headers["access-control-expose-headers"]
    # The traceback is logged with the request id, so the id in the client's error chip finds it.
    logged = [record for record in caplog.records if body["requestId"] in record.getMessage()]
    assert logged and logged[0].exc_info is not None


# ---- ids in the URL ----

LARGEST_ID = 2**63 - 1  # SQLite's largest integer
# Every route with an id in its path, the id under test written as {id}, and its documented name.
ID_ROUTES = [
    ("GET", "/sessions/{id}", "sessionId"),
    ("PUT", "/sessions/{id}/items/1/answer", "sessionId"),
    ("PUT", "/sessions/1/items/{id}/answer", "itemId"),
    ("POST", "/sessions/{id}/complete", "sessionId"),
    ("POST", "/sessions/{id}/quit", "sessionId"),
    ("POST", "/me/chests/{id}/claim", "nodeId"),
    ("POST", "/me/league/results/{id}/ack", "membershipId"),
    ("GET", "/me/purchases/{id}", "purchaseId"),
    ("GET", "/users/{id}/profile", "userId"),
    ("GET", "/units/{id}/guidebook", "unitId"),
]


@pytest.mark.parametrize(("method", "path", "name"), ID_ROUTES)
@pytest.mark.parametrize("bad_id", [LARGEST_ID + 1, 10**20, 0, -1])
def test_an_id_outside_the_integer_range_is_a_validation_error(
    client: TestClient, method: str, path: str, name: str, bad_id: int
) -> None:
    answer = {"type": "skip"} if method == "PUT" else None
    response = client.request(method, API_V1_PREFIX + path.format(id=bad_id), json=answer)
    body = assert_problem(response, 422, "VALIDATION_ERROR")
    assert [error["field"] for error in body["errors"]] == [f"path.{name}"]


@pytest.mark.parametrize(("method", "path", "name"), ID_ROUTES)
def test_the_largest_id_is_valid_and_simply_not_found(
    client: TestClient, method: str, path: str, name: str
) -> None:
    answer = {"type": "skip"} if method == "PUT" else None
    response = client.request(method, API_V1_PREFIX + path.format(id=LARGEST_ID), json=answer)
    assert_problem(response, 404, "NOT_FOUND")


@pytest.mark.parametrize("digits", ["%EF%BC%91", "%D9%A1", "+1", "1_0"])
def test_a_user_id_must_be_written_with_plain_ascii_digits(client: TestClient, digits: str) -> None:
    # A full-width "1" or an Arabic-Indic "1" is a digit to Python but never a valid id here.
    response = client.get(f"{API_V1_PREFIX}/users/{digits}/profile")
    body = assert_problem(response, 422, "VALIDATION_ERROR")
    assert [error["field"] for error in body["errors"]] == ["path.userId"]
