"""Word hints: prompts are split into plain text and glossary terms that carry a hint."""

from itertools import pairwise

import pytest

from app.domain.enums import TextLang
from app.domain.hints import Glossary, Segment, segment

ES, EN = TextLang.ES, TextLang.EN

GLOSSARY = Glossary(
    ES,
    {
        "hola": "hello, hi",
        "yo": "I",
        "tú": "you",
        "y": "and",
        "y tú": "and you?",
        "no": "no, not",
        "sí": "yes",
        "bebo": "drink, I drink",
        "agua": "water",
        "como": "eat, I eat",
        "cómo": "how",
        "cómo estás": "how are you?",
        "cómo te llamas": "what is your name?",
        "buenos": "good",
        "buenos días": "good morning",
        "días": "days",
    },
)


def spanish(text: str) -> list[Segment]:
    return segment(text, GLOSSARY, language=ES)


def test_every_known_word_gets_its_hint() -> None:
    assert spanish("Yo bebo agua.") == [
        Segment("Yo", "I"),
        Segment(" "),
        Segment("bebo", "drink, I drink"),
        Segment(" "),
        Segment("agua", "water"),
        Segment("."),
    ]


def test_the_blank_of_a_fill_in_sentence_stays_plain() -> None:
    assert spanish("Tú ___ agua.") == [
        Segment("Tú", "you"),
        Segment(" ___ "),
        Segment("agua", "water"),
        Segment("."),
    ]


def test_a_two_word_term_is_one_segment_with_its_inner_space() -> None:
    assert spanish("¿Cómo estás?") == [Segment("¿"), Segment("Cómo estás", "how are you?"), Segment("?")]


def test_the_longest_term_wins() -> None:
    assert spanish("Buenos días, Ana.") == [Segment("Buenos días", "good morning"), Segment(", Ana.")]


def test_a_three_word_term() -> None:
    assert spanish("¿Cómo te llamas?") == [
        Segment("¿"),
        Segment("Cómo te llamas", "what is your name?"),
        Segment("?"),
    ]


def test_a_shorter_term_still_matches_on_its_own() -> None:
    assert spanish("Buenos amigos") == [Segment("Buenos", "good"), Segment(" amigos")]


def test_capitalized_and_accented_words_match_their_normalized_terms() -> None:
    assert spanish("SÍ, gracias.") == [Segment("SÍ", "yes"), Segment(", gracias.")]


def test_accents_tell_terms_apart() -> None:
    assert spanish("Como pan.") == [Segment("Como", "eat, I eat"), Segment(" pan.")]


def test_punctuation_and_spaces_are_plain_segments() -> None:
    assert spanish("¡Hola! ¿Y tú?") == [
        Segment("¡"),
        Segment("Hola", "hello, hi"),
        Segment("! ¿"),
        Segment("Y tú", "and you?"),
        Segment("?"),
    ]


def test_a_term_never_spans_punctuation() -> None:
    assert spanish("Pan y, tú no.") == [
        Segment("Pan "),
        Segment("y", "and"),
        Segment(", "),
        Segment("tú", "you"),
        Segment(" "),
        Segment("no", "no, not"),
        Segment("."),
    ]


def test_an_english_prompt_is_one_plain_segment() -> None:
    # "No" is a Spanish glossary term too, but this prompt is English.
    assert segment("No, I am not.", GLOSSARY, language=EN) == [Segment("No, I am not.")]


def test_a_prompt_without_known_words_is_one_plain_segment() -> None:
    assert spanish("Me gusta el pan.") == [Segment("Me gusta el pan.")]


@pytest.mark.parametrize(
    "text",
    [
        "Yo bebo agua.",
        "¿Cómo te llamas? Me llamo Ana.",
        "¡Hola! ¿Y tú?",
        "Tú ___ agua.",
        "Buenos días, ¿cómo estás?",
        "  Sí,  no...  ",
        "Gracias",
        "",
    ],
)
def test_segments_rebuild_the_prompt_exactly(text: str) -> None:
    segments = spanish(text)
    assert "".join(s.text for s in segments) == text
    assert all(s.text for s in segments)
    # Plain text is never split: between two plain segments there is always a hinted one.
    assert not any(a.hint is None and b.hint is None for a, b in pairwise(segments))
