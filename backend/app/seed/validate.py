"""Load the seed files and check every rule, reporting all problems at once.

`read_files` does the reading; `parse_bundle` is a pure function of the files' contents. Each file
is parsed into its `app.seed.schema` model, which checks the rules about single records.
The rules that span files run next: node keys are unique, the glossary belongs to its course, the
learner is the one the settings sign in as, and the history script replays on the course with the
live start rules. Every problem becomes one line with its JSON path, for example:

    unit-2.json › nodes[1] › lessons[0] › exercises[3] › fill_blank: text must contain exactly one "___"
"""

import hashlib
from collections import Counter
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Final

from pydantic import ValidationError
from pydantic_core import ErrorDetails

from app.domain import path, planner
from app.domain.enums import NodeKind, NodeState, SessionKind, TextLang
from app.domain.grading import normalize
from app.domain.rules import LEGENDARY_ITEM_COUNT, LEGENDARY_PRICE_GEMS, MAX_HEARTS, PRACTICE_ITEM_COUNT
from app.seed.schema import (
    CatalogFile,
    ChestStep,
    CourseFile,
    CourseSeed,
    HistoryStep,
    LegendaryStep,
    LessonStep,
    NodeSeed,
    PlayStep,
    PurchaseStep,
    SampleLearnerFile,
    SeedModel,
    UnitFile,
    UsersFile,
)

DATA_DIR: Final = Path(__file__).resolve().parent / "data"
COURSE_FILE: Final = "course.json"
CATALOG_FILE: Final = "catalog.json"
USERS_FILE: Final = "users.json"
SCRIPT_FILE: Final = "sample_learner.json"


class SeedError(Exception):
    """The seed files break one or more rules. `problems` lists every one, each with its JSON path."""

    def __init__(self, problems: Sequence[str]) -> None:
        self.problems = list(problems)
        super().__init__("the seed files are invalid:\n" + "\n".join(self.problems))


@dataclass(frozen=True)
class LoadedUnit:
    """A parsed unit file, with its file name for problem paths."""

    file: str
    content: UnitFile


@dataclass(frozen=True)
class LoadedCourse:
    """A course with its units, in path order."""

    entry: CourseSeed
    units: tuple[LoadedUnit, ...]

    def nodes(self) -> list[tuple[LoadedUnit, int, NodeSeed]]:
        """Every node in course order, with its unit and its index inside that unit."""
        return [(unit, index, node) for unit in self.units for index, node in enumerate(unit.content.nodes)]


@dataclass(frozen=True)
class SeedBundle:
    """Every seed file, parsed and validated."""

    courses: tuple[LoadedCourse, ...]  # in menu order
    catalog: CatalogFile
    users: UsersFile
    sample_learner: SampleLearnerFile
    version: str  # the sha256 of the data files, stored as app_state.seed_version

    @property
    def learner_course(self) -> LoadedCourse:
        """The course the learner takes: the first published one."""
        return next(course for course in self.courses if course.entry.is_published)


def load_bundle(data_dir: Path = DATA_DIR, *, default_username: str) -> SeedBundle:
    """Read the seed files in `data_dir` and validate them: see `parse_bundle`."""
    return parse_bundle(read_files(data_dir), default_username=default_username)


def read_files(data_dir: Path = DATA_DIR) -> dict[str, bytes]:
    """The content of every seed file in `data_dir`, by file name."""
    return {file.name: file.read_bytes() for file in sorted(data_dir.glob("*.json"))}


def parse_bundle(files: Mapping[str, bytes], *, default_username: str) -> SeedBundle:
    """Parse and validate the seed files' contents, or raise SeedError listing every problem found.

    `default_username` is the learner the settings sign in as; users.json must name the same one.
    """
    problems: list[str] = []
    course_file = _parse(files, COURSE_FILE, CourseFile, problems)
    catalog = _parse(files, CATALOG_FILE, CatalogFile, problems)
    users = _parse(files, USERS_FILE, UsersFile, problems)
    script = _parse(files, SCRIPT_FILE, SampleLearnerFile, problems)
    entries = [] if course_file is None else course_file.courses
    courses = [_parse_course(files, entry, problems) for entry in entries]
    parsed = [course for course in courses if course is not None]

    problems += _node_key_problems(parsed)
    for index, course in enumerate(courses):
        if course is not None:
            problems += _glossary_problems(course, index)
    if users is not None and users.learner.username != default_username:
        problems.append(
            f"{USERS_FILE} › learner › username: must be {default_username!r}, the default learner"
        )
    # The script replays on the learner's course, the first published one, if its units parsed.
    learner_course = next((c for entry, c in zip(entries, courses, strict=True) if entry.is_published), None)
    if script is not None and catalog is not None and learner_course is not None:
        problems += _script_problems(script, learner_course, catalog)

    if problems or catalog is None or users is None or script is None or len(parsed) != len(entries):
        raise SeedError(problems)
    return SeedBundle(tuple(parsed), catalog, users, script, data_version(files))


