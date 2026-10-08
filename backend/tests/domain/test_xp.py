"""XP: a base amount per kind of session, a combo bonus of up to 5, and the XP Boost line."""

from datetime import UTC, datetime, timedelta

import pytest

from app.domain.enums import NodeKind, SessionKind, XpReason
from app.domain.xp import XpLine, combo_bonus, is_boost_active, session_xp_lines

LESSON, PRACTICE = SessionKind.LESSON, SessionKind.PRACTICE
LEGENDARY, TIMED = SessionKind.LEGENDARY, SessionKind.TIMED
SKILL, REVIEW = NodeKind.SKILL, NodeKind.REVIEW


def lines(
    kind: SessionKind,
    node_kind: NodeKind | None = SKILL,
    *,
    best_run: int = 0,
    item_count: int = 6,
    correct: int = 0,
    boost: bool = False,
) -> list[XpLine]:
    return session_xp_lines(
        kind,
        node_kind=node_kind,
        best_run=best_run,
        item_count=item_count,
        correct=correct,
        boost_active=boost,
    )


@pytest.mark.parametrize(
    ("kind", "node_kind", "base"),
    [
        (LESSON, SKILL, XpLine(XpReason.LESSON, 10)),
        (LESSON, REVIEW, XpLine(XpReason.REVIEW, 40)),
        (PRACTICE, SKILL, XpLine(XpReason.PRACTICE, 5)),
        (PRACTICE, REVIEW, XpLine(XpReason.PRACTICE, 5)),
        (PRACTICE, None, XpLine(XpReason.PRACTICE, 10)),
        (LEGENDARY, SKILL, XpLine(XpReason.LEGENDARY, 40)),
    ],
    ids=["lesson", "unit-review", "node-practice", "review-practice", "global-practice", "legendary"],
)
def test_base_xp_by_kind(kind: SessionKind, node_kind: NodeKind | None, base: XpLine) -> None:
    assert lines(kind, node_kind) == [base]


@pytest.mark.parametrize(
    ("item_count", "bonus_by_run"),
    [
        (6, [0, 1, 2, 3, 4, 5, 5]),
        (8, [0, 1, 2, 2, 3, 4, 4, 5, 5]),
        (10, [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]),
        (12, [0, 1, 1, 2, 2, 3, 3, 3, 4, 4, 5, 5, 5]),
    ],
)
def test_combo_bonus_table(item_count: int, bonus_by_run: list[int]) -> None:
    assert [combo_bonus(run, item_count) for run in range(item_count + 1)] == bonus_by_run


def test_combo_bonus_is_capped_at_five() -> None:
    assert combo_bonus(20, 6) == 5
    assert combo_bonus(40, 12) == 5


def test_no_items_means_no_combo_bonus() -> None:
    assert combo_bonus(0, 0) == 0


def test_a_perfect_six_item_lesson_earns_fifteen() -> None:
    assert lines(LESSON, best_run=6) == [XpLine(XpReason.LESSON, 10), XpLine(XpReason.COMBO, 5)]


def test_the_boost_doubles_the_base_and_the_combo() -> None:
    assert lines(LESSON, best_run=6, boost=True) == [
        XpLine(XpReason.LESSON, 10),
        XpLine(XpReason.COMBO, 5),
        XpLine(XpReason.BOOST, 15),
    ]
    assert lines(PRACTICE, None, best_run=4, item_count=10, boost=True) == [
        XpLine(XpReason.PRACTICE, 10),
        XpLine(XpReason.COMBO, 2),
        XpLine(XpReason.BOOST, 12),
    ]


def test_the_boost_without_a_combo() -> None:
    assert lines(LESSON, REVIEW, boost=True) == [XpLine(XpReason.REVIEW, 40), XpLine(XpReason.BOOST, 40)]


def test_timed_practice_earns_one_per_correct_answer() -> None:
    assert lines(TIMED, None, correct=12, item_count=20) == [XpLine(XpReason.TIMED, 12)]


def test_timed_practice_ignores_combo_and_boost() -> None:
    perfect_run = lines(TIMED, None, correct=20, best_run=20, item_count=20, boost=True)
    assert perfect_run == [XpLine(XpReason.TIMED, 20)]


def test_timed_practice_without_a_correct_answer_earns_nothing() -> None:
    assert lines(TIMED, None, correct=0, item_count=20) == []


@pytest.mark.parametrize("kind", [LESSON, PRACTICE, LEGENDARY, TIMED])
@pytest.mark.parametrize("boost", [False, True])
def test_every_line_is_positive(kind: SessionKind, boost: bool) -> None:
    # An xp_events row never carries 0 XP: lines with nothing to give are left out.
    for run in range(7):
        assert all(line.amount > 0 for line in lines(kind, best_run=run, correct=run, boost=boost))


class TestBoostWindow:
    NOW = datetime(2026, 10, 8, 12, 0, tzinfo=UTC)

    def test_no_boost_bought(self) -> None:
        assert not is_boost_active(None, self.NOW)

    def test_active_before_its_end(self) -> None:
        assert is_boost_active(self.NOW + timedelta(minutes=1), self.NOW)

    def test_over_at_its_end_instant(self) -> None:
        assert not is_boost_active(self.NOW, self.NOW)
        assert not is_boost_active(self.NOW - timedelta(minutes=1), self.NOW)
