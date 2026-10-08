"""Streak: learner-local days, one Streak Freeze per missed day, zone changes that keep the gap."""

from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.domain.calendar import local_date, local_midnight_utc, next_local_midnight
from app.domain.enums import StreakStatus
from app.domain.rules import MAX_STREAK_FREEZES
from app.domain.streak import (
    SettleResult,
    StreakState,
    credit,
    is_milestone,
    settle,
    shift_for_timezone,
    status,
)

DAY = timedelta(days=1)
D = date(2026, 10, 8)
NO_STREAK = StreakState(current=0, longest=0, last_date=None, freezes=0)
KOLKATA, LOS_ANGELES = "Asia/Kolkata", "America/Los_Angeles"


def alive(current: int = 5, *, last_date: date = D, freezes: int = 0, longest: int = 9) -> StreakState:
    """A running streak; by default 5 days long, last covered on D, record 9, no freezes."""
    return StreakState(current=current, longest=longest, last_date=last_date, freezes=freezes)


class TestCredit:
    def test_the_first_activity_starts_a_streak_of_one(self) -> None:
        assert credit(NO_STREAK, D) == (StreakState(1, 1, D, 0), True)

    def test_a_second_session_on_the_same_day_changes_nothing(self) -> None:
        once, _ = credit(NO_STREAK, D)
        assert credit(once, D) == (once, False)

    def test_the_next_day_adds_one(self) -> None:
        assert credit(alive(5), D + DAY) == (alive(6, last_date=D + DAY), True)

    def test_passing_the_record_raises_longest(self) -> None:
        assert credit(alive(9), D + DAY) == (alive(10, last_date=D + DAY, longest=10), True)

    def test_a_lost_streak_restarts_at_one_and_keeps_its_record(self) -> None:
        lost = settle(alive(5), D + 2 * DAY).state
        assert credit(lost, D + 2 * DAY) == (StreakState(1, 9, D + 2 * DAY, 0), True)


class TestSettle:
    def test_nothing_happens_while_yesterday_or_today_is_covered(self) -> None:
        for today in (D, D + DAY):
            assert settle(alive(5, freezes=1), today) == SettleResult(alive(5, freezes=1), (), lost=False)

    def test_one_missed_day_without_a_freeze_loses_the_streak(self) -> None:
        assert settle(alive(5), D + 2 * DAY) == SettleResult(StreakState(0, 9, None, 0), (), lost=True)

    def test_one_missed_day_with_a_freeze_keeps_the_streak(self) -> None:
        result = settle(alive(5, freezes=1), D + 2 * DAY)
        assert result == SettleResult(alive(5, last_date=D + DAY, freezes=0), (D + DAY,), lost=False)

    def test_two_missed_days_with_one_freeze_use_it_and_still_lose(self) -> None:
        result = settle(alive(5, freezes=1), D + 3 * DAY)
        assert result == SettleResult(StreakState(0, 9, None, 0), (D + DAY,), lost=True)

    def test_two_missed_days_with_two_freezes_keep_the_streak(self) -> None:
        result = settle(alive(5, freezes=2), D + 3 * DAY)
        assert result == SettleResult(
            alive(5, last_date=D + 2 * DAY, freezes=0), (D + DAY, D + 2 * DAY), lost=False
        )

    def test_only_the_freezes_needed_are_used(self) -> None:
        result = settle(alive(5, freezes=2), D + 2 * DAY)
        assert result == SettleResult(alive(5, last_date=D + DAY, freezes=1), (D + DAY,), lost=False)

    def test_frozen_days_bridge_the_gap_for_todays_session(self) -> None:
        kept = settle(alive(5, freezes=1), D + 2 * DAY).state
        assert credit(kept, D + 2 * DAY) == (alive(6, last_date=D + 2 * DAY), True)

    @pytest.mark.parametrize(
        ("state", "days_later"),
        [(NO_STREAK, 9), (alive(5), 1), (alive(5), 2), (alive(5, freezes=1), 2), (alive(5, freezes=2), 5)],
    )
    def test_settling_twice_is_the_same_as_settling_once(self, state: StreakState, days_later: int) -> None:
        today = D + days_later * DAY
        once = settle(state, today).state
        assert settle(once, today) == SettleResult(once, (), lost=False)


