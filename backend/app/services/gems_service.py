"""Gems: the only writer of user_stats.gems, which caches the balance of the gem ledger.

Every movement adds one ledger row that names its source and records the balance after it, in the
same flush as the cached balance, so the two can never disagree.
"""

from datetime import datetime

from sqlalchemy.orm import Session

from app.core.errors import InsufficientGems
from app.domain.enums import GemReason
from app.models import GemTransaction, UserStats
from app.repositories import user_repo


def credit(
    db: Session,
    user_id: int,
    amount: int,
    reason: GemReason,
    *,
    now: datetime,
    node_id: int | None = None,
    quest_claim_id: int | None = None,
) -> GemTransaction:
    """Add `amount` gems: a chest (`node_id`) or a quest reward (`quest_claim_id`)."""
    row = GemTransaction(user_id=user_id, reason=reason, node_id=node_id, quest_claim_id=quest_claim_id)
    return _record(db, row, amount, now)


def debit(
    db: Session,
    user_id: int,
    amount: int,
    reason: GemReason,
    *,
    now: datetime,
    purchase_id: int | None = None,
    session_id: int | None = None,
) -> GemTransaction:
    """Take `amount` gems for a purchase (`purchase_id`) or a legendary entry fee (`session_id`).

    A balance below the amount is refused with INSUFFICIENT_GEMS, and nothing changes.
    """
    balance = _stats(db, user_id).gems
    if balance < amount:
        raise InsufficientGems(required_gems=amount, balance=balance)
    row = GemTransaction(user_id=user_id, reason=reason, purchase_id=purchase_id, session_id=session_id)
    return _record(db, row, -amount, now)


def set_balance(db: Session, user_id: int, target: int, *, now: datetime) -> None:
    """Demo tools: move the balance to `target` with one `dev` ledger row (none when it is already there)."""
    delta = target - _stats(db, user_id).gems
    if delta != 0:
        _record(db, GemTransaction(user_id=user_id, reason=GemReason.DEV), delta, now)


def _record(db: Session, row: GemTransaction, delta: int, now: datetime) -> GemTransaction:
    """Apply `delta` to the cached balance and add the ledger row that explains it."""
    stats = _stats(db, row.user_id)
    stats.gems += delta
    stats.updated_at = now
    row.delta, row.balance_after, row.created_at = delta, stats.gems, now
    db.add(row)
    return row


def _stats(db: Session, user_id: int) -> UserStats:
    stats = user_repo.get_stats(db, user_id)
    if stats is None:  # bots have no wallet; learners always have a stats row
        raise RuntimeError(f"user {user_id} has no stats row")
    return stats
