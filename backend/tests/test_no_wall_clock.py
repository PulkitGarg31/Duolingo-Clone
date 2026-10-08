"""Time is injected, never read: only app/core/clock.py looks at the system clock, and the clocks
that everything else receives behave predictably."""

import re
from datetime import UTC, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from app.core.clock import FrozenClock, OffsetClock, SystemClock

APP_DIR = Path(__file__).resolve().parents[1] / "app"
CLOCK_MODULE = APP_DIR / "core" / "clock.py"
WALL_CLOCK_CALL = re.compile(r"\b(?:datetime\.(?:now|utcnow|today)|date\.today|time\.time(?:_ns)?)\(")


def test_only_the_clock_module_reads_the_wall_clock() -> None:
    offenders = [
        f"{path.relative_to(APP_DIR.parent).as_posix()}:{number}: {line.strip()}"
        for path in sorted(APP_DIR.rglob("*.py"))
        if path != CLOCK_MODULE
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1)
        if WALL_CLOCK_CALL.search(line)
    ]
    assert offenders == []


def test_the_scan_recognises_the_one_real_reader() -> None:
    # Guards the test above: if this pattern missed the legitimate call, the scan would prove nothing.
    assert WALL_CLOCK_CALL.search(CLOCK_MODULE.read_text(encoding="utf-8"))


def test_the_system_clock_returns_aware_utc() -> None:
    assert SystemClock().now().tzinfo is UTC


def test_a_frozen_clock_moves_only_when_advanced(clock: FrozenClock) -> None:
    start = clock.now()
    assert clock.now() == start
    assert clock.advance(hours=5) == start + timedelta(hours=5)
    assert clock.advance(days=1, minutes=30) == start + timedelta(days=1, hours=5, minutes=30)
    assert clock.now() == start + timedelta(days=1, hours=5, minutes=30)


def test_a_frozen_clock_never_moves_backwards(clock: FrozenClock) -> None:
    start = clock.now()
    with pytest.raises(ValueError, match="forward"):
        clock.advance(seconds=-1)
    assert clock.now() == start


def test_a_frozen_clock_normalizes_to_utc_and_refuses_naive_instants() -> None:
    noon_in_kolkata = datetime(2026, 10, 8, 17, 30, tzinfo=ZoneInfo("Asia/Kolkata"))
    assert FrozenClock(noon_in_kolkata).now() == datetime(2026, 10, 8, 12, 0, tzinfo=UTC)
    assert FrozenClock(noon_in_kolkata).now().tzinfo is UTC
    with pytest.raises(ValueError, match="aware"):
        FrozenClock(datetime(2026, 10, 8, 12, 0))  # noqa: DTZ001 - deliberately naive


def test_an_offset_clock_runs_ahead_of_its_base_by_the_offset(clock: FrozenClock) -> None:
    simulated = OffsetClock(clock, timedelta(days=2))
    assert simulated.now() == clock.now() + timedelta(days=2)
    clock.advance(minutes=1)
    assert simulated.now() == clock.now() + timedelta(days=2)
