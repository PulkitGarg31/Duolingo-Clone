"""A course's content as the rules and the views read it: frozen copies of the content rows.

Content never changes while the server runs, so one copy serves every request (services/reference.py
reads it once per database). Each part keeps the order the course is played in.
"""

from collections import defaultdict
from collections.abc import Collection, Iterator, Mapping
from dataclasses import dataclass
from functools import cached_property
from types import MappingProxyType

from app.domain import grading, hints
from app.domain.enums import ExerciseType, NodeKind, TextLang, UnitColor


@dataclass(frozen=True)
class CourseRow:
    """A course as the course menu and the top bar show it."""

    id: int
    slug: str
    title: str
    learning_language: str
    from_language: str
    tts_locale: str
    flag_key: str
    is_published: bool


@dataclass(frozen=True)
class LessonRow:
    """A lesson of a node ("Lesson 2 of 3") and its exercises in authored order."""

    id: int
    position: int
    exercise_ids: tuple[int, ...]


@dataclass(frozen=True)
class NodeRow:
    """A stop on the path, with its lessons in order (none for a chest), and its unit's number and colour."""

    id: int
    unit_id: int
    unit_number: int
    unit_color: UnitColor
    position: int
    key: str  # stable across seeds, such as 'u1.hello'
    kind: NodeKind
    title: str
    chest_gems: int | None
    lessons: tuple[LessonRow, ...]


@dataclass(frozen=True)
class UnitRow:
    """A unit with its nodes in path order."""

    id: int
    position: int
    section: int
    title: str
    description: str
    color: UnitColor
    has_guidebook: bool  # it has tips or at least one key phrase
    nodes: tuple[NodeRow, ...]


@dataclass(frozen=True)
class OptionRow:
    """A choice of a multiple-choice or fill-in exercise, or a word-bank tile."""

    id: int
    text: str
    image_key: str | None
    is_correct: bool


@dataclass(frozen=True)
class PairRow:
    """One pair of a match exercise."""

    id: int
    learning_text: str
    native_text: str


@dataclass(frozen=True)
class ExerciseRow:
    """An exercise with its choices or tiles, its accepted answers and its pairs, each in order."""

    id: int
    lesson_id: int
    type: ExerciseType
    instruction: str
    text: str | None
    text_language: TextLang | None
    text_translation: str | None
    audio_only: bool
    is_new_word: bool
    options: tuple[OptionRow, ...]
    answers: tuple[str, ...]  # accepted answers, the primary one first
    pairs: tuple[PairRow, ...]

    @property
    def sentence(self) -> tuple[str, TextLang]:
        """The sentence and its language; every type except match pairs has one."""
        if self.text is None or self.text_language is None:
            raise ValueError(f"exercise {self.id} has no sentence")
        return self.text, self.text_language

    @property
    def answer_language(self) -> TextLang:
        """The language a written answer to a translate or type-answer exercise is in."""
        return grading.answer_language(self.sentence[1], audio_only=self.audio_only)


@dataclass(frozen=True)
class GlossaryTermRow:
    """A word hint, and the node that introduces the word (which counts it as learned)."""

    language: TextLang
    term: str  # normalized: "buenos días"
    hint: str
    node_id: int | None


@dataclass(frozen=True)
class CourseContent:
    """A course's content: its path in order, its exercises by id and its glossary."""

    course: CourseRow
    units: tuple[UnitRow, ...]
    exercises: Mapping[int, ExerciseRow]  # in id order
    terms: tuple[GlossaryTermRow, ...]

    def nodes(self) -> Iterator[NodeRow]:
        """Every node in path order, unit by unit."""
        return (node for unit in self.units for node in unit.nodes)

    def node(self, node_id: int) -> NodeRow | None:
        """The node with this id, if it belongs to this course."""
        return next((node for node in self.nodes() if node.id == node_id), None)

    def exercise(self, exercise_id: int) -> ExerciseRow:
        exercise = self.exercises.get(exercise_id)
        if exercise is None:  # sessions only ever queue exercises of the learner's course
            raise ValueError(f"exercise {exercise_id} is not part of course {self.course.id}")
        return exercise

    def lesson_exercises(self, lesson: LessonRow) -> list[ExerciseRow]:
        """A lesson's exercises in authored order."""
        return [self.exercises[exercise_id] for exercise_id in lesson.exercise_ids]

    def node_exercises(self, node: NodeRow) -> list[ExerciseRow]:
        """Every exercise of a node's lessons, lesson by lesson: the legendary pool."""
        return [exercise for lesson in node.lessons for exercise in self.lesson_exercises(lesson)]

    def exercises_in_lessons(self, lesson_ids: Collection[int]) -> list[ExerciseRow]:
        """The exercises of the given lessons, by id: the practice and timed-practice pools."""
        return [exercise for exercise in self.exercises.values() if exercise.lesson_id in lesson_ids]

    def words_introduced(self, node_ids: Collection[int]) -> int:
        """How many glossary words of the learned language the given nodes introduce."""
        language = TextLang(self.course.learning_language)
        return sum(1 for term in self.terms if term.language == language and term.node_id in node_ids)

    @cached_property
    def glossary(self) -> hints.Glossary:
        """The word hints, in the language being learned."""
        language = TextLang(self.course.learning_language)
        hint_by_term = {term.term: term.hint for term in self.terms if term.language == language}
        return hints.Glossary(language, MappingProxyType(hint_by_term))

    @cached_property
    def vocabulary(self) -> Mapping[TextLang, frozenset[str]]:
        """The course's real words in each language: its glossary terms and every text a learner
        might type or tap. The typo rule won't forgive a slip that spells one of them."""
        texts: defaultdict[TextLang, list[str]] = defaultdict(list)
        for term in self.terms:
            texts[term.language].append(term.term)
        learning, native = TextLang(self.course.learning_language), TextLang(self.course.from_language)
        for exercise in self.exercises.values():
            for language, text in _written_texts(exercise, learning, native):
                texts[language].append(text)
        return MappingProxyType(
            {language: grading.vocabulary(texts[language], language) for language in TextLang}
        )


def _written_texts(
    exercise: ExerciseRow, learning: TextLang, native: TextLang
) -> Iterator[tuple[TextLang, str]]:
    """Each text of the exercise a learner might type or tap, with the language it is written in.

    Accepted answers and word-bank tiles are in the answer's language and fill-in choices in the
    sentence's. Multiple-choice options are in the language opposite the prompt, or in the
    learning language when there is no prompt ("Which one of these is 'the bread'?"). A match pair
    gives one text in each language.
    """
    match exercise.type:
        case ExerciseType.MATCH_PAIRS:
            for pair in exercise.pairs:
                yield learning, pair.learning_text
                yield native, pair.native_text
        case ExerciseType.MULTIPLE_CHOICE:
            language = learning if exercise.text is None else exercise.answer_language
            yield from ((language, option.text) for option in exercise.options)
        case ExerciseType.FILL_BLANK:
            language = exercise.sentence[1]
            yield from ((language, option.text) for option in exercise.options)
        case ExerciseType.TRANSLATE | ExerciseType.TYPE_ANSWER:
            language = exercise.answer_language
            yield from ((language, text) for text in exercise.answers)
            yield from ((language, tile.text) for tile in exercise.options)
