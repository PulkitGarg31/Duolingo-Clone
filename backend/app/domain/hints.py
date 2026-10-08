"""Word hints: the dotted underline under a prompt word that shows its meaning.

`segment()` cuts a prompt into segments that concatenate back to it exactly. A run of one to three
words that forms a glossary term becomes a hinted segment; the text between terms (other words,
spaces, punctuation) stays together in plain segments.
"""

import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from itertools import pairwise
from typing import Final, NamedTuple

from app.domain.enums import TextLang
from app.domain.grading import normalize

MAX_TERM_WORDS: Final = 3  # the longest glossary terms have three words: "cómo te llamas"

# Letters and digits, with apostrophes allowed inside a word ("l'eau"); everything else separates
# words. "\w" also matches "_", so the "___" blank of a fill-in sentence is a word no term contains.
WORD: Final = re.compile(r"\w+(?:['’]\w+)*")


@dataclass(frozen=True)
class Glossary:
    """A course's word hints in one language, keyed by normalized term ("buenos días")."""

    language: TextLang
    hints: Mapping[str, str]


@dataclass(frozen=True)
class Segment:
    """A piece of a prompt. One with a hint is underlined, and the hint shows on hover."""

    text: str
    hint: str | None = None


class _Word(NamedTuple):
    start: int
    end: int
    key: str  # the normalized form that glossary terms are written in


def segment(text: str, glossary: Glossary, *, language: TextLang) -> list[Segment]:
    """Split a prompt written in `language` into plain and hinted segments.

    Going left to right, the longest run of up to MAX_TERM_WORDS words that is a glossary term wins.
    Words are compared in normalized form, so case and punctuation do not matter but accents do:
    "cómo" (how) is not "como" (I eat). A term never spans punctuation.
    """
    if language != glossary.language:
        return [Segment(text)]  # an English prompt: the glossary only knows Spanish words
    segments: list[Segment] = []
    covered = 0  # text[:covered] is already in `segments`
    for start, end, hint in _term_spans(text, glossary):
        if covered < start:
            segments.append(Segment(text[covered:start]))
        segments.append(Segment(text[start:end], hint))
        covered = end
    if covered < len(text):
        segments.append(Segment(text[covered:]))
    return segments


def _term_spans(text: str, glossary: Glossary) -> list[tuple[int, int, str]]:
    """(start, end, hint) of each glossary term found in `text`, left to right."""
    words = [
        _Word(match.start(), match.end(), normalize(match.group(), glossary.language))
        for match in WORD.finditer(text)
    ]
    spans: list[tuple[int, int, str]] = []
    i = 0
    while i < len(words):
        found = _leading_term(text, words[i : i + MAX_TERM_WORDS], glossary.hints)
        if found is None:
            i += 1
            continue
        size, hint = found
        spans.append((words[i].start, words[i + size - 1].end, hint))
        i += size
    return spans


def _leading_term(text: str, words: Sequence[_Word], hints: Mapping[str, str]) -> tuple[int, str] | None:
    """The longest run at the start of `words` that is a glossary term, as (word count, hint)."""
    for size in range(len(words), 0, -1):
        run = words[:size]
        if not all(text[left.end : right.start].isspace() for left, right in pairwise(run)):
            continue  # the words are not separated by spaces only
        hint = hints.get(" ".join(word.key for word in run))
        if hint is not None:
            return size, hint
    return None
