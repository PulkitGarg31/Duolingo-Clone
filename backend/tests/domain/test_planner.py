"""Session start preconditions and the planners that fill a new session's queue."""

import random
from collections import Counter
from datetime import UTC, datetime, timedelta

import pytest

from app.core.errors import ErrorCode
from app.domain.enums import ExerciseType, NodeKind, NodeState, SessionKind
from app.domain.planner import (
    ExerciseFacts,
    Mistake,
    PlannedItem,
    StartRefusal,
    plan_legendary,
    plan_lesson,
    plan_practice,
    plan_timed,
    recent_mistake_ids,
    start_refusal,
)

LESSON, PRACTICE, LEGENDARY, TIMED = (
    SessionKind.LESSON,
    SessionKind.PRACTICE,
    SessionKind.LEGENDARY,
    SessionKind.TIMED,
)
SKILL, CHEST, REVIEW = NodeKind.SKILL, NodeKind.CHEST, NodeKind.REVIEW
LOCKED, ACTIVE, AVAILABLE = NodeState.LOCKED, NodeState.ACTIVE, NodeState.AVAILABLE
COMPLETED, GOLD = NodeState.COMPLETED, NodeState.LEGENDARY  # gold: the legendary run was passed

MC, TRANSLATE, MATCH = ExerciseType.MULTIPLE_CHOICE, ExerciseType.TRANSLATE, ExerciseType.MATCH_PAIRS
FILL, TYPE = ExerciseType.FILL_BLANK, ExerciseType.TYPE_ANSWER
# The authored order of a regular lesson; lesson 2 ends with "type what you hear".
LESSON_TEMPLATE = (MC, TRANSLATE, MATCH, FILL, TRANSLATE, TYPE)
NOW = datetime(2026, 10, 8, 12, 0, tzinfo=UTC)


def lesson(number: int, first_id: int) -> list[ExerciseFacts]:
    return [
        ExerciseFacts(first_id + offset, kind, audio_only=number == 2 and kind is TYPE)
        for offset, kind in enumerate(LESSON_TEMPLATE)
    ]


def skill_exercises(lesson_count: int, first_id: int = 1) -> list[ExerciseFacts]:
    return [e for n in range(1, lesson_count + 1) for e in lesson(n, first_id + 6 * (n - 1))]


THREE_LESSON_SKILL = skill_exercises(3)  # ids 1..18
TWO_LESSON_SKILL = skill_exercises(2)  # ids 1..12
BY_ID = {e.id: e for e in skill_exercises(3) + skill_exercises(3, first_id=101)}


def ids(plan: list[PlannedItem]) -> list[int]:
    return [item.exercise_id for item in plan]


def type_counts(plan: list[PlannedItem]) -> Counter[ExerciseType]:
    return Counter(BY_ID[item.exercise_id].type for item in plan)


