"""Grading: forgiving about case, punctuation, accents and one small typo; strict about meaning."""

import pytest

from app.domain.enums import ExerciseType, GradeNote, ItemResult, TextLang
from app.domain.grading import (
    Answer,
    AnswerKey,
    CantListen,
    Grade,
    InvalidAnswer,
    Option,
    OptionAnswer,
    PairsAnswer,
    Skip,
    TextAnswer,
    TextGrade,
    TilesAnswer,
    answer_language,
    grade,
    grade_text,
    normalize,
    osa_distance,
    strip_accents,
    vocabulary,
)

ES, EN = TextLang.ES, TextLang.EN
ALTERNATE, ACCENT, TYPO = GradeNote.ALTERNATE, GradeNote.ACCENT, GradeNote.TYPO
MISSING_WORD, WRONG_WORD = GradeNote.MISSING_WORD, GradeNote.WRONG_WORD
CORRECT, INCORRECT = ItemResult.CORRECT, ItemResult.INCORRECT

# ---- typed text: (accepted answers, primary first), learner text, answer language -> verdict ----

TYPED_CASES = [
    # case, punctuation, whitespace and quotes never matter
    pytest.param(("Buenas noches",), "  buenas   noches!! ", ES, True, None, id="whitespace-punctuation"),
    pytest.param(("Buenos días",), "BUENOS DÍAS", ES, True, None, id="case"),
    pytest.param(("¿Cómo estás?",), "Cómo estás", ES, True, None, id="inverted-marks-optional"),
    pytest.param(('Él dice "hola".',), "él dice «hola»", ES, True, None, id="smart-quotes"),
    pytest.param(("I am Ana.",), "I’m Ana", EN, True, None, id="smart-apostrophe-contraction"),
    # accents: correct, with a note
    pytest.param(("Hola, ¿cómo estás?",), "hola como estas", ES, True, ACCENT, id="accents-missing"),
    pytest.param(("Buenos días",), "buenos dias", ES, True, ACCENT, id="días-dias"),
    pytest.param(("Feliz año",), "feliz ano", ES, True, ACCENT, id="año-ano"),
    pytest.param(("Él es alto",), "el es alto", ES, True, ACCENT, id="él-el"),
    pytest.param(("Sí",), "si", ES, True, ACCENT, id="accent-on-a-short-word"),
    # one small typo in one word of four letters or more: correct, with a note
    pytest.param(("Quiero una manzana",), "quiero una manzanna", ES, True, TYPO, id="typo-insertion"),
    pytest.param(("Quiero una manzana",), "quiero una manzna", ES, True, TYPO, id="typo-deletion"),
    pytest.param(("Mi familia",), "mi famolia", ES, True, TYPO, id="typo-substitution"),
    pytest.param(("Mucho gusto",), "mucho gutso", ES, True, TYPO, id="typo-transposition"),
    pytest.param(("Buenos días",), "buenos dais", ES, True, TYPO, id="typo-after-accents"),
    pytest.param(("Yo bebo agua",), "yo bebo agia", ES, True, TYPO, id="typo-in-a-four-letter-word"),
    pytest.param(("The water",), "the watr", EN, True, TYPO, id="typo-in-english"),
    # short words must be exact
    pytest.param(("el pan",), "la pan", ES, False, WRONG_WORD, id="short-word-el-la"),
    pytest.param(("Un café",), "una cafe", ES, False, WRONG_WORD, id="short-word-un-una"),
    pytest.param(("Mi pan",), "mi pon", ES, False, WRONG_WORD, id="three-letter-word"),
    # the final letter carries gender and number
    pytest.param(("mi hermano",), "mi hermana", ES, False, WRONG_WORD, id="final-letter-hermano"),
    pytest.param(("Él es alto",), "él es alta", ES, False, WRONG_WORD, id="final-letter-alto"),
    # at most one word may differ
    pytest.param(("Mucho gusto",), "mucha gutso", ES, False, None, id="two-words-differ"),
    pytest.param(("Buenas noches",), "bunas nochs", ES, False, None, id="two-typos"),
    # notes on wrong answers
    pytest.param(("Quiero agua.",), "quiero", ES, False, MISSING_WORD, id="missing-last-word"),
    pytest.param(("Yo bebo agua",), "yo agua", ES, False, MISSING_WORD, id="missing-middle-word"),
    pytest.param(("Yo bebo agua",), "yo como agua", ES, False, WRONG_WORD, id="wrong-word"),
    pytest.param(("Yo bebo agua",), "yo bebo la agua", ES, False, None, id="extra-word"),
    pytest.param(("Yo bebo agua",), "agua bebo yo", ES, False, None, id="scrambled"),
    # alternates and English contractions
    pytest.param(
        ("I drink water.", "I am drinking water."), "I am drinking water", EN, True, ALTERNATE, id="alternate"
    ),
    pytest.param(
        ("I am drinking water.", "I drink water."), "I'm drinking water", EN, True, None, id="contraction-im"
    ),
    pytest.param(("I do not drink milk.",), "I don't drink milk", EN, True, None, id="contraction-dont"),
    pytest.param(("They are tall.",), "they're tall", EN, True, None, id="contraction-theyre"),
    pytest.param(("Bebo café.", "Yo bebo café."), "yo bebo cafe", ES, True, ACCENT, id="accent-on-alternate"),
    # nothing left after normalizing
    pytest.param(("Gracias",), "", ES, False, None, id="empty"),
    pytest.param(("Gracias",), "¡¡!!", ES, False, None, id="only-punctuation"),
    pytest.param(("Gracias",), "   ", ES, False, None, id="only-spaces"),
]


