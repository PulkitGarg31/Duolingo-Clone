"""The sample learner's history, planned with the game's own pure rules and no database.

The history script (sample_learner.json) lists what the learner did, day by day, before the seed
day. `plan_sample_learner` turns it into the rows a live learner would have produced: the real
planners pick each session's exercises, the real grader marks each scripted answer, retries are
appended exactly as `session_flow.decide` appends them, XP comes from `xp.session_xp_lines`, the
streak is folded through `streak.settle` and `streak.credit`, and last week's league is finished
with the league and bot rules. `app.seed.sample_learner` reads the inputs and writes the result.
"""

import random
from collections import Counter
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, replace
from datetime import UTC, date, datetime, time, timedelta
from functools import cache, cached_property
from typing import Final
from zoneinfo import ZoneInfo

from app.domain import grading, leagues, planner, session_flow, streak, xp
from app.domain.bots import bot_week_xp
from app.domain.calendar import LEAGUE_WEEK, league_week_bounds, league_week_start, local_date
from app.domain.enums import (
    ActivityKind,
    ExerciseType,
    GemReason,
    GradeNote,
    ItemOrigin,
    ItemResult,
    LeagueOutcome,
    NodeKind,
    SessionKind,
    ShopItemKind,
)
from app.domain.hearts import HeartsState, refill
from app.domain.rng import stable_seed
from app.domain.rules import LEAGUE_UNLOCK_SESSIONS, LEGENDARY_PRICE_GEMS, MAX_STREAK_FREEZES
from app.domain.session_flow import ItemFacts
from app.domain.streak import StreakState
from app.domain.xp import XpLine
from app.schemas.sessions import (
    AnswerIn,
    FillBlankAnswer,
    MatchPairIn,
    MatchPairsAnswer,
    MultipleChoiceAnswer,
    SkipAnswer,
    TranslateAnswer,
    TypeAnswerAnswer,
)
from app.seed.schema import (
    JOIN_TIME,
    ChestStep,
    HeartsSeed,
    HistoryStep,
    PlayStep,
    PurchaseStep,
    SampleLearnerFile,
)
from app.services import exercises
from app.services.session_service import canonical_json

ITEM_PACE: Final = timedelta(seconds=9)  # between two answers
FINISH_DELAY: Final = timedelta(seconds=3)  # from the last answer to the completion
LISTENING_ENABLED: Final = True  # the sample learner keeps listening exercises on (the default setting)


# ---- what the plan reads: the learner's course, the shop and the bots ----


@dataclass(frozen=True)
class ExerciseInfo:
    """An exercise as the planners and the grader see it."""

    id: int
    answer_key: grading.AnswerKey

    @property
    def facts(self) -> planner.ExerciseFacts:
        """What the planners need: the id, the type and whether it is a listening exercise."""
        return planner.ExerciseFacts(self.id, self.answer_key.type, self.answer_key.audio_only)


@dataclass(frozen=True)
class LessonInfo:
    """A lesson and its exercises."""

    id: int
    exercises: tuple[ExerciseInfo, ...]  # in authored order


@dataclass(frozen=True)
class NodeInfo:
    """A path node, with its lessons in order (none for a chest)."""

    id: int
    key: str
    kind: NodeKind
    chest_gems: int | None
    lessons: tuple[LessonInfo, ...]  # in order


@dataclass(frozen=True)
class ShopInfo:
    """A shop item: what it does and what it costs."""

    id: int
    kind: ShopItemKind
    price_gems: int
    duration_minutes: int | None


@dataclass(frozen=True)
class BotInfo:
    """A league bot's pace, which with its seed fixes its weekly XP."""

    user_id: int
    rng_seed: int
    daily_xp: int


