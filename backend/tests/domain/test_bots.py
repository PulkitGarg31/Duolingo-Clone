"""Bot league XP: a pure, deterministic weekly schedule that the leaderboard reads up to `until`."""

import os
import subprocess
import sys
from datetime import date, datetime, timedelta
from pathlib import Path
from statistics import mean

import pytest

from app.domain.bots import WEEK_SECONDS, bot_week_schedule, bot_week_xp, bot_week_xp_bound
from app.domain.calendar import league_week_bounds
from app.domain.rng import stable_seed
from app.domain.rules import BOT_SESSION_XP

BACKEND_DIR = Path(__file__).resolve().parents[2]
WEEK = date(2026, 10, 5)
START, END = league_week_bounds(WEEK)
HEAVY = stable_seed("bot", "kenji_t")  # a heavy bot: 110 XP a day before the tier multiplier

# A light bot's Bronze week (two sessions: Wednesday 13:12:42 and Friday 17:09:16 UTC), recorded from
# the implementation so that any change to the schedule algorithm has to be deliberate.
LIGHT_BOT_SCHEDULE = ((220362, 15), (407356, 14))


def heavy_week_xp(until_offset: timedelta) -> tuple[int, datetime | None]:
    """The heavy bot's Gold-league XP up to `until_offset` after the week starts."""
    return bot_week_xp(HEAVY, 110, WEEK, 3, START + until_offset)


class TestSchedule:
    def test_snapshot_for_fixed_inputs(self) -> None:
        assert bot_week_schedule(stable_seed("bot", "ana_p"), 6, WEEK, 1) == LIGHT_BOT_SCHEDULE

    def test_sessions_are_sorted_inside_the_week_with_known_sizes(self) -> None:
        schedule = bot_week_schedule(HEAVY, 110, WEEK, 3)
        assert list(schedule) == sorted(schedule)
        assert all(0 <= offset < WEEK_SECONDS for offset, _ in schedule)
        assert {xp for _, xp in schedule} <= set(BOT_SESSION_XP)

    def test_higher_tiers_field_tougher_bots(self) -> None:
        def average_week(tier: int) -> float:
            return mean(bot_week_xp(stable_seed("bot", n), 30, WEEK, tier, END)[0] for n in range(200))

        assert average_week(1) < average_week(5) < average_week(10)


class TestWeekXp:
    def test_zero_before_the_week_starts(self) -> None:
        assert heavy_week_xp(timedelta(0)) == (0, None)
        assert heavy_week_xp(timedelta(days=-3)) == (0, None)

    def test_complete_at_the_week_end_and_frozen_afterwards(self) -> None:
        schedule = bot_week_schedule(HEAVY, 110, WEEK, 3)
        full = (sum(xp for _, xp in schedule), START + timedelta(seconds=schedule[-1][0]))
        assert heavy_week_xp(timedelta(days=7)) == full
        assert heavy_week_xp(timedelta(days=40)) == full

    def test_monotonic_in_until(self) -> None:
        values = [heavy_week_xp(timedelta(hours=hour)) for hour in range(-24, 8 * 24 + 1)]
        totals = [xp for xp, _ in values]
        reached = [at for _, at in values if at is not None]
        assert totals == sorted(totals)
        assert reached == sorted(reached)
        assert totals[0] == 0 and totals[-1] > 0

    def test_a_session_counts_once_until_is_past_it(self) -> None:
        offset, amount = bot_week_schedule(HEAVY, 110, WEEK, 3)[0]
        moment = timedelta(seconds=offset)
        assert heavy_week_xp(moment) == (0, None)
        assert heavy_week_xp(moment + timedelta(microseconds=1)) == (amount, START + moment)


class TestBound:
    @pytest.mark.parametrize(("daily_xp", "tier"), [(4, 1), (10, 1), (10, 2), (45, 5), (110, 10)])
    def test_a_week_stays_under_the_bound_for_1000_seeds(self, daily_xp: int, tier: int) -> None:
        weeks = [bot_week_xp(stable_seed("bot", n), daily_xp, WEEK, tier, END)[0] for n in range(1000)]
        assert max(weeks) < bot_week_xp_bound(daily_xp, tier)

    def test_a_light_bot_never_tops_68_xp_in_bronze(self) -> None:
        # The seed's promotion argument: round(7 x 10 x 0.5 x 1.4) + 19 = 68.
        assert bot_week_xp_bound(10, 1) == pytest.approx(69)


PROBE = """
from datetime import UTC, date, datetime
from app.domain.bots import bot_week_schedule, bot_week_xp
print(hash("owlingo"))
print(repr(bot_week_schedule(123456789, 35, date(2026, 10, 5), 2)))
print(repr(bot_week_xp(123456789, 35, date(2026, 10, 5), 2, datetime(2026, 10, 8, 12, tzinfo=UTC))))
"""


def run_probe(hash_seed: str) -> list[str]:
    """Runs PROBE in a fresh interpreter whose string hashing is salted with `hash_seed`."""
    env = {**os.environ, "PYTHONHASHSEED": hash_seed}
    done = subprocess.run(
        [sys.executable, "-c", PROBE],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        check=True,
        timeout=120,
    )
    return done.stdout.splitlines()


def test_identical_output_across_processes_with_different_hash_seeds() -> None:
    first, second = run_probe("1"), run_probe("2024")
    assert first[0] != second[0]  # the salt really changed, so the comparison below means something
    assert first[1:] == second[1:]
    assert first[1] == repr(bot_week_schedule(123456789, 35, WEEK, 2))
