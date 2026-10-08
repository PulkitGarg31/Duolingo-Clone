"""Hearts: a token bucket that refills one heart per interval, computed lazily.

The state is the heart count plus the anchor: the instant the running regeneration interval
started. Nothing ticks in the background; any request brings the state up to `now` by counting
the whole intervals since the anchor and keeping the remainder. So a server that slept for hours
catches up exactly, with no scheduler.

Hearts are spent only in lessons. Practice earns one back, and a refill from the shop fills them.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta

from app.domain.rules import MAX_HEARTS


class OutOfHearts(Exception):
    """A lesson tried to spend a heart while none was left."""

    def __init__(self, *, next_heart_at: datetime | None) -> None:
        super().__init__(f"no hearts left; the next one arrives at {next_heart_at}")
        self.next_heart_at = next_heart_at


@dataclass(frozen=True)
class HeartsState:
    """The heart count and the start of the interval that is refilling the next heart."""

    hearts: int
    anchor: datetime | None  # None exactly when the hearts are full (a DB CHECK too)

    def __post_init__(self) -> None:
        if not 0 <= self.hearts <= MAX_HEARTS:
            raise ValueError(f"hearts must be between 0 and {MAX_HEARTS}, got {self.hearts}")
        if (self.anchor is None) != (self.hearts == MAX_HEARTS):
            raise ValueError("a regeneration anchor is set exactly when hearts are below the maximum")


def regenerate(s: HeartsState, now: datetime, interval: timedelta) -> HeartsState:
    """Add one heart per whole interval since the anchor, keeping the unfinished part."""
    if s.anchor is None:
        return s  # already full
    gained = (now - s.anchor) // interval  # whole intervals elapsed (timedelta // timedelta is an int)
    if gained <= 0:
        return s
    hearts = min(MAX_HEARTS, s.hearts + gained)
    if hearts == MAX_HEARTS:
        return refill()
    return HeartsState(hearts, s.anchor + gained * interval)


def lose_one(s: HeartsState, now: datetime, interval: timedelta) -> HeartsState:
    """Spend a heart on a wrong answer or a skip in a lesson."""
    s = regenerate(s, now, interval)
    if s.hearts == 0:
        raise OutOfHearts(next_heart_at=next_heart_at(s, interval))
    # The timer starts with the first heart lost; later losses do not restart it.
    return HeartsState(s.hearts - 1, now if s.anchor is None else s.anchor)


def gain(s: HeartsState, n: int, now: datetime, interval: timedelta) -> HeartsState:
    """Add `n` hearts (the practice reward), keeping the progress toward the next one."""
    s = regenerate(s, now, interval)
    hearts = min(MAX_HEARTS, s.hearts + n)
    if hearts == MAX_HEARTS:
        return refill()
    return HeartsState(hearts, s.anchor)


def refill() -> HeartsState:
    """Full hearts, with no interval running."""
    return HeartsState(MAX_HEARTS, None)


def set_hearts(n: int, now: datetime) -> HeartsState:
    """Exactly `n` hearts, with a fresh interval when below the maximum (demo tools)."""
    return HeartsState(n, None if n == MAX_HEARTS else now)


def next_heart_at(s: HeartsState, interval: timedelta) -> datetime | None:
    """When the next heart arrives, for a state already regenerated to now; None when full."""
    return None if s.anchor is None else s.anchor + interval


def full_at(s: HeartsState, interval: timedelta) -> datetime | None:
    """When the hearts will be full again, for a state already regenerated to now; None when full."""
    return None if s.anchor is None else s.anchor + (MAX_HEARTS - s.hearts) * interval
