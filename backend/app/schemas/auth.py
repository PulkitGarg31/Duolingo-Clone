"""Accounts under /auth: sign up, log in, log out, and a guest's private demo."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import AfterValidator, Field, StringConstraints
from pydantic_core import PydanticCustomError

from app.schemas.base import ApiModel
from app.schemas.common import IanaTimezone
from app.schemas.me import MeUser

MIN_PASSWORD_LENGTH = 8
# Long enough for any passphrase, short enough that hashing one stays cheap.
MAX_PASSWORD_LENGTH = 128
MAX_EMAIL_LENGTH = 254  # the longest address SMTP can deliver to


def _plausible_email(value: str) -> str:
    """A simple shape check, not a full RFC 5322 parse: one "@", something before it, and a domain
    with a dot that neither starts nor ends it. Whether the address exists is never checked."""
    local, _, domain = value.partition("@")
    plausible = (
        value.count("@") == 1
        and local != ""
        and "." in domain
        and not domain.startswith(".")
        and not domain.endswith(".")
        and not any(character.isspace() for character in value)
    )
    if not plausible:
        raise PydanticCustomError("invalid_email", "Enter a valid email address")
    return value


# Trimmed and lowercased before it is checked, so " Ana@Example.com" and "ana@example.com" are one account.
Email = Annotated[
    str,
    StringConstraints(strip_whitespace=True, to_lower=True, min_length=1, max_length=MAX_EMAIL_LENGTH),
    AfterValidator(_plausible_email),
]
Password = Annotated[str, Field(min_length=MIN_PASSWORD_LENGTH, max_length=MAX_PASSWORD_LENGTH)]


class SignupIn(ApiModel):
    """A new account. The time zone is the device's; without one, days follow the server's seed zone
    until the app adopts the device's zone."""

    display_name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
    email: Email
    password: Password
    timezone: IanaTimezone | None = None


class LoginIn(ApiModel):
    """An email and password to exchange for a token. Any password length is accepted here: a wrong
    one is simply wrong, whatever rules applied when it was chosen."""

    email: Email
    password: Annotated[str, Field(min_length=1, max_length=MAX_PASSWORD_LENGTH)]


class DemoIn(ApiModel):
    """A private copy of the demo. The time zone is the device's; without one, days follow the
    server's seed zone until the app adopts the device's zone."""

    timezone: IanaTimezone | None = None


class AuthOut(ApiModel):
    """A signed-in session (an account's or a guest's): send the token as
    `Authorization: Bearer <token>` until it expires."""

    token: str
    expires_at: datetime
    user: MeUser


class LogoutOut(ApiModel):
    """The token no longer works (or never did)."""

    logged_out: Literal[True] = True
