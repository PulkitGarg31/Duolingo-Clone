"""Answer grading: forgiving about form, strict about meaning.

Case, punctuation, spacing, quote style and English contractions never matter. Typed answers are
also forgiven wrong or missing accents and one small typo, each reported with a note, but never a
slip that changes the meaning: short words (el/la) and final letters (hermano/hermana) must be
exact. Word-bank tiles can only be wrong in choice or order, so they must match exactly.

`grade()` first checks that the answer fits the exercise (its type and its option, tile and pair
ids) and raises `InvalidAnswer` when it does not; services report that as 422 INVALID_ANSWER.
"""

import unicodedata
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from typing import Final

from app.domain.enums import ExerciseType, GradeNote, ItemResult, TextLang
from app.domain.rules import TYPO_MIN_WORD_LENGTH

BLANK: Final = "___"  # the gap in a fill-in-the-blank sentence

# Typographic quotes and the accents people type as apostrophes, mapped to plain quotes.
QUOTES: Final = str.maketrans(
    {"’": "'", "‘": "'", "`": "'", "´": "'", "“": '"', "”": '"', "«": '"', "»": '"'}
)
# Characters that only separate words. The apostrophe is not one of them: contractions need it, and
# it is dropped once they have been spelled out.
PUNCTUATION: Final = frozenset('.,;:!?¡¿"()[]…–—-/')
CONTRACTIONS: Final[Mapping[str, str]] = {
    "i'm": "i am",
    "you're": "you are",
    "he's": "he is",
    "she's": "she is",
    "it's": "it is",
    "we're": "we are",
    "they're": "they are",
    "i've": "i have",
    "you've": "you have",
    "we've": "we have",
    "they've": "they have",
    "i'll": "i will",
    "you'll": "you will",
    "we'll": "we will",
    "they'll": "they will",
    "i'd": "i would",
    "don't": "do not",
    "doesn't": "does not",
    "didn't": "did not",
    "isn't": "is not",
    "aren't": "are not",
    "wasn't": "was not",
    "can't": "cannot",
    "won't": "will not",
    "what's": "what is",
    "that's": "that is",
    "there's": "there is",
    "let's": "let us",
}

CHOICE_TYPES: Final = frozenset({ExerciseType.MULTIPLE_CHOICE, ExerciseType.FILL_BLANK})
TYPED_TYPES: Final = frozenset({ExerciseType.TRANSLATE, ExerciseType.TYPE_ANSWER})


class InvalidAnswer(Exception):
    """The answer does not fit the exercise: another type, or ids that belong elsewhere."""


# ---- the exercise ----


@dataclass(frozen=True)
class Option:
    """A choice of a multiple-choice or fill-in-the-blank exercise, or a word-bank tile."""

    id: int
    text: str
    is_correct: bool = False  # marks the one right choice; tiles never set it


@dataclass(frozen=True)
class AnswerKey:
    """What grading needs to know about one exercise."""

    type: ExerciseType
    text: str | None = None  # the sentence shown or spoken; a fill-in sentence contains BLANK
    text_language: TextLang | None = None
    audio_only: bool = False  # "Type what you hear": the sentence is only spoken
    options: tuple[Option, ...] = ()  # choices, or the tiles of a translate exercise
    accepted: tuple[str, ...] = ()  # accepted answers of translate and type-answer, primary first
    pair_ids: frozenset[int] = frozenset()  # match pairs: one id names a pair on both sides


# ---- the learner's answer ----


@dataclass(frozen=True)
class OptionAnswer:
    """A tapped choice, sent for a multiple-choice or a fill-in-the-blank exercise."""

    exercise_type: ExerciseType
    option_id: int

    def __post_init__(self) -> None:
        if self.exercise_type not in CHOICE_TYPES:
            raise ValueError(f"an option answer is for a choice exercise, not {self.exercise_type}")


@dataclass(frozen=True)
class TilesAnswer:
    """The word-bank tiles of a translate exercise, in answer order."""

    tile_ids: tuple[int, ...]


@dataclass(frozen=True)
class TextAnswer:
    """Typed text, sent for a translate exercise (keyboard mode) or a type-answer exercise."""

    exercise_type: ExerciseType
    text: str

    def __post_init__(self) -> None:
        if self.exercise_type not in TYPED_TYPES:
            raise ValueError(f"a text answer is for a typed exercise, not {self.exercise_type}")


@dataclass(frozen=True)
class PairsAnswer:
    """Every match of a match-pairs exercise, as (left id, right id)."""

    pairs: tuple[tuple[int, int], ...]


@dataclass(frozen=True)
class Skip:
    """SKIP: allowed on any exercise, and counted as a wrong answer."""