class TestStartRefusal:
    @pytest.mark.parametrize(
        ("kind", "node_kind", "state", "hearts", "gems", "refusal"),
        [
            (LESSON, SKILL, ACTIVE, 5, 0, None),
            (LESSON, REVIEW, ACTIVE, 1, 0, None),
            (LESSON, SKILL, ACTIVE, 0, 999, StartRefusal.OUT_OF_HEARTS),
            (LESSON, CHEST, AVAILABLE, 5, 0, StartRefusal.NODE_NOT_PLAYABLE),
            (LESSON, SKILL, LOCKED, 5, 0, StartRefusal.NODE_LOCKED),
            (LESSON, SKILL, COMPLETED, 5, 0, StartRefusal.NODE_ALREADY_COMPLETED),
            (LESSON, SKILL, GOLD, 5, 0, StartRefusal.NODE_ALREADY_COMPLETED),
            (PRACTICE, SKILL, COMPLETED, 0, 0, None),  # practice is allowed at 0 hearts
            (PRACTICE, SKILL, GOLD, 5, 0, None),
            (PRACTICE, REVIEW, COMPLETED, 5, 0, None),
            (PRACTICE, SKILL, LOCKED, 5, 0, StartRefusal.NODE_LOCKED),
            (PRACTICE, SKILL, ACTIVE, 5, 0, StartRefusal.NODE_NOT_PLAYABLE),
            (PRACTICE, CHEST, COMPLETED, 5, 0, StartRefusal.NODE_NOT_PLAYABLE),
            (LEGENDARY, SKILL, COMPLETED, 0, 100, None),
            (LEGENDARY, SKILL, COMPLETED, 5, 99, StartRefusal.INSUFFICIENT_GEMS),
            (LEGENDARY, SKILL, GOLD, 5, 500, StartRefusal.ALREADY_LEGENDARY),
            (LEGENDARY, SKILL, LOCKED, 5, 500, StartRefusal.NODE_LOCKED),
            (LEGENDARY, SKILL, ACTIVE, 5, 500, StartRefusal.NODE_NOT_PLAYABLE),
            (LEGENDARY, REVIEW, COMPLETED, 5, 500, StartRefusal.NODE_NOT_PLAYABLE),
            (LEGENDARY, REVIEW, LOCKED, 5, 500, StartRefusal.NODE_NOT_PLAYABLE),  # the kind is checked first
            (LEGENDARY, CHEST, COMPLETED, 5, 500, StartRefusal.NODE_NOT_PLAYABLE),
        ],
    )
    def test_sessions_on_a_node(
        self,
        kind: SessionKind,
        node_kind: NodeKind,
        state: NodeState,
        hearts: int,
        gems: int,
        refusal: StartRefusal | None,
    ) -> None:
        verdict = start_refusal(kind, (node_kind, state), hearts=hearts, gems=gems, lessons_completed=3)
        assert verdict == refusal

    @pytest.mark.parametrize("kind", [PRACTICE, TIMED])
    def test_global_sessions_need_one_completed_lesson(self, kind: SessionKind) -> None:
        assert start_refusal(kind, None, hearts=0, gems=0, lessons_completed=1) is None
        refusal = start_refusal(kind, None, hearts=5, gems=999, lessons_completed=0)
        assert refusal is StartRefusal.NOTHING_TO_PRACTICE

    @pytest.mark.parametrize(
        ("kind", "node"),
        [(LESSON, None), (LEGENDARY, None), (TIMED, (SKILL, COMPLETED))],
        ids=["lesson-without-node", "legendary-without-node", "timed-with-node"],
    )
    def test_a_request_of_the_wrong_shape_is_a_programming_error(
        self, kind: SessionKind, node: tuple[NodeKind, NodeState] | None
    ) -> None:
        with pytest.raises(ValueError, match="node"):
            start_refusal(kind, node, hearts=5, gems=500, lessons_completed=3)

    def test_every_refusal_is_an_api_error_code(self) -> None:
        # The service reports a refusal by its value, so each one must name a real error code.
        assert {refusal.value for refusal in StartRefusal} <= {code.value for code in ErrorCode}


class TestLessonPlanner:
    def test_a_lesson_plays_every_exercise_in_authored_order(self) -> None:
        assert plan_lesson(lesson(2, 7), listening_enabled=True) == [PlannedItem(i) for i in range(7, 13)]

    def test_listening_exercises_are_skipped_when_listening_is_off(self) -> None:
        assert ids(plan_lesson(lesson(2, 7), listening_enabled=False)) == [7, 8, 9, 10, 11]

    def test_a_lesson_without_listening_is_unaffected_by_the_setting(self) -> None:
        assert ids(plan_lesson(lesson(1, 1), listening_enabled=False)) == [1, 2, 3, 4, 5, 6]


class TestRecentMistakes:
    def test_only_the_lookback_window_counts(self) -> None:
        mistakes = [
            Mistake(1, NOW - timedelta(days=14)),  # exactly 14 days ago: still recent
            Mistake(2, NOW - timedelta(days=14, seconds=1)),
            Mistake(3, NOW - timedelta(days=30)),
        ]
        assert recent_mistake_ids(mistakes, NOW) == [1]

    def test_most_recent_first_and_each_exercise_once(self) -> None:
        mistakes = [
            Mistake(4, NOW - timedelta(days=3)),
            Mistake(5, NOW - timedelta(hours=1)),
            Mistake(4, NOW - timedelta(minutes=5)),
            Mistake(6, NOW - timedelta(days=1)),
        ]
        assert recent_mistake_ids(mistakes, NOW) == [4, 5, 6]


