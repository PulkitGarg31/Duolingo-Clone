"""The invariants every state of the game keeps, checked straight on the database.

`check_invariants(db, now)` lists every broken invariant as one readable line; an empty list means the
database is consistent at `now`. The API tests run it after every scenario and the seed tests run it
on the seeded demo, each time after bringing every learner up to `now` the way a request does,
because I3 describes a settled streak.

- I1: a learner's gems equal the sum of their gem ledger, and each row's balance follows from the
  rows before it.
- I2: 0 <= hearts <= 5; the regeneration anchor is set exactly when hearts are below 5, and never
  lies in the future.
- I3: a live streak covers yesterday or today, never exceeds the record and counts the active days of
  its run; a lost streak has no last day.
- I4: a user has at most one active session.
- I5: a completed session's XP lines and its mistake and combo snapshots match its items; no other
  session earned XP.
- I6: no row is dated after `now`, and no learner-local day after the learner's today.
- I7: a learner has at most one league membership per week; a finalized cohort ranks its members 1..n.
- I8: a learner has an active calendar day exactly on the local days they earned XP.
- I9: each legendary session paid exactly one entry fee; chest rewards come from chest nodes only.
"""

from collections import Counter, defaultdict
from collections.abc import Sequence
from datetime import date, datetime, timedelta
from typing import Final

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.domain import session_flow, xp
from app.domain.calendar import local_date
from app.domain.enums import ActivityKind, GemReason, NodeKind, SessionKind, SessionStatus, XpReason
from app.domain.rules import MAX_HEARTS
from app.domain.session_flow import ItemFacts
from app.models import (
    ActivityDay,
    AppState,
    GemTransaction,
    LeagueCohort,
    LeagueMembership,
    LessonSession,
    PathNode,
    Purchase,
    QuestClaim,
    SessionItem,
    User,
    UserAchievement,
    UserSettings,
    UserStats,
    XpEvent,
)

ONE_DAY: Final = timedelta(days=1)

# Every column that records when something happened. A deadline (`expires_at`) or the end of an XP
# Boost (`xp_boost_until`) may lie ahead; a fact may not.
INSTANT_COLUMNS: Final = (
    XpEvent.earned_at,
    GemTransaction.created_at,
    ActivityDay.created_at,
    LeagueCohort.created_at,
    LeagueCohort.finalized_at,
    LeagueMembership.joined_at,
    LeagueMembership.result_seen_at,
    LessonSession.started_at,
    LessonSession.last_activity_at,
    LessonSession.ended_at,
    SessionItem.answered_at,
    Purchase.purchased_at,
    QuestClaim.claimed_at,
    UserAchievement.unlocked_at,
    UserSettings.updated_at,
    UserStats.updated_at,
    User.joined_at,
    AppState.seeded_at,
)

# Learner-local days, as (owner column, day column). Each is a snapshot of the learner's day when it
# was written, in the zone the learner had then.
DAY_COLUMNS: Final = (
    (ActivityDay.user_id, ActivityDay.local_date),
    (XpEvent.user_id, XpEvent.local_date),
    (QuestClaim.user_id, QuestClaim.local_date),
    (UserStats.user_id, UserStats.streak_last_date),
)


def check_invariants(db: Session, now: datetime, *, zone_shifted: bool = False) -> list[str]:
    """Every broken invariant as a readable line, or [] when the database is consistent at `now`.

    Pass `zone_shifted=True` after a learner changed time zone. A change moves the streak's last day
    but not the day snapshots already written (calendar rows, XP days), so the two checks that
    compare those snapshots with days in the new zone are skipped: the streak's run count (I3) and
    "no day after today" (I6).
    """
    learners = list(db.scalars(select(User).join(UserStats).options(selectinload(User.stats))))
    return [
        *gems_match_the_ledger(db, learners),
        *hearts_are_in_range(learners, now),
        *streaks_are_settled(db, learners, now, count_runs=not zone_shifted),
        *one_active_session_per_user(db),
        *xp_matches_the_sessions(db),
        *nothing_is_dated_in_the_future(db, learners, now, check_days=not zone_shifted),
        *league_weeks_are_consistent(db, learners),
        *active_days_are_the_days_with_xp(db, learners),
        *fees_and_chests_point_at_their_sources(db),
    ]