@dataclass(frozen=True)
class SampleWorld:
    """Everything the plan needs from the database, read once."""

    nodes: tuple[NodeInfo, ...]  # in course order
    shop: Mapping[str, ShopInfo]  # by item code
    bots: tuple[BotInfo, ...]

    @cached_property
    def exercises(self) -> dict[int, ExerciseInfo]:
        """Every exercise of the course, by id."""
        return {e.id: e for node in self.nodes for lesson in node.lessons for e in lesson.exercises}

    def node(self, key: str) -> NodeInfo:
        """The node with this key."""
        return next(node for node in self.nodes if node.key == key)


# ---- what the plan produces ----


@dataclass(frozen=True)
class PlannedAnswer:
    """One answered item of a session's queue."""

    seq: int
    exercise_id: int
    origin: ItemOrigin
    from_mistakes: bool
    result: ItemResult
    note: GradeNote | None
    submitted_json: str
    answered_at: datetime


@dataclass(frozen=True)
class PlannedSession:
    """A completed session: its answered queue and the XP lines it earned."""

    kind: SessionKind
    node_id: int | None
    lesson_id: int | None
    rng_seed: int
    started_at: datetime
    ended_at: datetime
    mistakes: int
    best_combo: int
    answers: tuple[PlannedAnswer, ...]
    xp_lines: tuple[XpLine, ...]
    local_date: date  # the learner's local day when it was completed


@dataclass(frozen=True)
class PlannedPurchase:
    """A shop purchase, with the price paid."""

    shop_item_id: int
    price_gems: int
    idempotency_key: str
    purchased_at: datetime


@dataclass(frozen=True)
class GemMove:
    """One gem ledger row. Sessions and purchases are named by their index in the plan."""

    delta: int
    balance_after: int
    reason: GemReason
    created_at: datetime
    node_id: int | None = None
    session_index: int | None = None
    purchase_index: int | None = None


@dataclass(frozen=True)
class PlannedDay:
    """A covered day of the streak calendar."""

    local_date: date
    kind: ActivityKind
    goal_xp: int | None  # the daily goal in force, on active days
    created_at: datetime


@dataclass(frozen=True)
class PlannedMember:
    """A cohort member; finished weeks carry the final XP, rank and outcome."""

    user_id: int
    joined_at: datetime
    final_xp: int | None = None
    final_rank: int | None = None
    outcome: LeagueOutcome | None = None


@dataclass(frozen=True)
class PlannedCohort:
    """A league cohort and its members; open while `finalized_at` is None."""

    tier: int
    week_start: date
    created_at: datetime
    finalized_at: datetime | None
    members: tuple[PlannedMember, ...]


@dataclass(frozen=True)
class SampleRows:
    """Everything the sample learner's history writes, computed without touching the database."""

    joined_at: datetime
    daily_goal_xp: int
    sessions: tuple[PlannedSession, ...]
    purchases: tuple[PlannedPurchase, ...]
    gem_moves: tuple[GemMove, ...]  # in order; the last balance is the learner's gems
    days: tuple[PlannedDay, ...]
    streak: StreakState
    hearts: HeartsState
    xp_boost_until: datetime | None
    league_tier: int
    cohorts: tuple[PlannedCohort, ...]  # last week's finished cohort, then this week's open one

    @property
    def gems(self) -> int:
        """The learner's balance after the last gem movement."""
        return self.gem_moves[-1].balance_after if self.gem_moves else 0


# ---- planning (pure) ----


def plan_sample_learner(
    script: SampleLearnerFile, world: SampleWorld, *, learner_id: int, now: datetime, tz: str
) -> SampleRows:
    """The sample learner's whole history, relative to `now` in time zone `tz`. Reads no database.

    The script's days count back from the learner's local date at `now`; each step becomes the rows
    a live learner would have produced by taking it at that local time.
    """
    history = _History(script, world, learner_id=learner_id, tz=tz, today=local_date(now, tz))
    for step in script.steps:
        history.take(step)
    tier, cohorts = _league_weeks(history.sessions, world.bots, script.last_week_league_tier, learner_id, now)
    return SampleRows(
        joined_at=history.joined_at,
        daily_goal_xp=script.daily_goal_xp,
        sessions=tuple(history.sessions),
        purchases=tuple(history.purchases),
        gem_moves=tuple(history.gem_moves),
        days=history.days(),
        streak=history.streak,
        hearts=_hearts_at(script.hearts, now),
        xp_boost_until=history.boost_until,
        league_tier=tier,
        cohorts=cohorts,
    )