def data_version(files: Mapping[str, bytes]) -> str:
    """The sha256 of every seed file and its name: it changes whenever any file changes."""
    digest = hashlib.sha256()
    for name in sorted(files):
        digest.update(name.encode())
        digest.update(files[name])
    return digest.hexdigest()


# ---- parsing ----


def _parse[M: SeedModel](
    files: Mapping[str, bytes], name: str, model: type[M], problems: list[str]
) -> M | None:
    """One file parsed into `model`, or None once its problems are added to `problems`."""
    raw = files.get(name)
    if raw is None:
        problems.append(f"{name}: file not found")
        return None
    try:
        return model.model_validate_json(raw)
    except ValidationError as error:
        problems += [f"{_json_path(name, issue['loc'])}: {_message(issue)}" for issue in error.errors()]
        return None


def _parse_course(files: Mapping[str, bytes], entry: CourseSeed, problems: list[str]) -> LoadedCourse | None:
    """A course with its unit files, or None when one of them is invalid."""
    units = [
        LoadedUnit(name, unit)
        for name in entry.units
        if (unit := _parse(files, name, UnitFile, problems)) is not None
    ]
    return LoadedCourse(entry, tuple(units)) if len(units) == len(entry.units) else None


def _json_path(file: str, loc: tuple[int | str, ...]) -> str:
    """'unit-2.json › nodes[1] › lessons[0]', from the location Pydantic gives an error."""
    parts = [file]
    for key in loc:
        if isinstance(key, int):
            parts[-1] += f"[{key}]"
        else:
            parts.append(key)
    return " › ".join(parts)


def _message(issue: ErrorDetails) -> str:
    """The problem's text, without Pydantic's prefix for our own errors."""
    # The validators raise ValueError, which Pydantic reports as "Value error, <message>".
    return issue["msg"].removeprefix("Value error, ")


# ---- rules that span files ----


def _node_key_problems(courses: Sequence[LoadedCourse]) -> list[str]:
    """Node keys name nodes across the whole database, so no two nodes may share one."""
    first_use: dict[str, str] = {}
    problems = []
    for course in courses:
        for unit, index, node in course.nodes():
            where = f"{unit.file} › nodes[{index}]"
            if node.key in first_use:
                problems.append(f"{where} › key: {node.key!r} is already the key of {first_use[node.key]}")
            first_use.setdefault(node.key, where)
    return problems


def _glossary_problems(course: LoadedCourse, course_index: int) -> list[str]:
    """Glossary terms are written normalized, are unique in their course and name one of its nodes."""
    if not course.units:
        return []
    if course.entry.learning_language not in {lang.value for lang in TextLang}:
        where = f"{COURSE_FILE} › courses[{course_index}] › learningLanguage"
        return [f"{where}: a course with units teaches es or en"]
    language = TextLang(course.entry.learning_language)
    node_keys = {node.key for _, _, node in course.nodes()}
    first_use: dict[str, str] = {}
    problems = []
    for unit in course.units:
        for index, entry in enumerate(unit.content.glossary):
            where = f"{unit.file} › glossary[{index}]"
            written = normalize(entry.term, language)
            if entry.term != written:
                problems.append(f"{where} › term: write it normalized, as {written!r}")
            if entry.term in first_use:
                problems.append(
                    f"{where} › term: {entry.term!r} is already defined at {first_use[entry.term]}"
                )
            first_use.setdefault(entry.term, where)
            if entry.node not in node_keys:
                problems.append(f"{where} › node: there is no node {entry.node!r} in this course")
    return problems


