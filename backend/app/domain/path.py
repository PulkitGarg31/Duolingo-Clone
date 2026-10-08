"""The learning path: which nodes are locked, current, open or done, and what each one offers.

Node progress is derived from facts (completed lesson sessions, passed legendary runs and chest
claims), never stored. Walking the course in order:
- the first skill or review that is not completed is the one `active` node, and every node after
  it is `locked` (lessons are played in order, so nothing can be skipped);
- a chest never blocks the path: once reachable it is `available` until it is opened;
- a completed skill or review earns crown 1, and a passed legendary run turns a skill gold (crown 2).
"""

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from typing import Final

from app.domain.enums import NodeKind, NodeState, UnitState
from app.domain.rules import LEGENDARY_PRICE_GEMS, LEGENDARY_XP, LESSON_XP, NODE_PRACTICE_XP, UNIT_REVIEW_XP

PLAYABLE_KINDS: Final = frozenset({NodeKind.SKILL, NodeKind.REVIEW})  # chests are opened, not played
FINISHED_STATES: Final = frozenset({NodeState.COMPLETED, NodeState.LEGENDARY})
UNLOCKED_STATES: Final = frozenset({NodeState.ACTIVE, NodeState.AVAILABLE})


@dataclass(frozen=True)
class NodeFacts:
    """What the path rules need to know about one node, for one learner."""

    id: int
    kind: NodeKind
    lesson_count: int  # 0 for a chest
    lessons_completed: int = 0  # distinct lessons of the node finished in lesson sessions
    legendary: bool = False  # a legendary run on the node was passed
    chest_claimed: bool = False


@dataclass(frozen=True)
class NodeActions:
    """What the node's popover offers. The server decides, so the client never re-implements it."""

    can_start: bool
    start_xp: int | None
    can_practice: bool
    practice_xp: int
    can_legendary: bool
    legendary_xp: int
    legendary_price_gems: int


def is_completed(node: NodeFacts) -> bool:
    """A chest is done once opened; a skill or review once every one of its lessons is finished."""
    if node.kind == NodeKind.CHEST:
        return node.chest_claimed
    return node.lessons_completed >= node.lesson_count


def node_states(nodes_in_course_order: Iterable[NodeFacts]) -> dict[int, NodeState]:
    """Every node's state, keyed by id, in course order (unit position, then node position)."""
    states: dict[int, NodeState] = {}
    blocked = False  # set at the first unfinished skill or review: everything after it is locked
    for node in nodes_in_course_order:
        if is_completed(node):
            states[node.id] = NodeState.LEGENDARY if node.legendary else NodeState.COMPLETED
        elif blocked:
            states[node.id] = NodeState.LOCKED
        elif node.kind == NodeKind.CHEST:
            states[node.id] = NodeState.AVAILABLE  # reachable but unopened; it does not block the path
        else:
            states[node.id] = NodeState.ACTIVE
            blocked = True
    return states


def current_node_id(states: Mapping[int, NodeState]) -> int | None:
    """The one active node, or None once the whole course is finished."""
    return next((node_id for node_id, state in states.items() if state == NodeState.ACTIVE), None)


def crown_level(kind: NodeKind, state: NodeState) -> int:
    """0 until the node is finished, 1 once completed, 2 once legendary. Chests carry no crown."""
    if kind == NodeKind.CHEST or state not in FINISHED_STATES:
        return 0
    return 2 if state == NodeState.LEGENDARY else 1


def next_lesson_number(node: NodeFacts, state: NodeState) -> int | None:
    """The lesson that START plays ("Lesson 2 of 3"). Only the active node has one."""
    return node.lessons_completed + 1 if state == NodeState.ACTIVE else None


def unit_state(nodes: Sequence[tuple[NodeKind, NodeState]]) -> UnitState:
    """Completed when every non-chest node is finished, locked when every node is locked.

    `nodes` holds each node's kind and state. An unopened chest does not hold a unit back.
    """
    if all(state in FINISHED_STATES for kind, state in nodes if kind != NodeKind.CHEST):
        return UnitState.COMPLETED
    if all(state == NodeState.LOCKED for _, state in nodes):
        return UnitState.LOCKED
    return UnitState.IN_PROGRESS


def newly_unlocked(before: Mapping[int, NodeState], after: Mapping[int, NodeState]) -> list[int]:
    """Nodes that went from locked to playable (active, or an available chest), in path order.

    Both mappings come from `node_states`, so `after` iterates in course order and the path can
    animate the unlocks one after another.
    """
    return [
        node_id
        for node_id, state in after.items()
        if state in UNLOCKED_STATES and before[node_id] == NodeState.LOCKED
    ]


def node_actions(kind: NodeKind, state: NodeState) -> NodeActions:
    """What the learner can do on a node:

    - START the next lesson of the active skill or review (+10 XP, or +40 for a unit review);
    - PRACTICE a finished skill or review;
    - try a LEGENDARY run on a completed skill that is not gold yet.
    The XP and price fields are always filled in, so the popover can show them.
    """
    can_start = kind in PLAYABLE_KINDS and state == NodeState.ACTIVE
    lesson_xp = UNIT_REVIEW_XP if kind == NodeKind.REVIEW else LESSON_XP
    return NodeActions(
        can_start=can_start,
        start_xp=lesson_xp if can_start else None,
        can_practice=kind in PLAYABLE_KINDS and state in FINISHED_STATES,
        practice_xp=NODE_PRACTICE_XP,
        can_legendary=kind == NodeKind.SKILL and state == NodeState.COMPLETED,
        legendary_xp=LEGENDARY_XP,
        legendary_price_gems=LEGENDARY_PRICE_GEMS,
    )