@dataclass(frozen=True)
class CantListen:
    """CAN'T LISTEN NOW on a listening exercise: neither right nor wrong."""


Answer = OptionAnswer | TilesAnswer | TextAnswer | PairsAnswer | Skip | CantListen


# ---- verdicts ----


@dataclass(frozen=True)
class TextGrade:
    """The verdict on a written answer."""

    correct: bool
    note: GradeNote | None = None
    matched: str | None = None  # the accepted answer it matched, as authored


@dataclass(frozen=True)
class Grade:
    """The verdict on one answer, as the API reports it."""

    result: ItemResult
    note: GradeNote | None = None
    correct_answer: str | None = None  # shown under "Correct solution:"; match pairs have none


# ---- comparing text ----


def normalize(text: str, lang: TextLang) -> str:
    """The comparable form of a sentence.

    Casefolded, without punctuation, single-spaced, and with English contractions spelled out.
    Accents are kept: only the lenient comparison strips them.
    """
    # Quotes are mapped first because NFKC splits "´" into a space plus a combining accent.
    folded = unicodedata.normalize("NFKC", text.translate(QUOTES)).casefold()
    words = "".join(" " if ch in PUNCTUATION else ch for ch in folded).split()
    if lang == TextLang.EN:
        words = expand_contractions(words)
    words = [word.replace("'", "") for word in words]
    return " ".join(word for word in words if word)  # a lone apostrophe leaves no empty word


def expand_contractions(words: Iterable[str]) -> list[str]:
    """Spell out English contractions, so that "I'm" and "I am" are the same answer."""
    return " ".join(CONTRACTIONS.get(word, word) for word in words).split()


def strip_accents(text: str) -> str:
    """Remove diacritics: días -> dias, niño -> nino, pingüino -> pinguino."""
    return "".join(ch for ch in unicodedata.normalize("NFD", text) if unicodedata.category(ch) != "Mn")


def osa_distance(a: str, b: str) -> int:
    """The optimal string alignment distance between `a` and `b`.

    That is the fewest insertions, deletions, substitutions and swaps of two neighbouring
    characters that turn `a` into `b`, never editing the same characters twice.
    """
    # d[i][j] is the distance between the first i characters of `a` and the first j of `b`.
    d = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(len(a) + 1):
        d[i][0] = i
    for j in range(len(b) + 1):
        d[0][j] = j
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            d[i][j] = min(
                d[i - 1][j] + 1,  # delete a[i - 1]
                d[i][j - 1] + 1,  # insert b[j - 1]
                d[i - 1][j - 1] + cost,  # keep or replace a[i - 1]
            )
            if i > 1 and j > 1 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]:
                d[i][j] = min(d[i][j], d[i - 2][j - 2] + 1)  # swap two neighbours
    return d[len(a)][len(b)]


def is_single_typo(given: str, target: str) -> bool:
    """True when `given` is `target` with one small slip in one word (both normalized, no accents)."""
    given_words, target_words = given.split(), target.split()
    if len(given_words) != len(target_words):
        return False  # a missing or extra word is a real mistake
    differing = [(g, t) for g, t in zip(given_words, target_words, strict=True) if g != t]
    if len(differing) != 1:
        return False  # at most one wrong word per answer
    typed, expected = differing[0]
    return (
        len(expected) >= TYPO_MIN_WORD_LENGTH  # short words must be exact: el/la, un/una
        and typed[-1] == expected[-1]  # the final letter carries gender and number: hermano/hermana
        and osa_distance(typed, expected) == 1  # one edit, a swap of neighbours included: gutso/gusto
    )


def blame(given: str, target: str) -> GradeNote | None:
    """What went wrong in a wrong typed answer, if it was one simple thing (normalized, no accents)."""
    given_words, target_words = given.split(), target.split()
    for i in range(len(target_words)):
        if given_words == target_words[:i] + target_words[i + 1 :]:
            return GradeNote.MISSING_WORD  # "You missed a word."
    same_length = len(given_words) == len(target_words)
    if same_length and sum(g != t for g, t in zip(given_words, target_words, strict=True)) == 1:
        return GradeNote.WRONG_WORD  # "You used the wrong word."
    return None


