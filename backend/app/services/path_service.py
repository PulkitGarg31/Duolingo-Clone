"""The learning path: each node's derived state, the path view, and opening treasure chests.

Node progress is never stored. Three small queries (lessons completed per node, passed legendary
runs, opened chests) feed the pure path rules, which decide every node's state in course order.
"""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.errors import ChestLocked, NodeNotPlayable, NotFound
from app.domain import path
from app.domain.enums import GemReason, NodeKind, NodeState
from app.domain.path import NodeFacts
from app.models import Course, PathNode, Unit, User
from app.repositories import content_repo, ledger_repo, play_repo
from app.schemas.common import CourseBrief
from app.schemas.path import ChestClaimOut, PathNodeActions, PathNodeOut, PathOut, PathUnitOut
from app.services import gems_service
from app.services.context import RequestContext


@dataclass(frozen=True)
class PathSnapshot:
    """A learner's path at one moment: the course content in path order, with each node's facts and state."""

    course: Course
    units: list[Unit]  # in order, each with its nodes (in order) and their lessons loaded
    facts: dict[int, NodeFacts]  # by node id
    states: dict[int, NodeState]  # by node id, in course order

    def node(self, node_id: int) -> PathNode | None:
        """The node with this id, if it belongs to this course."""
        return next((node for unit in self.units for node in unit.nodes if node.id == node_id), None)

    def finished_node_ids(self) -> set[int]:
        """Nodes that are completed or legendary."""
        return {node_id for node_id, state in self.states.items() if state in path.FINISHED_STATES}


def snapshot(db: Session, user: User) -> PathSnapshot:
    """Load the learner's current course and derive every node's state."""
    course = course_of(db, user)
    units = content_repo.course_path(db, course.id)
    lessons_done = play_repo.lessons_completed_by_node(db, user.id)
    legendary = play_repo.legendary_node_ids(db, user.id)
    chests = ledger_repo.claimed_chest_node_ids(db, user.id)
    facts = {
        node.id: NodeFacts(
            id=node.id,
            kind=node.kind,
            lesson_count=len(node.lessons),
            lessons_completed=lessons_done.get(node.id, 0),
            legendary=node.id in legendary,
            chest_claimed=node.id in chests,
        )
        for unit in units
        for node in unit.nodes
    }
    return PathSnapshot(course, units, facts, path.node_states(facts.values()))


def course_of(db: Session, user: User) -> Course:
    """The course the learner is taking."""
    course = content_repo.get_course(db, user.current_course_id)
    if course is None:  # users.current_course_id is a foreign key
        raise RuntimeError(f"course {user.current_course_id} is missing")
    return course


def course_brief(course: Course) -> CourseBrief:
    """A course as the course menu and the top bar show it."""
    return CourseBrief.model_validate(course)


def path_view(db: Session, ctx: RequestContext) -> PathOut:
    """The whole path: units in order, each node with its state, crown, progress and actions."""
    path_now = snapshot(db, ctx.user)
    with_guidebook = content_repo.unit_ids_with_guidebook(db, path_now.course.id)
    return PathOut(
        course=course_brief(path_now.course),
        current_node_id=path.current_node_id(path_now.states),
        units=[_unit_out(unit, path_now, unit.id in with_guidebook) for unit in path_now.units],
    )


def claim_chest(db: Session, ctx: RequestContext, node_id: int) -> ChestClaimOut:
    """Open a reachable chest: its gems are credited once, and a repeated claim replays the first one.

    The gem ledger row is the claim itself; a partial unique index allows one per learner and chest.
    """
    path_now = snapshot(db, ctx.user)
    node = path_now.node(node_id)
    if node is None:
        raise NotFound("There is no path node with that id.")
    if node.kind != NodeKind.CHEST or node.chest_gems is None:
        raise NodeNotPlayable("Only a treasure chest can be opened.")
    earlier = ledger_repo.chest_claim(db, ctx.user.id, node_id)
    if earlier is not None:
        return ChestClaimOut(node_id=node_id, gems_awarded=earlier.delta, gems=ctx.stats.gems, replayed=True)
    if path_now.states[node_id] != NodeState.AVAILABLE:
        raise ChestLocked()
    gems_service.credit(db, ctx.user.id, node.chest_gems, GemReason.CHEST, now=ctx.now, node_id=node_id)
    return ChestClaimOut(node_id=node_id, gems_awarded=node.chest_gems, gems=ctx.stats.gems, replayed=False)


def _unit_out(unit: Unit, path_now: PathSnapshot, has_guidebook: bool) -> PathUnitOut:
    return PathUnitOut(
        id=unit.id,
        number=unit.position,
        section=unit.section,
        title=unit.title,
        description=unit.description,
        color=unit.color,
        state=path.unit_state([(node.kind, path_now.states[node.id]) for node in unit.nodes]),
        has_guidebook=has_guidebook,
        nodes=[_node_out(node, path_now.facts[node.id], path_now.states[node.id]) for node in unit.nodes],
    )


def _node_out(node: PathNode, facts: NodeFacts, state: NodeState) -> PathNodeOut:
    return PathNodeOut(
        id=node.id,
        position=node.position,
        kind=node.kind,
        title=node.title,
        state=state,
        crown_level=path.crown_level(node.kind, state),
        lessons_completed=facts.lessons_completed,
        lesson_count=facts.lesson_count,
        next_lesson_number=path.next_lesson_number(facts, state),
        chest_gems=node.chest_gems,
        # The domain's actions carry the same field names as the wire model.
        actions=PathNodeActions.model_validate(path.node_actions(node.kind, state)),
    )
