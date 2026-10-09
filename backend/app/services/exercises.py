"""Exercises as the lesson player sees them and as the grading rules see them.

`payload` builds an exercise's public view. It never reveals the answer, with two deliberate
exceptions: a match pair carries the same id in both columns (per-tap feedback needs it), and a
listening prompt carries its sentence for the browser to speak (it is never displayed).
`answer_key`, `to_answer` and `canonical_json` adapt exercises and request bodies to the pure rules.
"""

import json
import random
from collections.abc import Iterable
from dataclasses import dataclass

from app.domain import grading, hints
from app.domain.content import ExerciseRow
from app.domain.enums import ExerciseType, TextLang
from app.domain.rules import SPECIAL_CHARACTERS_ES
from app.schemas.exercises import (
    ChoiceOptionOut,
    ExerciseOut,
    FillBlankExercise,
    MatchPairsExercise,
    MultipleChoiceExercise,
    PromptOut,
    PromptSegment,
    TokenOut,
    TranslateExercise,
    TypeAnswerExercise,
)
from app.schemas.sessions import (
    AnswerIn,
    CantListenAnswer,
    FillBlankAnswer,
    MatchPairsAnswer,
    MultipleChoiceAnswer,
    SkipAnswer,
    TranslateAnswer,
    TypeAnswerAnswer,
)


@dataclass(frozen=True)
class PromptStyle:
    """What the prompts of one session share: the language being learned, its word hints, and
    whether hints are shown (legendary runs hide them)."""

    learning_language: TextLang
    glossary: hints.Glossary
    hints_enabled: bool


# ---- payloads ----


def payload(exercise: ExerciseRow, style: PromptStyle, rng: random.Random) -> ExerciseOut:
    """The exercise as the player renders it. `rng` shuffles choices and match columns, so the same
    item always shows the same order."""
    match exercise.type:
        case ExerciseType.MULTIPLE_CHOICE:
            return MultipleChoiceExercise(
                id=exercise.id,
                instruction=exercise.instruction,
                prompt=None if exercise.text is None else _prompt(exercise, style),
                # The seed validator guarantees pictures on every option or on none.
                layout="pictures" if any(option.image_key for option in exercise.options) else "list",
                options=[
                    ChoiceOptionOut(id=option.id, text=option.text, image_key=option.image_key)
                    for option in _shuffled(exercise.options, rng)
                ],
            )
        case ExerciseType.TRANSLATE:
            language = exercise.answer_language
            return TranslateExercise(
                id=exercise.id,
                instruction=exercise.instruction,
                prompt=_prompt(exercise, style),
                answer_language=language,
                # Tiles keep their stored order: the seed shuffled them once already.
                tiles=[TokenOut(id=tile.id, text=tile.text) for tile in exercise.options],
                special_characters=_special_characters(language),
            )
        case ExerciseType.MATCH_PAIRS:
            return MatchPairsExercise(
                id=exercise.id,
                instruction=exercise.instruction,
                left=[
                    TokenOut(id=pair.id, text=pair.learning_text) for pair in _shuffled(exercise.pairs, rng)
                ],
                right=[
                    TokenOut(id=pair.id, text=pair.native_text) for pair in _shuffled(exercise.pairs, rng)
                ],
            )
        case ExerciseType.FILL_BLANK:
            before, after = exercise.sentence[0].split(grading.BLANK, 1)
            return FillBlankExercise(
                id=exercise.id,
                instruction=exercise.instruction,
                prompt=_prompt(exercise, style),
                before=before.strip(),
                after=after.strip(),
                translation=exercise.text_translation,
                options=[
                    TokenOut(id=option.id, text=option.text) for option in _shuffled(exercise.options, rng)
                ],
            )
        case ExerciseType.TYPE_ANSWER:
            language = exercise.answer_language
            return TypeAnswerExercise(
                id=exercise.id,
                instruction=exercise.instruction,
                prompt=_prompt(exercise, style),
                audio_only=exercise.audio_only,
                answer_language=language,
                special_characters=_special_characters(language),
            )


def _prompt(exercise: ExerciseRow, style: PromptStyle) -> PromptOut:
    """The exercise's sentence, split into hint segments that concatenate back to it.

    A listening sentence is heard, never shown, so it has no segments. Without hints the sentence
    is one plain segment.
    """
    text, language = exercise.sentence
    if exercise.audio_only:
        segments: list[PromptSegment] = []
    elif style.hints_enabled:
        segments = [
            PromptSegment(text=piece.text, hint=piece.hint)
            for piece in hints.segment(text, style.glossary, language=language)
        ]
    else:
        segments = [PromptSegment(text=text, hint=None)]
    return PromptOut(
        text=text, language=language, speak=language == style.learning_language, segments=segments
    )


def _special_characters(language: TextLang) -> list[str]:
    """The accent keys under the text box, offered only for answers written in Spanish."""
    return list(SPECIAL_CHARACTERS_ES) if language == TextLang.ES else []


def _shuffled[T](items: Iterable[T], rng: random.Random) -> list[T]:
    shuffled = list(items)
    rng.shuffle(shuffled)
    return shuffled


# ---- grading adapters ----


def answer_key(exercise: ExerciseRow) -> grading.AnswerKey:
    """What grading needs to know about the exercise; accepted answers come primary first."""
    return grading.AnswerKey(
        type=exercise.type,
        text=exercise.text,
        text_language=exercise.text_language,
        audio_only=exercise.audio_only,
        options=tuple(
            grading.Option(option.id, option.text, option.is_correct) for option in exercise.options
        ),
        accepted=exercise.answers,
        pair_ids=frozenset(pair.id for pair in exercise.pairs),
    )


def to_answer(body: AnswerIn) -> grading.Answer:
    """The request body as the domain's answer value."""
    match body:
        case MultipleChoiceAnswer(option_id=option_id):
            return grading.OptionAnswer(ExerciseType.MULTIPLE_CHOICE, option_id)
        case FillBlankAnswer(option_id=option_id):
            return grading.OptionAnswer(ExerciseType.FILL_BLANK, option_id)
        case TranslateAnswer(tile_ids=list() as tile_ids):
            return grading.TilesAnswer(tuple(tile_ids))
        case TranslateAnswer(text=str() as text):
            return grading.TextAnswer(ExerciseType.TRANSLATE, text)
        case MatchPairsAnswer(pairs=pairs):
            return grading.PairsAnswer(tuple((pair.left_id, pair.right_id) for pair in pairs))
        case TypeAnswerAnswer(text=text):
            return grading.TextAnswer(ExerciseType.TYPE_ANSWER, text)
        case SkipAnswer():
            return grading.Skip()
        case CantListenAnswer():
            return grading.CantListen()
    raise TypeError(f"unsupported answer {body!r}")  # the request schema allows nothing else


def canonical_json(body: AnswerIn) -> str:
    """The answer payload in one canonical text form: a repeated request is compared against it."""
    return json.dumps(body.model_dump(by_alias=True), sort_keys=True, separators=(",", ":"))
