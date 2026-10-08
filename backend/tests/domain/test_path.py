"""Path rules: node states, crowns, unit states, unlocks and the actions offered on each node."""

from dataclasses import replace

import pytest

from app.domain.enums import NodeKind, NodeState, UnitState
from app.domain.path import (
    NodeActions,
    NodeFacts,
    crown_level,
    current_node_id,
    is_completed,
    newly_unlocked,
    next_lesson_number,
    node_actions,
    node_states,
    unit_state,
)

SKILL, CHEST, REVIEW = NodeKind.SKILL, NodeKind.CHEST, NodeKind.REVIEW
LOCKED, ACTIVE, AVAILABLE = NodeState.LOCKED, NodeState.ACTIVE, NodeState.AVAILABLE
COMPLETED, LEGENDARY = NodeState.COMPLETED, NodeState.LEGENDARY


def skill(node_id: int, done: int = 0, *, lessons: int = 3, legendary: bool = False) -> NodeFacts:
    return NodeFacts(node_id, SKILL, lesson_count=lessons, lessons_completed=done, legendary=legendary)


def review(node_id: int, done: int = 0) -> NodeFacts:
    return NodeFacts(node_id, REVIEW, lesson_count=1, lessons_completed=done)


def chest(node_id: int, *, claimed: bool = False) -> NodeFacts:
    return NodeFacts(node_id, CHEST, lesson_count=0, chest_claimed=claimed)


def seeded_path() -> list[NodeFacts]:
    """The sample learner's course: unit 1 done (first skill gold), Food done, Drinks at 1 of 3."""
    return [
        skill(1, 3, legendary=True), skill(2, 3), chest(3, claimed=True), review(4, 1),
        skill(5, 3), skill(6, 1), chest(7), review(8),
        skill(9, lessons=2), skill(10, lessons=2), review(11),
    ]  # fmt: skip


class TestNodeStates:
    def test_p1_a_fresh_learner_has_the_first_node_active_and_the_rest_locked(self) -> None:
        states = node_states([skill(1), skill(2), chest(3), review(4), skill(5)])
        assert states == {1: ACTIVE, 2: LOCKED, 3: LOCKED, 4: LOCKED, 5: LOCKED}

    def test_p2_a_reachable_chest_is_available_and_does_not_block_the_path(self) -> None:
        states = node_states([skill(1, 3), chest(2), skill(3), review(4)])
        assert states == {1: COMPLETED, 2: AVAILABLE, 3: ACTIVE, 4: LOCKED}

    def test_an_unopened_chest_stays_available_while_the_learner_moves_on(self) -> None:
        states = node_states([skill(1, 3), chest(2), skill(3, 3), review(4)])
        assert states == {1: COMPLETED, 2: AVAILABLE, 3: COMPLETED, 4: ACTIVE}

    def test_an_opened_chest_is_completed(self) -> None:
        assert node_states([skill(1, 3), chest(2, claimed=True), skill(3)])[2] is COMPLETED

    def test_a_passed_legendary_run_turns_a_completed_skill_legendary(self) -> None:
        assert node_states([skill(1, 3, legendary=True), skill(2)]) == {1: LEGENDARY, 2: ACTIVE}

    def test_the_seeded_demo_path(self) -> None:
        states = node_states(seeded_path())
        assert states == {
            1: LEGENDARY, 2: COMPLETED, 3: COMPLETED, 4: COMPLETED,
            5: COMPLETED, 6: ACTIVE, 7: LOCKED, 8: LOCKED,
            9: LOCKED, 10: LOCKED, 11: LOCKED,
        }  # fmt: skip
        assert current_node_id(states) == 6
        assert sum(crown_level(n.kind, states[n.id]) for n in seeded_path()) == 5  # profile "crowns"

    def test_p4_exactly_one_node_is_active_until_the_course_is_finished(self) -> None:
        nodes = {n.id: n for n in [skill(1), skill(2), chest(3), review(4), skill(5, lessons=2), review(6)]}
        for _ in range(10):  # the course has ten lessons in total
            states = node_states(nodes.values())
            active = [node_id for node_id, state in states.items() if state is ACTIVE]
            assert len(active) == 1
            assert current_node_id(states) == active[0]
            node = nodes[active[0]]
            nodes[node.id] = replace(node, lessons_completed=node.lessons_completed + 1)
        final = node_states(nodes.values())
        assert ACTIVE not in final.values()
        assert current_node_id(final) is None
        assert final[3] is AVAILABLE  # never opened, and it never blocked anything

    @pytest.mark.parametrize(
        ("node", "completed"),
        [
            (skill(1, 2), False),
            (skill(1, 3), True),
            (review(1, 1), True),
            (chest(1), False),
            (chest(1, claimed=True), True),
        ],
    )
    def test_is_completed(self, node: NodeFacts, completed: bool) -> None:
        assert is_completed(node) is completed


