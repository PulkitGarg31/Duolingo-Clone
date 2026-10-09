"""Accounts and guests: sign up, log in, log out, start a private demo, and the bearer token that
identifies a request.

A token is issued at signup, at login and to a new guest, and is valid for 30 days of real time,
until its owner logs out. Only its sha256 is stored. Auth instants are real time, never a learner's
simulated clock: the demo tools' time travel must not sign anyone out.

A guest is a visitor's private copy of the demo: a user without credentials that starts with the
seeded learner's sample history. It can't log in again once its token is gone, and signing up
creates a separate, fresh account. At most MAX_GUESTS are kept: starting one more deletes the oldest.
"""

import re
import secrets
from datetime import datetime
from typing import Final

from sqlalchemy.orm import Session

from app.core import security
from app.core.config import Settings
from app.core.errors import EmailTaken, InvalidCredentials, Unauthenticated
from app.domain.rules import AVATAR_COLORS, MAX_GUESTS
from app.models import AuthSession, User
from app.repositories import auth_repo, content_repo, user_repo
from app.schemas.auth import AuthOut, DemoIn, LoginIn, SignupIn
from app.seed.sample_learner import checked_bundle, start_guest, start_new_account
from app.services import me_service

MAX_USERNAME_LENGTH: Final = 32  # users.username is VARCHAR(32)
FALLBACK_USERNAME: Final = "learner"  # for an email whose local part keeps no usable character
_NOT_USERNAME_CHARACTERS: Final = re.compile(r"[^a-z0-9_]")
GUEST_USERNAME_PREFIX: Final = "guest_"
GUEST_USERNAME_HEX_BYTES: Final = 5  # 10 lowercase hex digits: "guest_3f9a1c07be"


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
    user = User(
        username=_unique_username(db, body.email),
        display_name=body.display_name,
        avatar_color=secrets.choice(AVATAR_COLORS),
        timezone=body.timezone or settings.seed_timezone,
        timezone_confirmed=body.timezone is not None,
        current_course_id=_first_course_id(db),
        joined_at=now,
        email=body.email,
        password_hash=security.hash_password(body.password),
        clock_offset_seconds=0,
    )
    db.add(user)
    db.flush()  # the account's first rows need its id
    start_new_account(db, user.id, now)
    return _sign_in(db, user, now, settings)


def start_demo(db: Session, body: DemoIn, now: datetime, settings: Settings) -> AuthOut:
    """Create a guest, a private copy of the demo, and sign it in.

    The guest looks like the seeded learner (name and avatar colour from the sample learner's seed
    entry) and gets the same sample history, relative to `now` in its own zone: the device's when one
    is sent (and that zone counts as adopted), else the server's seed zone until the app adopts the
    device's. The guest's own league cohorts draw their own bots, so only its standing can differ.
    The oldest guests beyond MAX_GUESTS are then deleted, with every row of theirs.
    """
    bundle = checked_bundle(db, settings)
    seed_entry = bundle.users.learner
    guest = User(
        username=_guest_username(db),
        display_name=seed_entry.display_name,
        avatar_color=seed_entry.avatar_color,
        timezone=body.timezone or settings.seed_timezone,
        timezone_confirmed=body.timezone is not None,
        current_course_id=_first_course_id(db),
        joined_at=now,  # replaced by the sample history's join date
        clock_offset_seconds=0,
        is_guest=True,
    )
    db.add(guest)
    db.flush()  # the guest's history needs its id
    start_guest(db, guest.id, bundle.sample_learner, now=now, tz=guest.timezone)
    user_repo.delete_users(db, user_repo.guest_ids_beyond(db, MAX_GUESTS))
    return _sign_in(db, guest, now, settings)


def login(db: Session, body: LoginIn, now: datetime, settings: Settings) -> AuthOut:
    """Exchange an email and password for a new token.

    An unknown email and a wrong password get the same INVALID_CREDENTIALS, after the same amount of
    hashing work, so neither the answer nor its timing tells whether an account exists. Guests have
    no email, so no login ever reaches one.
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


def _first_course_id(db: Session) -> int:
    """The course every new learner starts on: the first published one."""
    course_id = content_repo.first_published_course_id(db)
    if course_id is None:  # the seed always publishes one course
        raise RuntimeError("there is no published course to start a new learner on")
    return course_id


def _guest_username(db: Session) -> str:
    """A fresh guest username: "guest_" and 10 random lowercase hex digits, drawn again on the rare
    collision."""
    while True:
        candidate = GUEST_USERNAME_PREFIX + secrets.token_hex(GUEST_USERNAME_HEX_BYTES)
        if user_repo.get_by_username(db, candidate) is None:
            return candidate


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
