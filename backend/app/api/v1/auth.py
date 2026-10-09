"""Accounts: POST /auth/signup, /auth/login and /auth/logout.

None of them acts as a learner, so none syncs or sends X-Server-Time. Their instants (when a token
was issued, when it expires) are real time.
"""

from fastapi import APIRouter, status

from app.api.deps import BearerTokenDep, DbDep, RealClockDep, SettingsDep
from app.api.problems import problem_responses
from app.schemas.auth import AuthOut, LoginIn, LogoutOut, SignupIn
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post(
    "/signup",
    response_model=AuthOut,
    status_code=status.HTTP_201_CREATED,
    operation_id="signup",
    summary="Create an account",
    responses=problem_responses(409, 422),
)
def signup(body: SignupIn, db: DbDep, real_clock: RealClockDep, settings: SettingsDep) -> AuthOut:
    """Create an account that starts at the first lesson, and sign it in. A taken email is a 409."""
    signed_in = auth_service.signup(db, body, real_clock.now(), settings)
    db.commit()
    return signed_in


@router.post(
    "/login",
    response_model=AuthOut,
    operation_id="login",
    summary="Log in",
    responses=problem_responses(401, 422),
)
def login(body: LoginIn, db: DbDep, real_clock: RealClockDep, settings: SettingsDep) -> AuthOut:
    """Exchange an email and password for a new token. A wrong password and an unknown email get the
    same 401, so the answer never tells whether an account exists."""
    signed_in = auth_service.login(db, body, real_clock.now(), settings)
    db.commit()
    return signed_in


@router.post("/logout", response_model=LogoutOut, operation_id="logout", summary="Log out")
def logout(token: BearerTokenDep, db: DbDep, real_clock: RealClockDep) -> LogoutOut:
    """Revoke the request's bearer token. Always succeeds: without a valid token there is nothing to
    revoke, and the client is signed out either way."""
    auth_service.logout(db, token, real_clock.now())
    db.commit()
    return LogoutOut()
