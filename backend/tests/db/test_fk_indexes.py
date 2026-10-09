"""Schema shape: the 31 tables, the ON DELETE policy and an index behind every foreign key, and how
startup builds the schema (rebuilding a database file made for another one).

SQLite does not index foreign keys by itself. Without an index, every lookup of a parent's
children (and every parent delete) scans the whole child table.
"""

import re
from collections import defaultdict
from collections.abc import Iterator
from pathlib import Path

import pytest
import sqlalchemy as sa
from sqlalchemy import Connection, Engine

from app.core.db import create_tables, make_engine, schema_fingerprint
from app.models import Base

TABLES = {
    # content
    "courses",
    "units",
    "path_nodes",
    "lessons",
    "exercises",
    "exercise_options",
    "exercise_answers",
    "exercise_pairs",
    "guidebook_phrases",
    "glossary_terms",
    # learner
    "users",
    "user_settings",
    "user_stats",
    "bot_profiles",
    "auth_sessions",
    # play
    "lesson_sessions",
    "session_items",
    # ledgers and facts
    "xp_events",
    "purchases",
    "gem_transactions",
    "activity_days",
    # gamification and system
    "leagues",
    "league_cohorts",
    "league_memberships",
    "achievements",
    "achievement_tiers",
    "user_achievements",
    "shop_items",
    "quests",
    "quest_claims",
    "app_state",
}

# Cascade inside an aggregate, restrict across aggregates, set null on optional informational links.
ON_DELETE = {
    # content aggregate
    ("units", ("course_id",)): ("courses", "CASCADE"),
    ("path_nodes", ("unit_id",)): ("units", "CASCADE"),
    ("lessons", ("node_id",)): ("path_nodes", "CASCADE"),
    ("exercises", ("lesson_id",)): ("lessons", "CASCADE"),
    ("exercise_options", ("exercise_id",)): ("exercises", "CASCADE"),
    ("exercise_answers", ("exercise_id",)): ("exercises", "CASCADE"),
    ("exercise_pairs", ("exercise_id",)): ("exercises", "CASCADE"),
    ("guidebook_phrases", ("unit_id",)): ("units", "CASCADE"),
    ("glossary_terms", ("course_id",)): ("courses", "CASCADE"),
    ("glossary_terms", ("node_id",)): ("path_nodes", "SET NULL"),
    # learner aggregate, and its references to content and catalogue rows
    ("users", ("current_course_id",)): ("courses", "RESTRICT"),
    ("user_settings", ("user_id",)): ("users", "CASCADE"),
    ("user_stats", ("user_id",)): ("users", "CASCADE"),
    ("user_stats", ("league_tier",)): ("leagues", "RESTRICT"),
    ("bot_profiles", ("user_id",)): ("users", "CASCADE"),
    ("auth_sessions", ("user_id",)): ("users", "CASCADE"),
    ("lesson_sessions", ("user_id",)): ("users", "CASCADE"),
    ("lesson_sessions", ("node_id",)): ("path_nodes", "RESTRICT"),
    ("lesson_sessions", ("lesson_id", "node_id")): ("lessons", "RESTRICT"),
    ("session_items", ("session_id",)): ("lesson_sessions", "CASCADE"),
    ("session_items", ("exercise_id",)): ("exercises", "RESTRICT"),
    ("xp_events", ("user_id",)): ("users", "CASCADE"),
    ("xp_events", ("session_id",)): ("lesson_sessions", "CASCADE"),
    ("purchases", ("user_id",)): ("users", "CASCADE"),
    ("purchases", ("shop_item_id",)): ("shop_items", "RESTRICT"),
    ("gem_transactions", ("user_id",)): ("users", "CASCADE"),
    ("gem_transactions", ("node_id",)): ("path_nodes", "RESTRICT"),
    ("gem_transactions", ("quest_claim_id",)): ("quest_claims", "CASCADE"),
    ("gem_transactions", ("purchase_id",)): ("purchases", "CASCADE"),
    ("gem_transactions", ("session_id",)): ("lesson_sessions", "CASCADE"),
    ("activity_days", ("user_id",)): ("users", "CASCADE"),
    ("league_cohorts", ("owner_user_id",)): ("users", "CASCADE"),  # a learner's private cohorts
    ("league_memberships", ("cohort_id",)): ("league_cohorts", "CASCADE"),
    ("league_memberships", ("user_id",)): ("users", "CASCADE"),
    ("user_achievements", ("user_id",)): ("users", "CASCADE"),
    ("user_achievements", ("achievement_tier_id",)): ("achievement_tiers", "RESTRICT"),
    ("user_achievements", ("session_id",)): ("lesson_sessions", "SET NULL"),
    ("quest_claims", ("user_id",)): ("users", "CASCADE"),
    ("quest_claims", ("quest_id",)): ("quests", "RESTRICT"),
    # catalogue aggregates
    ("league_cohorts", ("league_tier",)): ("leagues", "RESTRICT"),
    ("achievement_tiers", ("achievement_id",)): ("achievements", "CASCADE"),
}