class _History:
    """The learner's state while the script is replayed in order, kept the way the live game keeps it."""

    def __init__(
        self, script: SampleLearnerFile, world: SampleWorld, *, learner_id: int, tz: str, today: date
    ) -> None:
        self.script, self.world, self.learner_id, self.tz, self.today = script, world, learner_id, tz, today
        self.joined_at = self.instant(-script.joined_days_ago, JOIN_TIME)
        self.sessions: list[PlannedSession] = []
        self.purchases: list[PlannedPurchase] = []
        self.gem_moves: list[GemMove] = []
        self.streak = StreakState(current=0, longest=0, last_date=None, freezes=0)
        self.active_days: dict[date, datetime] = {}  # local day -> its first completion
        self.frozen_days: dict[date, datetime] = {}  # local day -> when a freeze covered it
        self.boost_until: datetime | None = None
        self.lessons_done = Counter[int]()  # node id -> lessons completed
        self.mistakes: list[planner.Mistake] = []
        self._move_gems(script.starting_gems, GemReason.SEED, self.joined_at)

    def instant(self, day: int, clock: time) -> datetime:
        """The UTC instant of a local time on a day counted from the seed day (-1 is yesterday)."""
        local_day = self.today + timedelta(days=day)
        return datetime.combine(local_day, clock, tzinfo=ZoneInfo(self.tz)).astimezone(UTC)

    def take(self, step: HistoryStep) -> None:
        """One step of the script. Each is a request, so the streak first catches up to its day."""
        at = self.instant(step.day, step.local_time)
        self._settle(at)
        match step:
            case ChestStep(node=key):
                node = self.world.node(key)
                self._move_gems(node.chest_gems or 0, GemReason.CHEST, at, node_id=node.id)
            case PurchaseStep(item=code):
                self._buy(self.world.shop[code], at)
            case _:
                self._play(step, at)

    def days(self) -> tuple[PlannedDay, ...]:
        """The streak calendar: active days with the goal in force, and the days freezes covered."""
        goal = self.script.daily_goal_xp
        active = [PlannedDay(day, ActivityKind.ACTIVE, goal, at) for day, at in self.active_days.items()]
        frozen = [PlannedDay(day, ActivityKind.FROZEN, None, at) for day, at in self.frozen_days.items()]
        return tuple(sorted(active + frozen, key=lambda planned: planned.local_date))

    def _settle(self, at: datetime) -> None:
        """Spend freezes on the days missed since the last covered day, or lose the streak."""
        settled = streak.settle(self.streak, local_date(at, self.tz))
        self.streak = settled.state
        for day in settled.frozen_dates:
            self.frozen_days.setdefault(day, at)

    def _move_gems(self, delta: int, reason: GemReason, at: datetime, **source: int) -> None:
        """Add a gem ledger row; its balance follows from the previous one."""
        balance = (self.gem_moves[-1].balance_after if self.gem_moves else 0) + delta
        self.gem_moves.append(GemMove(delta, balance, reason, at, **source))

    def _buy(self, item: ShopInfo, at: datetime) -> None:
        """Pay for an item and apply what lasts. A refill leaves nothing: the script sets the hearts."""
        index = len(self.purchases)
        self.purchases.append(PlannedPurchase(item.id, item.price_gems, f"seed-{index + 1}", at))
        self._move_gems(-item.price_gems, GemReason.PURCHASE, at, purchase_index=index)
        if item.kind == ShopItemKind.STREAK_FREEZE:
            if self.streak.freezes >= MAX_STREAK_FREEZES:
                raise ValueError(
                    f"the script buys a streak freeze at {at} while {MAX_STREAK_FREEZES} are equipped"
                )
            self.streak = replace(self.streak, freezes=self.streak.freezes + 1)
        if item.kind == ShopItemKind.XP_BOOST and item.duration_minutes is not None:
            self.boost_until = max(at, self.boost_until or at) + timedelta(minutes=item.duration_minutes)

    def _play(self, step: PlayStep, started_at: datetime) -> None:
        """A lesson, practice or legendary session, from its start to its completion."""
        kind = SessionKind(step.kind)
        node = None if step.node is None else self.world.node(step.node)
        node_id = None if node is None else node.id
        rng_seed = stable_seed(self.learner_id, kind, node_id, started_at.isoformat())
        lesson, planned = self._plan(kind, node, started_at, random.Random(rng_seed))
        if kind == SessionKind.LEGENDARY:  # the entry fee is paid when the run starts
            fee = -LEGENDARY_PRICE_GEMS
            self._move_gems(fee, GemReason.LEGENDARY_FEE, started_at, session_index=len(self.sessions))
        answers = self._answer(kind, planned, frozenset(step.wrong), started_at)
        ended_at = answers[-1].answered_at + FINISH_DELAY
        items = [ItemFacts(a.seq, a.exercise_id, a.origin, a.result) for a in answers]
        best_combo = session_flow.best_combo(items)
        lines = xp.session_xp_lines(
            kind,
            node_kind=None if node is None else node.kind,
            best_run=best_combo,
            item_count=session_flow.initial_count(items),
            correct=session_flow.correct_count(items),
            boost_active=xp.is_boost_active(self.boost_until, ended_at),
        )
        self._settle(ended_at)  # completing is a request of its own
        day = local_date(ended_at, self.tz)
        self.sessions.append(
            PlannedSession(
                kind=kind,
                node_id=node_id,
                lesson_id=None if lesson is None else lesson.id,
                rng_seed=rng_seed,
                started_at=started_at,
                ended_at=ended_at,
                mistakes=session_flow.mistakes(items),
                best_combo=best_combo,
                answers=tuple(answers),
                xp_lines=tuple(lines),
                local_date=day,
            )
        )
        if node is not None and lesson is not None:
            self.lessons_done[node.id] += 1
        self.mistakes += [
            planner.Mistake(a.exercise_id, a.answered_at) for a in answers if a.result in session_flow.WRONG
        ]
        if lines:  # a session that earns XP counts for the streak
            self.streak, _ = streak.credit(self.streak, day)
            self.active_days.setdefault(day, ended_at)

    def _plan(
        self, kind: SessionKind, node: NodeInfo | None, started_at: datetime, rng: random.Random
    ) -> tuple[LessonInfo | None, list[planner.PlannedItem]]:
        """The session's lesson (lessons only) and its initial queue, from the live planners."""
        if kind == SessionKind.PRACTICE:
            nodes = self.world.nodes if node is None else (node,)
            pool = [  # the exercises of every lesson completed so far, on the node or anywhere
                e.facts
                for n in nodes
                for lesson in n.lessons[: self.lessons_done[n.id]]
                for e in lesson.exercises
            ]
            recent = planner.recent_mistake_ids(self.mistakes, started_at)
            return None, planner.plan_practice(pool, recent, rng, listening_enabled=LISTENING_ENABLED)
        if node is None:
            raise ValueError(f"a {kind} step needs a node")
        if kind == SessionKind.LESSON:
            lesson = node.lessons[self.lessons_done[node.id]]  # the node's next lesson
            facts = (e.facts for e in lesson.exercises)
            return lesson, planner.plan_lesson(facts, listening_enabled=LISTENING_ENABLED)
        facts = (e.facts for lesson in node.lessons for e in lesson.exercises)
        return None, planner.plan_legendary(facts, rng, listening_enabled=LISTENING_ENABLED)

    def _answer(
        self,
        kind: SessionKind,
        planned: Sequence[planner.PlannedItem],
        wrong: frozenset[int],
        started_at: datetime,
    ) -> list[PlannedAnswer]:
        """Answer the queue in order: the scripted initial items wrong once, every other item right.

        Each answer is graded by the live grader, and a wrong one appends a retry exactly when
        `session_flow.decide` says so. Answers come ITEM_PACE apart.
        """
        if any(position > len(planned) for position in wrong):
            raise ValueError(
                f"a {kind} session has {len(planned)} items, fewer than the script's {sorted(wrong)}"
            )
        queue = [ItemFacts(seq, item.exercise_id) for seq, item in enumerate(planned, start=1)]
        from_mistakes = {seq for seq, item in enumerate(planned, start=1) if item.from_mistakes}
        answers: list[PlannedAnswer] = []
        while len(answers) < len(queue):
            item = queue[len(answers)]
            right = item.origin == ItemOrigin.RETRY or item.seq not in wrong
            attempt = _scripted_attempt(self.world.exercises[item.exercise_id].answer_key, right=right)
            outcome = session_flow.decide(kind, item, attempt.result, queue)
            if outcome.fail:
                raise ValueError(f"the script fails a {kind} run, which then earns nothing")
            queue[len(answers)] = replace(item, result=attempt.result)
            if outcome.append_retry:
                queue.append(ItemFacts(len(queue) + 1, item.exercise_id, ItemOrigin.RETRY))
            answers.append(
                PlannedAnswer(
                    seq=item.seq,
                    exercise_id=item.exercise_id,
                    origin=item.origin,
                    from_mistakes=item.seq in from_mistakes,
                    result=attempt.result,
                    note=attempt.note,
                    submitted_json=attempt.submitted_json,
                    answered_at=started_at + ITEM_PACE * (len(answers) + 1),
                )
            )
        return answers


