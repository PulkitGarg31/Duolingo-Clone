"""Password hashes and session tokens: scrypt with a salt per hash, and tokens kept only as a digest."""

import hashlib

import pytest

from app.core.security import (
    hash_password,
    new_token,
    token_digest,
    unused_password_hash,
    verify_password,
)


def test_a_hash_verifies_its_own_password_only() -> None:
    stored = hash_password("correct horse battery")
    assert verify_password("correct horse battery", stored)
    assert not verify_password("correct horse batterY", stored)
    assert not verify_password("", stored)


def test_a_hash_names_its_parameters_and_never_holds_the_password() -> None:
    stored = hash_password("correct horse battery")
    scheme, n, r, p, salt, digest = stored.split("$")
    assert (scheme, n, r, p) == ("scrypt", "16384", "8", "1")
    assert len(salt) == 24 and len(digest) == 88  # base64 of 16 and 64 bytes
    assert "correct horse battery" not in stored
    assert len(stored) <= 255  # fits users.password_hash


def test_the_same_password_hashes_differently_each_time() -> None:
    assert hash_password("same password") != hash_password("same password")


@pytest.mark.parametrize(
    "stored",
    [
        "",
        "plain text password",
        "bcrypt$12$abc$def",
        "scrypt$16384$8$1$not base64!$aGFzaA==",
        "scrypt$x$8$1$c2FsdA==$aGFzaA==",
        "scrypt$16384$8$1$c2FsdA==",  # a part missing
        "scrypt$3$8$1$c2FsdA==$aGFzaA==",  # a cost scrypt refuses (not a power of two)
    ],
)
def test_a_malformed_stored_hash_never_matches(stored: str) -> None:
    assert not verify_password("anything", stored)


def test_the_unused_hash_matches_no_password_a_caller_could_know() -> None:
    assert unused_password_hash() == unused_password_hash()  # computed once
    assert not verify_password("", unused_password_hash())
    assert not verify_password("correct horse battery", unused_password_hash())


def test_tokens_are_random_and_stored_as_their_sha256() -> None:
    tokens = {new_token() for _ in range(100)}
    assert len(tokens) == 100
    token = tokens.pop()
    assert len(token) == 43  # 32 random bytes, URL-safe base64
    assert token_digest(token) == hashlib.sha256(token.encode()).hexdigest()
    assert len(token_digest(token)) == 64  # fits auth_sessions.token_hash
