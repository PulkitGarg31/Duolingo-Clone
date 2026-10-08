"""Command line for the demo data.

    python -m app.seed --check   validate the seed files, reporting every problem with its JSON path
    python -m app.seed --reset   drop and re-create the database at DATABASE_URL, then seed it

`--check` touches no database, so CI runs it before the tests.
"""

import argparse
import sys
from collections import Counter
from collections.abc import Sequence

from app.core.clock import SystemClock
from app.core.config import Settings, get_settings
from app.core.db import make_engine, make_session_factory
from app.models import Base
from app.seed.loader import seed_if_empty
from app.seed.validate import DATA_DIR, SeedBundle, SeedError, load_bundle


def main(argv: Sequence[str] | None = None) -> int:
    """Run the command; the result is the process exit status."""
    parser = argparse.ArgumentParser(
        prog="python -m app.seed", description="Validate or rebuild the demo data."
    )
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument(
        "--check", action="store_true", help="validate the seed files and report every problem"
    )
    action.add_argument("--reset", action="store_true", help="drop and re-create the database, then seed it")
    args = parser.parse_args(argv)
    settings = get_settings()
    try:
        bundle = load_bundle(DATA_DIR, default_username=settings.default_username)
    except SeedError as error:
        print(f"The seed files have {len(error.problems)} problem(s):", file=sys.stderr)
        for problem in error.problems:
            print(f"  {problem}", file=sys.stderr)
        return 1
    if args.check:
        print(f"Seed files OK: {summary(bundle)}.")
        return 0
    rebuild_database(settings)
    print(f"Rebuilt and seeded {settings.database_url}.")
    return 0


def summary(bundle: SeedBundle) -> str:
    """The totals of the seed data, for the --check report."""
    units = [unit.content for course in bundle.courses for unit in course.units]
    nodes = [node for unit in units for node in unit.nodes]
    lessons = [lesson for node in nodes for lesson in node.lessons]
    exercise_types = Counter(exercise.type.value for lesson in lessons for exercise in lesson.exercises)
    by_type = ", ".join(f"{count} {name}" for name, count in sorted(exercise_types.items()))
    return (
        f"{len(bundle.courses)} courses, {len(units)} units, {len(nodes)} nodes, {len(lessons)} lessons, "
        f"{exercise_types.total()} exercises ({by_type}), "
        f"{sum(len(unit.glossary) for unit in units)} glossary terms, "
        f"1 learner and {len(bundle.users.bots)} bots, {len(bundle.sample_learner.steps)} history steps"
    )


def rebuild_database(settings: Settings) -> None:
    """Drop every table of the configured database, create them again and seed the demo data."""
    engine = make_engine(settings.database_url)
    try:
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
        with make_session_factory(engine)() as db:
            seed_if_empty(db, real_now=SystemClock().now(), settings=settings)
            db.commit()
    finally:
        engine.dispose()


if __name__ == "__main__":
    sys.exit(main())