@dataclass(frozen=True)
class _Attempt:
    """A scripted answer as it is stored: its grade and its canonical payload."""

    result: ItemResult
    note: GradeNote | None
    submitted_json: str


@cache  # the same answer to the same exercise always grades the same way, so it is graded once
def _scripted_attempt(key: grading.AnswerKey, *, right: bool) -> _Attempt:
    """Grade the sample learner's scripted answer with the live grader.

    The payload is kept in the canonical form the API stores for a live answer.
    """
    payload = _scripted_answer(key, right=right)
    graded = grading.grade(key, exercises.to_answer(payload))
    if (graded.result == ItemResult.CORRECT) != right:
        raise ValueError(f"the scripted answer {payload!r} was graded {graded.result}")
    return _Attempt(graded.result, graded.note, canonical_json(payload))


def _scripted_answer(key: grading.AnswerKey, *, right: bool) -> AnswerIn:
    """The payload the sample learner submits: the expected answer, or a typical mistake.

    A mistake is a wrong choice, crossed match pairs, or a typed answer missing its last word (a
    one-word answer is skipped instead, which counts as a mistake too).
    """
    match key.type:
        case ExerciseType.MULTIPLE_CHOICE:
            return MultipleChoiceAnswer(type="multiple_choice", option_id=_choice(key, right=right))
        case ExerciseType.FILL_BLANK:
            return FillBlankAnswer(type="fill_blank", option_id=_choice(key, right=right))
        case ExerciseType.MATCH_PAIRS:
            lefts = sorted(key.pair_ids)
            partners = lefts if right else lefts[1:] + lefts[:1]  # a mistake pairs each item with the next
            pairs = [MatchPairIn(left_id=a, right_id=b) for a, b in zip(lefts, partners, strict=True)]
            return MatchPairsAnswer(type="match_pairs", pairs=pairs, mistakes=0)
    words = key.accepted[0].split()
    text = " ".join(words if right else words[:-1])
    if not text:
        return SkipAnswer(type="skip")
    if key.type == ExerciseType.TRANSLATE:
        return TranslateAnswer(type="translate", text=text)
    return TypeAnswerAnswer(type="type_answer", text=text)