class TestLocalDays:
    def test_a_second_either_side_of_local_midnight_is_two_days(self) -> None:
        zone = ZoneInfo(KOLKATA)
        late = datetime(2026, 10, 8, 23, 59, 59, tzinfo=zone)
        early = datetime(2026, 10, 9, 0, 0, 1, tzinfo=zone)  # two seconds later
        s, _ = credit(NO_STREAK, local_date(late, KOLKATA))
        assert credit(s, local_date(early, KOLKATA)) == (StreakState(2, 2, date(2026, 10, 9), 0), True)

    def test_one_instant_is_a_different_day_in_kolkata_and_los_angeles(self) -> None:
        instant = datetime(2026, 10, 9, 3, 0, tzinfo=UTC)  # 08:30 in Kolkata, 20:00 the evening before in LA
        done_on_the_8th = alive(5, last_date=date(2026, 10, 8))
        assert status(done_on_the_8th, local_date(instant, LOS_ANGELES)) is StreakStatus.EXTENDED
        assert status(done_on_the_8th, local_date(instant, KOLKATA)) is StreakStatus.AT_RISK

    @pytest.mark.parametrize(
        ("tz", "day", "hours"),
        [
            ("America/New_York", date(2026, 3, 8), 23),
            ("America/New_York", date(2026, 11, 1), 25),
            ("Europe/Madrid", date(2026, 3, 29), 23),
            ("Europe/Madrid", date(2026, 10, 25), 25),
        ],
    )
    def test_a_dst_day_counts_as_exactly_one_day(self, tz: str, day: date, hours: int) -> None:
        start = local_midnight_utc(day, tz)
        end = next_local_midnight(start, tz)
        assert end - start == timedelta(hours=hours)
        tick = timedelta(microseconds=1)
        s, counts = NO_STREAK, []
        for instant in (start - tick, start, end - tick, end):
            today = local_date(instant, tz)
            s, _ = credit(settle(s, today).state, today)
            counts.append(s.current)
        assert counts == [1, 2, 2, 3]

    def test_a_day_before_the_last_covered_one_is_not_counted_again(self) -> None:
        # After a move west, "today" can be a date the streak already covers.
        s = alive(5, last_date=D)
        assert credit(s, D - DAY) == (s, False)
        assert settle(s, D - DAY) == SettleResult(s, (), lost=False)
        assert status(s, D - DAY) is StreakStatus.EXTENDED


class TestTimezoneShift:
    INSTANT = datetime(2026, 10, 9, 3, 0, tzinfo=UTC)  # Kolkata 2026-10-09, Los Angeles 2026-10-08

    def test_moving_west_shifts_the_dates_back_a_day(self) -> None:
        before = alive(5, last_date=date(2026, 10, 8))  # yesterday in Kolkata
        after = shift_for_timezone(before, self.INSTANT, KOLKATA, LOS_ANGELES)
        assert after == alive(5, last_date=date(2026, 10, 7))  # yesterday in Los Angeles
        assert status(before, local_date(self.INSTANT, KOLKATA)) is StreakStatus.AT_RISK
        assert status(after, local_date(self.INSTANT, LOS_ANGELES)) is StreakStatus.AT_RISK

    def test_moving_east_shifts_the_dates_forward_a_day(self) -> None:
        before = alive(5, last_date=date(2026, 10, 8))  # today in Los Angeles
        after = shift_for_timezone(before, self.INSTANT, LOS_ANGELES, KOLKATA)
        assert after == alive(5, last_date=date(2026, 10, 9))  # today in Kolkata
        assert status(before, local_date(self.INSTANT, LOS_ANGELES)) is StreakStatus.EXTENDED
        assert status(after, local_date(self.INSTANT, KOLKATA)) is StreakStatus.EXTENDED

    def test_zones_on_the_same_date_change_nothing(self) -> None:
        before = alive(5, last_date=date(2026, 10, 8))
        assert shift_for_timezone(before, self.INSTANT, KOLKATA, "Asia/Dubai") == before

    def test_without_a_streak_there_is_nothing_to_shift(self) -> None:
        assert shift_for_timezone(NO_STREAK, self.INSTANT, KOLKATA, LOS_ANGELES) == NO_STREAK


class TestStatus:
    def test_no_streak_is_inactive(self) -> None:
        assert status(NO_STREAK, D) is StreakStatus.INACTIVE

    def test_covered_today_is_extended(self) -> None:
        assert status(alive(5, last_date=D), D) is StreakStatus.EXTENDED

    def test_covered_until_yesterday_is_at_risk(self) -> None:
        assert status(alive(5, last_date=D - DAY), D) is StreakStatus.AT_RISK


@pytest.mark.parametrize("n", [7, 14, 30, 50, 75, 100, 125, 150, 200, 250, 300, 365, 400, 500, 1000])
def test_milestones(n: int) -> None:
    assert is_milestone(n)


@pytest.mark.parametrize("n", [0, 1, 6, 8, 13, 15, 99, 101, 175, 366, 450, 501])
def test_not_milestones(n: int) -> None:
    assert not is_milestone(n)


@pytest.mark.parametrize(
    ("current", "longest", "last_date", "freezes"),
    [
        (-1, 0, None, 0),
        (0, 0, D, 0),
        (3, 3, None, 0),
        (3, 2, D, 0),
        (3, 3, D, -1),
        (3, 3, D, MAX_STREAK_FREEZES + 1),
    ],
    ids=[
        "negative",
        "date-without-streak",
        "streak-without-date",
        "longest-below-current",
        "negative-freezes",
        "too-many-freezes",
    ],
)
def test_impossible_states_are_rejected(
    current: int, longest: int, last_date: date | None, freezes: int
) -> None:
    with pytest.raises(ValueError, match="streak"):
        StreakState(current, longest, last_date, freezes)
