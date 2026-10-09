"""League rules: the weekly window, ranking, zones, outcomes, tier changes and the bot draw."""

from datetime import UTC, date, datetime, timedelta

import pytest

from app.domain.calendar import league_week_start
from app.domain.enums import LeagueOutcome, LeagueZone
from app.domain.leagues import (
    Ranked,
    Standing,
    draw_bots,
    ladder,
    leagues_unlocked,
    outcome,
    rank,
    sessions_to_unlock,
    tier_after,
    xp_to_pass_next,
    zone,
)

BRONZE, SILVER, DIAMOND = 1, 2, 10
PROMOTED, STAYED, DEMOTED = LeagueOutcome.PROMOTED, LeagueOutcome.STAYED, LeagueOutcome.DEMOTED
MONDAY = date(2026, 10, 5)
BOT_POOL = list(range(100, 135))  # 35 bots


def at(hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 10, 8, hour, minute, tzinfo=UTC)


class TestWeek:
    def test_xp_at_the_last_microsecond_of_sunday_belongs_to_the_closing_week(self) -> None:
        last_instant = datetime(2026, 10, 11, 23, 59, 59, 999999, tzinfo=UTC)
        assert league_week_start(last_instant) == MONDAY
        assert league_week_start(last_instant + timedelta(microseconds=1)) == MONDAY + timedelta(days=7)


class TestUnlock:
    @pytest.mark.parametrize(
        ("completed", "unlocked", "left"),
        [(0, False, 10), (9, False, 1), (10, True, 0), (23, True, 0)],
    )
    def test_leagues_open_after_ten_sessions(self, completed: int, unlocked: bool, left: int) -> None:
        assert leagues_unlocked(completed) is unlocked
        assert sessions_to_unlock(completed) == left


class TestRank:
    def test_more_xp_ranks_higher(self) -> None:
        ranked = rank([Standing(1, 40, at(9)), Standing(2, 90, at(10)), Standing(3, 65, at(8))])
        assert [(r.rank, r.user_id) for r in ranked] == [(1, 2), (2, 3), (3, 1)]

    def test_ties_go_to_whoever_reached_the_xp_first_then_to_the_lower_id(self) -> None:
        ranked = rank(
            [
                Standing(7, 50, at(11)),
                Standing(9, 50, at(10)),
                Standing(4, 50, at(11)),
                Standing(8, 0),
                Standing(3, 0),
            ]
        )
        assert [r.user_id for r in ranked] == [9, 4, 7, 3, 8]

    def test_ranked_rows_keep_their_facts(self) -> None:
        assert rank([Standing(5, 12, at(9), is_bot=True)]) == [Ranked(1, 5, 12, at(9), is_bot=True)]


class TestZones:
    @pytest.mark.parametrize(
        ("tier", "rank_", "expected"),
        [
            (SILVER, 1, LeagueZone.PROMOTION),
            (SILVER, 15, LeagueZone.PROMOTION),
            (SILVER, 16, LeagueZone.SAFE),
            (SILVER, 23, LeagueZone.SAFE),
            (SILVER, 24, LeagueZone.DEMOTION),
            (SILVER, 30, LeagueZone.DEMOTION),
            (BRONZE, 20, LeagueZone.PROMOTION),
            (BRONZE, 30, LeagueZone.SAFE),  # Bronze never demotes
            (DIAMOND, 1, LeagueZone.SAFE),  # Diamond never promotes
            (DIAMOND, 26, LeagueZone.DEMOTION),
        ],
    )
    def test_zones_in_a_full_cohort(self, tier: int, rank_: int, expected: LeagueZone) -> None:
        assert zone(rank_, 30, tier=tier) is expected

    def test_bronze_never_demotes_and_diamond_never_promotes(self) -> None:
        assert all(zone(r, 30, tier=BRONZE) is not LeagueZone.DEMOTION for r in range(1, 31))
        assert all(zone(r, 30, tier=DIAMOND) is not LeagueZone.PROMOTION for r in range(1, 31))

    def test_the_ladder_rows(self) -> None:
        silver = ladder(SILVER)
        assert (silver.name, silver.promote_count, silver.demote_count) == ("Silver", 15, 7)
        with pytest.raises(KeyError):
            ladder(11)


