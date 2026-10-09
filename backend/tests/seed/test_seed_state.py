"""The seeded demo, fact by fact, at the frozen seed instant in Asia/Kolkata.

At FROZEN_NOW it is 17:30 on 2026-10-08 in Kolkata, so the seed day D is 2026-10-08. Every number
here is a moment of the first screen: a 13-day streak at risk with a freeze equipped, 820 gems,
4 hearts, Silver this week with last week's promotion waiting to be shown, and four badges at
level 2. The template database is seeded once per test run; each test reads its own copy.
"""

import subprocess
import sys
import time
import warnings
from collections import Counter
from collections.abc import Iterator
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import pytest
from sqlalchemy import Engine, func, insert, select, text, update
from sqlalchemy.orm import Session

from app.core.db import make_session_factory
from app.domain import path, session_flow, xp
from app.domain.calendar import league_week_bounds, league_week_start, local_date
from app.domain.enums import (
    AchievementMetric,
    ActivityKind,
    EndReason,
    ExerciseType,
    GemReason,
    LeagueOutcome,
    NodeKind,
    NodeState,
    SessionKind,
    SessionStatus,
)
from app.domain.session_flow import ItemFacts
from app.models import (
    Achievement,
    AchievementTier,
    ActivityDay,
    AppState,
    BotProfile,
    Course,
    Exercise,
    GemTransaction,
    GlossaryTerm,
    LeagueCohort,
    LeagueMembership,
    LessonSession,
    PathNode,
    Purchase,
    SessionItem,
    ShopItem,
    User,
    UserAchievement,
    UserSettings,
    UserStats,
    XpEvent,
)
from app.repositories import content_repo, ledger_repo, play_repo, user_repo
from app.seed.loader import seed_if_empty
from app.seed.sample_learner import insert_fresh_learner_rows, reset_demo
from app.services import achievement_service
from tests.conftest import FROZEN_NOW, api_settings, build_database
from tests.invariants import check_invariants

ZONE = "Asia/Kolkata"
D = date(2026, 10, 8)  # the seed day: FROZEN_NOW is 17:30 there
SEED_BUDGET_SECONDS = 1.5

Metric = AchievementMetric


def days_before(n: int) -> date:
    return D - timedelta(days=n)


@pytest.fixture
def seeded_db(seeded_engine: Engine) -> Iterator[Session]:
    """A session on a private copy of the seeded demo."""
    with make_session_factory(seeded_engine)() as session:
        yield session


@pytest.fixture
def learner(seeded_db: Session) -> User:
    user = user_repo.get_by_username(seeded_db, "alex")
    assert user is not None and user.stats is not None and user.settings is not None
    return user


def sessions_of(db: Session, user_id: int) -> list[LessonSession]:
    return list(
        db.scalars(select(LessonSession).where(LessonSession.user_id == user_id).order_by(LessonSession.id))
    )


def node_states(db: Session, user: User) -> dict[str, NodeState]:
    """Every node's state by key, derived from the learner's facts by the path rules."""
    nodes = [node for unit in content_repo.course_path(db, user.current_course_id) for node in unit.nodes]
    done = play_repo.lessons_completed_by_node(db, user.id)
    legendary = play_repo.legendary_node_ids(db, user.id)
    chests = ledger_repo.claimed_chest_node_ids(db, user.id)
    facts = [
        path.NodeFacts(
            node.id,
            node.kind,
            len(node.lessons),
            done.get(node.id, 0),
            node.id in legendary,
            node.id in chests,
        )
        for node in nodes
    ]
    states = path.node_states(facts)
    return {node.key: states[node.id] for node in nodes}


class TestLearner:
    def test_lives_in_the_seed_zone_until_the_browser_zone_is_adopted(self, learner: User) -> None:
        assert (learner.timezone, learner.timezone_confirmed) == (ZONE, False)

    def test_joined_at_noon_thirty_days_before_the_seed_day(self, learner: User) -> None:
        assert learner.joined_at == datetime(2026, 9, 8, 6, 30, tzinfo=UTC)  # 12:00 in Kolkata

    def test_has_a_regular_daily_goal_and_default_preferences(self, learner: User) -> None:
        assert learner.settings is not None
        assert learner.settings.daily_goal_xp == 20
        assert (learner.settings.theme, learner.settings.listening_exercises) == ("system", True)


