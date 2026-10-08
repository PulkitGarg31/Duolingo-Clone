"""Deterministic randomness that is identical in every process.

Python's built-in `hash()` is salted per process (PYTHONHASHSEED), so it never seeds anything
that must be reproducible, such as a session's exercise order or a bot's weekly XP.
"""

import hashlib
import random

# Seeds are stored in SQLite INTEGER columns, which are signed 64-bit: keep the low 63 bits.
_SEED_MASK = (1 << 63) - 1


def stable_seed(*parts: str | int | None) -> int:
    """A seed in [0, 2**63) derived from the sha256 of the parts joined with '|'."""
    digest = hashlib.sha256("|".join(map(str, parts)).encode()).digest()
    return int.from_bytes(digest[:8], "big") & _SEED_MASK


def rng_for(*parts: str | int | None) -> random.Random:
    """A random generator seeded with `stable_seed(*parts)`."""
    return random.Random(stable_seed(*parts))