# ---- I1 to I3: the stored counters ----


def gems_match_the_ledger(db: Session, learners: Sequence[User]) -> list[str]:
    """I1: the cached balance is the ledger's sum, and every row's balance is the running sum."""
    problems: list[str] = []
    running: defaultdict[int, int] = defaultdict(int)
    rows = db.execute(
        select(
            GemTransaction.id, GemTransaction.user_id, GemTransaction.delta, GemTransaction.balance_after
        ).order_by(GemTransaction.user_id, GemTransaction.id)
    )
    for row_id, user_id, delta, balance_after in rows:
        running[user_id] += delta
        if balance_after != running[user_id]:
            problems.append(
                f"I1: gem row {row_id} of user {user_id} records a balance of {balance_after},"
                f" but the ledger sums to {running[user_id]}"
            )
    for learner in learners:
        gems = _stats(learner).gems
        if gems != running[learner.id]:
            problems.append(
                f"I1: user {learner.id} has {gems} gems, but the ledger sums to {running[learner.id]}"
            )
    return problems


def hearts_are_in_range(learners: Sequence[User], now: datetime) -> list[str]:
    """I2: hearts within 0..5, an anchor exactly when below 5, and never an anchor in the future."""
    problems: list[str] = []
    for learner in learners:
        stats = _stats(learner)
        anchor = stats.hearts_regen_anchor_at
        if not 0 <= stats.hearts <= MAX_HEARTS:
            problems.append(f"I2: user {learner.id} has {stats.hearts} hearts")
        if (anchor is None) != (stats.hearts == MAX_HEARTS):
            problems.append(
                f"I2: user {learner.id} has {stats.hearts} hearts and regeneration anchor {anchor}"
            )
        if anchor is not None and anchor > now:
            problems.append(f"I2: user {learner.id} has a regeneration anchor {anchor} after now {now}")
    return problems


def streaks_are_settled(
    db: Session, learners: Sequence[User], now: datetime, *, count_runs: bool
) -> list[str]:
    """I3: a live streak covers yesterday or today and never exceeds the record; a lost one has no day.

    With `count_runs`, a live streak must also equal the number of active days in the unbroken run of
    covered days (active or frozen) that ends on its last day: a frozen day keeps a streak alive
    without lengthening it.
    """
    problems: list[str] = []
    calendars = _calendars(db)
    for learner in learners:
        stats = _stats(learner)
        last, current = stats.streak_last_date, stats.streak_current
        if current == 0:
            if last is not None:
                problems.append(f"I3: user {learner.id} has no streak, yet a last streak day {last}")
            continue
        today = local_date(now, learner.timezone)
        if last is None or last < today - ONE_DAY:
            problems.append(
                f"I3: user {learner.id} has a {current}-day streak that ended on {last}, before yesterday"
            )
            continue
        if stats.streak_longest < current:
            problems.append(
                f"I3: user {learner.id} has a {current}-day streak but a record of {stats.streak_longest}"
            )
        active = _active_days_in_run(calendars[learner.id], last)
        if count_runs and active != current:
            problems.append(
                f"I3: user {learner.id} has a {current}-day streak, but the run of covered days ending on"
                f" {last} holds {active} active days"
            )
    return problems


def _calendars(db: Session) -> defaultdict[int, dict[date, ActivityKind]]:
    """Each user's covered local days, with how each was covered."""
    calendars: defaultdict[int, dict[date, ActivityKind]] = defaultdict(dict)
    for user_id, day, kind in db.execute(
        select(ActivityDay.user_id, ActivityDay.local_date, ActivityDay.kind)
    ):
        calendars[user_id][day] = kind
    return calendars


def _active_days_in_run(calendar: dict[date, ActivityKind], last: date) -> int:
    """The active days in the unbroken run of covered days that ends on `last`."""
    active, day = 0, last
    while day in calendar:
        active += calendar[day] == ActivityKind.ACTIVE
        day -= ONE_DAY
    return active


