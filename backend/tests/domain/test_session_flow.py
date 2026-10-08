"""Session flow: the queue, what a wrong answer does per kind, progress, combos, accuracy, completion."""

from datetime import UTC, datetime, timedelta

import pytest

from app.domain.enums import ItemLabel, ItemOrigin, ItemResult, RetryPolicy, SessionKind, SessionStatus
from app.domain.session_flow import (
    BlockedReason,
    ItemFacts,
    Lives,
    Outcome,
    Progress,
    SessionFacts,
    SessionRules,
    accuracy_percent,
    answered_count,
    best_combo,
    blocked_reason,
    can_complete,
    combo,
    correct_count,
    current_item,
    decide,
    initial_count,
    item_label,
    lives,
    mistakes,
    progress,
    retries_of,
    rules_for,
)

C, X, S, L = ItemResult.CORRECT, ItemResult.INCORRECT, ItemResult.SKIPPED, ItemResult.CANT_LISTEN
LESSON, PRACTICE = SessionKind.LESSON, SessionKind.PRACTICE
LEGENDARY, TIMED = SessionKind.LEGENDARY, SessionKind.TIMED
NOW = datetime(2026, 10, 8, 12, 0, tzinfo=UTC)


def planned(*results: ItemResult | None) -> list[ItemFacts]:
    """Initial items 1..n for exercises 1..n with the given results (None = not answered yet)."""
    return [ItemFacts(seq=n, exercise_id=n, result=result) for n, result in enumerate(results, start=1)]


def retry(seq: int, exercise_id: int, result: ItemResult | None = None) -> ItemFacts:
    return ItemFacts(seq=seq, exercise_id=exercise_id, origin=ItemOrigin.RETRY, result=result)


class TestQueue:
    def test_the_current_item_is_the_lowest_unanswered_seq(self) -> None:
        item = current_item(planned(C, X, None, None))
        assert item is not None and item.seq == 3

    def test_a_retry_becomes_current_once_the_planned_items_are_answered(self) -> None:
        item = current_item([retry(4, 2), *planned(C, X, C)])
        assert item is not None and (item.seq, item.origin) == (4, ItemOrigin.RETRY)

    def test_nothing_is_current_once_every_item_is_answered(self) -> None:
        assert current_item(planned(C, X, L) + [retry(4, 2, C)]) is None

    def test_counts(self) -> None:
        items = planned(C, X, S, L, None) + [retry(6, 2, C)]
        assert mistakes(items) == 2  # a skip is a mistake; can't-listen is not
        assert correct_count(items) == 2
        assert answered_count(items) == 5
        assert initial_count(items) == 5
        assert (retries_of(items, 2), retries_of(items, 3)) == (1, 0)


class TestDecide:
    @pytest.mark.parametrize("result", [X, S])
    def test_a_lesson_mistake_costs_a_heart_and_comes_back_later(self, result: ItemResult) -> None:
        items = planned(None, None)
        assert decide(LESSON, items[0], result, items) == Outcome(lose_heart=True, append_retry=True)

    @pytest.mark.parametrize("kind", list(SessionKind))
    @pytest.mark.parametrize("result", [C, L])
    def test_a_right_or_cant_listen_answer_is_free(self, kind: SessionKind, result: ItemResult) -> None:
        items = planned(None, None)
        assert decide(kind, items[0], result, items) == Outcome()

    def test_a_lesson_keeps_asking_until_the_exercise_is_right(self) -> None:
        items = planned(X, C) + [retry(3, 1, X), retry(4, 1)]
        assert decide(LESSON, items[3], X, items) == Outcome(lose_heart=True, append_retry=True)

    def test_practice_retries_a_missed_exercise_once_and_costs_no_heart(self) -> None:
        items = planned(None, None)
        assert decide(PRACTICE, items[0], X, items) == Outcome(append_retry=True)

    def test_practice_lets_go_of_an_exercise_after_its_retry(self) -> None:
        items = planned(X, C) + [retry(3, 1)]
        assert decide(PRACTICE, items[2], X, items) == Outcome()

    @pytest.mark.parametrize(
        ("results_before", "expected"),
        [((None, None, None), Outcome()), ((X, None, None), Outcome()), ((X, S, None), Outcome(fail=True))],
        ids=["first-mistake", "second-mistake", "third-mistake-fails"],
    )
    def test_legendary_never_retries_and_the_third_mistake_fails(
        self, results_before: tuple[ItemResult | None, ...], expected: Outcome
    ) -> None:
        items = planned(*results_before)
        assert decide(LEGENDARY, items[-1], X, items) == expected

    def test_timed_practice_neither_retries_nor_penalizes(self) -> None:
        items = planned(None, None)
        assert decide(TIMED, items[0], X, items) == Outcome()