# Every explicitly named index: (table, columns, unique, partial-index predicate or None).
# UNIQUE constraints add unnamed automatic indexes on top (see UNIQUE_KEYS).
INDEXES: dict[str, tuple[str, tuple[str, ...], bool, str | None]] = {
    "ux_exercise_options_one_correct": ("exercise_options", ("exercise_id",), True, "is_correct = 1"),
    "ux_exercise_answers_one_primary": ("exercise_answers", ("exercise_id",), True, "is_primary = 1"),
    "ix_glossary_terms_node_id": ("glossary_terms", ("node_id",), False, None),
    "ix_users_current_course_id": ("users", ("current_course_id",), False, None),
    "ix_user_stats_league_tier": ("user_stats", ("league_tier",), False, None),
    "ix_auth_sessions_user_id": ("auth_sessions", ("user_id",), False, None),
    "ux_lesson_sessions_one_active": ("lesson_sessions", ("user_id",), True, "status = 'active'"),
    "ix_lesson_sessions_user_id_status_ended_at": (
        "lesson_sessions",
        ("user_id", "status", "ended_at"),
        False,
        None,
    ),
    "ix_lesson_sessions_node_id": ("lesson_sessions", ("node_id",), False, None),
    "ix_lesson_sessions_lesson_id_node_id": ("lesson_sessions", ("lesson_id", "node_id"), False, None),
    "ix_session_items_exercise_id": ("session_items", ("exercise_id",), False, None),
    "ix_xp_events_user_id_local_date": ("xp_events", ("user_id", "local_date"), False, None),
    "ix_xp_events_user_id_earned_at": ("xp_events", ("user_id", "earned_at"), False, None),
    "ix_purchases_shop_item_id": ("purchases", ("shop_item_id",), False, None),
    "ux_gem_transactions_chest_once": ("gem_transactions", ("user_id", "node_id"), True, "reason = 'chest'"),
    "ux_gem_transactions_quest_claim": (
        "gem_transactions",
        ("quest_claim_id",),
        True,
        "quest_claim_id IS NOT NULL",
    ),
    "ux_gem_transactions_purchase": ("gem_transactions", ("purchase_id",), True, "purchase_id IS NOT NULL"),
    "ux_gem_transactions_fee_once": ("gem_transactions", ("session_id",), True, "reason = 'legendary_fee'"),
    "ix_gem_transactions_user_id_created_at": ("gem_transactions", ("user_id", "created_at"), False, None),
    "ix_gem_transactions_node_id": ("gem_transactions", ("node_id",), False, None),
    "ix_gem_transactions_session_id": ("gem_transactions", ("session_id",), False, None),
    "ix_league_cohorts_league_tier": ("league_cohorts", ("league_tier",), False, None),
    "ix_league_cohorts_open": (
        "league_cohorts",
        ("owner_user_id", "week_start"),
        False,
        "finalized_at IS NULL",
    ),
    "ix_league_memberships_user_id": ("league_memberships", ("user_id",), False, None),
    "ix_user_achievements_achievement_tier_id": ("user_achievements", ("achievement_tier_id",), False, None),
    "ix_user_achievements_session_id": ("user_achievements", ("session_id",), False, None),
    "ix_quest_claims_quest_id": ("quest_claims", ("quest_id",), False, None),
}
NAMED_INDEXES = set(INDEXES)