@pytest.mark.parametrize(("accepted", "given", "lang", "correct", "note"), TYPED_CASES)
def test_typed_answers(
    accepted: tuple[str, ...], given: str, lang: TextLang, correct: bool, note: GradeNote | None
) -> None:
    verdict = grade_text(given, accepted, lang, lenient=True)
    assert (verdict.correct, verdict.note) == (correct, note)


TILE_CASES = [
    pytest.param(("I drink water.",), "I drink water", EN, True, None, id="exact"),
    pytest.param(("I drink water.",), "drink I water", EN, False, None, id="order-matters"),
    pytest.param(
        ("I drink water.", "I am drinking water."), "I am drinking water", EN, True, ALTERNATE, id="alternate"
    ),
    pytest.param(("Buenos días",), "buenos dias", ES, False, None, id="no-accent-leniency"),
    pytest.param(("Quiero una manzana",), "quiero una manzanna", ES, False, None, id="no-typo-leniency"),
    pytest.param(("Quiero agua.",), "quiero", ES, False, None, id="no-blame-note"),
]


@pytest.mark.parametrize(("accepted", "given", "lang", "correct", "note"), TILE_CASES)
def test_word_bank_answers_must_match_exactly(
    accepted: tuple[str, ...], given: str, lang: TextLang, correct: bool, note: GradeNote | None
) -> None:
    verdict = grade_text(given, accepted, lang, lenient=False)
    assert (verdict.correct, verdict.note) == (correct, note)


def test_a_near_miss_reports_the_accepted_answer_it_matched() -> None:
    verdict = grade_text("yo bebo cafe", ("Bebo café.", "Yo bebo café."), ES, lenient=True)
    assert verdict == TextGrade(True, ACCENT, "Yo bebo café.")


# ---- a slip that spells another word of the course is a wrong word, not a typo ----

# Spanish words of a course, collected the way the session service does it: from glossary terms,
# accepted answers, options and pairs.
COURSE_WORDS_ES = vocabulary(
    ["Buenos días", "Buenas noches", "la madre", "el padre", "Mi madre se llama Elena."], ES
)

COURSE_WORD_CASES = [
    pytest.param("Buenas noches", "Buenos noches", False, WRONG_WORD, id="buenos-is-a-course-word"),
    pytest.param(
        "La madre se llama Elena", "La padre se llama Elena", False, WRONG_WORD, id="padre-is-a-course-word"
    ),
    pytest.param("La madre se llama Elena", "La madre se llama Elenna", True, TYPO, id="non-word-is-a-typo"),
]


@pytest.mark.parametrize(("accepted", "given", "correct", "note"), COURSE_WORD_CASES)
def test_a_slip_that_spells_a_course_word_is_a_wrong_word(
    accepted: str, given: str, correct: bool, note: GradeNote
) -> None:
    verdict = grade_text(given, (accepted,), ES, lenient=True, known_words=COURSE_WORDS_ES)
    assert (verdict.correct, verdict.note) == (correct, note)