class TestHistory:
    def test_373_xp_in_total_and_none_today(self, seeded_db: Session, learner: User) -> None:
        week_start, week_end = league_week_bounds(league_week_start(FROZEN_NOW))
        assert ledger_repo.total_xp(seeded_db, learner.id) == 373
        assert ledger_repo.xp_on(seeded_db, learner.id, D) == 0
        totals = ledger_repo.xp_totals(seeded_db, learner.id, D, week_start, week_end)
        assert (totals.total, totals.on_day, totals.in_window) == (373, 0, 14 + 15 + 13)

    def test_23_completed_sessions_of_which_11_are_lessons(self, seeded_db: Session, learner: User) -> None:
        sessions = sessions_of(seeded_db, learner.id)
        assert Counter(s.kind for s in sessions) == {
            SessionKind.LESSON: 11,
            SessionKind.PRACTICE: 11,
            SessionKind.LEGENDARY: 1,
        }
        assert {(s.status, s.end_reason) for s in sessions} == {(SessionStatus.COMPLETED, EndReason.PASSED)}
        assert play_repo.active_session(seeded_db, learner.id) is None

    def test_every_session_earns_its_base_and_combo_lines(self, seeded_db: Session, learner: User) -> None:
        lines = Counter(seeded_db.scalars(select(XpEvent.session_id).where(XpEvent.user_id == learner.id)))
        assert len(lines) == 23 and set(lines.values()) == {2}

    def test_the_path_shows_every_node_state(self, seeded_db: Session, learner: User) -> None:
        assert node_states(seeded_db, learner) == {
            "u1.hello": NodeState.LEGENDARY,
            "u1.intro": NodeState.COMPLETED,
            "u1.chest": NodeState.COMPLETED,
            "u1.review": NodeState.COMPLETED,
            "u2.food": NodeState.COMPLETED,
            "u2.drinks": NodeState.ACTIVE,
            "u2.chest": NodeState.LOCKED,
            "u2.review": NodeState.LOCKED,
            "u3.family": NodeState.LOCKED,
            "u3.people": NodeState.LOCKED,
            "u3.review": NodeState.LOCKED,
        }
        drinks = seeded_db.scalar(select(PathNode.id).where(PathNode.key == "u2.drinks"))
        assert play_repo.lessons_completed_by_node(seeded_db, learner.id)[drinks] == 1  # "1/3"

    def test_answers_are_paced_nine_seconds_apart(self, seeded_db: Session, learner: User) -> None:
        first = sessions_of(seeded_db, learner.id)[0]
        answered = list(
            seeded_db.scalars(
                select(SessionItem.answered_at)
                .where(SessionItem.session_id == first.id)
                .order_by(SessionItem.seq)
            )
        )
        assert answered == [first.started_at + timedelta(seconds=9 * n) for n in range(1, 7)]
        assert first.ended_at == answered[-1] + timedelta(seconds=3)


class TestStreak:
    def test_13_days_at_risk_with_one_freeze_equipped(self, learner: User) -> None:
        stats = learner.stats
        assert stats is not None
        assert (stats.streak_current, stats.streak_longest, stats.streak_last_date) == (
            13,
            13,
            days_before(1),
        )
        assert stats.streak_freezes == 1

    def test_the_calendar_shows_two_runs_and_the_day_a_freeze_covered(
        self, seeded_db: Session, learner: User
    ) -> None:
        days = {
            day.local_date: (day.kind, day.goal_xp)
            for day in seeded_db.scalars(select(ActivityDay).where(ActivityDay.user_id == learner.id))
        }
        old_run = {days_before(n) for n in range(21, 31)}
        current_run = {days_before(n) for n in range(1, 15) if n != 6}
        assert days.pop(days_before(6)) == (ActivityKind.FROZEN, None)
        assert set(days) == old_run | current_run
        assert set(days.values()) == {(ActivityKind.ACTIVE, 20)}