class TestPracticePlanner:
    def test_recent_mistakes_come_first_labelled_then_fresh_exercises_fill_ten(self) -> None:
        plan = plan_practice(THREE_LESSON_SKILL, [9, 2], random.Random(7), listening_enabled=True)
        assert len(plan) == len(set(ids(plan))) == 10
        assert plan[:2] == [PlannedItem(9, from_mistakes=True), PlannedItem(2, from_mistakes=True)]
        assert not any(item.from_mistakes for item in plan[2:])

    def test_at_most_five_mistakes(self) -> None:
        recent = [1, 2, 3, 4, 5, 6, 7]
        plan = plan_practice(THREE_LESSON_SKILL, recent, random.Random(7), listening_enabled=True)
        assert ids(plan)[:5] == [1, 2, 3, 4, 5]
        assert [item.from_mistakes for item in plan] == [True] * 5 + [False] * 5

    def test_mistakes_outside_the_pool_or_repeated_count_once_or_not_at_all(self) -> None:
        plan = plan_practice(THREE_LESSON_SKILL, [99, 3, 3, 4], random.Random(7), listening_enabled=True)
        assert [item for item in plan if item.from_mistakes] == [
            PlannedItem(3, from_mistakes=True),
            PlannedItem(4, from_mistakes=True),
        ]

    def test_listening_off_drops_audio_exercises_even_when_missed(self) -> None:
        audio_id = next(e.id for e in THREE_LESSON_SKILL if e.audio_only)
        for seed in range(30):
            plan = plan_practice(THREE_LESSON_SKILL, [audio_id], random.Random(seed), listening_enabled=False)
            assert audio_id not in ids(plan)

    def test_deterministic_per_seed(self) -> None:
        def plan(seed: int) -> list[PlannedItem]:
            return plan_practice(THREE_LESSON_SKILL, [5], random.Random(seed), listening_enabled=True)

        assert plan(42) == plan(42)
        assert len({tuple(ids(plan(seed))) for seed in range(10)}) > 1

    def test_a_small_pool_gives_a_shorter_session(self) -> None:
        small_pool = lesson(1, 50)[:5]
        plan = plan_practice(small_pool, [], random.Random(1), listening_enabled=True)
        assert sorted(ids(plan)) == [50, 51, 52, 53, 54]


class TestLegendaryPlanner:
    def test_twelve_productive_exercises_and_never_match_pairs(self) -> None:
        plan = plan_legendary(THREE_LESSON_SKILL, random.Random(3), listening_enabled=True)
        assert len(plan) == len(set(ids(plan))) == 12
        assert type_counts(plan) == {TRANSLATE: 6, FILL: 3, TYPE: 3}

    def test_multiple_choice_fills_in_only_when_productive_ones_run_out(self) -> None:
        plan = plan_legendary(THREE_LESSON_SKILL, random.Random(3), listening_enabled=False)
        assert len(plan) == 12
        assert type_counts(plan) == {TRANSLATE: 6, FILL: 3, TYPE: 2, MC: 1}
        assert not any(BY_ID[i].audio_only for i in ids(plan))

    @pytest.mark.parametrize(("listening", "count"), [(True, 10), (False, 9)])
    def test_a_two_lesson_skill_gives_a_shorter_run(self, listening: bool, count: int) -> None:
        plan = plan_legendary(TWO_LESSON_SKILL, random.Random(3), listening_enabled=listening)
        assert len(plan) == count
        assert MATCH not in type_counts(plan)

    def test_deterministic_per_seed_and_shuffled_together(self) -> None:
        def kinds(seed: int) -> list[ExerciseType]:
            plan = plan_legendary(THREE_LESSON_SKILL, random.Random(seed), listening_enabled=False)
            return [BY_ID[item.exercise_id].type for item in plan]

        assert kinds(11) == kinds(11)
        # The one multiple-choice pick is shuffled in with the rest, not parked at the end.
        assert len({kinds(seed).index(MC) for seed in range(20)}) > 1


class TestTimedPlanner:
    def test_only_fast_types_and_at_most_twenty(self) -> None:
        pool = list(BY_ID.values())  # two three-lesson skills: 36 exercises, 30 of them fast
        plan = plan_timed(pool, random.Random(5))
        assert len(plan) == len(set(ids(plan))) == 20
        assert TYPE not in type_counts(plan)

    def test_a_small_pool_gives_every_fast_exercise(self) -> None:
        assert sorted(ids(plan_timed(lesson(2, 7), random.Random(5)))) == [7, 8, 9, 10, 11]

    def test_deterministic_per_seed(self) -> None:
        pool = list(BY_ID.values())
        assert plan_timed(pool, random.Random(8)) == plan_timed(pool, random.Random(8))
        assert plan_timed(pool, random.Random(8)) != plan_timed(pool, random.Random(9))
