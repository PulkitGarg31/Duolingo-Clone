"""League competitors: a bot's week is a pure function of its seed, pace, week and tier.

Bots have no XP rows. Each (bot, week, tier) gets a fixed schedule of sessions spread over the
week, drawn from a generator seeded with sha256 (never Python's per-process salted `hash()`), so
every process and machine shows the same leaderboard. Only the sessions before `until` count,
which makes the board move with real time and with time travel, with no background job.
"""

from datetime import date, datetime, timedelta
from functools import lru_cache
from typing import Final

from app.domain.calendar import LEAGUE_WEEK, league_week_bounds
from app.domain.rng import rng_for
from app.domain.rules import BOT_SESSION_XP, BOT_TIER_PACE, BOT_WEEK_SPREAD

WEEK_SECONDS: Final = int(LEAGUE_WEEK.total_seconds())

# One league week of sessions: (seconds after Monday 00:00 UTC, XP earned), sorted by time.
Schedule = tuple[tuple[int, int], ...]


@lru_cache(maxsize=4096)
def bot_week_schedule(rng_seed: int, daily_xp: int, week_start: date, tier: int) -> Schedule:
    """The bot's sessions in one league week; the same inputs give the same schedule everywhere.

    The weekly target is seven days at the bot's daily pace, scaled by the tier (higher leagues field
    tougher bots) and by a random factor within BOT_WEEK_SPREAD. Sessions sized from BOT_SESSION_XP
    land at random instants of the week until the target is met.
    """
    rng = rng_for("bot-week", rng_seed, week_start.isoformat(), tier)
    target = round(7 * daily_xp * BOT_TIER_PACE[tier] * rng.uniform(*BOT_WEEK_SPREAD))
    sessions: list[tuple[int, int]] = []
    total = 0
    while total < target:
        xp = rng.choice(BOT_SESSION_XP)
        sessions.append((rng.randrange(WEEK_SECONDS), xp))
        total += xp
    return tuple(sorted(sessions))


def bot_week_xp(
    rng_seed: int, daily_xp: int, week_start: date, tier: int, until: datetime
) -> tuple[int, datetime | None]:
    """The bot's league XP from the week's start up to `until`, and when it last earned any.

    Only sessions strictly before `until` count: the total is 0 before the week starts, grows as
    `until` moves forward and is final from the week's end on.
    """
    start, end = league_week_bounds(week_start)
    horizon = (min(until, end) - start).total_seconds()
    xp = 0
    last: datetime | None = None
    for offset, amount in bot_week_schedule(rng_seed, daily_xp, week_start, tier):
        if offset >= horizon:
            break  # sessions are sorted by time, so every later one is past `until` too
        xp += amount
        last = start + timedelta(seconds=offset)
    return xp, last


def bot_week_xp_bound(daily_xp: int, tier: int) -> float:
    """A strict upper bound on a bot's weekly XP: the largest possible target plus one session.

    The schedule stops at the first session that reaches the target, so it overshoots the rounded
    target (at most half an XP above the largest unrounded one) by less than one session. The seed
    relies on this bound to show that the sample learner's last league week was a promotion.
    """
    return 7 * daily_xp * BOT_TIER_PACE[tier] * BOT_WEEK_SPREAD[1] + max(BOT_SESSION_XP)
