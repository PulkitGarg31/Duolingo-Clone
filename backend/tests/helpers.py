"""Helpers that drive the API as the frontend would, plus the test-only knowledge it never has.

The right answers are read from the database. Reads use short-lived sessions closed before the next
API call, because every transaction takes the write lock (BEGIN IMMEDIATE) and an open one would
make the API wait.
"""

from collections.abc import Collection, Iterable, Mapping
from typing import Any
from uuid import uuid4

import httpx2
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

from app.api.problems import PROBLEM_JSON
from app.api.v1.router import API_V1_PREFIX
from app.core.config import Settings, get_settings
from app.domain.enums import ExerciseType
from app.models import Exercise
from app.repositories.content_repo import EXERCISE_CHILDREN

API = API_V1_PREFIX
Json = dict[str, Any]
Headers = Mapping[str, str] | None
# The members every problem document has; some codes add extension members.
PROBLEM_KEYS = frozenset({"type", "title", "status", "detail", "instance", "code", "requestId", "errors"})


def as_user(user_id: int) -> dict[str, str]:
    """Request headers that act as another learner."""
    return {"X-User-Id": str(user_id)}


def bearer(token: str) -> dict[str, str]:
    """Request headers that act as the account this token was issued to."""
    return {"Authorization": f"Bearer {token}"}


def signup(
    client: TestClient,
    email: str,
    *,
    password: str = "correct horse battery",
    display_name: str = "Ana",
    timezone: str | None = "Europe/Madrid",
) -> Json:
    """Create an account through the API and return the answer: its token and its user."""
    body: Json = {"displayName": display_name, "email": email, "password": password}
    if timezone is not None:
        body["timezone"] = timezone
    response = client.post(f"{API}/auth/signup", json=body)
    assert response.status_code == 201, response.text
    signed_up: Json = response.json()
    return signed_up


def assert_problem(response: httpx2.Response, status: int, code: str) -> Json:
    """Assert an RFC 9457 problem document with this status and code, and return its body."""
    assert response.status_code == status, response.text
    assert response.headers["content-type"] == PROBLEM_JSON
    body: Json = response.json()
    assert (body["status"], body["code"]) == (status, code)
    assert body["type"] == "/problems/" + code.lower().replace("_", "-")
    assert body["requestId"] == response.headers["x-request-id"]
    assert set(body) >= PROBLEM_KEYS
    return body


def use_settings(client: TestClient, **changes: Any) -> None:
    """Run the client's app with some settings changed from here on (e.g. enable_dev_tools=False)."""
    app = client.app
    assert isinstance(app, FastAPI)
    changed: Settings = app.dependency_overrides[get_settings]().model_copy(update=changes)
    app.dependency_overrides[get_settings] = lambda: changed


# ---- reading the course ----


def load_exercises(engine: Engine, exercise_ids: Iterable[int]) -> dict[int, Exercise]:
    """The exercises with their options, answers and pairs, readable after their session is closed."""
    with Session(engine) as db:
        rows = db.scalars(
            select(Exercise).where(Exercise.id.in_(set(exercise_ids))).options(*EXERCISE_CHILDREN)
        )
        return {exercise.id: exercise for exercise in rows}


def answer_for(exercise: Exercise, *, correct: bool = True) -> Json:
    """A right (or a plainly wrong) answer payload for the exercise."""
    match exercise.type:
        case ExerciseType.MULTIPLE_CHOICE | ExerciseType.FILL_BLANK:
            option = next(option for option in exercise.options if option.is_correct == correct)
            return {"type": exercise.type.value, "optionId": option.id}
        case ExerciseType.TRANSLATE | ExerciseType.TYPE_ANSWER:
            text = exercise.answers[0].text if correct else "zzz"  # the primary answer comes first
            return {"type": exercise.type.value, "text": text}
        case ExerciseType.MATCH_PAIRS:
            lefts = [pair.id for pair in exercise.pairs]
            rights = lefts if correct else lefts[1:] + lefts[:1]  # wrong: every pair crossed
            pairs = [{"leftId": left, "rightId": right} for left, right in zip(lefts, rights, strict=True)]
            return {"type": "match_pairs", "pairs": pairs, "mistakes": 0}


def path_nodes(client: TestClient, *, headers: Headers = None) -> dict[tuple[int, int], Json]:
    """Every node of the learner's path, keyed by (unit number, position)."""
    path = client.get(f"{API}/me/path", headers=headers).json()
    return {(unit["number"], node["position"]): node for unit in path["units"] for node in unit["nodes"]}