def test_without_course_words_a_one_letter_slip_is_a_typo() -> None:
    assert grade_text("Buenos noches", ("Buenas noches",), ES, lenient=True).note == TYPO


def test_vocabulary_holds_each_word_normalized_and_without_accents() -> None:
    assert vocabulary(["¡Buenos días!", "El café, por favor."], ES) == {
        "buenos",
        "dias",
        "el",
        "cafe",
        "por",
        "favor",
    }


# ---- normalization helpers ----


@pytest.mark.parametrize(
    ("text", "lang", "expected"),
    [
        ("¡Hola, Ana!", ES, "hola ana"),
        ("  Buenas   noches!! ", ES, "buenas noches"),
        ("Días", ES, "días"),  # accents are kept; only the lenient comparison strips them
        ("I’m here", EN, "i am here"),
        ("Don´t stop", EN, "do not stop"),  # an acute accent typed as an apostrophe
        ("Don`t stop", EN, "do not stop"),
        ("«Hola»", ES, "hola"),
        ("ｈｏｌａ", ES, "hola"),  # full-width letters
        ("Espera…", ES, "espera"),
        ("well-known/famous", EN, "well known famous"),
        ("rock ' roll", EN, "rock roll"),  # a lone apostrophe leaves no empty word behind
        ("I'm", ES, "im"),  # contractions are expanded in English only
    ],
)
def test_normalize(text: str, lang: TextLang, expected: str) -> None:
    assert normalize(text, lang) == expected


def test_strip_accents() -> None:
    assert strip_accents("días niño pingüino Él") == "dias nino pinguino El"


@pytest.mark.parametrize(
    ("a", "b", "distance"),
    [
        ("", "", 0),
        ("abc", "", 3),
        ("", "abc", 3),
        ("gusto", "gutso", 1),  # a swap of neighbours is one edit
        ("manzanna", "manzana", 1),
        ("hermano", "hermana", 1),
        ("kitten", "sitting", 3),
        ("abcd", "badc", 2),
        ("ca", "abc", 3),  # no substring is edited twice
    ],
)
def test_osa_distance(a: str, b: str, distance: int) -> None:
    assert osa_distance(a, b) == distance
    assert osa_distance(b, a) == distance


@pytest.mark.parametrize(
    ("text_language", "audio_only", "expected"),
    [(ES, False, EN), (EN, False, ES), (ES, True, ES)],
    ids=["translate-to-english", "translate-to-spanish", "type-what-you-hear"],
)
def test_answer_language(text_language: TextLang, audio_only: bool, expected: TextLang) -> None:
    assert answer_language(text_language, audio_only=audio_only) == expected


# ---- grading one exercise ----

PICTURE_CHOICE = AnswerKey(
    type=ExerciseType.MULTIPLE_CHOICE,
    options=(Option(301, "el agua"), Option(302, "el jugo", is_correct=True), Option(303, "la leche")),
)
FILL_IN = AnswerKey(
    type=ExerciseType.FILL_BLANK,
    text="Tú ___ agua.",
    text_language=ES,
    options=(Option(321, "bebo"), Option(322, "bebes", is_correct=True), Option(323, "beber")),
)
TRANSLATE_TO_ENGLISH = AnswerKey(
    type=ExerciseType.TRANSLATE,
    text="Yo bebo agua.",
    text_language=ES,
    options=(
        Option(311, "water"),
        Option(312, "milk"),
        Option(313, "I"),
        Option(314, "eat"),
        Option(315, "drink"),
        Option(316, "am"),
        Option(317, "drinking"),
    ),
    accepted=("I drink water.", "I am drinking water."),
)
TRANSLATE_TO_SPANISH = AnswerKey(
    type=ExerciseType.TRANSLATE,
    text="I want a juice, please.",
    text_language=EN,
    options=(Option(331, "jugo"), Option(332, "favor"), Option(333, "Quiero"), Option(334, "un")),
    accepted=("Quiero un jugo, por favor.", "Yo quiero un jugo, por favor."),
)
WRITE_IN_ENGLISH = AnswerKey(
    type=ExerciseType.TYPE_ANSWER, text="Yo soy Ana.", text_language=ES, accepted=("I am Ana.",)
)
LISTENING = AnswerKey(
    type=ExerciseType.TYPE_ANSWER,
    text="Quiero agua.",
    text_language=ES,
    audio_only=True,
    accepted=("Quiero agua.",),
)
MATCH = AnswerKey(type=ExerciseType.MATCH_PAIRS, pair_ids=frozenset({41, 42, 43, 44}))


