"""GET /me/path and chest claims: the learning path with every node's derived state."""

from typing import Literal

from app.domain.enums import NodeKind, NodeState, UnitColor, UnitState
from app.schemas.base import ApiModel
from app.schemas.common import CourseBrief

# 0: not completed, 1: completed, 2: legendary.
CrownLevel = Literal[0, 1, 2]


class PathNodeActions(ApiModel):
    """What the node popover offers. The server decides, so the client never re-implements unlock rules."""

    can_start: bool
    start_xp: int | None
    can_practice: bool
    practice_xp: int
    can_legendary: bool
    legendary_xp: int
    legendary_price_gems: int


class PathNodeOut(ApiModel):
    """A stop on the path. The progress ring is `lessonsCompleted / lessonCount` on the active node."""

    id: int
    position: int
    kind: NodeKind
    title: str
    state: NodeState
    crown_level: CrownLevel
    lessons_completed: int
    lesson_count: int
    next_lesson_number: int | None
    chest_gems: int | None
    actions: PathNodeActions


class PathUnitOut(ApiModel):
    """A unit banner and its nodes in path order."""

    id: int
    number: int
    section: int
    title: str
    description: str
    color: UnitColor
    state: UnitState
    has_guidebook: bool
    nodes: list[PathNodeOut]


class PathOut(ApiModel):
    """The whole course path. `currentNodeId` is the active node, null once the course is finished."""

    course: CourseBrief
    current_node_id: int | None
    units: list[PathUnitOut]


class ChestClaimOut(ApiModel):
    """An opened chest. A repeated claim replays the original award."""

    node_id: int
    gems_awarded: int
    gems: int
    replayed: bool
