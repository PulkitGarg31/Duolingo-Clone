"""A tour of all 30 endpoints on the seeded demo: every answer, nested objects included, has the
recorded contract shape, and every instant in it is written in UTC with a "Z".
"""

import json
import re
from dataclasses import dataclass, field
from typing import Any

from fastapi.testclient import TestClient
from sqlalchemy import Engine

from app.api.v1.router import API_V1_PREFIX
from app.core.clock import FrozenClock
from tests.api.contract_keys import (
    CONTRACT_KEYS,
    DISCRIMINATED_UNIONS,
    ENDPOINTS,
    ME_EXAMPLE,
    OBJECT_FIELDS,
    REQUEST_BODIES,
)
from tests.helpers import answer_for, load_exercises

# ---- every endpoint, end to end ----

# An ISO-8601 instant in UTC as the contract writes it: whole seconds, or milliseconds, then "Z".
UTC_INSTANT = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z")
LOOKS_LIKE_AN_INSTANT = re.compile(r"\d{4}-\d{2}-\d{2}T")
LOCAL_INSTANTS = frozenset({"localNow"})  # the only instant the contract writes with a UTC offset


def shape_problems(value: object, kind: str, where: str, seen: set[str]) -> list[str]:
    """How `value` differs from the contract type `kind` ("X", "X[]" or a union), nested objects
    included. Every object type met is added to `seen`."""
    if kind.endswith("[]"):
        if not isinstance(value, list):
            return [f"{where}: expected an array of {kind[:-2]}"]
        return [
            problem
            for index, item in enumerate(value)
            for problem in shape_problems(item, kind[:-2], f"{where}[{index}]", seen)
        ]
    if not isinstance(value, dict):
        return [f"{where}: expected a {kind} object"]
    if kind in DISCRIMINATED_UNIONS:
        member = DISCRIMINATED_UNIONS[kind].get(value.get("type"))
        if member is None:
            return [f"{where}: {value.get('type')!r} is not a type of {kind}"]
        kind = member
    seen.add(kind)
    problems = []
    keys, expected = set(value), CONTRACT_KEYS[kind]
    if keys != expected:
        problems.append(
            f"{where} ({kind}): missing {sorted(expected - keys)}, unexpected {sorted(keys - expected)}"
        )
    for name, child_kind in OBJECT_FIELDS.get(kind, {}).items():
        if value.get(name) is not None:
            problems += shape_problems(value[name], child_kind, f"{where}.{name}", seen)
    return problems


def instant_problems(value: object, where: str) -> list[str]:
    """Every instant in `value` that is not written in UTC with a "Z" (localNow excepted)."""
    if isinstance(value, list):
        return [
            problem
            for index, item in enumerate(value)
            for problem in instant_problems(item, f"{where}[{index}]")
        ]
    if not isinstance(value, dict):
        return []
    problems = []
    for name, item in value.items():
        if isinstance(item, str) and LOOKS_LIKE_AN_INSTANT.match(item):
            if name not in LOCAL_INSTANTS and not UTC_INSTANT.fullmatch(item):
                problems.append(f"{where}.{name}: {item!r} is not a UTC instant ending in Z")
        else:
            problems += instant_problems(item, f"{where}.{name}")
    return problems


def test_the_shape_check_names_every_difference() -> None:
    seen: set[str] = set()
    broken = json.loads(json.dumps(ME_EXAMPLE))
    del broken["gems"]
    broken["xp"]["week"] = broken["xp"].pop("thisWeek")
    broken["pendingLeagueResult"]["newLeague"]["icon"] = "silver"
    assert shape_problems(broken, "MeOut", "me", seen) == [
        "me (MeOut): missing ['gems'], unexpected []",
        "me.xp (MeXp): missing ['thisWeek'], unexpected ['week']",
        "me.pendingLeagueResult.newLeague (LeagueBrief): missing [], unexpected ['icon']",
    ]
    assert {"MeOut", "MeXp", "LeagueResultOut", "LeagueBrief", "DevInfo"} <= seen
    times = {"a": {"at": "2026-10-08T12:00:00+00:00"}, "localNow": "2026-10-08T17:30:00+05:30"}
    assert instant_problems(times, "x") == [
        "x.a.at: '2026-10-08T12:00:00+00:00' is not a UTC instant ending in Z"
    ]


@dataclass
class EndpointTour:
    """Calls endpoints by operation id and checks every answer against the contract, recording which
    operations were called and which object types their answers contained."""

    client: TestClient
    operations: set[str] = field(default_factory=set)
    types_seen: set[str] = field(default_factory=set)

    def call(
        self,
        operation: str,
        *,
        expect: int = 200,
        body: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        **path_params: object,
    ) -> dict[str, Any]:
        """Call one endpoint, assert its status, and check its answer's keys (nested) and instants."""
        method, path, answer_type = ENDPOINTS[operation]
        url = API_V1_PREFIX + path.format(**path_params)
        response = self.client.request(method, url, json=body, headers=headers)
        assert response.status_code == expect, f"{operation}: {response.status_code} {response.text}"
        assert response.headers["content-type"] == "application/json", operation
        answer: dict[str, Any] = response.json()
        problems = shape_problems(answer, answer_type, operation, self.types_seen)
        problems += instant_problems(answer, operation)
        assert problems == [], "\n".join(problems)
        self.operations.add(operation)
        return answer

    def play(
        self, engine: Engine, start: dict[str, Any], *, wrong: frozenset[int] = frozenset()
    ) -> dict[str, Any]:
        """Start a session, answer every item (initial items whose seq is in `wrong` wrongly first),
        then complete it; returns the receipt."""
        session = self.call("startSession", expect=201, body=start)
        items = {item["id"]: item for item in session["items"]}
        exercises = load_exercises(engine, (item["exercise"]["id"] for item in items.values()))
        current = session["currentItemId"]
        while current is not None:
            item = items[current]
            miss = item["origin"] == "initial" and item["seq"] in wrong
            payload = answer_for(exercises[item["exercise"]["id"]], correct=not miss)
            result = self.call("submitAnswer", body=payload, sessionId=session["id"], itemId=current)
            if result["appendedItem"] is not None:
                items[result["appendedItem"]["id"]] = result["appendedItem"]
            current = result["session"]["currentItemId"]
        return self.call("completeSession", sessionId=session["id"])