def _choice(key: grading.AnswerKey, *, right: bool) -> int:
    """The id of the correct option, or of the first wrong one."""
    return next(option.id for option in key.options if option.is_correct == right)


def _hearts_at(scripted: HeartsSeed, now: datetime) -> HeartsState:
    """The scripted hearts, with the regeneration interval started the given minutes before `now`."""
    if scripted.anchor_minutes_ago is None:
        return refill()
    return HeartsState(scripted.current, now - timedelta(minutes=scripted.anchor_minutes_ago))


def _league_weeks(
    sessions: Sequence[PlannedSession],
    bots: Sequence[BotInfo],
    last_week_tier: int,
    learner_id: int,
    now: datetime,
) -> tuple[int, tuple[PlannedCohort, ...]]:
    """Last week's finished cohort, this week's open one, and the learner's tier after them.

    As live, the learner joins a week's cohort with their first XP of that week once leagues are
    unlocked. Last week is finished at `now`: every member gets a final XP, rank and outcome, and
    the learner's outcome moves their tier. This week's cohort, in the new tier, stays open.
    """
    eligible = sessions[LEAGUE_UNLOCK_SESSIONS - 1 :]  # from the completion that unlocks the leagues
    this_week = league_week_start(now)
    finished = _cohort(sessions, eligible, bots, last_week_tier, this_week - LEAGUE_WEEK, learner_id, now)
    tier = last_week_tier
    if finished is not None:
        learner = next(member for member in finished.members if member.user_id == learner_id)
        tier = leagues.tier_after(last_week_tier, learner.outcome or LeagueOutcome.STAYED)
    current = _cohort(sessions, eligible, bots, tier, this_week, learner_id, finished_at=None)
    return tier, tuple(cohort for cohort in (finished, current) if cohort is not None)