class TestChoices:
    @pytest.mark.parametrize(("option_id", "result"), [(302, CORRECT), (301, INCORRECT)])
    def test_multiple_choice_shows_the_correct_option(self, option_id: int, result: ItemResult) -> None:
        answer = OptionAnswer(ExerciseType.MULTIPLE_CHOICE, option_id)
        assert grade(PICTURE_CHOICE, answer) == Grade(result, None, "el jugo")

    @pytest.mark.parametrize(("option_id", "result"), [(322, CORRECT), (321, INCORRECT)])
    def test_fill_in_the_blank_shows_the_completed_sentence(self, option_id: int, result: ItemResult) -> None:
        answer = OptionAnswer(ExerciseType.FILL_BLANK, option_id)
        assert grade(FILL_IN, answer) == Grade(result, None, "Tú bebes agua.")

    def test_an_option_answer_only_names_a_choice_exercise_type(self) -> None:
        with pytest.raises(ValueError, match="choice"):
            OptionAnswer(ExerciseType.TRANSLATE, 311)


class TestWordBank:
    def test_the_primary_answer(self) -> None:
        verdict = grade(TRANSLATE_TO_ENGLISH, TilesAnswer((313, 315, 311)))
        assert verdict == Grade(CORRECT, None, "I drink water.")

    def test_an_alternate_shows_the_primary_as_another_solution(self) -> None:
        verdict = grade(TRANSLATE_TO_ENGLISH, TilesAnswer((313, 316, 317, 311)))
        assert verdict == Grade(CORRECT, ALTERNATE, "I drink water.")

    def test_tiles_in_the_wrong_order_are_wrong(self) -> None:
        verdict = grade(TRANSLATE_TO_ENGLISH, TilesAnswer((315, 313, 311)))
        assert verdict == Grade(INCORRECT, None, "I drink water.")


class TestTypedText:
    def test_a_typo_shows_the_accepted_answer_it_was_close_to(self) -> None:
        answer = TextAnswer(ExerciseType.TRANSLATE, "yo quiero un jugo por fabor")
        assert grade(TRANSLATE_TO_SPANISH, answer) == Grade(CORRECT, TYPO, "Yo quiero un jugo, por favor.")

    def test_a_wrong_answer_shows_the_primary(self) -> None:
        verdict = grade(TRANSLATE_TO_SPANISH, TextAnswer(ExerciseType.TRANSLATE, "quiero leche"))
        assert verdict == Grade(INCORRECT, None, "Quiero un jugo, por favor.")

    def test_answers_to_a_spanish_prompt_are_english_with_contractions(self) -> None:
        verdict = grade(WRITE_IN_ENGLISH, TextAnswer(ExerciseType.TYPE_ANSWER, "I'm Ana"))
        assert verdict == Grade(CORRECT, None, "I am Ana.")

    @pytest.mark.parametrize(("text", "result"), [("quiero agua", CORRECT), ("I want water", INCORRECT)])
    def test_listening_answers_are_written_in_spanish(self, text: str, result: ItemResult) -> None:
        verdict = grade(LISTENING, TextAnswer(ExerciseType.TYPE_ANSWER, text))
        assert verdict == Grade(result, None, "Quiero agua.")

    def test_a_text_answer_only_names_a_typed_exercise_type(self) -> None:
        with pytest.raises(ValueError, match="typed"):
            TextAnswer(ExerciseType.MATCH_PAIRS, "el agua")

    def test_course_words_reach_the_typo_rule(self) -> None:
        key = AnswerKey(
            type=ExerciseType.TYPE_ANSWER, text="Good night", text_language=EN, accepted=("Buenas noches",)
        )
        answer = TextAnswer(ExerciseType.TYPE_ANSWER, "buenos noches")
        verdict = grade(key, answer, known_words=COURSE_WORDS_ES)
        assert verdict == Grade(INCORRECT, WRONG_WORD, "Buenas noches")
        assert grade(key, answer) == Grade(CORRECT, TYPO, "Buenas noches")


