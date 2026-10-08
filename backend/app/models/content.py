"""Course content: course -> unit -> path node -> lesson -> exercise -> options, answers, pairs.

The whole tree is one aggregate, so deletes cascade down it. Learner history points into it with
ON DELETE RESTRICT, so content that has been played can never disappear from under a learner.

Parent-to-children relationships use cascade="all, delete-orphan" with passive_deletes=True: the
ORM saves children with their parent, and the database's ON DELETE CASCADE removes them without
loading them first.
"""

from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.types import checked_bool, str_enum
from app.domain.enums import ExerciseType, NodeKind, TextLang, UnitColor
from app.models.base import Base


class Course(Base):
    """A language course, such as Spanish for English speakers; the root of the content tree."""

    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(sa.String(16))  # 'es-en'
    title: Mapped[str] = mapped_column(sa.String(40))
    learning_language: Mapped[str] = mapped_column(sa.String(8))
    from_language: Mapped[str] = mapped_column(sa.String(8))
    tts_locale: Mapped[str] = mapped_column(sa.String(16))  # Web Speech voice, e.g. 'es-ES'
    flag_key: Mapped[str] = mapped_column(sa.String(16))
    is_published: Mapped[bool] = mapped_column(checked_bool("is_published"), server_default=sa.true())
    position: Mapped[int]

    units: Mapped[list[Unit]] = relationship(
        back_populates="course", order_by="Unit.position", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (
        sa.UniqueConstraint("slug"),
        sa.UniqueConstraint("position"),
        sa.CheckConstraint("learning_language <> from_language", name="languages_differ"),
    )


class Unit(Base):
    """A themed stretch of the path ("Unit 1"), with its colour and its Guidebook content."""

    __tablename__ = "units"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(sa.ForeignKey("courses.id", ondelete="CASCADE"))
    position: Mapped[int]
    section: Mapped[int] = mapped_column(server_default=sa.text("1"))
    title: Mapped[str] = mapped_column(sa.String(80))
    description: Mapped[str] = mapped_column(sa.String(160))
    color: Mapped[UnitColor] = mapped_column(str_enum(UnitColor, "color", 12))  # a palette key, never a hex
    guidebook_tips_md: Mapped[str | None] = mapped_column(sa.Text)  # NULL: key phrases only

    course: Mapped[Course] = relationship(back_populates="units")
    nodes: Mapped[list[PathNode]] = relationship(
        back_populates="unit",
        order_by="PathNode.position",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    guidebook_phrases: Mapped[list[GuidebookPhrase]] = relationship(
        back_populates="unit",
        order_by="GuidebookPhrase.position",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        sa.UniqueConstraint("course_id", "position"),
        sa.CheckConstraint("position >= 1", name="position_positive"),
        sa.CheckConstraint("section >= 1", name="section_positive"),
    )


class PathNode(Base):
    """A stop on the learning path: a skill (a set of lessons), a treasure chest or a unit review.

    Progress is not stored here: a node's state is derived from the learner's completed sessions.
    """

    __tablename__ = "path_nodes"

    id: Mapped[int] = mapped_column(primary_key=True)
    unit_id: Mapped[int] = mapped_column(sa.ForeignKey("units.id", ondelete="CASCADE"))
    position: Mapped[int]
    key: Mapped[str] = mapped_column(sa.String(32))  # stable id such as 'u1.hola', used by the seed
    kind: Mapped[NodeKind] = mapped_column(str_enum(NodeKind, "kind", 8))
    title: Mapped[str] = mapped_column(sa.String(80))
    chest_gems: Mapped[int | None]  # chests only

    unit: Mapped[Unit] = relationship(back_populates="nodes")
    lessons: Mapped[list[Lesson]] = relationship(
        back_populates="node", order_by="Lesson.position", cascade="all, delete-orphan", passive_deletes=True
    )

    __table_args__ = (
        sa.UniqueConstraint("unit_id", "position"),
        sa.UniqueConstraint("key"),
        sa.CheckConstraint("position >= 1", name="position_positive"),
        sa.CheckConstraint("(kind = 'chest') = (chest_gems IS NOT NULL)", name="chest_has_gems"),
        sa.CheckConstraint("chest_gems IS NULL OR chest_gems > 0", name="chest_gems_positive"),
    )


class Lesson(Base):
    """One lesson of a skill or review node ("Lesson 2 of 3"); lessons are played in order."""

    __tablename__ = "lessons"

    id: Mapped[int] = mapped_column(primary_key=True)
    node_id: Mapped[int] = mapped_column(sa.ForeignKey("path_nodes.id", ondelete="CASCADE"))
    position: Mapped[int]

    node: Mapped[PathNode] = relationship(back_populates="lessons")
    exercises: Mapped[list[Exercise]] = relationship(
        back_populates="lesson",
        order_by="Exercise.position",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        sa.UniqueConstraint("node_id", "position"),
        # The parent key of the composite foreign key lesson_sessions(lesson_id, node_id).
        sa.UniqueConstraint("id", "node_id"),
        sa.CheckConstraint("position >= 1", name="position_positive"),
    )


class Exercise(Base):
    """One authored exercise of one of the five types.

    Its choices, accepted answers and match pairs live in typed child tables rather than JSON, so
    the database can guard them ("one correct choice", "one primary answer", unique pair sides).
    """

    __tablename__ = "exercises"

    id: Mapped[int] = mapped_column(primary_key=True)
    lesson_id: Mapped[int] = mapped_column(sa.ForeignKey("lessons.id", ondelete="CASCADE"))
    position: Mapped[int]
    key: Mapped[str] = mapped_column(sa.String(48))  # 'u1.hola.l1.e3', derived by the seed loader
    type: Mapped[ExerciseType] = mapped_column(str_enum(ExerciseType, "type", 16))
    instruction: Mapped[str] = mapped_column(sa.String(160))  # the heading, e.g. 'Translate this sentence'
    text: Mapped[str | None] = mapped_column(sa.String(300))  # sentence shown or spoken; fill_blank has '___'
    text_language: Mapped[TextLang | None] = mapped_column(str_enum(TextLang, "text_language", 2))
    text_translation: Mapped[str | None] = mapped_column(sa.String(300))  # meaning line under the sentence
    # "Type what you hear": a listening exercise is a type_answer whose Spanish text is only spoken.
    audio_only: Mapped[bool] = mapped_column(checked_bool("audio_only"), server_default=sa.false())
    is_new_word: Mapped[bool] = mapped_column(checked_bool("is_new_word"), server_default=sa.false())

    lesson: Mapped[Lesson] = relationship(back_populates="exercises")
    options: Mapped[list[ExerciseOption]] = relationship(
        back_populates="exercise",
        order_by="ExerciseOption.position",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    answers: Mapped[list[ExerciseAnswer]] = relationship(
        back_populates="exercise",
        # Primary first: grading tries the primary answer before the alternates.
        order_by=lambda: (ExerciseAnswer.is_primary.desc(), ExerciseAnswer.id),
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    pairs: Mapped[list[ExercisePair]] = relationship(
        back_populates="exercise",
        order_by="ExercisePair.position",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        sa.UniqueConstraint("lesson_id", "position"),
        sa.UniqueConstraint("key"),
        sa.CheckConstraint("position >= 1", name="position_positive"),
        sa.CheckConstraint("(text IS NULL) = (text_language IS NULL)", name="text_language_pair"),
        sa.CheckConstraint(
            "type IN ('multiple_choice', 'match_pairs') OR text IS NOT NULL", name="text_required"
        ),
        sa.CheckConstraint("type <> 'match_pairs' OR text IS NULL", name="match_has_no_text"),
        sa.CheckConstraint("type <> 'fill_blank' OR instr(text, '___') > 0", name="blank_present"),
        sa.CheckConstraint(
            "audio_only = 0 OR (type = 'type_answer' AND text_language = 'es')", name="audio_only_listening"
        ),
    )


class ExerciseOption(Base):
    """A choice (multiple choice, fill in the blank) or a word-bank tile (translate).

    `is_correct` marks the one right choice and means nothing else; tiles never set it.
    """

    __tablename__ = "exercise_options"

    id: Mapped[int] = mapped_column(primary_key=True)
    exercise_id: Mapped[int] = mapped_column(sa.ForeignKey("exercises.id", ondelete="CASCADE"))
    position: Mapped[int]  # display order; tiles are shuffled once, by the seed loader
    text: Mapped[str] = mapped_column(sa.String(80))  # tiles may repeat ('la' twice), so no UNIQUE
    image_key: Mapped[str | None] = mapped_column(sa.String(32))  # picture-card illustration
    is_correct: Mapped[bool] = mapped_column(checked_bool("is_correct"), server_default=sa.false())

    exercise: Mapped[Exercise] = relationship(back_populates="options")

    __table_args__ = (
        sa.UniqueConstraint("exercise_id", "position"),
        sa.CheckConstraint("position >= 1", name="position_positive"),
        # At most one correct choice per exercise; the seed validator requires exactly one.
        sa.Index(
            "ux_exercise_options_one_correct",
            "exercise_id",
            unique=True,
            sqlite_where=sa.text("is_correct = 1"),
        ),
    )


class ExerciseAnswer(Base):
    """An accepted answer of a translate or type-answer exercise; exactly one is the primary."""

    __tablename__ = "exercise_answers"

    id: Mapped[int] = mapped_column(primary_key=True)
    exercise_id: Mapped[int] = mapped_column(sa.ForeignKey("exercises.id", ondelete="CASCADE"))
    text: Mapped[str] = mapped_column(sa.String(300))  # as authored, with accents and punctuation
    is_primary: Mapped[bool] = mapped_column(checked_bool("is_primary"), server_default=sa.false())

    exercise: Mapped[Exercise] = relationship(back_populates="answers")

    __table_args__ = (
        sa.UniqueConstraint("exercise_id", "text"),
        # At most one primary answer: the one shown after "Correct solution:".
        sa.Index(
            "ux_exercise_answers_one_primary",
            "exercise_id",
            unique=True,
            sqlite_where=sa.text("is_primary = 1"),
        ),
    )


class ExercisePair(Base):
    """One Spanish-English pair of a match-pairs exercise; each side appears once per exercise."""

    __tablename__ = "exercise_pairs"

    id: Mapped[int] = mapped_column(primary_key=True)
    exercise_id: Mapped[int] = mapped_column(sa.ForeignKey("exercises.id", ondelete="CASCADE"))
    position: Mapped[int]
    learning_text: Mapped[str] = mapped_column(sa.String(60))  # 'el pan'
    native_text: Mapped[str] = mapped_column(sa.String(60))  # 'the bread'

    exercise: Mapped[Exercise] = relationship(back_populates="pairs")

    __table_args__ = (
        sa.UniqueConstraint("exercise_id", "position"),
        sa.UniqueConstraint("exercise_id", "learning_text"),
        sa.UniqueConstraint("exercise_id", "native_text"),
        sa.CheckConstraint("position >= 1", name="position_positive"),
    )


class GuidebookPhrase(Base):
    """A key phrase in a unit's Guidebook, with its translation."""

    __tablename__ = "guidebook_phrases"

    id: Mapped[int] = mapped_column(primary_key=True)
    unit_id: Mapped[int] = mapped_column(sa.ForeignKey("units.id", ondelete="CASCADE"))
    position: Mapped[int]
    text: Mapped[str] = mapped_column(sa.String(160))  # Spanish, read aloud by the speaker button
    translation: Mapped[str] = mapped_column(sa.String(160))

    unit: Mapped[Unit] = relationship(back_populates="guidebook_phrases")

    __table_args__ = (
        sa.UniqueConstraint("unit_id", "position"),
        sa.CheckConstraint("position >= 1", name="position_positive"),
    )


class GlossaryTerm(Base):
    """A word or phrase with its hint: drives the dotted-underline hints and "words learned"."""

    __tablename__ = "glossary_terms"

    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(sa.ForeignKey("courses.id", ondelete="CASCADE"))
    # The node that introduces the term. The link is informational, so deleting the node clears it.
    node_id: Mapped[int | None] = mapped_column(
        sa.ForeignKey("path_nodes.id", ondelete="SET NULL"), index=True
    )
    language: Mapped[TextLang] = mapped_column(str_enum(TextLang, "language", 2))
    # Normalized (casefolded, no punctuation) so prompt words can be matched to it; may be multi-word.
    term: Mapped[str] = mapped_column(sa.String(60))
    hint: Mapped[str] = mapped_column(sa.String(120))  # 'good morning'

    __table_args__ = (sa.UniqueConstraint("course_id", "language", "term"),)