def node_at(client: TestClient, unit: int, position: int, *, headers: Headers = None) -> int:
    """The id of the node at this place of the path ("Drinks" is unit 2, position 2)."""
    found: int = path_nodes(client, headers=headers)[(unit, position)]["id"]
    return found


# ---- the lesson loop ----


def start_session(client: TestClient, start: Json, *, headers: Headers = None) -> Json:
    """Start (or resume) a session and return it."""
    response = client.post(f"{API}/sessions", json=start, headers=headers)
    assert response.status_code in (200, 201), response.text
    session: Json = response.json()
    return session


def submit(
    client: TestClient, session_id: int, item_id: int, payload: Json, *, headers: Headers = None
) -> httpx2.Response:
    """PUT an answer to one item of a session."""
    return client.put(f"{API}/sessions/{session_id}/items/{item_id}/answer", json=payload, headers=headers)


def answer_items(
    client: TestClient,
    engine: Engine,
    session: Json,
    *,
    wrong: Collection[int] = (),
    limit: int | None = None,
    headers: Headers = None,
) -> list[Json]:
    """Answer the session's queue in order, retries included, and return every answer's result.

    Initial items whose seq is in `wrong` are answered wrongly first; every other item is answered
    right. It stops when nothing is left to answer, the session ends, or after `limit` answers.
    """
    items = {item["id"]: item for item in session["items"]}
    exercises = load_exercises(engine, (item["exercise"]["id"] for item in items.values()))
    results: list[Json] = []
    current = session["currentItemId"]
    while current is not None and (limit is None or len(results) < limit):
        item = items[current]
        miss = item["origin"] == "initial" and item["seq"] in wrong
        payload = answer_for(exercises[item["exercise"]["id"]], correct=not miss)
        response = submit(client, session["id"], current, payload, headers=headers)
        assert response.status_code == 200, response.text
        result: Json = response.json()
        results.append(result)
        if result["appendedItem"] is not None:  # a retry of an exercise already in the queue
            items[result["appendedItem"]["id"]] = result["appendedItem"]
        if result["session"]["status"] != "active":
            break
        current = result["session"]["currentItemId"]
    return results


def complete(client: TestClient, session_id: int, *, headers: Headers = None) -> Json:
    """Complete a session and return its receipt."""
    response = client.post(f"{API}/sessions/{session_id}/complete", headers=headers)
    assert response.status_code == 200, response.text
    receipt: Json = response.json()
    return receipt


def play_session(
    client: TestClient,
    engine: Engine,
    start: Json,
    *,
    wrong: Collection[int] = (),
    headers: Headers = None,
) -> Json:
    """Start (or resume) a session, answer every item, complete it and return the receipt.

    Initial items whose seq is in `wrong` are answered wrongly first; every other item, retries
    included, is answered right.
    """
    session = start_session(client, start, headers=headers)
    answer_items(client, engine, session, wrong=wrong, headers=headers)
    return complete(client, session["id"], headers=headers)


def play_lesson(
    client: TestClient,
    engine: Engine,
    node_id: int,
    *,
    wrong: Collection[int] = (),
    headers: Headers = None,
) -> Json:
    """Play the node's next lesson to completion (see `play_session`) and return the receipt."""
    return play_session(client, engine, {"kind": "lesson", "nodeId": node_id}, wrong=wrong, headers=headers)


# ---- the shop and the demo tools ----


def buy(
    client: TestClient, item_code: str, *, key: str | None = None, headers: Headers = None
) -> httpx2.Response:
    """POST a purchase with an Idempotency-Key (a fresh one unless given)."""
    return client.post(
        f"{API}/me/purchases",
        json={"itemCode": item_code},
        headers={"Idempotency-Key": key or str(uuid4()), **(headers or {})},
    )


def set_learner(client: TestClient, *, headers: Headers = None, **values: int) -> Json:
    """Set the learner's hearts and/or gems with the demo tools; returns the new `me`."""
    response = client.patch(f"{API}/dev/learner", json=values, headers=headers)
    assert response.status_code == 200, response.text
    me: Json = response.json()
    return me


def get_me(client: TestClient, *, headers: Headers = None) -> Json:
    """GET /me: the learner's whole state."""
    response = client.get(f"{API}/me", headers=headers)
    assert response.status_code == 200, response.text
    body: Json = response.json()
    return body
