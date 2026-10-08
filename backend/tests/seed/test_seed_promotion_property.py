"""At seed time, last week's league result is always a promotion, whatever the seed day and zone.

Why it holds: the sample learner earns at least 79 XP in any week that can be "last week", a light
bot's Bronze week stays below that, and any 29 of the 35 bots include at least 10 light bots. So the
learner beats at least 10 members, ranks 20th or better, and Bronze promotes its top 20.

The check plans the history with the pure planner (no database) for every day of the eight weeks
that follow the frozen seed instant, in three time zones. The course and the bot pool are read once
from the seeded template.
"""

import shutil
import time
import warnings
from datetime import timedelta
from pathlib import Path

import pytest

from app.core.db import make_engine, make_session_factory
from app.domain.bots import bot_week_xp_bound
from app.domain.calendar import league_week_bounds
from app.domain.enums import LeagueOutcome
from app.repositories import user_repo
from app.seed.history import SampleRows, SampleWorld, plan_sample_learner
from app.seed.sample_learner import load_world
from app.seed.schema import PACE_CLASSES, SampleLearnerFile
from app.seed.validate import load_bundle
from tests.conftest import FROZEN_NOW

ZONES = ("Asia/Kolkata", "UTC", "America/Los_Angeles")
SEED_DAYS = 8 * 7
TIME_LIMIT_SECONDS = 3.0
MIN_LAST_WEEK_XP = 79  # the weakest week the history can give, D-12 20:05 to D-7 (15+10+15+14+10+15)
BRONZE = 1


@pytest.fixture(scope="module")
def world(seeded_template: Path, tmp_path_factory: pytest.TempPathFactory) -> tuple[SampleWorld, int]:
    """The course, shop and bots of the seeded demo, and the learner's id, read from a copy of it."""
    copy = tmp_path_factory.mktemp("property") / "seeded.db"
    shutil.copyfile(seeded_template, copy)
    engine = make_engine(f"sqlite:///{copy.as_posix()}")
    try:
        with make_session_factory(engine)() as db:
            learner = user_repo.get_by_username(db, "alex")
            assert learner is not None
            return load_world(db, learner.current_course_id), learner.id
    finally:
        engine.dispose()


@pytest.fixture(scope="module")
def script() -> SampleLearnerFile:
    return load_bundle(default_username="alex").sample_learner


def last_week_result(
    rows: SampleRows, learner_id: int
) -> tuple[LeagueOutcome | None, int | None, int | None]:
    """The learner's outcome, rank and XP in the finished cohort."""
    finished = next(cohort for cohort in rows.cohorts if cohort.finalized_at is not None)
    assert finished.tier == BRONZE
    mine = next(member for member in finished.members if member.user_id == learner_id)
    return mine.outcome, mine.final_rank, mine.final_xp


def test_last_week_is_a_promotion_on_every_seed_day_and_zone(
    world: tuple[SampleWorld, int], script: SampleLearnerFile
) -> None:
    sample_world, learner_id = world
    started = time.perf_counter()
    failures = []
    for day in range(SEED_DAYS):
        now = FROZEN_NOW + timedelta(days=day)
        for zone in ZONES:
            rows = plan_sample_learner(script, sample_world, learner_id=learner_id, now=now, tz=zone)
            outcome, rank, xp = last_week_result(rows, learner_id)
            if (
                outcome != LeagueOutcome.PROMOTED
                or (xp or 0) < MIN_LAST_WEEK_XP
                or rows.league_tier != BRONZE + 1
            ):
                failures.append(f"{now:%Y-%m-%d} {zone}: {outcome} at rank {rank} with {xp} XP")
    elapsed = time.perf_counter() - started
    assert failures == []
    if (
        elapsed > TIME_LIMIT_SECONDS
    ):  # a slow or instrumented run (coverage) is not a failure, but worth seeing
        warnings.warn(f"{SEED_DAYS * len(ZONES)} plans took {elapsed:.2f} s", stacklevel=1)


def test_a_light_bot_bronze_week_stays_below_the_learner(world: tuple[SampleWorld, int]) -> None:
    light = PACE_CLASSES["light"]
    assert bot_week_xp_bound(light.max_daily_xp, BRONZE) < MIN_LAST_WEEK_XP
    sample_world, _ = world
    light_bots = [bot for bot in sample_world.bots if bot.daily_xp <= light.max_daily_xp]
    assert len(light_bots) == light.count


def test_the_seed_instant_itself_ranks_the_learner_inside_the_promotion_zone(
    world: tuple[SampleWorld, int], script: SampleLearnerFile
) -> None:
    sample_world, learner_id = world
    rows = plan_sample_learner(script, sample_world, learner_id=learner_id, now=FROZEN_NOW, tz="Asia/Kolkata")
    finished = rows.cohorts[0]
    start, end = league_week_bounds(finished.week_start)
    earned = sum(line.amount for s in rows.sessions if start <= s.ended_at < end for line in s.xp_lines)
    assert last_week_result(rows, learner_id) == (LeagueOutcome.PROMOTED, 14, earned)
