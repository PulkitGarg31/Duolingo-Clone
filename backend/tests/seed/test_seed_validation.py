"""Seed validation: the real files pass, and every content rule rejects a crafted broken copy.

The broken cases live in fixtures/rule_*.json, one file per rule. Each case patches the real seed
files' contents in memory with JSON Patch operations (paths are JSON Pointers) and names the problem
line the validation must report, JSON path included.
"""

import copy
import json
import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import pytest

import app.seed.__main__ as seed_command
from app.seed.validate import DATA_DIR, SeedError, load_bundle, parse_bundle, read_files

FIXTURES = Path(__file__).parent / "fixtures"
BACKEND_DIR = Path(__file__).resolve().parents[2]
LEARNER = "alex"  # DEFAULT_USERNAME in the test settings
RULE_COUNT = 12
REAL_FILES = read_files(DATA_DIR)

Json = Any  # a parsed JSON value


@dataclass(frozen=True)
class BrokenCase:
    """A copy of the seed files broken in one way, and the problem it must produce."""

    name: str
    patch: list[dict[str, Json]]
    expect: str


def rule_files() -> list[Path]:
    return sorted(FIXTURES.glob("rule_*.json"))


def broken_cases() -> list[Any]:
    """Every case of every rule file, as pytest parameters named '<rule file>/<case>'."""
    params = []
    for file in rule_files():
        for case in json.loads(file.read_text(encoding="utf-8"))["cases"]:
            broken = BrokenCase(case["name"], case["patch"], case["expect"])
            params.append(pytest.param(broken, id=f"{file.stem}/{broken.name}"))
    return params


def broken_files(patch: list[dict[str, Json]]) -> dict[str, bytes]:
    """The real seed files' contents after applying the JSON Patch operations to the files they name."""
    files = dict(REAL_FILES)
    for name in dict.fromkeys(operation["file"] for operation in patch):
        document = json.loads(files[name])
        for operation in patch:
            if operation["file"] == name:
                apply_operation(document, operation)
        files[name] = json.dumps(document, ensure_ascii=False).encode()
    return files


def apply_operation(document: Json, operation: dict[str, Json]) -> None:
    """One JSON Patch operation: add, remove, replace, copy or move."""
    match operation["op"]:
        case "add":
            _put(document, operation["path"], operation["value"], insert=True)
        case "replace":
            _put(document, operation["path"], operation["value"], insert=False)
        case "remove":
            _take(document, operation["path"])
        case "copy":
            _put(document, operation["path"], copy.deepcopy(_get(document, operation["from"])), insert=True)
        case "move":
            _put(document, operation["path"], _take(document, operation["from"]), insert=True)
        case unknown:
            raise ValueError(f"unsupported patch operation {unknown!r}")


def _parent(document: Json, pointer: str) -> tuple[Json, Any]:
    """The container that `pointer` points into, and the key or index inside it."""
    *parents, last = pointer.removeprefix("/").split("/")
    container = document
    for token in parents:
        container = container[int(token)] if isinstance(container, list) else container[token]
    return container, int(last) if isinstance(container, list) else last


def _get(document: Json, pointer: str) -> Json:
    container, key = _parent(document, pointer)
    return container[key]


def _put(document: Json, pointer: str, value: Json, *, insert: bool) -> None:
    container, key = _parent(document, pointer)
    if isinstance(container, list) and insert:
        container.insert(key, value)
    else:
        container[key] = value


def _take(document: Json, pointer: str) -> Json:
    container, key = _parent(document, pointer)
    return container.pop(key)


def problems_of(files: dict[str, bytes]) -> list[str]:
    with pytest.raises(SeedError) as rejected:
        parse_bundle(files, default_username=LEARNER)
    return rejected.value.problems


class TestRealFiles:
    def test_the_seed_files_pass_every_rule(self) -> None:
        bundle = load_bundle(DATA_DIR, default_username=LEARNER)
        course = bundle.learner_course
        nodes = [node for _, _, node in course.nodes()]
        lessons = [lesson for node in nodes for lesson in node.lessons]
        assert course.entry.slug == "es-en"
        assert (len(course.units), len(nodes), len(lessons)) == (3, 11, 19)
        assert sum(len(lesson.exercises) for lesson in lessons) == 120
        assert len(bundle.users.bots) == 35

    def test_the_check_command_accepts_them(self) -> None:
        result = subprocess.run(
            [sys.executable, "-m", "app.seed", "--check"],
            cwd=BACKEND_DIR,
            env={**os.environ, "DEFAULT_USERNAME": LEARNER},
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=False,
        )
        assert result.returncode == 0, result.stderr
        assert result.stdout.startswith(
            "Seed files OK: 3 courses, 3 units, 11 nodes, 19 lessons, 120 exercises"
        )


class TestBrokenFiles:
    def test_every_rule_has_failing_cases(self) -> None:
        files = rule_files()
        assert len(files) == RULE_COUNT
        assert all(json.loads(file.read_text(encoding="utf-8"))["cases"] for file in files)

    @pytest.mark.parametrize("case", broken_cases())
    def test_each_rule_rejects_its_broken_copy(self, case: BrokenCase) -> None:
        problems = problems_of(broken_files(case.patch))
        assert any(case.expect in problem for problem in problems), "\n".join(problems)

    def test_problems_in_several_files_are_reported_together(self) -> None:
        patch = [
            {"op": "replace", "file": "unit-2.json", "path": "/nodes/2/chestGems", "value": 0},
            {"op": "replace", "file": "catalog.json", "path": "/leagues/0/demoteCount", "value": 3},
            {"op": "replace", "file": "users.json", "path": "/bots/0/avatarColor", "value": "orange"},
        ]
        problems = problems_of(broken_files(patch))
        assert [problem.split(" › ")[0] for problem in problems] == [
            "catalog.json",
            "users.json",
            "unit-2.json",
        ]

    def test_invalid_json_and_missing_files_are_reported(self) -> None:
        files = dict(REAL_FILES, **{"unit-3.json": b"{ not json"})
        del files["users.json"]
        problems = problems_of(files)
        assert "users.json: file not found" in problems
        assert any(problem.startswith("unit-3.json: Invalid JSON") for problem in problems)

    def test_the_check_command_lists_every_problem(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
    ) -> None:
        patch = [
            {"op": "remove", "file": "unit-1.json", "path": "/glossary/0/hint"},
            {"op": "replace", "file": "unit-2.json", "path": "/color", "value": "beige"},
        ]
        for name, content in broken_files(patch).items():
            (tmp_path / name).write_bytes(content)
        monkeypatch.setattr(seed_command, "DATA_DIR", tmp_path)
        assert seed_command.main(["--check"]) == 1
        report = capsys.readouterr().err
        assert "The seed files have 2 problem(s):" in report
        assert "unit-1.json › glossary[0] › hint: Field required" in report
        assert "unit-2.json › color: Input should be" in report