class TestGemsAndHearts:
    def test_820_gems_after_the_scripted_ledger(self, seeded_db: Session, learner: User) -> None:
        ledger = seeded_db.execute(
            select(GemTransaction.reason, GemTransaction.delta, GemTransaction.balance_after)
            .where(GemTransaction.user_id == learner.id)
            .order_by(GemTransaction.created_at, GemTransaction.id)
        ).all()
        assert [tuple(row) for row in ledger] == [
            (GemReason.SEED, 1300, 1300),
            (GemReason.CHEST, 20, 1320),
            (GemReason.PURCHASE, -200, 1120),
            (GemReason.LEGENDARY_FEE, -100, 1020),
            (GemReason.PURCHASE, -200, 820),
        ]
        assert learner.stats is not None and learner.stats.gems == 820

    def test_two_streak_freezes_were_bought(self, seeded_db: Session, learner: User) -> None:
        purchases = seeded_db.execute(
            select(Purchase.idempotency_key, ShopItem.code, Purchase.price_gems, Purchase.purchased_at)
            .join(ShopItem)
            .where(Purchase.user_id == learner.id)
            .order_by(Purchase.purchased_at)
        ).all()
        assert [tuple(row) for row in purchases] == [
            ("seed-1", "streak_freeze", 200, datetime(2026, 9, 24, 13, 0, tzinfo=UTC)),  # D-14 18:30 local
            ("seed-2", "streak_freeze", 200, datetime(2026, 10, 3, 13, 40, tzinfo=UTC)),  # D-5 19:10 local
        ]

    def test_four_hearts_with_the_next_one_in_four_hours(self, learner: User) -> None:
        stats = learner.stats
        assert stats is not None
        assert (stats.hearts, stats.hearts_regen_anchor_at) == (4, FROZEN_NOW - timedelta(hours=1))


class TestLeagues:
    def test_promoted_from_bronze_last_week_with_the_result_not_yet_seen(
        self, seeded_db: Session, learner: User
    ) -> None:
        cohort = seeded_db.scalar(select(LeagueCohort).where(LeagueCohort.league_tier == 1))
        assert cohort is not None
        assert (cohort.week_start, cohort.finalized_at) == (date(2026, 9, 28), FROZEN_NOW)
        members = sorted(cohort.memberships, key=lambda m: m.final_rank or 0)
        assert [m.final_rank for m in members] == list(range(1, 31))
        mine = next(m for m in members if m.user_id == learner.id)
        start, end = league_week_bounds(cohort.week_start)
        assert mine.final_xp == ledger_repo.xp_totals(seeded_db, learner.id, D, start, end).in_window == 112
        assert (mine.outcome, mine.result_seen_at) == (LeagueOutcome.PROMOTED, None)
        assert mine.joined_at == min(
            seeded_db.scalars(
                select(XpEvent.earned_at).where(XpEvent.earned_at >= start, XpEvent.earned_at < end)
            )
        )

    def test_competes_in_silver_this_week_against_29_bots(self, seeded_db: Session, learner: User) -> None:
        assert learner.stats is not None and learner.stats.league_tier == 2
        cohort = seeded_db.scalar(select(LeagueCohort).where(LeagueCohort.league_tier == 2))
        assert cohort is not None
        assert (cohort.week_start, cohort.finalized_at) == (date(2026, 10, 5), None)
        bots = set(seeded_db.scalars(select(BotProfile.user_id)))
        members = {m.user_id: m for m in cohort.memberships}
        assert len(members) == 30 and set(members) - bots == {learner.id}
        week_start, _ = league_week_bounds(cohort.week_start)
        first_xp_this_week = seeded_db.scalar(
            select(func.min(XpEvent.earned_at)).where(XpEvent.earned_at >= week_start)
        )
        assert members[learner.id].joined_at == first_xp_this_week
        assert {m.joined_at for user_id, m in members.items() if user_id != learner.id} == {week_start}