class TestOutcome:
    @pytest.mark.parametrize(
        ("tier", "rank_", "xp", "expected"),
        [
            (BRONZE, 6, 112, PROMOTED),
            (BRONZE, 6, 0, STAYED),  # zero XP never promotes, even in the promotion zone
            (SILVER, 20, 30, STAYED),
            (SILVER, 30, 0, DEMOTED),
            (SILVER, 24, 55, DEMOTED),
            (DIAMOND, 1, 900, STAYED),
        ],
    )
    def test_outcomes(self, tier: int, rank_: int, xp: int, expected: LeagueOutcome) -> None:
        assert outcome(rank_, 30, xp, tier=tier) is expected

    @pytest.mark.parametrize(
        ("tier", "result", "after"),
        [
            (BRONZE, PROMOTED, SILVER),
            (SILVER, DEMOTED, BRONZE),
            (SILVER, STAYED, SILVER),
            (BRONZE, DEMOTED, BRONZE),
            (DIAMOND, PROMOTED, DIAMOND),
        ],
    )
    def test_tier_after_moves_one_step_and_clamps(self, tier: int, result: LeagueOutcome, after: int) -> None:
        assert tier_after(tier, result) == after


class TestXpToPassNext:
    def test_the_gap_to_strictly_pass_the_row_above(self) -> None:
        ranked = rank([Standing(1, 42, at(9)), Standing(2, 50, at(9)), Standing(3, 50, at(8))])
        assert xp_to_pass_next(ranked, 1) == 9
        assert xp_to_pass_next(ranked, 2) == 1  # a tie still needs one more XP to pass
        assert xp_to_pass_next(ranked, 3) is None  # already first
        assert xp_to_pass_next(ranked, 99) is None  # not in this cohort


class TestDrawBots:
    OWNER = 1  # the learner whose cohort is filled

    def test_twenty_nine_distinct_bots_from_the_pool(self) -> None:
        drawn = draw_bots(BOT_POOL, BRONZE, MONDAY, owner_id=self.OWNER)
        assert len(drawn) == len(set(drawn)) == 29
        assert set(drawn) <= set(BOT_POOL)

    def test_deterministic_and_independent_of_the_pool_order(self) -> None:
        assert draw_bots(BOT_POOL, BRONZE, MONDAY, owner_id=self.OWNER) == draw_bots(
            list(reversed(BOT_POOL)), BRONZE, MONDAY, owner_id=self.OWNER
        )

    def test_each_tier_and_week_gets_its_own_field(self) -> None:
        bronze_this_week = set(draw_bots(BOT_POOL, BRONZE, MONDAY, owner_id=self.OWNER))
        assert bronze_this_week != set(draw_bots(BOT_POOL, SILVER, MONDAY, owner_id=self.OWNER))
        next_week = MONDAY + timedelta(days=7)
        assert bronze_this_week != set(draw_bots(BOT_POOL, BRONZE, next_week, owner_id=self.OWNER))

    def test_each_learner_gets_a_field_of_their_own(self) -> None:
        # Every learner competes in private cohorts, so two learners in one tier and week rarely meet
        # the same bots; a bot may still sit in both fields.
        fields = {owner: set(draw_bots(BOT_POOL, BRONZE, MONDAY, owner_id=owner)) for owner in (1, 2, 3)}
        assert len({frozenset(field) for field in fields.values()}) == 3
        assert fields[1] & fields[2]  # 29 of 35 bots each: the fields always overlap

    def test_a_small_pool_is_drawn_entirely(self) -> None:
        assert sorted(draw_bots([3, 1, 2], SILVER, MONDAY, owner_id=self.OWNER)) == [1, 2, 3]
