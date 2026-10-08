"""The only module allowed to read the system time.

Everything else receives `now` (one instant per request) or a `Clock`. Production uses real time
plus a persisted, forward-only offset, so a demo can jump to "tomorrow"; tests use FrozenClock and
move it explicitly, with no monkeypatching. `tests/test_no_wall_clock.py` enforces this rule.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Protocol


class Clock(Protocol):
    """A source of the current instant."""

    def now(self) -> datetime:
        """The current instant as an aware UTC datetime."""
        ...


class SystemClock:
    """Real wall-clock time."""

    def now(self) -> datetime:
        return datetime.now(UTC)


@dataclass(frozen=True)
class OffsetClock:
    """Another clock shifted by a fixed offset: simulated time = real time + offset."""

    base: Clock
    offset: timedelta

    def now(self) -> datetime:
        return self.base.now() + self.offset


class FrozenClock:
    """A clock that stands still until a test moves it forward."""

    def __init__(self, at: datetime) -> None:
        if at.tzinfo is None or at.utcoffset() is None:
            raise ValueError("FrozenClock needs an aware datetime")
        self._at = at.astimezone(UTC)

    def now(self) -> datetime:
        return self._at

    def advance(self, **delta: float) -> datetime:
        """Move time forward by `timedelta(**delta)` (weeks=, days=, hours=, ... microseconds=) and
        return the new instant. Time never moves backwards."""
        step = timedelta(**delta)
        if step < timedelta(0):
            raise ValueError("time only moves forward")
        self._at += step
        return self._at