class TestAchievements:
    def test_four_badges_reach_level_2_at_the_seed_instant(self, seeded_db: Session, learner: User) -> None:
        rows = seeded_db.execute(
            select(
                Achievement.code,
                AchievementTier.level,
                UserAchievement.unlocked_at,
                UserAchievement.session_id,
            )
            .join(AchievementTier, AchievementTier.id == UserAchievement.achievement_tier_id)
            .join(Achievement)
            .where(UserAchievement.user_id == learner.id)
            .order_by(Achievement.position, AchievementTier.level)
        ).all()
        assert [(code, level) for code, level, _, _ in rows] == [
            ("wildfire", 1),
            ("wildfire", 2),
            ("sage", 1),
            ("sage", 2),
            ("sharpshooter", 1),
            ("sharpshooter", 2),
            ("champion", 1),
            ("champion", 2),
        ]
        assert {(unlocked_at, session_id) for _, _, unlocked_at, session_id in rows} == {(FROZEN_NOW, None)}

    def test_the_learner_statistics(self, seeded_db: Session, learner: User) -> None:
        assert achievement_service.metrics_for(seeded_db, learner, FROZEN_NOW) == {
            Metric.LONGEST_STREAK: 13,
            Metric.TOTAL_XP: 373,
            Metric.WORDS_LEARNED: 38,  # Say hello 14 + Introduce yourself 15 + Food 9: Scholar stays at 0
            Metric.PERFECT_LESSONS: 5,
            Metric.HIGHEST_LEAGUE: 2,
            Metric.FIRST_PLACE_FINISHES: 0,
            Metric.DIAMOND_WINS: 0,
        }

    def test_the_profile_lists_all_seven_with_levels_and_dates(
        self, seeded_db: Session, learner: User
    ) -> None:
        metrics = achievement_service.metrics_for(seeded_db, learner, FROZEN_NOW)
        badges = achievement_service.list_for_profile(seeded_db, learner.id, metrics, is_bot=False)
        assert [(b.code, b.level, b.current_value, b.next_threshold) for b in badges] == [
            ("wildfire", 2, 13, 14),
            ("sage", 2, 373, 500),
            ("scholar", 0, 38, 50),
            ("sharpshooter", 2, 5, 20),
            ("champion", 2, 2, 3),
            ("winner", 0, 0, 1),
            ("legendary", 0, 0, 1),
        ]
        wildfire = badges[0]
        assert wildfire.description == "Reach a 14 day streak"
        assert [tier.unlocked_at for tier in wildfire.tiers[:3]] == [FROZEN_NOW, FROZEN_NOW, None]
        assert badges[4].description == "Advance to the Gold League"

    def test_a_bot_profile_is_computed_and_never_dated(self, seeded_db: Session) -> None:
        bot = seeded_db.scalar(
            select(BotProfile).join(LeagueMembership, LeagueMembership.user_id == BotProfile.user_id)
        )
        assert bot is not None
        metrics = achievement_service.metrics_for(seeded_db, bot.user, FROZEN_NOW)
        assert metrics[Metric.LONGEST_STREAK] == bot.baseline_streak
        assert metrics[Metric.TOTAL_XP] > bot.baseline_xp  # plus its league weeks
        assert metrics[Metric.WORDS_LEARNED] == metrics[Metric.PERFECT_LESSONS] == 0
        badges = achievement_service.list_for_profile(seeded_db, bot.user_id, metrics, is_bot=True)
        assert len(badges) == 7
        assert all(tier.unlocked_at is None for badge in badges for tier in badge.tiers)
        assert achievement_service.evaluate(seeded_db, bot.user_id, FROZEN_NOW) == []

    def test_evaluating_again_reports_and_writes_nothing(self, seeded_db: Session, learner: User) -> None:
        assert achievement_service.evaluate(seeded_db, learner.id, FROZEN_NOW + timedelta(hours=1)) == []
        seeded_db.flush()
        assert seeded_db.scalar(select(func.count()).select_from(UserAchievement)) == 8

    def test_a_longer_streak_unlocks_only_the_highest_new_level(
        self, seeded_db: Session, learner: User
    ) -> None:
        later = FROZEN_NOW + timedelta(days=1)
        seeded_db.execute(
            update(UserStats)
            .where(UserStats.user_id == learner.id)
            .values(streak_current=30, streak_longest=30)
        )
        seeded_db.expire_all()
        unlocked = achievement_service.evaluate(seeded_db, learner.id, later)
        assert [(u.code, u.level, u.threshold, u.description) for u in unlocked] == [
            ("wildfire", 4, 30, "Reach a 30 day streak")
        ]
        seeded_db.flush()
        new_rows = seeded_db.scalars(
            select(UserAchievement).where(UserAchievement.unlocked_at == later)
        ).all()
        assert len(new_rows) == 2  # levels 3 and 4 both recorded


