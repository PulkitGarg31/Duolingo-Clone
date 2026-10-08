"""XP earned by a completed session, as ledger lines: a base amount, a combo bonus and a boost.

Each line becomes one xp_events row, and a session earns each reason at most once. Failed and
abandoned sessions earn nothing, so these rules only run on completion.
"""

import math
from dataclasses import dataclass
from datetime import datetime

from app.domain.enums import NodeKind, SessionKind, XpReason
from app.domain.rules import (
    COMBO_BONUS_MAX,
    GLOBAL_PRACTICE_XP,
    LEGENDARY_XP,
    LESSON_XP,
    NODE_PRACTICE_XP,
    TIMED_XP_PER_CORRECT,
    UNIT_REVIEW_XP,
    XP_BOOST_MULTIPLIER,
)


@dataclass(frozen=True)
class XpLine:
    """One reason a session earned XP, and how much."""

    reason: XpReason
    amount: int


def combo_bonus(best_run: int, item_count: int) -> int:
    """Up to COMBO_BONUS_MAX extra XP, in proportion to the longest run of correct answers."""
    if item_count == 0:
        return 0
    return min(COMBO_BONUS_MAX, math.ceil(COMBO_BONUS_MAX * best_run / item_count))


def is_boost_active(xp_boost_until: datetime | None, now: datetime) -> bool:
    """An XP Boost counts until its end instant, exclusive."""
    return xp_boost_until is not None and now < xp_boost_until


def session_xp_lines(
    kind: SessionKind,
    *,
    node_kind: NodeKind | None,
    best_run: int,
    item_count: int,
    correct: int,
    boost_active: bool,
) -> list[XpLine]:
    """The XP lines of a completed session.

    `node_kind` is the played node's kind (None for global practice and timed practice),
    `best_run` the longest run of correct answers, `item_count` the number of planned items
    (retries excluded) and `correct` the number of correct answers (used by timed practice).
    """
    match kind:
        case SessionKind.TIMED:
            # One XP per correct answer, with no combo bonus and no boost.
            return [XpLine(XpReason.TIMED, correct * TIMED_XP_PER_CORRECT)] if correct else []
        case SessionKind.LESSON if node_kind == NodeKind.REVIEW:
            base = XpLine(XpReason.REVIEW, UNIT_REVIEW_XP)
        case SessionKind.LESSON:
            base = XpLine(XpReason.LESSON, LESSON_XP)
        case SessionKind.PRACTICE:
            base = XpLine(XpReason.PRACTICE, GLOBAL_PRACTICE_XP if node_kind is None else NODE_PRACTICE_XP)
        case SessionKind.LEGENDARY:
            base = XpLine(XpReason.LEGENDARY, LEGENDARY_XP)
    lines = [base]
    bonus = combo_bonus(best_run, item_count)
    if bonus:
        lines.append(XpLine(XpReason.COMBO, bonus))
    if boost_active:
        # The boost multiplies the base and the combo together; this line holds the extra part.
        lines.append(XpLine(XpReason.BOOST, (base.amount + bonus) * (XP_BOOST_MULTIPLIER - 1)))
    return lines
