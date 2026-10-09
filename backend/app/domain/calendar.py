"""Calendar helpers for the two kinds of day boundary in the game.

A streak is personal, so its day ends at the learner's local midnight (an IANA zone). A league
is a shared competition, so its week is one global window that starts on Monday 00:00 UTC.
Streak gaps are counted on `date` objects, never as "24 hours since", which makes a 23- or
25-hour DST day count as exactly one day.
"""

from datetime import UTC, date, datetime, time, timedelta
from functools import cache
from zoneinfo import ZoneInfo, available_timezones

LEAGUE_WEEK = timedelta(days=7)


def local_date(instant: datetime, tz: str) -> date:
    """The calendar date that `instant` falls on in the IANA zone `tz`."""
    return _require_aware(instant).astimezone(ZoneInfo(tz)).date()


def local_midnight_utc(day: date, tz: str) -> datetime:
    """The first instant of `day` in `tz`, expressed in UTC.

    When a DST change skips local midnight, zoneinfo resolves the missing 00:00 to the first
    instant of the day that does exist.
    """
    return datetime.combine(day, time.min, tzinfo=ZoneInfo(tz)).astimezone(UTC)


def next_local_midnight(instant: datetime, tz: str) -> datetime:
    """The start of the local day after the one that contains `instant` (always later)."""
    return local_midnight_utc(local_date(instant, tz) + timedelta(days=1), tz)


def league_week_start(instant: datetime) -> date:
    """The Monday that starts the UTC league week containing `instant`."""
    day = _require_aware(instant).astimezone(UTC).date()
    return day - timedelta(days=day.weekday())


def league_week_bounds(week_start: date) -> tuple[datetime, datetime]:
    """The half-open UTC window [start, end) of the league week starting on `week_start`."""
    if week_start.weekday() != 0:
        raise ValueError(f"a league week starts on a Monday, got {week_start.isoformat()}")
    start = datetime.combine(week_start, time.min, tzinfo=UTC)
    return start, start + LEAGUE_WEEK


def is_valid_timezone(name: str) -> bool:
    """True for a canonical IANA zone name such as 'Asia/Kolkata' (case-sensitive)."""
    return name in _known_timezones()


# Old names that browsers still report for some zones (Chrome reports India as "Asia/Calcutta").
# Storing the current name means the same zone under its old name is never treated as a move.
_ZONE_ALIASES = {
    "Asia/Calcutta": "Asia/Kolkata",
    "Asia/Saigon": "Asia/Ho_Chi_Minh",
    "Asia/Katmandu": "Asia/Kathmandu",
    "Asia/Rangoon": "Asia/Yangon",
    "Asia/Dacca": "Asia/Dhaka",
    "Asia/Ulan_Bator": "Asia/Ulaanbaatar",
    "Europe/Kiev": "Europe/Kyiv",
    "Atlantic/Faeroe": "Atlantic/Faroe",
    "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
    "America/Indianapolis": "America/Indiana/Indianapolis",
    "US/Eastern": "America/New_York",
    "US/Central": "America/Chicago",
    "US/Mountain": "America/Denver",
    "US/Pacific": "America/Los_Angeles",
}


def canonical_timezone(name: str) -> str:
    """The current IANA name for `name`: an old alias becomes its new name, anything else is kept."""
    return _ZONE_ALIASES.get(name, name)


@cache
def _known_timezones() -> frozenset[str]:
    # Scanning the time-zone database is slow, and its contents never change while running.
    return frozenset(available_timezones())


def _require_aware(instant: datetime) -> datetime:
    # A naive datetime would silently be read as the server's local time.
    if instant.tzinfo is None or instant.utcoffset() is None:
        raise ValueError(f"expected an aware datetime, got naive {instant.isoformat()}")
    return instant