# Damage to the seeded database, one kind at a time, and the invariant that must report it. Each is
# raw SQL on a private copy; the one-active-session index has to go before I4 can be broken at all.
DAMAGE: dict[str, tuple[str, ...]] = {
    "I1": ("UPDATE user_stats SET gems = gems + 1",),
    "I2": ("UPDATE user_stats SET hearts_regen_anchor_at = '2026-10-08 13:00:00.000000'",),
    "I3": ("UPDATE user_stats SET streak_current = 12",),
    "I4": (
        "DROP INDEX ux_lesson_sessions_one_active",
        "UPDATE lesson_sessions SET status = 'active', end_reason = NULL, ended_at = NULL"
        " WHERE id IN (SELECT id FROM lesson_sessions ORDER BY id LIMIT 2)",
    ),
    "I5": ("UPDATE xp_events SET amount = amount + 1 WHERE id = (SELECT MIN(id) FROM xp_events)",),
    "I6": ("UPDATE purchases SET purchased_at = '2026-10-09 12:00:00.000000'",),
    "I7": ("UPDATE league_memberships SET final_rank = 31 WHERE final_rank = 30",),
    "I8": ("DELETE FROM activity_days WHERE local_date = '2026-10-07'",),
    "I9": (
        "UPDATE gem_transactions SET node_id = (SELECT id FROM path_nodes WHERE key = 'u1.hello')"
        " WHERE reason = 'chest'",
    ),
}