def tour_the_learners_pages(tour: EndpointTour) -> dict[str, Any]:
    """The shell, settings, history, path, quests, content, league and profiles; returns the path."""
    tour.call("getHealth")
    me = tour.call("getMe")  # last week's promotion is still to be shown
    tour.call("getSettings")
    tour.call("updateSettings", body={"soundEffects": False})
    tour.call("getActivity")
    path = tour.call("getPath")
    tour.call("getQuests")
    tour.call("listCourses")
    tour.call("getGuidebook", unitId=path["units"][0]["id"])
    league = tour.call("getLeague")  # this week's rows and last week's result
    tour.call("getProfile", userId="me")
    tour.call("getProfile", userId=next(row["userId"] for row in league["rows"] if not row["isMe"]))
    tour.call("ackLeagueResult", membershipId=me["pendingLeagueResult"]["membershipId"])
    return path


def tour_the_shop(tour: EndpointTour) -> None:
    tour.call("listShopItems")
    key = {"Idempotency-Key": "4c7e1a0e-8f63-4e8b-9d55-0b6a2f7c1d90"}
    bought = tour.call("createPurchase", expect=201, body={"itemCode": "heart_refill"}, headers=key)
    tour.call("getPurchase", purchaseId=bought["id"])


def tour_the_lesson_loop(
    tour: EndpointTour, engine: Engine, path: dict[str, Any], clock: FrozenClock
) -> None:
    """Lessons, a chest, a legendary run that is quit, and a timed run that runs out of time."""
    drinks, chest = path["units"][1]["nodes"][1]["id"], path["units"][1]["nodes"][2]["id"]
    lesson = tour.call("startSession", expect=201, body={"kind": "lesson", "nodeId": drinks})
    assert tour.call("getMe")["activeSession"] is not None
    tour.call("getSession", sessionId=lesson["id"])
    tour.call("quitSession", sessionId=lesson["id"])
    first = tour.play(engine, {"kind": "lesson", "nodeId": drinks}, wrong=frozenset({1}))  # with a retry
    assert first["achievementsUnlocked"] and first["league"] and first["node"]
    second = tour.play(engine, {"kind": "lesson", "nodeId": drinks})
    assert second["questsCompleted"]
    tour.call("claimChest", nodeId=chest)

    introduce_yourself = path["units"][0]["nodes"][1]["id"]
    legendary = tour.call(
        "startSession", expect=201, body={"kind": "legendary", "nodeId": introduce_yourself}
    )
    assert legendary["lives"] is not None
    tour.call("quitSession", sessionId=legendary["id"])
    timed = tour.call("startSession", expect=201, body={"kind": "timed"})
    assert timed["timer"] is not None
    clock.advance(seconds=31)
    assert tour.call("completeSession", sessionId=timed["id"])["timed"] is not None


def tour_the_dev_tools(tour: EndpointTour) -> None:
    tour.call("getDevClock")
    tour.call("advanceDevClock", body={"hours": 1})
    tour.call("devNextDay")
    assert tour.call("devNextWeek")["effects"]["leagueResults"]  # this week's league is finalized
    tour.call("patchDevLearner", body={"hearts": 3})
    tour.call("resetDemo")


def tour_the_accounts(tour: EndpointTour) -> None:
    """Sign up, log out and log back in; the new account's token works like any other."""
    credentials = {"email": "ana@example.com", "password": "correct horse battery"}
    signed_up = tour.call(
        "signup", expect=201, body={"displayName": "Ana", "timezone": "Europe/Madrid", **credentials}
    )
    bearer = {"Authorization": f"Bearer {signed_up['token']}"}
    assert tour.call("getMe", headers=bearer)["user"]["email"] == "ana@example.com"
    tour.call("logout", headers=bearer)
    tour.call("login", body=credentials)


def test_every_endpoint_answers_in_the_contract_shape(
    client: TestClient, clock: FrozenClock, seeded_engine: Engine
) -> None:
    tour = EndpointTour(client)
    path = tour_the_learners_pages(tour)
    tour_the_shop(tour)
    tour_the_lesson_loop(tour, seeded_engine, path, clock)
    tour_the_dev_tools(tour)
    tour_the_accounts(tour)

    assert tour.operations == set(ENDPOINTS)
    answer_types = set(CONTRACT_KEYS) - REQUEST_BODIES - {"CompletionReceipt", "ProblemDetails", "FieldError"}
    assert answer_types - tour.types_seen == set()  # every object type of every answer was met, filled in