class TestProgress:
    def test_a_lesson_bar_moves_only_on_right_answers(self) -> None:
        assert progress(LESSON, planned(None, None, None)) == Progress(0, 3)
        assert progress(LESSON, planned(C, None, None)) == Progress(1, 3)
        assert progress(LESSON, planned(C, X, None) + [retry(4, 2)]) == Progress(1, 3)
        assert progress(LESSON, planned(C, X, C) + [retry(4, 2, X), retry(5, 2)]) == Progress(2, 3)
        assert progress(LESSON, planned(C, X, C) + [retry(4, 2, X), retry(5, 2, C)]) == Progress(3, 3)

    def test_practice_resolves_an_exercise_once_its_retry_is_used(self) -> None:
        assert progress(PRACTICE, planned(X, C) + [retry(3, 1)]) == Progress(1, 2)
        assert progress(PRACTICE, planned(X, C) + [retry(3, 1, X)]) == Progress(2, 2)

    def test_legendary_counts_every_answered_item(self) -> None:
        assert progress(LEGENDARY, planned(C, X, S, None)) == Progress(3, 4)

    def test_timed_counts_right_answers_out_of_the_planned_items(self) -> None:
        assert progress(TIMED, planned(C, X, C, None, None)) == Progress(2, 5)

    def test_cant_listen_resolves_an_exercise(self) -> None:
        assert progress(LESSON, planned(L, L, None)) == Progress(2, 3)


class TestCombo:
    def test_cant_listen_neither_breaks_nor_extends_a_run(self) -> None:
        items = planned(C, C, L, C)
        assert (combo(items), best_combo(items)) == (3, 3)

    def test_a_mistake_resets_the_current_run_but_not_the_best_one(self) -> None:
        items = planned(C, C, C, X, C)
        assert (combo(items), best_combo(items)) == (1, 3)

    def test_a_skip_breaks_a_run(self) -> None:
        assert combo(planned(C, C, S)) == 0

    def test_retries_count_in_seq_order(self) -> None:
        items = [retry(4, 2, C), *planned(C, X, C)]
        assert (combo(items), best_combo(items)) == (2, 2)

    def test_unanswered_items_do_not_count(self) -> None:
        assert (combo(planned(None, None)), best_combo(planned(None, None))) == (0, 0)
        assert combo(planned(C, C, None)) == 2


class TestAccuracy:
    @pytest.mark.parametrize(
        ("right", "wrong", "percent"),
        [
            (6, 0, 100),
            (7, 1, 88),  # 87.5 rounds half up
            (1, 7, 13),  # 12.5 rounds half up
            (5, 1, 83),
            (2, 1, 67),
            (1, 2, 33),
            (0, 3, 0),
        ],
    )
    def test_right_answers_out_of_graded_answers_rounded_half_up(
        self, right: int, wrong: int, percent: int
    ) -> None:
        assert accuracy_percent(planned(*[C] * right, *[X] * wrong)) == percent

    def test_cant_listen_and_unanswered_items_are_not_graded(self) -> None:
        assert accuracy_percent(planned(C, L, L, None)) == 100
        assert accuracy_percent(planned(C, S, L)) == 50

    def test_nothing_graded_counts_as_perfect(self) -> None:
        assert accuracy_percent(planned(L, None)) == 100