class TestInvariants:
    """The invariants every state of the game keeps, checked on the seed itself."""

    def test_the_seed_keeps_every_invariant(self, seeded_db: Session) -> None:
        assert check_invariants(seeded_db, FROZEN_NOW) == []

    @pytest.mark.parametrize("invariant", sorted(DAMAGE))
    def test_the_checker_reports_each_kind_of_damage(self, seeded_db: Session, invariant: str) -> None:
        for statement in DAMAGE[invariant]:
            seeded_db.execute(text(statement))
        seeded_db.expire_all()
        problems = check_invariants(seeded_db, FROZEN_NOW)
        assert any(problem.startswith(f"{invariant}:") for problem in problems), problems

    def test_gems_equal_the_ledger_sum_and_the_last_balance(self, seeded_db: Session, learner: User) -> None:
        balances = list(
            seeded_db.scalars(
                select(GemTransaction.balance_after)
                .where(GemTransaction.user_id == learner.id)
                .order_by(GemTransaction.id)
            )
        )
        total = seeded_db.scalar(
            select(func.sum(GemTransaction.delta)).where(GemTransaction.user_id == learner.id)
        )
        assert learner.stats is not None and learner.stats.gems == total == balances[-1]

    def test_hearts_and_their_anchor_agree(self, learner: User) -> None:
        stats = learner.stats
        assert stats is not None
        assert 0 <= stats.hearts < 5 and stats.hearts_regen_anchor_at is not None
        assert stats.hearts_regen_anchor_at <= FROZEN_NOW

    def test_the_streak_counts_the_active_days_of_its_unbroken_run(
        self, seeded_db: Session, learner: User
    ) -> None:
        stats = learner.stats
        assert stats is not None and stats.streak_last_date is not None
        covered = {
            day.local_date: day.kind
            for day in seeded_db.scalars(select(ActivityDay).where(ActivityDay.user_id == learner.id))
        }
        day, active = stats.streak_last_date, 0
        while day in covered:
            active += covered[day] == ActivityKind.ACTIVE
            day -= timedelta(days=1)
        assert stats.streak_last_date >= local_date(FROZEN_NOW, ZONE) - timedelta(days=1)
        assert stats.streak_longest >= stats.streak_current == active

    def test_stored_xp_and_snapshots_match_a_recomputation(self, seeded_db: Session, learner: User) -> None:
        node_kinds = {
            node_id: kind for node_id, kind in seeded_db.execute(select(PathNode.id, PathNode.kind))
        }
        for session in sessions_of(seeded_db, learner.id):
            items = [
                ItemFacts(item.seq, item.exercise_id, item.origin, item.result)
                for item in seeded_db.scalars(select(SessionItem).where(SessionItem.session_id == session.id))
            ]
            expected = xp.session_xp_lines(
                session.kind,
                node_kind=None if session.node_id is None else node_kinds[session.node_id],
                best_run=session_flow.best_combo(items),
                item_count=session_flow.initial_count(items),
                correct=session_flow.correct_count(items),
                boost_active=False,
            )
            stored = seeded_db.execute(
                select(XpEvent.reason, XpEvent.amount, XpEvent.user_id).where(
                    XpEvent.session_id == session.id
                )
            ).all()
            assert {(line.reason, line.amount, learner.id) for line in expected} == {
                tuple(row) for row in stored
            }
            assert (session.mistakes, session.best_combo) == (
                session_flow.mistakes(items),
                session_flow.best_combo(items),
            )

    def test_nothing_is_dated_in_the_future(self, seeded_db: Session) -> None:
        instants = [
            select(func.max(XpEvent.earned_at)),
            select(func.max(GemTransaction.created_at)),
            select(func.max(Purchase.purchased_at)),
            select(func.max(LessonSession.started_at)),
            select(func.max(LessonSession.ended_at)),
            select(func.max(SessionItem.answered_at)),
            select(func.max(ActivityDay.created_at)),
            select(func.max(LeagueMembership.joined_at)),
            select(func.max(UserAchievement.unlocked_at)),
            select(func.max(User.joined_at)),
        ]
        assert all(seeded_db.scalar(query) <= FROZEN_NOW for query in instants)
        assert seeded_db.scalar(select(func.max(ActivityDay.local_date))) < D

    def test_one_membership_per_week_and_gapless_final_ranks(self, seeded_db: Session, learner: User) -> None:
        weeks = seeded_db.scalars(
            select(LeagueCohort.week_start)
            .join(LeagueCohort.memberships)
            .where(LeagueMembership.user_id == learner.id)
        ).all()
        assert len(weeks) == len(set(weeks)) == 2
        for cohort in seeded_db.scalars(select(LeagueCohort).where(LeagueCohort.finalized_at.is_not(None))):
            assert sorted(m.final_rank or 0 for m in cohort.memberships) == list(
                range(1, len(cohort.memberships) + 1)
            )

    def test_active_days_are_exactly_the_days_with_xp(self, seeded_db: Session, learner: User) -> None:
        xp_days = set(seeded_db.scalars(select(XpEvent.local_date).where(XpEvent.user_id == learner.id)))
        active_days = set(
            seeded_db.scalars(
                select(ActivityDay.local_date).where(
                    ActivityDay.user_id == learner.id, ActivityDay.kind == ActivityKind.ACTIVE
                )
            )
        )
        assert active_days == xp_days

    def test_one_fee_per_legendary_run_and_chest_rewards_from_chests(self, seeded_db: Session) -> None:
        legendary = set(
            seeded_db.scalars(select(LessonSession.id).where(LessonSession.kind == SessionKind.LEGENDARY))
        )
        fees = Counter(
            seeded_db.scalars(
                select(GemTransaction.session_id).where(GemTransaction.reason == GemReason.LEGENDARY_FEE)
            )
        )
        assert fees == {session_id: 1 for session_id in legendary}
        chest_kinds = seeded_db.scalars(
            select(PathNode.kind)
            .join(GemTransaction, GemTransaction.node_id == PathNode.id)
            .where(GemTransaction.reason == GemReason.CHEST)
        ).all()
        assert chest_kinds == [NodeKind.CHEST]

    def test_bots_have_no_settings_stats_or_ledger_rows(self, seeded_db: Session) -> None:
        bots = select(BotProfile.user_id)
        for table in (UserSettings, UserStats, XpEvent, GemTransaction, LessonSession, ActivityDay):
            assert (
                seeded_db.scalar(select(func.count()).select_from(table).where(table.user_id.in_(bots))) == 0
            )