# ---- I4 and I5: sessions ----


def one_active_session_per_user(db: Session) -> list[str]:
    """I4: at most one active session per user."""
    rows = db.execute(
        select(LessonSession.user_id, func.count())
        .where(LessonSession.status == SessionStatus.ACTIVE)
        .group_by(LessonSession.user_id)
        .having(func.count() > 1)
    )
    return [f"I4: user {user_id} has {count} active sessions" for user_id, count in rows]


def xp_matches_the_sessions(db: Session) -> list[str]:
    """I5: completed sessions earned exactly the XP lines their items give, and no other session earned any.

    The lines are recomputed with the XP rules from the session's items. Whether an XP Boost was
    running is not stored on the session, so a session with a boost line is recomputed with the boost
    on: the check then proves the boost line's amount. The completion snapshots (mistakes, best combo)
    must match the items too, and every XP line must belong to the session's own learner.
    """
    problems: list[str] = []
    lines: defaultdict[int, list[tuple[XpReason, int, int]]] = defaultdict(list)
    rows = db.execute(select(XpEvent.session_id, XpEvent.reason, XpEvent.amount, XpEvent.user_id))
    for session_id, reason, amount, user_id in rows:
        lines[session_id].append((reason, amount, user_id))
    node_kinds = {node_id: kind for node_id, kind in db.execute(select(PathNode.id, PathNode.kind))}
    for session in db.scalars(select(LessonSession).options(selectinload(LessonSession.items))):
        earned = lines.get(session.id, [])
        if session.status == SessionStatus.COMPLETED:
            problems += _completed_session_problems(session, earned, node_kinds)
        elif earned:
            problems.append(f"I5: session {session.id} is {session.status.value} but earned XP")
    return problems


def _completed_session_problems(
    session: LessonSession, earned: list[tuple[XpReason, int, int]], node_kinds: dict[int, NodeKind]
) -> list[str]:
    """What is wrong with one completed session's XP lines and snapshots."""
    problems: list[str] = []
    items = [ItemFacts(item.seq, item.exercise_id, item.origin, item.result) for item in session.items]
    expected = xp.session_xp_lines(
        session.kind,
        node_kind=None if session.node_id is None else node_kinds[session.node_id],
        best_run=session_flow.best_combo(items),
        item_count=session_flow.initial_count(items),
        correct=session_flow.correct_count(items),
        boost_active=any(reason == XpReason.BOOST for reason, _, _ in earned),
    )
    stored_lines = sorted((reason.value, amount) for reason, amount, _ in earned)
    expected_lines = sorted((line.reason.value, line.amount) for line in expected)
    if stored_lines != expected_lines:
        problems.append(
            f"I5: session {session.id} earned {stored_lines}, but its items give {expected_lines}"
        )
    if any(user_id != session.user_id for _, _, user_id in earned):
        problems.append(f"I5: session {session.id} has XP lines credited to another user")
    snapshots = (session.mistakes, session.best_combo)
    recomputed = (session_flow.mistakes(items), session_flow.best_combo(items))
    if snapshots != recomputed:
        problems.append(
            f"I5: session {session.id} stored (mistakes, best combo) {snapshots},"
            f" but its items give {recomputed}"
        )
    return problems


# ---- I6: time ----


def nothing_is_dated_in_the_future(
    db: Session, learners: Sequence[User], now: datetime, *, check_days: bool
) -> list[str]:
    """I6: no fact is dated after `now`; with `check_days`, no learner-local day after the learner's today."""
    problems: list[str] = []
    for column in INSTANT_COLUMNS:
        latest = db.scalar(select(func.max(column)))
        if latest is not None and latest > now:
            problems.append(
                f"I6: {column.class_.__tablename__}.{column.key} reaches {latest}, after now {now}"
            )
    if not check_days:
        return problems
    todays = {learner.id: local_date(now, learner.timezone) for learner in learners}
    for owner, day in DAY_COLUMNS:
        for user_id, latest_day in db.execute(select(owner, func.max(day)).group_by(owner)):
            today = todays.get(user_id)
            if today is not None and latest_day is not None and latest_day > today:
                problems.append(
                    f"I6: {day.class_.__tablename__}.{day.key} of user {user_id} reaches {latest_day},"
                    f" after their today {today}"
                )
    return problems