def _script_problems(script: SampleLearnerFile, course: LoadedCourse, catalog: CatalogFile) -> list[str]:
    """Replay the history script on the course's path, step by step, with the live start rules.

    Every step must be one a learner could really take at that moment: a lesson plays the next lesson
    of the current node, a chest must be reachable, practice needs finished lessons, a legendary run
    needs a completed skill and the entry fee, and a purchase needs an available item and its price.
    The replay stops at the first refused step, because every later step builds on it.
    """
    replay = _Replay(course, catalog, gems=script.starting_gems)
    problems = []
    for index, step in enumerate(script.steps):
        where = f"{SCRIPT_FILE} › steps[{index}]"
        refused = replay.refusal(step)
        if refused is not None:
            return [*problems, f"{where}: {refused}"]
        if not isinstance(step, ChestStep | PurchaseStep):
            problems += replay.wrong_item_problems(where, step)
        replay.take(step)
    return problems


class _Replay:
    """What the script has done so far: lessons finished per node, legendary skills, chests, gems."""

    def __init__(self, course: LoadedCourse, catalog: CatalogFile, *, gems: int) -> None:
        self.nodes = {node.key: node for _, _, node in course.nodes()}  # in course order
        self.shop = {item.code: item for item in catalog.shop_items}
        self.lessons_done = Counter[str]()
        self.legendary: set[str] = set()
        self.chests: set[str] = set()
        self.gems = gems

    def refusal(self, step: HistoryStep) -> str | None:
        """Why a learner couldn't take this step now, or None when they could."""
        if isinstance(step, PurchaseStep):
            item = self.shop.get(step.item)
            if item is None or not item.is_available:
                return f"the shop doesn't sell {step.item}"
            if item.price_gems > self.gems:
                return f"{step.item} costs {item.price_gems} gems, the learner has {self.gems}"
            return None
        node = None if step.node is None else self.nodes.get(step.node)
        if step.node is not None and node is None:
            return f"there is no node {step.node!r} in the learner's course"
        state = None if node is None else self._states()[node.key]
        if isinstance(step, ChestStep):
            reachable = node is not None and node.kind == NodeKind.CHEST and state == NodeState.AVAILABLE
            return None if reachable else f"{step.node} is not a reachable chest"
        refused = planner.start_refusal(
            SessionKind(step.kind),
            None if node is None or state is None else (node.kind, state),
            hearts=MAX_HEARTS,
            gems=self.gems,
            lessons_completed=self.lessons_done.total(),
        )
        return None if refused is None else f"this {step.kind} would be refused with {refused}"

    def take(self, step: HistoryStep) -> None:
        """Keep what an allowed step changes; practice changes nothing the replay follows."""
        match step:
            case PurchaseStep(item=code):
                self.gems -= self.shop[code].price_gems
            case ChestStep(node=key):
                self.chests.add(key)
                self.gems += self.nodes[key].chest_gems or 0
            case LessonStep(node=key):
                self.lessons_done[key] += 1
            case LegendaryStep(node=key):
                self.legendary.add(key)
                self.gems -= LEGENDARY_PRICE_GEMS

    def wrong_item_problems(self, where: str, step: PlayStep) -> list[str]:
        """Wrong answers must point at items the session will have."""
        if isinstance(step, LessonStep):
            node = self.nodes[step.node]
            items = len(node.lessons[self.lessons_done[node.key]].exercises)
        else:
            items = LEGENDARY_ITEM_COUNT if isinstance(step, LegendaryStep) else PRACTICE_ITEM_COUNT
        beyond = [item for item in step.wrong if item > items]
        return [f"{where} › wrong: the session has at most {items} items, so not {beyond}"] if beyond else []

    def _states(self) -> dict[str, NodeState]:
        """Every node's state, by key, from what the script has done so far."""
        facts = [
            path.NodeFacts(
                id=index,
                kind=node.kind,
                lesson_count=len(node.lessons),
                lessons_completed=self.lessons_done[node.key],
                legendary=node.key in self.legendary,
                chest_claimed=node.key in self.chests,
            )
            for index, node in enumerate(self.nodes.values())
        ]
        states = path.node_states(facts)
        return {key: states[index] for index, key in enumerate(self.nodes)}
