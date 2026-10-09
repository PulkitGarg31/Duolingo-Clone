"""League rules: ranking a cohort, its promotion and demotion zones, and the outcome of a week.

A league week is one global window, Monday 00:00 UTC to the next Monday (see `calendar`). Every
learner competes in private cohorts: for each (tier, week) they earn XP in, themselves plus bots drawn
from the pool for them, so each learner is a sandbox whose time travel moves no one else's board.
Leagues open after LEAGUE_UNLOCK_SESSIONS completed sessions of any kind.
"""

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, date, datetime
from itertools import pairwise
from types import MappingProxyType
from typing import Final

from app.domain.enums import LeagueOutcome, LeagueZone
from app.domain.rng import rng_for
from app.domain.rules import BOTS_PER_COHORT, LEAGUE_TIERS, LEAGUE_UNLOCK_SESSIONS, LeagueTier

_LADDER: Final[Mapping[int, LeagueTier]] = MappingProxyType({row.tier: row for row in LEAGUE_TIERS})
LOWEST_TIER: Final = LEAGUE_TIERS[0].tier
HIGHEST_TIER: Final = LEAGUE_TIERS[-1].tier
# Members who earned nothing have no "reached at" time; this sorts them after everyone who did.
_NEVER: Final = datetime.max.replace(tzinfo=UTC)


@dataclass(frozen=True)
class Standing:
    """One cohort member's XP this week, and when they reached it (None with no XP)."""

    user_id: int
    xp: int
    reached_at: datetime | None = None
    is_bot: bool = False


@dataclass(frozen=True)
class Ranked:
    """A standing with its place on the board, 1 being first."""

    rank: int
    user_id: int
    xp: int
    reached_at: datetime | None
    is_bot: bool


def ladder(tier: int) -> LeagueTier:
    """The tier's row of the league table: its name and how many members move up or down."""
    return _LADDER[tier]


def leagues_unlocked(completed_sessions: int) -> bool:
    """Lessons, practice, legendary runs and timed practice all count towards the unlock."""
    return completed_sessions >= LEAGUE_UNLOCK_SESSIONS


def sessions_to_unlock(completed_sessions: int) -> int:
    """How many more completed sessions open the leagues; 0 once they are open."""
    return max(0, LEAGUE_UNLOCK_SESSIONS - completed_sessions)


def rank(standings: Iterable[Standing]) -> list[Ranked]:
    """Places 1..n by XP. Ties go to whoever reached their XP first, then to the lower user id."""
    ordered = sorted(standings, key=_ranking_key)
    return [
        Ranked(place, s.user_id, s.xp, s.reached_at, s.is_bot) for place, s in enumerate(ordered, start=1)
    ]


def _ranking_key(standing: Standing) -> tuple[int, datetime, int]:
    reached_at = standing.reached_at if standing.reached_at is not None else _NEVER
    return (-standing.xp, reached_at, standing.user_id)


def zone(rank: int, cohort_size: int, *, tier: int) -> LeagueZone:
    """The top `promote_count` places promote and the bottom `demote_count` places demote.

    Bronze has no demotion zone and Diamond no promotion zone (their counts are 0).
    """
    row = ladder(tier)
    if rank <= row.promote_count:
        return LeagueZone.PROMOTION
    if rank > cohort_size - row.demote_count:
        return LeagueZone.DEMOTION
    return LeagueZone.SAFE


def outcome(rank: int, cohort_size: int, xp: int, *, tier: int) -> LeagueOutcome:
    """The week's result: a promotion needs at least 1 XP, and the demotion zone always demotes."""
    where = zone(rank, cohort_size, tier=tier)
    if where == LeagueZone.PROMOTION and xp > 0:
        return LeagueOutcome.PROMOTED
    if where == LeagueZone.DEMOTION:
        return LeagueOutcome.DEMOTED
    return LeagueOutcome.STAYED


def tier_after(tier: int, result: LeagueOutcome) -> int:
    """One tier up on a promotion, one down on a demotion, never past Bronze or Diamond."""
    step = {LeagueOutcome.PROMOTED: 1, LeagueOutcome.DEMOTED: -1}.get(result, 0)
    return max(LOWEST_TIER, min(HIGHEST_TIER, tier + step))


def xp_to_pass_next(ranked: Sequence[Ranked], user_id: int) -> int | None:
    """The XP the member needs to strictly pass the one just above; None when first or absent."""
    for above, row in pairwise(ranked):
        if row.user_id == user_id:
            return above.xp - row.xp + 1
    return None


def draw_bots(
    bot_ids: Iterable[int], tier: int, week_start: date, *, owner_id: int, k: int = BOTS_PER_COHORT
) -> list[int]:
    """The bots that fill a learner's (tier, week) cohort: a uniform draw, the same in every process.

    The draw depends only on the owner, the tier and the week, so a promotion brings new rivals and
    two learners rarely face the same field. The pool is sorted first, so the order it arrives in
    doesn't matter; a pool smaller than `k` is used whole.
    """
    pool = sorted(bot_ids)
    return rng_for("cohort", owner_id, tier, week_start.isoformat()).sample(pool, min(k, len(pool)))
