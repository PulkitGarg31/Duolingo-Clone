"""Accounts: sign up, log in, log out, and who a request acts as.

A request with a bearer token acts as that account; one without acts as the shared demo learner,
exactly as before accounts existed. An unknown, expired or revoked token is a 401 UNAUTHENTICATED,
never a quiet fall back to the demo learner. Tokens live for 30 days of real time.
"""

import hashlib

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine, select
from sqlalchemy.orm import Session

from app.core.clock import FrozenClock
from app.core.security import verify_password
from app.domain.enums import GemReason
from app.models import AuthSession, GemTransaction, User
from tests.conftest import TEST_ORIGIN
from tests.helpers import API, Json, as_user, assert_problem, bearer, get_me, signup

PASSWORD = "correct horse battery"


def login(client: TestClient, email: str, password: str = PASSWORD) -> Json:
    response = client.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    body: Json = response.json()
    return body


def account_row(engine: Engine, email: str) -> User:
    with Session(engine) as db:
        return db.scalars(select(User).where(User.email == email)).one()


# ---- signing up ----


def test_a_signup_creates_an_account_whose_token_works(client: TestClient) -> None:
    response = client.post(
        f"{API}/auth/signup",
        json={
            "displayName": "Ana",
            "email": "ana@example.com",
            "password": PASSWORD,
            "timezone": "Europe/Madrid",
        },
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["expiresAt"] == "2026-11-07T12:00:00Z"  # 30 days of real time
    user = body["user"]
    assert (user["username"], user["displayName"], user["email"], user["isDemo"]) == (
        "ana",
        "Ana",
        "ana@example.com",
        False,
    )
    assert (user["timezone"], user["timezoneConfirmed"], user["joinedAt"]) == (
        "Europe/Madrid",
        True,
        "2026-10-08T12:00:00Z",
    )
    assert "x-server-time" not in response.headers  # signing up acts as no learner yet

    me = get_me(client, headers=bearer(body["token"]))
    assert me["user"] == user
    assert me["dev"] == {"enabled": True, "clockOffsetSeconds": 0}


def test_a_new_account_starts_at_unit_one_with_five_hearts_and_500_gems(
    client: TestClient, seeded_engine: Engine
) -> None:
    token = signup(client, "ana@example.com")["token"]
    me = get_me(client, headers=bearer(token))
    assert (me["xp"], me["gems"], me["hearts"]["current"], me["hearts"]["nextHeartAt"]) == (
        {"total": 0, "today": 0, "thisWeek": 0},
        500,
        5,
        None,
    )
    streak = me["streak"]
    assert (streak["current"], streak["longest"], streak["status"], streak["freezesEquipped"]) == (
        0,
        0,
        "inactive",
        0,
    )
    league = me["league"]
    assert (league["tier"], league["name"], league["unlocked"], league["lessonsToUnlock"]) == (
        1,
        "Bronze",
        False,
        10,
    )
    assert (me["course"]["slug"], me["activeSession"], me["pendingLeagueResult"]) == ("es-en", None, None)
    assert me["dailyGoal"] == {"goalXp": 20, "earnedXp": 0, "met": False}

    path = client.get(f"{API}/me/path", headers=bearer(token)).json()
    states = [node["state"] for unit in path["units"] for node in unit["nodes"]]
    first = path["units"][0]["nodes"][0]
    assert (path["currentNodeId"], first["state"], first["lessonsCompleted"]) == (first["id"], "active", 0)
    assert states[1:] == ["locked"] * (len(states) - 1)
    with Session(seeded_engine) as db:
        user_id = me["user"]["id"]
        ledger = db.execute(
            select(GemTransaction.reason, GemTransaction.delta, GemTransaction.balance_after).where(
                GemTransaction.user_id == user_id
            )
        ).all()
    assert [tuple(row) for row in ledger] == [(GemReason.SEED, 500, 500)]


def test_without_a_time_zone_the_account_waits_in_the_seed_zone(client: TestClient) -> None:
    user = signup(client, "ana@example.com", timezone=None)["user"]
    assert (user["timezone"], user["timezoneConfirmed"]) == ("Asia/Kolkata", False)  # adopted on first visit


def test_an_old_zone_name_is_stored_under_its_current_name(client: TestClient) -> None:
    assert signup(client, "ana@example.com", timezone="Asia/Calcutta")["user"]["timezone"] == "Asia/Kolkata"


def test_a_taken_email_is_a_409(client: TestClient) -> None:
    signup(client, "ana@example.com")
    response = client.post(
        f"{API}/auth/signup",
        json={"displayName": "Other Ana", "email": "ana@example.com", "password": PASSWORD},
    )
    assert_problem(response, 409, "EMAIL_TAKEN")


def test_the_email_is_trimmed_and_case_insensitive(client: TestClient, seeded_engine: Engine) -> None:
    user = signup(client, "  Ana.Lopez@Example.COM ")["user"]
    assert user["email"] == "ana.lopez@example.com"
    assert account_row(seeded_engine, "ana.lopez@example.com").email == "ana.lopez@example.com"
    again = client.post(
        f"{API}/auth/signup",
        json={"displayName": "Ana", "email": "ANA.LOPEZ@example.com", "password": PASSWORD},
    )
    assert_problem(again, 409, "EMAIL_TAKEN")
    assert login(client, "ANA.Lopez@EXAMPLE.com")["user"]["id"] == user["id"]


@pytest.mark.parametrize(
    ("changes", "field"),
    [
        pytest.param({"displayName": ""}, "body.displayName", id="empty-name"),
        pytest.param({"displayName": "   "}, "body.displayName", id="blank-name"),
        pytest.param({"displayName": "x" * 41}, "body.displayName", id="long-name"),
        pytest.param({"email": "ana.example.com"}, "body.email", id="no-at"),
        pytest.param({"email": "ana@example"}, "body.email", id="no-dot-in-domain"),
        pytest.param({"email": "ana@@example.com"}, "body.email", id="two-ats"),
        pytest.param({"email": "@example.com"}, "body.email", id="no-local-part"),
        pytest.param({"email": "ana@example.com."}, "body.email", id="dot-ends-domain"),
        pytest.param({"email": "ana maria@example.com"}, "body.email", id="space"),
        pytest.param({"email": "a" * 243 + "@example.com"}, "body.email", id="255-characters"),
        pytest.param({"password": "seven77"}, "body.password", id="short-password"),
        pytest.param({"password": "x" * 129}, "body.password", id="long-password"),
        pytest.param({"timezone": "Mars/Olympus_Mons"}, "body.timezone", id="unknown-zone"),
        pytest.param({"username": "ana"}, "body.username", id="unknown-field"),
    ],
)
def test_an_invalid_signup_is_a_422_naming_the_field(
    client: TestClient, seeded_engine: Engine, changes: Json, field: str
) -> None:
    body = {"displayName": "Ana", "email": "ana@example.com", "password": PASSWORD} | changes
    problem = assert_problem(client.post(f"{API}/auth/signup", json=body), 422, "VALIDATION_ERROR")
    assert [error["field"] for error in problem["errors"]] == [field]
    with Session(seeded_engine) as db:
        assert db.scalar(select(User.id).where(User.email.is_not(None))) is None  # nothing was created


@pytest.mark.parametrize("missing", ["displayName", "email", "password"])
def test_a_signup_needs_a_name_an_email_and_a_password(client: TestClient, missing: str) -> None:
    body = {"displayName": "Ana", "email": "ana@example.com", "password": PASSWORD}
    del body[missing]
    problem = assert_problem(client.post(f"{API}/auth/signup", json=body), 422, "VALIDATION_ERROR")
    assert problem["errors"][0]["field"] == f"body.{missing}"


def test_the_longest_name_and_password_are_accepted(client: TestClient) -> None:
    user = signup(client, "ana@example.com", display_name="x" * 40, password="p" * 128)["user"]
    assert user["displayName"] == "x" * 40
    assert login(client, "ana@example.com", "p" * 128)["user"]["id"] == user["id"]


@pytest.mark.parametrize(
    ("email", "username"),
    [
        ("alex@example.com", "alex2"),  # the demo learner already has "alex"
        ("Ana.María-López+duo@example.com", "anamaralpezduo"),
        ("+++@example.com", "learner"),
        ("snake_case_name@example.com", "snake_case_name"),
        ("x" * 40 + "@example.com", "x" * 32),
    ],
)
def test_the_username_comes_from_the_email(client: TestClient, email: str, username: str) -> None:
    assert signup(client, email)["user"]["username"] == username


def test_usernames_are_made_unique_with_a_number(client: TestClient) -> None:
    names = [signup(client, f"ana@{domain}.com")["user"]["username"] for domain in ("one", "two", "three")]
    assert names == ["ana", "ana2", "ana3"]


# ---- the stored credentials ----


def test_the_password_is_stored_hashed_never_in_plain_text(client: TestClient, seeded_engine: Engine) -> None:
    token = signup(client, "ana@example.com")["token"]
    row = account_row(seeded_engine, "ana@example.com")
    assert row.password_hash is not None
    assert PASSWORD not in row.password_hash
    scheme, n, r, p, salt, digest = row.password_hash.split("$")
    assert (scheme, n, r, p) == ("scrypt", "16384", "8", "1")
    assert salt and digest
    assert verify_password(PASSWORD, row.password_hash)
    with Session(seeded_engine) as db:
        stored = db.scalars(select(AuthSession.token_hash).where(AuthSession.user_id == row.id)).one()
    assert stored == hashlib.sha256(token.encode()).hexdigest() != token  # only the token's digest is kept


def test_two_accounts_with_one_password_get_different_hashes(
    client: TestClient, seeded_engine: Engine
) -> None:
    signup(client, "ana@example.com")
    signup(client, "bea@example.com")
    first, second = (
        account_row(seeded_engine, "ana@example.com"),
        account_row(seeded_engine, "bea@example.com"),
    )
    assert first.password_hash != second.password_hash  # each hash has its own salt


# ---- logging in ----


def test_login_issues_a_new_token_alongside_the_first(client: TestClient) -> None:
    signed_up = signup(client, "ana@example.com")
    logged_in = login(client, "ana@example.com")
    assert logged_in["user"] == signed_up["user"]
    assert logged_in["token"] != signed_up["token"]
    assert logged_in["expiresAt"] == "2026-11-07T12:00:00Z"
    for token in (signed_up["token"], logged_in["token"]):  # a second device doesn't sign out the first
        assert get_me(client, headers=bearer(token))["user"]["email"] == "ana@example.com"


def test_a_wrong_password_and_an_unknown_email_get_the_same_401(client: TestClient) -> None:
    signup(client, "ana@example.com")
    wrong_password = client.post(
        f"{API}/auth/login", json={"email": "ana@example.com", "password": "nope-nope"}
    )
    unknown_email = client.post(f"{API}/auth/login", json={"email": "bea@example.com", "password": PASSWORD})
    bodies = [
        assert_problem(response, 401, "INVALID_CREDENTIALS") for response in (wrong_password, unknown_email)
    ]
    first, second = ({key: value for key, value in body.items() if key != "requestId"} for body in bodies)
    assert first == second  # nothing tells the two apart
    assert wrong_password.headers["www-authenticate"] == unknown_email.headers["www-authenticate"] == "Bearer"


@pytest.mark.parametrize(
    "body",
    [
        pytest.param({"email": "ana@example.com"}, id="no-password"),
        pytest.param({"password": PASSWORD}, id="no-email"),
        pytest.param({"email": "ana@example.com", "password": ""}, id="empty-password"),
        pytest.param({"email": "not-an-email", "password": PASSWORD}, id="bad-email"),
        pytest.param({"email": "ana@example.com", "password": "x" * 129}, id="long-password"),
    ],
)
def test_an_invalid_login_is_a_422(client: TestClient, body: Json) -> None:
    assert_problem(client.post(f"{API}/auth/login", json=body), 422, "VALIDATION_ERROR")


# ---- logging out and token lifetime ----


def test_logout_revokes_the_token(client: TestClient) -> None:
    token = signup(client, "ana@example.com")["token"]
    response = client.post(f"{API}/auth/logout", headers=bearer(token))
    assert response.status_code == 200
    assert response.json() == {"loggedOut": True}
    problem = assert_problem(client.get(f"{API}/me", headers=bearer(token)), 401, "UNAUTHENTICATED")
    assert problem["instance"] == f"{API}/me"
    # Logging out again, or with no token at all, is still a success: the client is signed out either way.
    assert client.post(f"{API}/auth/logout", headers=bearer(token)).json() == {"loggedOut": True}
    assert client.post(f"{API}/auth/logout").json() == {"loggedOut": True}
    assert client.post(f"{API}/auth/logout", headers=bearer("never-issued")).status_code == 200


def test_logout_revokes_only_its_own_token(client: TestClient) -> None:
    first = signup(client, "ana@example.com")["token"]
    second = login(client, "ana@example.com")["token"]
    client.post(f"{API}/auth/logout", headers=bearer(first))
    assert get_me(client, headers=bearer(second))["user"]["email"] == "ana@example.com"


def test_a_token_expires_after_thirty_days_of_real_time(client: TestClient, clock: FrozenClock) -> None:
    token = signup(client, "ana@example.com")["token"]
    clock.advance(days=30)  # exactly at the expiry instant: no longer valid
    assert_problem(client.get(f"{API}/me", headers=bearer(token)), 401, "UNAUTHENTICATED")


def test_a_token_is_valid_until_just_before_it_expires(client: TestClient, clock: FrozenClock) -> None:
    token = signup(client, "ana@example.com")["token"]
    clock.advance(days=29, hours=23, minutes=59, seconds=59)
    assert get_me(client, headers=bearer(token))["user"]["email"] == "ana@example.com"


def test_time_travel_never_signs_anyone_out(client: TestClient) -> None:
    token = signup(client, "ana@example.com")["token"]
    for _ in range(2):  # 120 simulated days, far past the token's 30 real days
        response = client.post(f"{API}/dev/clock/advance", json={"days": 60}, headers=bearer(token))
        assert response.status_code == 200, response.text
    me = get_me(client, headers=bearer(token))
    assert (me["serverNow"], me["dev"]["clockOffsetSeconds"]) == ("2027-02-05T12:00:00Z", 120 * 86_400)


# ---- who a request acts as ----


def test_without_a_token_requests_act_as_the_demo_learner(client: TestClient) -> None:
    signup(client, "ana@example.com")
    user = get_me(client)["user"]
    assert (user["username"], user["email"], user["isDemo"]) == ("alex", None, True)


@pytest.mark.parametrize(
    "authorization",
    [
        pytest.param("Bearer not-a-token", id="unknown"),
        pytest.param("Bearer ", id="empty"),
        pytest.param("Basic YWxleDpzZWNyZXQ=", id="other-scheme"),
        pytest.param("ana@example.com", id="no-scheme"),
    ],
)
def test_an_unusable_authorization_header_is_a_401_not_the_demo(
    client: TestClient, authorization: str
) -> None:
    response = client.get(f"{API}/me", headers={"Authorization": authorization})
    assert_problem(response, 401, "UNAUTHENTICATED")
    assert response.headers["www-authenticate"] == "Bearer"
    assert "x-server-time" not in response.headers  # no learner was resolved


def test_a_token_wins_over_the_user_header(client: TestClient, learner2: int) -> None:
    token = signup(client, "ana@example.com")["token"]
    me = get_me(client, headers={**bearer(token), **as_user(learner2)})
    assert me["user"]["email"] == "ana@example.com"


def test_health_needs_no_token_and_ignores_a_bad_one(client: TestClient) -> None:
    response = client.get(f"{API}/health", headers=bearer("not-a-token"))
    assert response.status_code == 200
    assert response.json()["seeded"] is True


def test_the_browser_may_send_the_authorization_header(client: TestClient) -> None:
    preflight = client.options(
        f"{API}/me",
        headers={
            "Origin": TEST_ORIGIN,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )
    assert preflight.status_code == 200
    assert "authorization" in preflight.headers["access-control-allow-headers"].lower()


def test_the_api_docs_describe_the_bearer_scheme(client: TestClient) -> None:
    schema = client.get(f"{API}/openapi.json").json()
    assert schema["components"]["securitySchemes"]["BearerToken"]["scheme"] == "bearer"
    assert "auth" in [tag["name"] for tag in schema["tags"]]
    assert set(schema["paths"][f"{API}/auth/signup"]["post"]["responses"]) >= {"201", "409", "422"}