class TestCompletion:
    def test_a_lesson_completes_once_nothing_is_left_to_answer(self) -> None:
        session = SessionFacts(LESSON, SessionStatus.ACTIVE)
        assert not can_complete(session, planned(C, None), hearts=3, now=NOW)
        assert can_complete(session, planned(C, C), hearts=3, now=NOW)

    def test_a_lesson_at_zero_hearts_is_blocked_not_ended(self) -> None:
        assert blocked_reason(LESSON, 0) is BlockedReason.OUT_OF_HEARTS
        assert not can_complete(SessionFacts(LESSON, SessionStatus.ACTIVE), planned(C, C), hearts=0, now=NOW)

    @pytest.mark.parametrize(("kind", "hearts"), [(LESSON, 1), (PRACTICE, 0), (LEGENDARY, 0), (TIMED, 0)])
    def test_only_lessons_are_blocked_by_hearts(self, kind: SessionKind, hearts: int) -> None:
        assert blocked_reason(kind, hearts) is None

    @pytest.mark.parametrize("status", [s for s in SessionStatus if s != SessionStatus.ACTIVE])
    def test_an_ended_session_cannot_complete(self, status: SessionStatus) -> None:
        assert not can_complete(SessionFacts(PRACTICE, status), planned(C), hearts=5, now=NOW)

    def test_timed_practice_completes_at_the_deadline_with_items_left(self) -> None:
        session = SessionFacts(TIMED, SessionStatus.ACTIVE, expires_at=NOW)
        items = planned(C, X, None, None)
        assert not can_complete(session, items, hearts=4, now=NOW - timedelta(microseconds=1))
        assert can_complete(session, items, hearts=4, now=NOW)
        assert can_complete(session, items, hearts=4, now=NOW + timedelta(minutes=5))

    def test_timed_practice_also_completes_early_when_every_item_is_answered(self) -> None:
        session = SessionFacts(TIMED, SessionStatus.ACTIVE, expires_at=NOW + timedelta(seconds=20))
        assert can_complete(session, planned(C, X), hearts=0, now=NOW)


class TestRulesByKind:
    @pytest.mark.parametrize(
        ("kind", "rules"),
        [
            (LESSON, SessionRules(True, RetryPolicy.ALWAYS, True, None)),
            (PRACTICE, SessionRules(False, RetryPolicy.ONCE, True, None)),
            (LEGENDARY, SessionRules(False, RetryPolicy.NEVER, False, 2)),
            (TIMED, SessionRules(False, RetryPolicy.NEVER, True, None)),
        ],
    )
    def test_rules_for_each_kind(self, kind: SessionKind, rules: SessionRules) -> None:
        assert rules_for(kind) == rules

    def test_legendary_shows_three_lives_that_never_go_negative(self) -> None:
        assert lives(LEGENDARY, planned(None)) == Lives(max=3, left=3)
        assert lives(LEGENDARY, planned(X, C, S)) == Lives(max=3, left=1)
        assert lives(LEGENDARY, planned(X, X, X, X)) == Lives(max=3, left=0)

    @pytest.mark.parametrize("kind", [LESSON, PRACTICE, TIMED])
    def test_other_kinds_have_no_lives(self, kind: SessionKind) -> None:
        assert lives(kind, planned(X)) is None

    @pytest.mark.parametrize(
        ("kind", "origin", "from_mistakes", "is_new_word", "label"),
        [
            (LESSON, ItemOrigin.RETRY, False, False, ItemLabel.PREVIOUS_MISTAKE),
            (LESSON, ItemOrigin.RETRY, False, True, ItemLabel.PREVIOUS_MISTAKE),
            (PRACTICE, ItemOrigin.INITIAL, True, False, ItemLabel.PREVIOUS_MISTAKE),
            (LESSON, ItemOrigin.INITIAL, False, True, ItemLabel.NEW_WORD),
            (PRACTICE, ItemOrigin.INITIAL, False, True, None),
            (LESSON, ItemOrigin.INITIAL, False, False, None),
        ],
    )
    def test_item_labels(
        self,
        kind: SessionKind,
        origin: ItemOrigin,
        from_mistakes: bool,
        is_new_word: bool,
        label: ItemLabel | None,
    ) -> None:
        assert item_label(kind, origin, from_mistakes=from_mistakes, is_new_word=is_new_word) == label
