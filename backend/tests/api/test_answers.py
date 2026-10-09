"""PUT /sessions/{id}/items/{itemId}/answer: grading, its notes, what a mistake costs, and idempotency.

Most tests play lesson 2 of "Drinks", the seeded learner's next lesson, whose queue is:
1 picture choice ("the juice") · 2 "Yo bebo agua." to English · 3 match pairs ·
4 "Tú ___ agua." · 5 "I want a juice, please." to Spanish · 6 listening ("Quiero agua.").
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import Engine

from app.core.db import make_session_factory
from app.models import Exercise
from tests.conftest import FROZEN_NOW
from tests.factories import add_catalog, add_learner, add_mini_course
from tests.helpers import (
    API,
    Json,
    answer_for,
    answer_items,
    as_user,
    assert_problem,
    complete,
    get_me,
    load_exercises,
    node_at,
    play_lesson,
    start_session,
    submit,
)


@pytest.fixture
def drinks(client: TestClient) -> Json:
    """Lesson 2 of "Drinks", just started."""
    return start_session(client, {"kind": "lesson", "nodeId": node_at(client, 2, 2)})


def exercise_of(engine: Engine, item: Json) -> Exercise:
    return load_exercises(engine, [item["exercise"]["id"]])[item["exercise"]["id"]]


def tiles(item: Json, *words: str) -> Json:
    """A word-bank answer that taps the tiles showing `words`, in that order."""
    by_text = {tile["text"]: tile["id"] for tile in item["exercise"]["tiles"]}
    return {"type": "translate", "tileIds": [by_text[word] for word in words]}


def answer(client: TestClient, session: Json, seq: int, payload: Json) -> Json:
    """Answer the item with this seq; the answer must be accepted."""
    item = next(item for item in session["items"] if item["seq"] == seq)
    response = submit(client, session["id"], item["id"], payload)
    assert response.status_code == 200, response.text
    result: Json = response.json()
    return result


# ---- what a mistake costs ----


def test_a_wrong_answer_costs_a_heart_and_comes_back_at_the_end(
    client: TestClient, seeded_engine: Engine, drinks: Json
) -> None:
    first = drinks["items"][0]
    result = answer(client, drinks, 1, answer_for(exercise_of(seeded_engine, first), correct=False))

    assert (result["itemId"], result["replayed"]) == (first["id"], False)
    assert (result["result"], result["isCorrect"], result["note"]) == ("incorrect", False, None)
    assert (result["correctAnswer"], result["meaning"]) == ("el jugo", None)
    assert result["heartLost"] is True
    assert result["hearts"]["current"] == 3
    assert (result["hearts"]["nextHeartAt"], result["hearts"]["fullAt"]) == (
        "2026-10-08T16:00:00Z",  # the running interval is not restarted
        "2026-10-08T21:00:00Z",
    )
    assert result["progress"] == {"completed": 0, "total": 6}  # the bar never moves on a mistake
    assert (result["mistakes"], result["combo"], result["bestCombo"]) == (1, 0, 0)
    retry = result["appendedItem"]
    assert (retry["seq"], retry["origin"], retry["label"], retry["result"]) == (
        7,
        "retry",
        "previous_mistake",
        None,
    )
    assert retry["exercise"]["id"] == first["exercise"]["id"]
    assert result["session"] == {
        "status": "active",
        "endReason": None,
        "blockedReason": None,
        "canComplete": False,
        "currentItemId": drinks["items"][1]["id"],
        "livesLeft": None,
        "expiresAt": None,
    }
    assert get_me(client)["hearts"]["current"] == 3


def test_repeating_an_answer_replays_the_verdict_without_a_second_heart(
    client: TestClient, seeded_engine: Engine, drinks: Json
) -> None:
    wrong = answer_for(exercise_of(seeded_engine, drinks["items"][0]), correct=False)
    first = answer(client, drinks, 1, wrong)
    again = answer(client, drinks, 1, wrong)
    assert again == first | {"replayed": True}
    assert get_me(client)["hearts"]["current"] == 3
    assert len(client.get(f"{API}/sessions/{drinks['id']}").json()["items"]) == 7  # still one retry


def test_a_late_replay_repeats_the_verdict_with_the_session_as_it_is_now(
    client: TestClient, seeded_engine: Engine, drinks: Json
) -> None:
    wrong = answer_for(exercise_of(seeded_engine, drinks["items"][0]), correct=False)
    first = answer(client, drinks, 1, wrong)
    answer(client, drinks, 2, answer_for(exercise_of(seeded_engine, drinks["items"][1])))
    late = answer(client, drinks, 1, wrong)  # a duplicate of the first request, arriving last
    verdict = ("result", "isCorrect", "note", "correctAnswer", "meaning", "heartLost", "appendedItem")
    assert {key: late[key] for key in verdict} == {key: first[key] for key in verdict}
    assert (late["replayed"], late["progress"], late["combo"]) == (True, {"completed": 1, "total": 6}, 1)
    assert late["session"]["currentItemId"] == drinks["items"][2]["id"]


def test_a_different_answer_to_an_answered_item_is_refused(
    client: TestClient, seeded_engine: Engine, drinks: Json
) -> None:
    exercise = exercise_of(seeded_engine, drinks["items"][0])
    answer(client, drinks, 1, answer_for(exercise, correct=False))
    response = submit(client, drinks["id"], drinks["items"][0]["id"], answer_for(exercise))
    assert_problem(response, 409, "ITEM_ALREADY_ANSWERED")
    assert client.get(f"{API}/sessions/{drinks['id']}").json()["items"][0]["result"] == "incorrect"


def test_only_the_current_item_can_be_answered(client: TestClient, drinks: Json) -> None:
    third = drinks["items"][2]
    problem = assert_problem(
        submit(client, drinks["id"], third["id"], {"type": "skip"}), 409, "ITEM_OUT_OF_ORDER"
    )
    assert problem["currentItemId"] == drinks["items"][0]["id"]


def test_a_skip_counts_as_a_wrong_answer(client: TestClient, drinks: Json) -> None:
    result = answer(client, drinks, 1, {"type": "skip"})
    assert (result["result"], result["isCorrect"], result["heartLost"]) == ("skipped", False, True)
    assert result["correctAnswer"] == "el jugo"
    assert (result["mistakes"], result["appendedItem"]["origin"]) == (1, "retry")


# ---- grading notes ----


def test_word_bank_tiles_count_only_in_the_right_order(
    client: TestClient, seeded_engine: Engine, drinks: Json
) -> None:
    answer_items(client, seeded_engine, drinks, limit=1)
    sentence = drinks["items"][1]
    shuffled = answer(client, drinks, 2, tiles(sentence, "drink", "I", "water"))
    assert (shuffled["result"], shuffled["correctAnswer"]) == ("incorrect", "I drink water.")
    retry = shuffled["appendedItem"]
    answer_items(client, seeded_engine, drinks | {"currentItemId": drinks["items"][2]["id"]}, limit=4)
    result = submit(client, drinks["id"], retry["id"], tiles(retry, "I", "drink", "water")).json()
    assert (result["result"], result["note"], result["session"]["canComplete"]) == ("correct", None, True)


def test_a_typo_is_forgiven_and_shows_the_answer_it_was_close_to(
    client: TestClient, seeded_engine: Engine, drinks: Json
) -> None:
    answer_items(client, seeded_engine, drinks, limit=1)
    result = answer(client, drinks, 2, {"type": "translate", "text": "I am drinkng water"})
    assert (result["result"], result["isCorrect"], result["note"]) == ("correct", True, "typo")
    assert result["correctAnswer"] == "I am drinking water."  # the accepted answer it nearly matched
    assert (result["heartLost"], result["combo"]) == (False, 2)


def test_another_accepted_answer_is_correct_and_shows_the_main_one(
    client: TestClient, seeded_engine: Engine, drinks: Json
) -> None:
    answer_items(client, seeded_engine, drinks, limit=1)
    result = answer(client, drinks, 2, {"type": "translate", "text": "I'm drinking water"})  # "I'm" == "I am"
    assert (result["result"], result["note"], result["correctAnswer"]) == (
        "correct",
        "alternate",
        "I drink water.",
    )


def test_missing_accents_are_forgiven_with_a_note(
    client: TestClient, seeded_engine: Engine, learner2: int
) -> None:
    # A new learner's first lesson; its fifth exercise is "Thank you, Luis. Goodbye!" to Spanish.
    theirs = as_user(learner2)
    session = start_session(
        client, {"kind": "lesson", "nodeId": node_at(client, 1, 1, headers=theirs)}, headers=theirs
    )
    answer_items(client, seeded_engine, session, limit=4, headers=theirs)
    fifth = session["items"][4]
    response = submit(
        client,
        session["id"],
        fifth["id"],
        {"type": "translate", "text": "Gracias, Luis. Adios!"},
        headers=theirs,
    )
    result = response.json()
    assert (result["result"], result["note"], result["correctAnswer"]) == (
        "correct",
        "accent",
        "Gracias, Luis. ¡Adiós!",
    )


def test_a_missing_or_wrong_word_is_named(client: TestClient, seeded_engine: Engine, drinks: Json) -> None:
    answer_items(client, seeded_engine, drinks, limit=4)
    missing = answer(client, drinks, 5, {"type": "translate", "text": "Quiero jugo, por favor."})
    assert (missing["result"], missing["note"]) == ("incorrect", "missing_word")
    assert missing["correctAnswer"] == "Quiero un jugo, por favor."
    retry = missing["appendedItem"]
    answer_items(client, seeded_engine, drinks | {"currentItemId": drinks["items"][5]["id"]}, limit=1)
    wrong_word = submit(
        client, drinks["id"], retry["id"], {"type": "translate", "text": "Quiero una jugo, por favor."}
    )
    assert (wrong_word.json()["result"], wrong_word.json()["note"]) == (
        "incorrect",
        "wrong_word",
    )  # un/una: too short for a typo


def test_a_wrong_choice_reveals_the_whole_sentence(
    client: TestClient, seeded_engine: Engine, drinks: Json
) -> None:
    answer_items(client, seeded_engine, drinks, limit=3)
    blank = drinks["items"][3]
    result = answer(client, drinks, 4, answer_for(exercise_of(seeded_engine, blank), correct=False))
    assert (result["result"], result["correctAnswer"]) == ("incorrect", "Tú bebes agua.")


def test_a_crossed_match_is_wrong_and_reveals_nothing(
    client: TestClient, seeded_engine: Engine, drinks: Json
) -> None:
    answer_items(client, seeded_engine, drinks, limit=2)
    match = drinks["items"][2]
    result = answer(client, drinks, 3, answer_for(exercise_of(seeded_engine, match), correct=False))
    assert (result["result"], result["correctAnswer"], result["heartLost"]) == ("incorrect", None, True)


def test_a_listening_exercise_reveals_its_meaning(
    client: TestClient, seeded_engine: Engine, drinks: Json
) -> None:
    answer_items(client, seeded_engine, drinks, limit=5)
    result = answer(client, drinks, 6, {"type": "type_answer", "text": "quiero agua"})
    assert (result["result"], result["correctAnswer"], result["meaning"]) == (
        "correct",
        "Quiero agua.",
        "I want water.",
    )


# ---- can't listen now ----


def test_cant_listen_excuses_a_listening_exercise_without_a_heart(
    client: TestClient, seeded_engine: Engine, drinks: Json
) -> None:
    answer_items(client, seeded_engine, drinks, limit=5)
    result = answer(client, drinks, 6, {"type": "cant_listen"})
    assert (result["result"], result["isCorrect"], result["heartLost"], result["appendedItem"]) == (
        "cant_listen",
        False,
        False,
        None,
    )
    assert (result["correctAnswer"], result["meaning"]) == ("Quiero agua.", "I want water.")
    assert (result["progress"], result["mistakes"], result["combo"]) == ({"completed": 6, "total": 6}, 0, 5)
    assert result["session"]["canComplete"] is True
    receipt = complete(client, drinks["id"])
    assert receipt["stats"] | {"durationSeconds": 0} == {
        "accuracyPercent": 100,  # can't-listen is not graded
        "durationSeconds": 0,
        "mistakes": 0,
        "bestCombo": 5,
        "perfect": True,
        "itemCount": 6,
    }
    assert receipt["xp"]["lines"] == [{"reason": "lesson", "amount": 10}, {"reason": "combo", "amount": 5}]


def test_cant_listen_excuses_every_listening_exercise_of_the_session(
    bare_client: TestClient, engine: Engine
) -> None:
    with make_session_factory(engine)() as db:
        add_catalog(db)
        course = add_mini_course(db)  # each skill lesson ends with a listening exercise
        add_learner(db, username="alex", joined_at=FROZEN_NOW)
        db.commit()
    play_lesson(bare_client, engine, course.skill_id)
    play_lesson(bare_client, engine, course.skill_id)
    practice = start_session(bare_client, {"kind": "practice"})  # both lessons: all ten exercises
    listening = [item["id"] for item in practice["items"] if item["exercise"].get("audioOnly")]
    assert len(listening) == 2

    first_listening = next(i for i, item in enumerate(practice["items"]) if item["id"] == listening[0])
    answer_items(bare_client, engine, practice, limit=first_listening)
    result = submit(bare_client, practice["id"], listening[0], {"type": "cant_listen"}).json()
    assert result["result"] == "cant_listen"
    read = bare_client.get(f"{API}/sessions/{practice['id']}").json()
    assert [item["result"] for item in read["items"] if item["id"] in listening] == ["cant_listen"] * 2
    assert read["currentItemId"] not in listening
    rest = answer_items(bare_client, engine, read)
    assert rest == [] or rest[-1]["session"]["canComplete"] is True
    assert complete(bare_client, practice["id"])["stats"]["mistakes"] == 0


def test_cant_listen_fits_only_a_listening_exercise(client: TestClient, drinks: Json) -> None:
    response = submit(client, drinks["id"], drinks["items"][0]["id"], {"type": "cant_listen"})
    assert_problem(response, 422, "INVALID_ANSWER")
    assert client.get(f"{API}/sessions/{drinks['id']}").json()["items"][0]["result"] is None


# ---- answers that don't fit the exercise ----


def test_an_answer_must_fit_its_exercise(client: TestClient, drinks: Json) -> None:
    first = drinks["items"][0]["id"]
    another_exercises_option = drinks["items"][3]["exercise"]["options"][0]["id"]
    for payload in (
        {"type": "multiple_choice", "optionId": another_exercises_option},
        {"type": "fill_blank", "optionId": drinks["items"][0]["exercise"]["options"][0]["id"]},
        {"type": "type_answer", "text": "el jugo"},
    ):
        assert_problem(submit(client, drinks["id"], first, payload), 422, "INVALID_ANSWER")
    assert get_me(client)["hearts"]["current"] == 4


def test_each_tile_can_be_used_once(client: TestClient, seeded_engine: Engine, drinks: Json) -> None:
    answer_items(client, seeded_engine, drinks, limit=1)
    sentence = drinks["items"][1]
    i = next(tile["id"] for tile in sentence["exercise"]["tiles"] if tile["text"] == "I")
    foreign = drinks["items"][4]["exercise"]["tiles"][0]["id"]
    for tile_ids in ([i, i], [foreign]):
        response = submit(client, drinks["id"], sentence["id"], {"type": "translate", "tileIds": tile_ids})
        assert_problem(response, 422, "INVALID_ANSWER")


def test_a_match_must_cover_every_pair_once(client: TestClient, seeded_engine: Engine, drinks: Json) -> None:
    answer_items(client, seeded_engine, drinks, limit=2)
    match = drinks["items"][2]
    ids = [token["id"] for token in match["exercise"]["left"]]
    for pairs in (ids[:-1], [*ids[:-1], ids[0]]):
        payload = {
            "type": "match_pairs",
            "pairs": [{"leftId": i, "rightId": i} for i in pairs],
            "mistakes": 0,
        }
        assert_problem(submit(client, drinks["id"], match["id"], payload), 422, "INVALID_ANSWER")
    complete_match = {
        "type": "match_pairs",
        "pairs": [{"leftId": i, "rightId": i} for i in ids],
        "mistakes": 2,
    }
    assert answer(client, drinks, 3, complete_match)["result"] == "correct"  # red taps cost no heart
