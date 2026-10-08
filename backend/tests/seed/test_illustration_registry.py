"""The picture keys: the backend registry, the frontend's copy and the course content agree."""

import json
from pathlib import Path

import pytest

from app.seed.illustrations import ILLUSTRATION_KEYS
from app.seed.validate import load_bundle

FRONTEND_KEYS = (
    Path(__file__).resolve().parents[3]
    / "frontend"
    / "src"
    / "components"
    / "illustrations"
    / "illustration-keys.json"
)


def test_the_frontend_lists_the_same_keys_in_the_same_order() -> None:
    if not FRONTEND_KEYS.exists():
        pytest.skip("the frontend is not checked out next to the backend")
    assert list(ILLUSTRATION_KEYS) == json.loads(FRONTEND_KEYS.read_text(encoding="utf-8"))


def test_the_keys_are_unique_lowercase_words() -> None:
    assert len(set(ILLUSTRATION_KEYS)) == len(ILLUSTRATION_KEYS) == 26
    assert all(key.isalpha() and key.islower() for key in ILLUSTRATION_KEYS)


def test_the_course_uses_every_illustration() -> None:
    course = load_bundle(default_username="alex").learner_course
    used = {
        option.image
        for _, _, node in course.nodes()
        for lesson in node.lessons
        for exercise in lesson.exercises
        if exercise.type == "multiple_choice"
        for option in exercise.options
        if option.image is not None
    }
    assert used == set(ILLUSTRATION_KEYS)
