"""Exercise payloads, discriminated on `type`.

They never contain correct flags or accepted answers. The two deliberate exceptions: match pairs
carry the same id on both sides (per-tap feedback needs it), and listening prompts carry the
sentence for the browser to speak; it is never displayed.
"""

from typing import Annotated, Literal

from pydantic import Field

from app.domain.enums import TextLang
from app.schemas.base import ApiModel


class PromptSegment(ApiModel):
    """A run of prompt text. A non-null `hint` gets the dotted underline and the hover translation."""

    text: str
    hint: str | None


class PromptOut(ApiModel):
    """The sentence an exercise shows or speaks. The segments concatenate exactly to `text`."""

    text: str
    language: TextLang
    speak: bool  # true when the prompt is in the language being learned
    segments: list[PromptSegment]


class ChoiceOptionOut(ApiModel):
    """A multiple-choice option; `imageKey` names a picture-card illustration."""

    id: int
    text: str
    image_key: str | None


class TokenOut(ApiModel):
    """A word-bank tile, a fill-in option or one side of a match pair."""

    id: int
    text: str


class MultipleChoiceExercise(ApiModel):
    """Pick the one right option, shown as picture cards or as a list."""

    id: int
    type: Literal["multiple_choice"] = "multiple_choice"
    instruction: str
    prompt: PromptOut | None
    layout: Literal["pictures", "list"]
    options: list[ChoiceOptionOut]


class TranslateExercise(ApiModel):
    """Translate the prompt with word-bank tiles or by typing."""

    id: int
    type: Literal["translate"] = "translate"
    instruction: str
    prompt: PromptOut
    answer_language: TextLang
    tiles: list[TokenOut]
    special_characters: list[str]


class MatchPairsExercise(ApiModel):
    """Match Spanish words (`left`) to English ones (`right`); a pair shares one id."""

    id: int
    type: Literal["match_pairs"] = "match_pairs"
    instruction: str
    left: list[TokenOut]
    right: list[TokenOut]


class FillBlankExercise(ApiModel):
    """Choose the word for the blank between `before` and `after`."""

    id: int
    type: Literal["fill_blank"] = "fill_blank"
    instruction: str
    prompt: PromptOut
    before: str
    after: str
    translation: str | None
    options: list[TokenOut]


class TypeAnswerExercise(ApiModel):
    """Type the answer. With `audioOnly` the prompt is only heard ("Type what you hear")."""

    id: int
    type: Literal["type_answer"] = "type_answer"
    instruction: str
    prompt: PromptOut
    audio_only: bool
    answer_language: TextLang
    special_characters: list[str]


ExerciseOut = Annotated[
    MultipleChoiceExercise | TranslateExercise | MatchPairsExercise | FillBlankExercise | TypeAnswerExercise,
    Field(discriminator="type"),
]
