"""POST /dev/reset: every learner's data is deleted, the clock returns to real time and the sample
learner's history is replayed relative to the real instant. Content, catalogues and bots stay.
"""

from fastapi.testclient import TestClient
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session

from app.core.clock import FrozenClock
from app.models import (
    Achievement,
    AchievementTier,
    BotProfile,
    Course,
    Exercise,
    GemTransaction,
    GlossaryTerm,
    League,
    Lesson,
    LessonSession,
    PathNode,
    Quest,
    ShopItem,
    Unit,
    User,
    XpEvent,
)
from tests.helpers import (
    API,
    Json,
    as_user,
    assert_problem,
    buy,
    get_me,
    node_at,
    play_lesson,
    set_learner,
    use_settings,
)

# Content, catalogues and every user survive a reset; only learner data is replayed.
KEPT_TABLES = (
    Course, Unit, PathNode, Lesson, Exercise, GlossaryTerm,
    League, Achievement, AchievementTier, Quest, ShopItem,
    User, BotProfile,
)  # fmt: skip


def reset(client: TestClient, *, headers: dict[str, str] | None = None) -> Json:
    response = client.post(f"{API}/dev/reset", headers=headers)
    assert response.status_code == 200, response.text
    assert response.headers["x-server-time"] == response.json()["seededAt"]
    body: Json = response.json()
    return body


def kept_rows(engine: Engine) -> dict[str, int]:
    with Session(engine) as db:
        return {
            model.__tablename__: db.scalar(select(func.count()).select_from(model)) or 0
            for model in KEPT_TABLES
        }


def test_a_reset_rebuilds_the_demo_at_real_time(
    client: TestClient, clock: FrozenClock, seeded_engine: Engine
) -> None:
    play_lesson(client, seeded_engine, node_at(client, 2, 2))
    buy(client, "streak_freeze")
    client.post(f"{API}/dev/clock/next-day")
    clock.advance(hours=3)  # real time moved on too: 15:00 UTC, 20:30 in Kolkata

    body = reset(client)
    assert (body["reset"], body["seededAt"]) == (True, "2026-10-08T15:00:00Z")
    me = body["me"]
    assert (me["serverNow"], me["localDate"], me["dev"]) == (
        "2026-10-08T15:00:00Z",
        "2026-10-08",
        {"enabled": True, "clockOffsetSeconds": 0},
    )
    assert (me["xp"], me["gems"], me["activeSession"]) == (
        {"total": 373, "today": 0, "thisWeek": 42},
        820,
        None,
    )
    assert (me["hearts"]["current"], me["hearts"]["nextHeartAt"]) == (4, "2026-10-08T19:00:00Z")  # an hour in
    streak = me["streak"]
    assert (streak["current"], streak["status"], streak["freezesEquipped"]) == (13, "at_risk", 1)
    result = me["pendingLeagueResult"]
    assert (result["outcome"], result["seen"]) == ("promoted", False)
    assert me["league"]["name"] == "Silver"

    clock_out = client.get(f"{API}/dev/clock").json()
    assert (clock_out["offsetSeconds"], clock_out["now"], clock_out["realNow"]) == (
        0,
        "2026-10-08T15:00:00Z",
        "2026-10-08T15:00:00Z",
    )
    drinks = client.get(f"{API}/me/path").json()["units"][1]["nodes"][1]
    assert (drinks["state"], drinks["lessonsCompleted"]) == ("active", 1)  # the lesson played earlier is gone


def test_a_reset_wipes_every_learners_data(client: TestClient, seeded_engine: Engine, learner2: int) -> None:
    theirs = as_user(learner2)
    play_lesson(client, seeded_engine, node_at(client, 1, 1, headers=theirs), headers=theirs)
    set_learner(client, hearts=2, gems=500, headers=theirs)

    me = reset(client, headers=theirs)["me"]  # the caller's own, fresh state
    assert (me["user"]["id"], me["user"]["username"]) == (learner2, "sam")
    assert (me["xp"]["total"], me["gems"], me["hearts"]["current"], me["streak"]["current"]) == (0, 0, 5, 0)
    with Session(seeded_engine) as db:
        for model in (LessonSession, XpEvent, GemTransaction):
            assert db.scalar(select(func.count()).select_from(model).where(model.user_id == learner2)) == 0
    sample = get_me(client)
    assert (sample["xp"]["total"], sample["gems"]) == (373, 820)


def test_a_reset_keeps_the_content_and_the_bots(client: TestClient, seeded_engine: Engine) -> None:
    before = kept_rows(seeded_engine)
    with Session(seeded_engine) as db:
        bots = db.execute(select(BotProfile.user_id, BotProfile.rng_seed, BotProfile.baseline_xp)).all()
    reset(client)
    assert kept_rows(seeded_engine) == before
    with Session(seeded_engine) as db:
        assert (
            db.execute(select(BotProfile.user_id, BotProfile.rng_seed, BotProfile.baseline_xp)).all() == bots
        )


def test_a_reset_needs_the_dev_tools(client: TestClient) -> None:
    use_settings(client, enable_dev_tools=False)
    assert_problem(client.post(f"{API}/dev/reset"), 403, "DEV_TOOLS_DISABLED")