class TestCrownsAndLessons:
    @pytest.mark.parametrize(
        ("kind", "state", "crowns"),
        [
            (SKILL, LEGENDARY, 2),
            (SKILL, COMPLETED, 1),
            (REVIEW, COMPLETED, 1),
            (SKILL, ACTIVE, 0),
            (SKILL, LOCKED, 0),
            (CHEST, COMPLETED, 0),
            (CHEST, AVAILABLE, 0),
        ],
    )
    def test_p3_crown_levels(self, kind: NodeKind, state: NodeState, crowns: int) -> None:
        assert crown_level(kind, state) == crowns

    @pytest.mark.parametrize(
        ("node", "state", "number"),
        [
            (skill(6, 1), ACTIVE, 2),
            (skill(1, 0), ACTIVE, 1),
            (skill(1, 3), COMPLETED, None),
            (skill(9, 0), LOCKED, None),
        ],
    )
    def test_only_the_active_node_has_a_next_lesson(
        self, node: NodeFacts, state: NodeState, number: int | None
    ) -> None:
        assert next_lesson_number(node, state) == number


class TestUnitState:
    def test_p5_every_non_chest_node_finished_completes_the_unit(self) -> None:
        nodes = [(SKILL, LEGENDARY), (SKILL, COMPLETED), (CHEST, AVAILABLE), (REVIEW, COMPLETED)]
        assert unit_state(nodes) is UnitState.COMPLETED

    def test_p5_a_unit_of_locked_nodes_is_locked(self) -> None:
        assert unit_state([(SKILL, LOCKED), (SKILL, LOCKED), (REVIEW, LOCKED)]) is UnitState.LOCKED

    @pytest.mark.parametrize(
        "nodes",
        [
            [(SKILL, COMPLETED), (SKILL, ACTIVE), (CHEST, LOCKED), (REVIEW, LOCKED)],
            [(SKILL, ACTIVE), (SKILL, LOCKED), (REVIEW, LOCKED)],
            [(SKILL, COMPLETED), (CHEST, COMPLETED), (REVIEW, ACTIVE)],
        ],
        ids=["midway", "just-unlocked", "review-left"],
    )
    def test_p5_anything_else_is_in_progress(self, nodes: list[tuple[NodeKind, NodeState]]) -> None:
        assert unit_state(nodes) is UnitState.IN_PROGRESS


class TestNewlyUnlocked:
    def test_p6_finishing_a_skill_unlocks_the_chest_and_the_next_skill(self) -> None:
        before = node_states([skill(1, 2), chest(2), skill(3), review(4)])
        after = node_states([skill(1, 3), chest(2), skill(3), review(4)])
        assert newly_unlocked(before, after) == [2, 3]

    def test_finishing_drinks_unlocks_the_unit_2_chest_and_review_in_path_order(self) -> None:
        before = node_states(seeded_path())
        after = node_states(skill(6, 3) if n.id == 6 else n for n in seeded_path())
        assert newly_unlocked(before, after) == [7, 8]

    def test_a_lesson_that_does_not_finish_the_node_unlocks_nothing(self) -> None:
        before = node_states([skill(1, 1), skill(2)])
        assert newly_unlocked(before, node_states([skill(1, 2), skill(2)])) == []

    def test_opening_a_chest_unlocks_nothing(self) -> None:
        before = node_states([skill(1, 3), chest(2), skill(3)])
        after = node_states([skill(1, 3), chest(2, claimed=True), skill(3)])
        assert newly_unlocked(before, after) == []


class TestNodeActions:
    @pytest.mark.parametrize(
        ("kind", "state", "can_start", "start_xp", "can_practice", "can_legendary"),
        [
            (SKILL, ACTIVE, True, 10, False, False),
            (REVIEW, ACTIVE, True, 40, False, False),
            (SKILL, COMPLETED, False, None, True, True),
            (SKILL, LEGENDARY, False, None, True, False),
            (REVIEW, COMPLETED, False, None, True, False),
            (SKILL, LOCKED, False, None, False, False),
            (REVIEW, LOCKED, False, None, False, False),
            (CHEST, AVAILABLE, False, None, False, False),
            (CHEST, COMPLETED, False, None, False, False),
        ],
    )
    def test_p7_the_actions_table(
        self,
        kind: NodeKind,
        state: NodeState,
        can_start: bool,
        start_xp: int | None,
        can_practice: bool,
        can_legendary: bool,
    ) -> None:
        assert node_actions(kind, state) == NodeActions(
            can_start=can_start,
            start_xp=start_xp,
            can_practice=can_practice,
            practice_xp=5,
            can_legendary=can_legendary,
            legendary_xp=40,
            legendary_price_gems=100,
        )