# Natural keys: the column lists of each table's UNIQUE constraints. Ordered loading, the seed's
# lookups and every idempotent write (XP lines, purchases, claims, memberships) rely on them.
UNIQUE_KEYS: dict[str, set[tuple[str, ...]]] = {
    "courses": {("slug",), ("position",)},
    "units": {("course_id", "position")},
    "path_nodes": {("unit_id", "position"), ("key",)},
    "lessons": {("node_id", "position"), ("id", "node_id")},
    "exercises": {("lesson_id", "position"), ("key",)},
    "exercise_options": {("exercise_id", "position")},
    "exercise_answers": {("exercise_id", "text")},
    "exercise_pairs": {
        ("exercise_id", "position"),
        ("exercise_id", "learning_text"),
        ("exercise_id", "native_text"),
    },
    "guidebook_phrases": {("unit_id", "position")},
    "glossary_terms": {("course_id", "language", "term")},
    "users": {("username",), ("email",)},
    "auth_sessions": {("token_hash",)},
    "session_items": {("session_id", "seq")},
    "xp_events": {("session_id", "reason")},
    "purchases": {("user_id", "idempotency_key")},
    "activity_days": {("user_id", "local_date")},
    "leagues": {("name",)},
    "league_cohorts": {("owner_user_id", "league_tier", "week_start")},
    "league_memberships": {("cohort_id", "user_id"), ("cohort_id", "final_rank")},
    "achievements": {("code",), ("position",)},
    "achievement_tiers": {("achievement_id", "level"), ("achievement_id", "threshold")},
    "user_achievements": {("user_id", "achievement_tier_id")},
    "shop_items": {("code",), ("position",)},
    "quests": {("code",), ("position",)},
    "quest_claims": {("user_id", "quest_id", "local_date")},
}


def foreign_keys(conn: Connection, table: str) -> dict[tuple[str, ...], tuple[str, str]]:
    """{child columns: (parent table, ON DELETE action)} for each foreign key of `table`."""
    columns: dict[int, list[tuple[int, str]]] = defaultdict(list)
    targets: dict[int, tuple[str, str]] = {}
    # One row per (key, column); "from" is the child column and "table" the parent table.
    for row in conn.exec_driver_sql(f"PRAGMA foreign_key_list({table})").mappings():
        columns[row["id"]].append((row["seq"], row["from"]))
        targets[row["id"]] = (row["table"], row["on_delete"])
    return {tuple(name for _, name in sorted(cols)): targets[fk_id] for fk_id, cols in columns.items()}


def indexed_column_lists(conn: Connection, table: str) -> list[tuple[str, ...]]:
    """Column lists of the indexes that can serve a foreign-key lookup on `table`.

    That is every full index, every partial index guarded by `<leading column> IS NOT NULL`
    (an equality lookup implies it), and the INTEGER PRIMARY KEY, which is the rowid B-tree itself.
    """
    lists = []
    primary_key = [row for row in conn.exec_driver_sql(f"PRAGMA table_info({table})") if row.pk]
    if len(primary_key) == 1 and primary_key[0].type.upper() == "INTEGER":
        lists.append((primary_key[0].name,))
    for index in conn.exec_driver_sql(f"PRAGMA index_list({table})"):
        cols = tuple(row.name for row in conn.exec_driver_sql(f"PRAGMA index_info({index.name})"))
        if index.partial:
            sql = conn.exec_driver_sql(
                "SELECT sql FROM sqlite_master WHERE name = ?", (index.name,)
            ).scalar_one()
            if not re.search(rf"WHERE {cols[0]} IS NOT NULL$", sql):
                continue
        lists.append(cols)
    return lists


def test_create_all_builds_exactly_the_31_tables(engine: Engine) -> None:
    with engine.connect() as conn:
        tables = set(conn.exec_driver_sql("SELECT name FROM sqlite_master WHERE type = 'table'").scalars())
    assert len(TABLES) == 31
    assert tables == TABLES


def test_on_delete_follows_the_aggregate_policy(engine: Engine) -> None:
    with engine.connect() as conn:
        actual = {
            (table, columns): target
            for table in TABLES
            for columns, target in foreign_keys(conn, table).items()
        }
    assert actual == ON_DELETE


def test_every_foreign_key_leads_an_index(engine: Engine) -> None:
    missing = []
    with engine.connect() as conn:
        for table in sorted(TABLES):
            indexed = indexed_column_lists(conn, table)
            for columns in foreign_keys(conn, table):
                if not any(index[: len(columns)] == columns for index in indexed):
                    missing.append(f"{table}({', '.join(columns)})")
    assert missing == []


def test_named_indexes_match_the_index_map(engine: Engine) -> None:
    actual = {}
    with engine.connect() as conn:
        named = conn.exec_driver_sql(
            "SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL"
        )
        for name, table, sql in named.all():
            columns = tuple(row.name for row in conn.exec_driver_sql(f"PRAGMA index_info({name})"))
            _, _, predicate = sql.partition(" WHERE ")
            actual[name] = (table, columns, sql.startswith("CREATE UNIQUE INDEX "), predicate or None)
    assert actual == INDEXES


