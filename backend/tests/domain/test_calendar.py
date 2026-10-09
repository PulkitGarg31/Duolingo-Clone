"""Calendar helpers: learner-local days (streaks, daily goal) and UTC league weeks."""

from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta
from zoneinfo import ZoneInfo

import pytest

from app.domain.calendar import (
    canonical_timezone,
    is_valid_timezone,
    league_week_bounds,
    league_week_start,
    local_date,
    local_midnight_utc,
    next_local_midnight,
)

KOLKATA = "Asia/Kolkata"  # UTC+05:30 all year
LOS_ANGELES = "America/Los_Angeles"


def utc(*args: int) -> datetime:
    return datetime(*args, tzinfo=UTC)


class TestLocalDate:
    def test_23_30_utc_is_already_the_next_day_in_kolkata(self) -> None:
        assert local_date(utc(2026, 10, 8, 23, 30), KOLKATA) == date(2026, 10, 9)

    def test_the_day_flips_exactly_at_local_midnight(self) -> None:
        assert local_date(utc(2026, 10, 8, 18, 29, 59), KOLKATA) == date(2026, 10, 8)
        assert local_date(utc(2026, 10, 8, 18, 30), KOLKATA) == date(2026, 10, 9)

    def test_one_instant_falls_on_different_days_in_different_zones(self) -> None:
        instant = utc(2026, 10, 9, 3, 0)
        assert local_date(instant, KOLKATA) == date(2026, 10, 9)  # 08:30 IST
        assert local_date(instant, LOS_ANGELES) == date(2026, 10, 8)  # 20:00 PDT


class TestLocalMidnight:
    def test_first_instant_of_a_kolkata_day(self) -> None:
        assert local_midnight_utc(date(2026, 10, 9), KOLKATA) == utc(2026, 10, 8, 18, 30)

    def test_next_local_midnight_from_the_afternoon(self) -> None:
        assert next_local_midnight(utc(2026, 10, 8, 12, 0), KOLKATA) == utc(2026, 10, 8, 18, 30)

    def test_next_local_midnight_is_strictly_after_a_midnight(self) -> None:
        assert next_local_midnight(utc(2026, 10, 8, 18, 30), KOLKATA) == utc(2026, 10, 9, 18, 30)

    @pytest.mark.parametrize(
        ("tz", "day", "hours"),
        [
            ("America/New_York", date(2026, 3, 8), 23),  # clocks spring forward
            ("America/New_York", date(2026, 11, 1), 25),  # clocks fall back
            ("Europe/Madrid", date(2026, 3, 29), 23),
            ("Europe/Madrid", date(2026, 10, 25), 25),
        ],
    )
    def test_a_dst_day_is_still_exactly_one_local_day(self, tz: str, day: date, hours: int) -> None:
        start = local_midnight_utc(day, tz)
        end = next_local_midnight(start, tz)
        assert end - start == timedelta(hours=hours)
        assert local_date(start, tz) == day
        assert local_date(end - timedelta(microseconds=1), tz) == day
        assert local_date(end, tz) == day + timedelta(days=1)

    def test_a_midnight_skipped_by_dst_resolves_to_the_first_real_instant(self) -> None:
        # Santiago springs forward at local midnight on 2026-09-06: 00:00 jumps to 01:00.
        start = local_midnight_utc(date(2026, 9, 6), "America/Santiago")
        assert start == utc(2026, 9, 6, 4, 0)
        assert local_date(start, "America/Santiago") == date(2026, 9, 6)
        assert local_date(start - timedelta(microseconds=1), "America/Santiago") == date(2026, 9, 5)


class TestLeagueWeek:
    def test_a_thursday_belongs_to_the_week_starting_monday(self) -> None:
        assert league_week_start(utc(2026, 10, 8, 12, 0)) == date(2026, 10, 5)

    def test_the_week_turns_over_at_monday_midnight_utc(self) -> None:
        assert league_week_start(utc(2026, 10, 11, 23, 59, 59, 999999)) == date(2026, 10, 5)
        assert league_week_start(utc(2026, 10, 12, 0, 0)) == date(2026, 10, 12)

    def test_the_week_is_measured_in_utc_not_local_time(self) -> None:
        monday_3am_in_kolkata = datetime(2026, 10, 12, 3, 0, tzinfo=ZoneInfo(KOLKATA))  # Sunday 21:30 UTC
        assert local_date(monday_3am_in_kolkata, KOLKATA) == date(2026, 10, 12)
        assert league_week_start(monday_3am_in_kolkata) == date(2026, 10, 5)

    def test_bounds_are_half_open(self) -> None:
        start, end = league_week_bounds(date(2026, 10, 5))
        assert (start, end) == (utc(2026, 10, 5), utc(2026, 10, 12))
        assert league_week_start(start) == date(2026, 10, 5)
        assert league_week_start(end - timedelta(microseconds=1)) == date(2026, 10, 5)
        assert league_week_start(end) == date(2026, 10, 12)

    def test_bounds_require_a_monday(self) -> None:
        with pytest.raises(ValueError, match="Monday"):
            league_week_bounds(date(2026, 10, 6))


class TestGuards:
    @pytest.mark.parametrize(
        "call",
        [
            lambda naive: local_date(naive, KOLKATA),
            lambda naive: next_local_midnight(naive, KOLKATA),
            league_week_start,
        ],
        ids=["local_date", "next_local_midnight", "league_week_start"],
    )
    def test_naive_instants_are_rejected(self, call: Callable[[datetime], object]) -> None:
        naive = datetime(2026, 10, 8, 12, 0)  # noqa: DTZ001 - deliberately naive
        with pytest.raises(ValueError, match="aware"):
            call(naive)

    @pytest.mark.parametrize("name", ["Asia/Kolkata", "UTC", "America/Los_Angeles", "Europe/Madrid"])
    def test_known_iana_zones_are_valid(self, name: str) -> None:
        assert is_valid_timezone(name)

    @pytest.mark.parametrize("name", ["", "Mars/Olympus_Mons", "asia/kolkata", "../etc/passwd", "+05:30"])
    def test_unknown_or_non_canonical_zones_are_invalid(self, name: str) -> None:
        assert not is_valid_timezone(name)


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("Asia/Calcutta", "Asia/Kolkata"),
        ("Europe/Kiev", "Europe/Kyiv"),
        ("US/Pacific", "America/Los_Angeles"),
        ("Asia/Kolkata", "Asia/Kolkata"),
        ("Europe/Madrid", "Europe/Madrid"),
    ],
)
def test_old_zone_names_map_to_their_current_name(name: str, expected: str) -> None:
    assert canonical_timezone(name) == expected
    assert is_valid_timezone(canonical_timezone(name))