# ---- I7: leagues ----


def league_weeks_are_consistent(db: Session, learners: Sequence[User]) -> list[str]:
    """I7: one membership per learner per week; finalized cohorts ranked 1..n, open ones not ranked yet."""
    problems: list[str] = []
    repeated = db.execute(
        select(LeagueMembership.user_id, LeagueCohort.week_start, func.count())
        .join(LeagueMembership.cohort)
        .where(LeagueMembership.user_id.in_([learner.id for learner in learners]))
        .group_by(LeagueMembership.user_id, LeagueCohort.week_start)
        .having(func.count() > 1)
    )
    for user_id, week_start, count in repeated:
        problems.append(f"I7: user {user_id} has {count} memberships in the week of {week_start}")
    for cohort in db.scalars(select(LeagueCohort).options(selectinload(LeagueCohort.memberships))):
        ranks = sorted(membership.final_rank or 0 for membership in cohort.memberships)
        if cohort.finalized_at is None and any(ranks):
            problems.append(f"I7: open cohort {cohort.id} already has final ranks {ranks}")
        if cohort.finalized_at is not None and ranks != list(range(1, len(ranks) + 1)):
            problems.append(f"I7: finalized cohort {cohort.id} has final ranks {ranks}")
    return problems


# ---- I8 and I9: calendar days and gem sources ----


def active_days_are_the_days_with_xp(db: Session, learners: Sequence[User]) -> list[str]:
    """I8: a learner's active calendar days are exactly the local days on which they earned XP."""
    learner_ids = [learner.id for learner in learners]
    xp_days = set(
        db.execute(
            select(XpEvent.user_id, XpEvent.local_date).where(XpEvent.user_id.in_(learner_ids))
        ).tuples()
    )
    active_days = set(
        db.execute(
            select(ActivityDay.user_id, ActivityDay.local_date).where(
                ActivityDay.user_id.in_(learner_ids), ActivityDay.kind == ActivityKind.ACTIVE
            )
        ).tuples()
    )
    missing = [
        f"I8: user {user_id} earned XP on {day}, which is not an active day"
        for user_id, day in sorted(xp_days - active_days)
    ]
    extra = [
        f"I8: user {user_id} has {day} as an active day without XP"
        for user_id, day in sorted(active_days - xp_days)
    ]
    return missing + extra


def fees_and_chests_point_at_their_sources(db: Session) -> list[str]:
    """I9: exactly one entry fee per legendary session and none for any other; chest gems from chests."""
    problems: list[str] = []
    fees = Counter(
        db.scalars(select(GemTransaction.session_id).where(GemTransaction.reason == GemReason.LEGENDARY_FEE))
    )
    legendary = set(db.scalars(select(LessonSession.id).where(LessonSession.kind == SessionKind.LEGENDARY)))
    for session_id in sorted(legendary):
        if fees[session_id] != 1:
            problems.append(f"I9: legendary session {session_id} paid {fees[session_id]} entry fees")
    for session_id in sorted(set(fees) - legendary):
        problems.append(f"I9: session {session_id} is not a legendary run but paid an entry fee")
    misplaced_chests = db.execute(
        select(GemTransaction.id, PathNode.kind)
        .join(PathNode, PathNode.id == GemTransaction.node_id)
        .where(GemTransaction.reason == GemReason.CHEST, PathNode.kind != NodeKind.CHEST)
    )
    for row_id, kind in misplaced_chests:
        problems.append(f"I9: chest reward {row_id} comes from a {kind.value} node")
    return problems


def _stats(learner: User) -> UserStats:
    """A learner's counters; the learners were selected by their stats row."""
    if learner.stats is None:
        raise ValueError(f"user {learner.id} has no stats row")
    return learner.stats