class TestMatchPairs:
    def test_pairs_in_any_order(self) -> None:
        answer = PairsAnswer(((43, 43), (41, 41), (44, 44), (42, 42)))
        assert grade(MATCH, answer) == Grade(CORRECT, None, None)

    def test_a_crossed_pair_is_wrong(self) -> None:
        answer = PairsAnswer(((41, 42), (42, 41), (43, 43), (44, 44)))
        assert grade(MATCH, answer) == Grade(INCORRECT, None, None)


@pytest.mark.parametrize(
    ("key", "shown"),
    [
        (PICTURE_CHOICE, "el jugo"),
        (FILL_IN, "Tú bebes agua."),
        (TRANSLATE_TO_ENGLISH, "I drink water."),
        (LISTENING, "Quiero agua."),
        (MATCH, None),
    ],
    ids=["multiple-choice", "fill-blank", "translate", "listening", "match-pairs"],
)
def test_skip_counts_as_wrong_and_shows_the_solution(key: AnswerKey, shown: str | None) -> None:
    assert grade(key, Skip()) == Grade(ItemResult.SKIPPED, None, shown)


def test_cant_listen_is_neutral_on_a_listening_exercise() -> None:
    assert grade(LISTENING, CantListen()) == Grade(ItemResult.CANT_LISTEN, None, "Quiero agua.")


@pytest.mark.parametrize(
    ("key", "answer", "message"),
    [
        (PICTURE_CHOICE, OptionAnswer(ExerciseType.MULTIPLE_CHOICE, 999), "option 999"),
        (FILL_IN, OptionAnswer(ExerciseType.FILL_BLANK, 302), "option 302"),
        (TRANSLATE_TO_ENGLISH, TilesAnswer((313, 313, 311)), "only once"),
        (TRANSLATE_TO_ENGLISH, TilesAnswer((313, 999)), "option 999"),
        (MATCH, PairsAnswer(((41, 41), (42, 42), (43, 43))), "exactly once"),
        (MATCH, PairsAnswer(((41, 41), (41, 42), (43, 43), (44, 44))), "exactly once"),
        (MATCH, PairsAnswer(((41, 41), (42, 41), (43, 43), (44, 44))), "exactly once"),
        (MATCH, PairsAnswer(((41, 41), (42, 42), (43, 43), (44, 44), (45, 45))), "exactly once"),
        (FILL_IN, OptionAnswer(ExerciseType.MULTIPLE_CHOICE, 322), "multiple_choice"),
        (PICTURE_CHOICE, OptionAnswer(ExerciseType.FILL_BLANK, 302), "fill_blank"),
        (LISTENING, TextAnswer(ExerciseType.TRANSLATE, "quiero agua"), "translate"),
        (TRANSLATE_TO_SPANISH, TextAnswer(ExerciseType.TYPE_ANSWER, "quiero un jugo"), "type_answer"),
        (LISTENING, TilesAnswer((1, 2)), "translate"),
        (PICTURE_CHOICE, PairsAnswer(((301, 301),)), "match_pairs"),
        (WRITE_IN_ENGLISH, CantListen(), "listening"),
        (PICTURE_CHOICE, CantListen(), "listening"),
    ],
    ids=[
        "foreign-option",
        "option-of-another-exercise",
        "duplicate-tile",
        "foreign-tile",
        "missing-pair",
        "duplicate-left",
        "duplicate-right",
        "foreign-pair",
        "choice-sent-as-other-choice-type",
        "fill-sent-as-other-choice-type",
        "keyboard-translate-on-type-answer",
        "type-answer-on-translate",
        "tiles-on-type-answer",
        "pairs-on-multiple-choice",
        "cant-listen-on-typed-exercise",
        "cant-listen-on-multiple-choice",
    ],
)
def test_answers_that_do_not_fit_the_exercise_are_invalid(
    key: AnswerKey, answer: Answer, message: str
) -> None:
    with pytest.raises(InvalidAnswer, match=message):
        grade(key, answer)