def grade_text(given: str, accepted: Sequence[str], lang: TextLang, *, lenient: bool) -> TextGrade:
    """Compare a written answer with the accepted answers, the primary first.

    An exact match is correct (with the `alternate` note for an answer other than the primary).
    Word-bank tiles (`lenient=False`) stop there. Typed text may then differ in accents only
    (`accent`) or by one small typo (`typo`). Anything else is wrong, with a note when the
    mistake is one missing or one wrong word compared with the primary answer.
    """
    answer = normalize(given, lang)
    if not answer:
        return TextGrade(correct=False)
    targets = [normalize(text, lang) for text in accepted]
    for i, target in enumerate(targets):
        if answer == target:
            return TextGrade(True, None if i == 0 else GradeNote.ALTERNATE, accepted[i])
    if not lenient:
        return TextGrade(correct=False)
    bare = strip_accents(answer)
    bare_targets = [strip_accents(target) for target in targets]
    for i, target in enumerate(bare_targets):
        if bare == target:
            return TextGrade(True, GradeNote.ACCENT, accepted[i])
    for i, target in enumerate(bare_targets):
        if is_single_typo(bare, target):
            return TextGrade(True, GradeNote.TYPO, accepted[i])
    return TextGrade(False, blame(bare, bare_targets[0]))


def answer_language(text_language: TextLang, *, audio_only: bool) -> TextLang:
    """The language a written answer is in.

    A sentence that was only heard is written down in its own language; any other written answer
    is a translation into the other language.
    """
    if audio_only:
        return text_language
    return TextLang.EN if text_language == TextLang.ES else TextLang.ES


# ---- grading one exercise ----


def grade(key: AnswerKey, answer: Answer) -> Grade:
    """Grade one answer to one exercise. Raises InvalidAnswer when the answer does not fit it."""
    match answer:
        case Skip():
            return Grade(ItemResult.SKIPPED, correct_answer=_solution(key))
        case CantListen():
            if not key.audio_only:
                raise InvalidAnswer("CAN'T LISTEN NOW only fits a listening exercise")
            return Grade(ItemResult.CANT_LISTEN, correct_answer=_solution(key))
        case OptionAnswer(exercise_type=declared, option_id=option_id):
            _check_type(key, declared)
            chosen = _option(key, option_id)
            return Grade(_result(chosen.is_correct), correct_answer=_solution(key))
        case TilesAnswer(tile_ids=tile_ids):
            _check_type(key, ExerciseType.TRANSLATE)
            if len(set(tile_ids)) != len(tile_ids):
                raise InvalidAnswer("each tile can be used only once")
            sentence = " ".join(_option(key, tile_id).text for tile_id in tile_ids)
            return _grade_written(key, sentence, lenient=False)
        case TextAnswer(exercise_type=declared, text=text):
            _check_type(key, declared)
            return _grade_written(key, text, lenient=True)
        case PairsAnswer(pairs=pairs):
            _check_type(key, ExerciseType.MATCH_PAIRS)
            expected = sorted(key.pair_ids)
            lefts = sorted(left for left, _ in pairs)
            rights = sorted(right for _, right in pairs)
            if lefts != expected or rights != expected:
                raise InvalidAnswer("a match must list every pair exactly once on each side")
            return Grade(_result(all(left == right for left, right in pairs)))


def _check_type(key: AnswerKey, declared: ExerciseType) -> None:
    if declared != key.type:
        raise InvalidAnswer(f"this is a {key.type} exercise, not {declared}")


def _option(key: AnswerKey, option_id: int) -> Option:
    for option in key.options:
        if option.id == option_id:
            return option
    raise InvalidAnswer(f"option {option_id} does not belong to this exercise")


def _result(correct: bool) -> ItemResult:
    return ItemResult.CORRECT if correct else ItemResult.INCORRECT


def _grade_written(key: AnswerKey, text: str, *, lenient: bool) -> Grade:
    if key.text_language is None:
        raise ValueError(f"a {key.type} exercise needs a sentence")
    lang = answer_language(key.text_language, audio_only=key.audio_only)
    verdict = grade_text(text, key.accepted, lang, lenient=lenient)
    # After an accent or typo note, show the accepted answer the learner was close to. Otherwise show
    # the primary: "Correct solution:" after a mistake, "Another correct solution:" after an alternate.
    near_miss = verdict.note in (GradeNote.ACCENT, GradeNote.TYPO)
    return Grade(_result(verdict.correct), verdict.note, verdict.matched if near_miss else key.accepted[0])


def _solution(key: AnswerKey) -> str | None:
    """The answer revealed after a mistake or a skip; match pairs reveal none."""
    match key.type:
        case ExerciseType.MULTIPLE_CHOICE:
            return _correct_option(key).text
        case ExerciseType.FILL_BLANK:
            if key.text is None:
                raise ValueError("a fill-in-the-blank exercise needs a sentence")
            return key.text.replace(BLANK, _correct_option(key).text)
        case ExerciseType.TRANSLATE | ExerciseType.TYPE_ANSWER:
            return key.accepted[0]
        case ExerciseType.MATCH_PAIRS:
            return None


def _correct_option(key: AnswerKey) -> Option:
    for option in key.options:
        if option.is_correct:
            return option
    raise ValueError("a choice exercise needs a correct option")