class TestSeeding:
    def test_seeding_again_changes_nothing(self, seeded_db: Session) -> None:
        counts_before = table_counts(seeded_db)
        assert (
            seed_if_empty(
                seeded_db, real_now=FROZEN_NOW + timedelta(days=3), settings=api_settings("sqlite://")
            )
            is False
        )
        assert table_counts(seeded_db) == counts_before

    def test_the_content_rows_match_the_files(self, seeded_db: Session) -> None:
        counts = table_counts(seeded_db)
        assert (counts["courses"], counts["path_nodes"], counts["exercises"], counts["glossary_terms"]) == (
            3,
            11,
            120,
            69,
        )
        assert (counts["users"], counts["bot_profiles"]) == (36, 35)
        state = seeded_db.get(AppState, 1)
        assert state is not None and (state.clock_offset_seconds, state.seeded_at) == (0, FROZEN_NOW)

    def test_choice_ids_and_positions_do_not_give_the_answer_away(self, seeded_db: Session) -> None:
        # The files list each exercise's correct choice first; numbering them in that order would
        # make the lowest option id the answer to every choice exercise.
        choice_types = (ExerciseType.MULTIPLE_CHOICE, ExerciseType.FILL_BLANK)
        exercises = seeded_db.scalars(
            select(Exercise).where(Exercise.type.in_(choice_types)).options(*content_repo.EXERCISE_CHILDREN)
        ).all()
        correct = [next(option for option in exercise.options if option.is_correct) for exercise in exercises]
        lowest_id = sum(option.id == min(o.id for o in option.exercise.options) for option in correct)
        first_place = sum(option.position == 1 for option in correct)
        assert len(exercises) == 41
        assert lowest_id < len(exercises) / 2  # about one in three, as chance gives
        assert first_place < len(exercises) / 2

    def test_planning_the_history_loads_no_service_but_the_answer_adapters(self) -> None:
        # The history is planned with the pure rules; it must not pull in the lesson-loop services.
        probe = (
            "import sys, app.seed.history;"
            "print(sorted(m for m in sys.modules if m.startswith('app.services.')))"
        )
        backend = Path(__file__).resolve().parents[2]
        loaded = subprocess.run(
            [sys.executable, "-c", probe], capture_output=True, text=True, check=True, cwd=backend
        ).stdout
        assert loaded.strip() == "['app.services.exercises']"

    def test_the_seed_fits_the_boot_budget(self, tmp_path: Path) -> None:
        engine = build_database(tmp_path / "budget.db")
        try:
            with make_session_factory(engine)() as db:
                started = time.perf_counter()
                assert seed_if_empty(db, real_now=FROZEN_NOW, settings=api_settings(str(engine.url))) is True
                db.commit()
                elapsed = time.perf_counter() - started
        finally:
            engine.dispose()
        if elapsed > SEED_BUDGET_SECONDS:  # a slow CI machine is not a failure, but it is worth seeing
            warnings.warn(
                f"seeding took {elapsed:.2f} s, over the {SEED_BUDGET_SECONDS} s budget", stacklevel=1
            )


def table_counts(db: Session) -> dict[str, int]:
    models = (
        Course, PathNode, Exercise, GlossaryTerm, User, BotProfile, UserStats, LessonSession,
        SessionItem, XpEvent, GemTransaction, ActivityDay, LeagueCohort, LeagueMembership, UserAchievement,
    )  # fmt: skip
    return {model.__tablename__: db.scalar(select(func.count()).select_from(model)) or 0 for model in models}


