"""Accounts: sign up, log in, log out, and the bearer token that identifies a request.

A token is issued at signup and at login and is valid for 30 days of real time, until its owner
logs out. Only its sha256 is stored. Auth instants are real time, never a learner's simulated clock:
the demo tools' time travel must not sign anyone out.
"""

import re
import secrets
from datetime import datetime
from typing import Final

from sqlalchemy.orm import Session

from app.core import security
from app.core.config import Settings
from app.core.errors import EmailTaken, InvalidCredentials, Unauthenticated
from app.domain.rules import AVATAR_COLORS
from app.models import AuthSession, User
from app.repositories import auth_repo, content_repo, user_repo
from app.schemas.auth import AuthOut, LoginIn, SignupIn
from app.seed.sample_learner import start_new_account
from app.services import me_service

MAX_USERNAME_LENGTH: Final = 32  # users.username is VARCHAR(32)
FALLBACK_USERNAME: Final = "learner"  # for an email whose local part keeps no usable character
_NOT_USERNAME_CHARACTERS: Final = re.compile(r"[^a-z0-9_]")


def signup(db: Session, body: SignupIn, now: datetime, settings: Settings) -> AuthOut:
    """Create an account and sign it in.

    It starts like any new learner: on the published course with nothing done, 5 hearts, the opening
    gems, no streak, Bronze, and its clock on real time. Its days follow the device's time zone when
    one is sent (and that zone counts as adopted), else the server's seed zone until the app adopts
    the device's. A taken email is refused with EMAIL_TAKEN; writes are serialized, so two signups
    with one email can't both get past the check.
    """
    if auth_repo.email_taken(db, body.email):
        raise EmailTaken()
    course_id = content_repo.first_published_course_id(db)
    if course_id is None:  # the seed always publishes one course
        raise RuntimeError("there is no published course to start a new account on")
    user = User(
        username=_unique_username(db, body.email),
        display_name=body.display_name,
        avatar_color=secrets.choice(AVATAR_COLORS),
        timezone=body.timezone or settings.seed_timezone,
        timezone_confirmed=body.timezone is not None,
        current_course_id=course_id,
        joined_at=now,
        email=body.email,
        password_hash=security.hash_password(body.password),
        clock_offset_seconds=0,
    )
    db.add(user)
    db.flush()  # the account's first rows need its id
    start_new_account(db, user.id, now)
    return _sign_in(db, user, now, settings)


def login(db: Session, body: LoginIn, now: datetime, settings: Settings) -> AuthOut:
    """Exchange an email and password for a new token.

    An unknown email and a wrong password get the same INVALID_CREDENTIALS, after the same amount of
    hashing work, so neither the answer nor its timing tells whether an account exists.
    """
    user = auth_repo.account_by_email(db, body.email)
    # An unknown email is checked against a hash nothing matches, so it takes as long as a wrong password.
    stored = user.password_hash if user is not None else None
    matches = security.verify_password(body.password, stored or security.unused_password_hash())
    if user is None or not matches:
        raise InvalidCredentials()
    return _sign_in(db, user, now, settings)


def logout(db: Session, token: str | None, now: datetime) -> None:
    """Revoke the token. Logging out twice, or with a token that is expired or was never valid,
    changes nothing and is not an error: either way the token no longer works."""
    if not token:
        return
    session = auth_repo.unrevoked_session(db, security.token_digest(token))
    if session is not None:
        session.revoked_at = now


def account_for_token(db: Session, token: str | None, now: datetime) -> User:
    """The account a bearer token belongs to. A missing, unknown, expired or revoked token is
    UNAUTHENTICATED, which tells the client to drop it."""
    if not token:
        raise Unauthenticated()
    session = auth_repo.live_session(db, security.token_digest(token), now)
    if session is None:
        raise Unauthenticated()
    return session.user


def _sign_in(db: Session, user: User, now: datetime, settings: Settings) -> AuthOut:
    """Issue a new token for the account. Only its digest is stored; the token itself is shown once."""
    token = security.new_token()
    expires_at = now + security.SESSION_LIFETIME
    db.add(
        AuthSession(
            user_id=user.id,
            token_hash=security.token_digest(token),
            created_at=now,
            expires_at=expires_at,
        )
    )
    return AuthOut(token=token, expires_at=expires_at, user=me_service.me_user(user, settings))


def _unique_username(db: Session, email: str) -> str:
    """A username from the email's local part: lowercase letters, digits and underscores, at most 32
    characters, with the smallest numeric suffix (from 2) that makes it unique."""
    base = _NOT_USERNAME_CHARACTERS.sub("", email.partition("@")[0].lower())[:MAX_USERNAME_LENGTH]
    base = base or FALLBACK_USERNAME
    candidate, suffix = base, 1
    while user_repo.get_by_username(db, candidate) is not None:
        suffix += 1
        candidate = base[: MAX_USERNAME_LENGTH - len(str(suffix))] + str(suffix)
    return candidate