def _cohort(
    sessions: Sequence[PlannedSession],
    eligible: Sequence[PlannedSession],
    bots: Sequence[BotInfo],
    tier: int,
    week: date,
    learner_id: int,
    finished_at: datetime | None,
) -> PlannedCohort | None:
    """The learner's cohort for one league week, finished at `finished_at`, or None if they never joined.

    Bots are drawn as live and join at the week's start. A finished week ranks the learner's XP in
    the week window against each bot's week, computed up to the week's end.
    """
    start, end = league_week_bounds(week)
    joins = [s.ended_at for s in eligible if start <= s.ended_at < end and s.xp_lines]
    if not joins:
        return None
    drawn = set(leagues.draw_bots([bot.user_id for bot in bots], tier, week))
    rivals = [bot for bot in bots if bot.user_id in drawn]
    if finished_at is None:
        members = [
            PlannedMember(learner_id, joins[0]),
            *(PlannedMember(bot.user_id, start) for bot in rivals),
        ]
        return PlannedCohort(tier, week, joins[0], None, tuple(members))
    earned = [(s.ended_at, line.amount) for s in sessions if start <= s.ended_at < end for line in s.xp_lines]
    learner = leagues.Standing(learner_id, sum(amount for _, amount in earned), max(at for at, _ in earned))
    standings = [
        leagues.Standing(bot.user_id, *bot_week_xp(bot.rng_seed, bot.daily_xp, week, tier, end), is_bot=True)
        for bot in rivals
    ]
    ranked = leagues.rank([learner, *standings])
    members = [
        PlannedMember(
            user_id=row.user_id,
            joined_at=start if row.is_bot else joins[0],
            final_xp=row.xp,
            final_rank=row.rank,
            outcome=leagues.outcome(row.rank, len(ranked), row.xp, tier=tier),
        )
        for row in ranked
    ]
    return PlannedCohort(tier, week, joins[0], finished_at, tuple(members))
