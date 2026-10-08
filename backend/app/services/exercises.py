"""Exercise rows as the lesson player sees them and as the grading rules see them.

`payload` builds an exercise's public view. It never reveals the answer, with two deliberate
exceptions: a match pair carries the same id in both columns (per-tap feedback needs it), and a
listening prompt carries its sentence for the browser to speak (it is never displayed).
`answer_key`, `to_answer` and `written_texts` adapt rows and request bodies to the pure rules.
"""

import random
from collections.abc import Iterable, Iterator
from dataclasses import dataclass

from app.domain import grading, hints
from app.domain.enums import ExerciseType, TextLang
from app.domain.rules import SPECIAL_CHARACTERS_ES
from app.models import Exercise
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


def payload(exercise: Exercise, style: PromptStyle, rng: random.Random) -> ExerciseOut:
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
            language = answer_language(exercise)
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
            before, after = _sentence(exercise)[0].split(grading.BLANK, 1)
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
            language = answer_language(exercise)
            return TypeAnswerExercise(
                id=exercise.id,
                instruction=exercise.instruction,
                prompt=_prompt(exercise, style),
                audio_only=exercise.audio_only,
                answer_language=language,
                special_characters=_special_characters(language),
            )


def _prompt(exercise: Exercise, style: PromptStyle) -> PromptOut:
    """The exercise's sentence, split into hint segments that concatenate back to it.

    A listening sentence is heard, never shown, so it has no segments. Without hints the sentence
    is one plain segment.
    """
    text, language = _sentence(exercise)
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


def _sentence(exercise: Exercise) -> tuple[str, TextLang]:
    """The sentence and its language; the schema requires both for every type that shows one."""
    if exercise.text is None or exercise.text_language is None:
        raise ValueError(f"exercise {exercise.id} has no sentence")
    return exercise.text, exercise.text_language


def answer_language(exercise: Exercise) -> TextLang:
    """The language a written answer to a translate or type-answer exercise is in."""
    return grading.answer_language(_sentence(exercise)[1], audio_only=exercise.audio_only)


def _special_characters(language: TextLang) -> list[str]:
    """The accent keys under the text box, offered only for answers written in Spanish."""
    return list(SPECIAL_CHARACTERS_ES) if language == TextLang.ES else []


def _shuffled[T](items: Iterable[T], rng: random.Random) -> list[T]:
    shuffled = list(items)
    rng.shuffle(shuffled)
    return shuffled


# ---- grading adapters ----


def answer_key(exercise: Exercise) -> grading.AnswerKey:
    """What grading needs to know about the exercise; accepted answers come primary first."""
    return grading.AnswerKey(
        type=exercise.type,
        text=exercise.text,
        text_language=exercise.text_language,
        audio_only=exercise.audio_only,
        options=tuple(
            grading.Option(option.id, option.text, option.is_correct) for option in exercise.options
        ),
        accepted=tuple(answer.text for answer in exercise.answers),
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


def written_texts(exercise: Exercise, learning: TextLang, native: TextLang) -> Iterator[tuple[TextLang, str]]:
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
            language = learning if exercise.text is None else answer_language(exercise)
            yield from ((language, option.text) for option in exercise.options)
        case ExerciseType.FILL_BLANK:
            language = _sentence(exercise)[1]
            yield from ((language, option.text) for option in exercise.options)
        case ExerciseType.TRANSLATE | ExerciseType.TYPE_ANSWER:
            language = answer_language(exercise)
            yield from ((language, answer.text) for answer in exercise.answers)
            yield from ((language, tile.text) for tile in exercise.options)
