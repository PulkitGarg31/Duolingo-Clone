"""Password hashing and session tokens, with the standard library only.

Passwords are hashed with scrypt, a memory-hard function, so a leaked table is slow to brute-force.
Each hash carries its own parameters and salt (`scrypt$16384$8$1$<salt>$<hash>`, base64), so the
cost can be raised later without breaking stored hashes. Session tokens are random and only their
sha256 is stored: a database dump holds no usable token.
"""

import base64
import hashlib
import hmac
import secrets
from datetime import timedelta
from functools import cache
from typing import Final

SESSION_LIFETIME: Final = timedelta(days=30)

_SCHEME: Final = "scrypt"
_N: Final = 2**14  # CPU and memory cost: about 16 MiB per hash
_R: Final = 8
_P: Final = 1
_SALT_BYTES: Final = 16
_HASH_BYTES: Final = 64
# Above the default 32 MiB cap, so a stored hash with a raised cost can still be checked.
_MAX_MEMORY: Final = 64 * 1024 * 1024


def hash_password(password: str) -> str:
    """The password's scrypt hash with a fresh random salt, in the self-describing stored form."""
    salt = secrets.token_bytes(_SALT_BYTES)
    digest = _scrypt(password, salt, n=_N, r=_R, p=_P)
    return "$".join((_SCHEME, str(_N), str(_R), str(_P), _b64(salt), _b64(digest)))


def verify_password(password: str, stored: str) -> bool:
    """Whether `password` matches the stored hash. The comparison takes the same time whatever the
    hash holds, and a stored value in an unknown format simply never matches."""
    parts = stored.split("$")
    if len(parts) != 6 or parts[0] != _SCHEME or not all(part.isdigit() for part in parts[1:4]):
        return False
    n, r, p = (int(part) for part in parts[1:4])
    try:
        salt, expected = base64.b64decode(parts[4], validate=True), base64.b64decode(parts[5], validate=True)
        actual = _scrypt(password, salt, n=n, r=r, p=p, length=len(expected))
    except ValueError:  # bad base64, or parameters scrypt refuses
        return False
    return hmac.compare_digest(actual, expected)


@cache
def unused_password_hash() -> str:
    """A hash no password the caller knows will match. Checking a login against it when the email is
    unknown makes that answer take as long as a wrong password, so timing can't reveal accounts."""
    return hash_password(secrets.token_urlsafe(32))


def new_token() -> str:
    """A fresh session token: 32 random bytes, URL-safe (43 characters)."""
    return secrets.token_urlsafe(32)


def token_digest(token: str) -> str:
    """The sha256 of a token in hex (64 characters): the only form of it the database keeps."""
    return hashlib.sha256(token.encode()).hexdigest()


def _scrypt(password: str, salt: bytes, *, n: int, r: int, p: int, length: int = _HASH_BYTES) -> bytes:
    return hashlib.scrypt(password.encode(), salt=salt, n=n, r=r, p=p, maxmem=_MAX_MEMORY, dklen=length)


def _b64(raw: bytes) -> str:
    return base64.b64encode(raw).decode("ascii")