def test_natural_keys_are_unique_constraints_named_by_convention(engine: Engine) -> None:
    keys: dict[str, set[tuple[str, ...]]] = defaultdict(set)
    misnamed = []
    with engine.connect() as conn:
        for table, ddl in conn.exec_driver_sql("SELECT name, sql FROM sqlite_master WHERE type = 'table'"):
            for name, column_list in re.findall(r"CONSTRAINT (\w+) UNIQUE \(([^)]*)\)", ddl):
                columns = tuple(column.strip().strip('"') for column in column_list.split(","))
                keys[table].add(columns)
                if name != f"uq_{table}_{'_'.join(columns)}":
                    misnamed.append(name)
    assert misnamed == []
    assert dict(keys) == UNIQUE_KEYS


# ---- building the schema at startup ----


@pytest.fixture
def blank_engine(tmp_path: Path) -> Iterator[Engine]:
    """An engine on a database file that doesn't exist yet."""
    engine = make_engine(f"sqlite:///{(tmp_path / 'boot' / 'app.db').as_posix()}")
    yield engine
    engine.dispose()


def table_names(engine: Engine) -> set[str]:
    with engine.connect() as conn:
        return set(conn.exec_driver_sql("SELECT name FROM sqlite_master WHERE type = 'table'").scalars())


def column_names(engine: Engine, table: str) -> set[str]:
    with engine.connect() as conn:
        return {row.name for row in conn.exec_driver_sql(f"PRAGMA table_info({table})")}


def test_a_fresh_file_gets_every_table_and_the_schema_fingerprint(blank_engine: Engine) -> None:
    assert create_tables(blank_engine, Base.metadata) is False  # nothing was there to drop
    assert table_names(blank_engine) == TABLES
    with blank_engine.connect() as conn:
        stored = conn.exec_driver_sql("PRAGMA user_version").scalar_one()
    assert stored == schema_fingerprint(blank_engine, Base.metadata) > 0


def test_a_database_of_the_current_schema_keeps_its_data(blank_engine: Engine) -> None:
    create_tables(blank_engine, Base.metadata)
    with blank_engine.begin() as conn:
        conn.exec_driver_sql(
            "INSERT INTO leagues (tier, name, color, promote_count, demote_count)"
            " VALUES (1, 'Bronze', '#D4A880', 20, 0)"
        )
    assert create_tables(blank_engine, Base.metadata) is False  # the next boot
    with blank_engine.connect() as conn:
        assert conn.exec_driver_sql("SELECT name FROM leagues").scalars().all() == ["Bronze"]


def test_a_database_built_for_another_schema_is_rebuilt_empty(blank_engine: Engine) -> None:
    # What an older version left behind: a global clock offset, and users without credentials.
    with blank_engine.begin() as conn:
        conn.exec_driver_sql(
            "CREATE TABLE app_state (id INTEGER PRIMARY KEY, clock_offset_seconds INTEGER NOT NULL,"
            " seeded_at DATETIME NOT NULL, seed_version VARCHAR(64) NOT NULL)"
        )
        conn.exec_driver_sql("CREATE TABLE users (id INTEGER PRIMARY KEY, username VARCHAR(32) NOT NULL)")
        conn.exec_driver_sql("INSERT INTO app_state VALUES (1, 3600, '2026-10-08 12:00:00', 'old')")
        conn.exec_driver_sql("INSERT INTO users (username) VALUES ('alex')")

    assert create_tables(blank_engine, Base.metadata) is True
    assert table_names(blank_engine) == TABLES
    assert {"email", "password_hash", "clock_offset_seconds"} <= column_names(blank_engine, "users")
    assert "clock_offset_seconds" not in column_names(blank_engine, "app_state")
    with blank_engine.connect() as conn:
        assert conn.exec_driver_sql("SELECT count(*) FROM app_state").scalar_one() == 0  # seeded again next


def test_the_fingerprint_follows_the_schema(blank_engine: Engine) -> None:
    assert schema_fingerprint(blank_engine, Base.metadata) == schema_fingerprint(blank_engine, Base.metadata)
    changed = sa.MetaData()
    for table in Base.metadata.sorted_tables:
        table.to_metadata(changed)
    changed.tables["users"].append_column(sa.Column("nickname", sa.String(20)))
    assert schema_fingerprint(blank_engine, changed) != schema_fingerprint(blank_engine, Base.metadata)