class TestReset:
    LATER = FROZEN_NOW + timedelta(days=5)  # Tuesday 2026-10-13: a new league week

    def test_rebuilds_the_demo_relative_to_real_now(self, seeded_db: Session, learner: User) -> None:
        seeded_db.execute(update(AppState).values(clock_offset_seconds=86_400))
        seeded_db.execute(update(UserStats).where(UserStats.user_id == learner.id).values(gems=5))
        reset_demo(seeded_db, self.LATER, api_settings("sqlite://"))
        seeded_db.commit()

        later_day = local_date(self.LATER, ZONE)
        stats = seeded_db.get(UserStats, learner.id)
        assert stats is not None
        assert (stats.gems, stats.streak_current, stats.streak_last_date) == (
            820,
            13,
            later_day - timedelta(days=1),
        )
        assert stats.hearts_regen_anchor_at == self.LATER - timedelta(hours=1)
        state = seeded_db.get(AppState, 1)
        assert state is not None and (state.clock_offset_seconds, state.seeded_at) == (0, self.LATER)
        assert ledger_repo.total_xp(seeded_db, learner.id) == 373
        assert len(sessions_of(seeded_db, learner.id)) == 23
        weeks = set(seeded_db.scalars(select(LeagueCohort.week_start)))
        assert weeks == {date(2026, 10, 5), date(2026, 10, 12)}
        unlocked = set(seeded_db.scalars(select(UserAchievement.unlocked_at)))
        assert unlocked == {self.LATER}
        assert check_invariants(seeded_db, self.LATER) == []

    def test_keeps_content_bots_and_the_zone_confirmation(self, seeded_db: Session, learner: User) -> None:
        counts_before = table_counts(seeded_db)
        seeded_db.execute(update(User).where(User.id == learner.id).values(timezone_confirmed=True))
        reset_demo(seeded_db, self.LATER, api_settings("sqlite://"))
        seeded_db.commit()
        counts_after = table_counts(seeded_db)
        for table in ("courses", "path_nodes", "exercises", "glossary_terms", "users", "bot_profiles"):
            assert counts_after[table] == counts_before[table]
        user = seeded_db.get(User, learner.id)
        assert user is not None and (user.timezone, user.timezone_confirmed) == (ZONE, True)

    def test_can_replay_the_history_in_another_zone(self, seeded_db: Session, learner: User) -> None:
        reset_demo(seeded_db, self.LATER, api_settings("sqlite://"), tz="America/Los_Angeles")
        seeded_db.commit()
        user = seeded_db.get(User, learner.id)
        assert user is not None and user.stats is not None
        today_there = local_date(self.LATER, "America/Los_Angeles")
        assert user.timezone == "America/Los_Angeles"
        assert user.stats.streak_last_date == today_there - timedelta(days=1)
        assert user.joined_at == datetime(
            2026, 9, 13, 19, 0, tzinfo=UTC
        )  # noon in Los Angeles, 30 days earlier

    def test_gives_every_other_human_fresh_stats(self, seeded_db: Session, learner: User) -> None:
        sam_id = seeded_db.execute(
            insert(User)
            .values(
                username="sam",
                display_name="Sam",
                avatar_color="#58CC02",
                timezone="UTC",
                current_course_id=learner.current_course_id,
                joined_at=FROZEN_NOW,
            )
            .returning(User.id)
        ).scalar_one()
        insert_fresh_learner_rows(seeded_db, [sam_id], FROZEN_NOW)
        seeded_db.execute(
            update(UserStats)
            .where(UserStats.user_id == sam_id)
            .values(hearts=2, hearts_regen_anchor_at=FROZEN_NOW, gems=0)
        )
        reset_demo(seeded_db, self.LATER, api_settings("sqlite://"))
        seeded_db.commit()
        stats = seeded_db.get(UserStats, sam_id)
        assert stats is not None and (stats.hearts, stats.hearts_regen_anchor_at, stats.gems) == (5, None, 0)
        assert seeded_db.get(UserSettings, sam_id) is not None
        assert play_repo.count_completed_sessions(seeded_db, sam_id) == 0
