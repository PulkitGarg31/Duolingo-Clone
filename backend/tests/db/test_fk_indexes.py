"""Schema shape: the 30 tables, the ON DELETE policy and an index behind every foreign key.

SQLite does not index foreign keys by itself. Without an index, every lookup of a parent's
children (and every parent delete) scans the whole child table.
"""

import re
from collections import defaultdict

from sqlalchemy import Connection, Engine

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

# Every explicitly named index; UNIQUE constraints add unnamed automatic indexes on top.
NAMED_INDEXES = {
    "ux_exercise_options_one_correct",
    "ux_exercise_answers_one_primary",
    "ix_glossary_terms_node_id",
    "ix_users_current_course_id",
    "ix_user_stats_league_tier",
    "ux_lesson_sessions_one_active",
    "ix_lesson_sessions_user_id_status_ended_at",
    "ix_lesson_sessions_node_id",
    "ix_lesson_sessions_lesson_id_node_id",
    "ix_session_items_exercise_id",
    "ix_xp_events_user_id_local_date",
    "ix_xp_events_user_id_earned_at",
    "ix_purchases_shop_item_id",
    "ux_gem_transactions_chest_once",
    "ux_gem_transactions_quest_claim",
    "ux_gem_transactions_purchase",
    "ux_gem_transactions_fee_once",
    "ix_gem_transactions_user_id_created_at",
    "ix_gem_transactions_node_id",
    "ix_gem_transactions_session_id",
    "ix_league_cohorts_open",
    "ix_league_memberships_user_id",
    "ix_user_achievements_achievement_tier_id",
    "ix_user_achievements_session_id",
    "ix_quest_claims_quest_id",
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


def test_create_all_builds_exactly_the_30_tables(engine: Engine) -> None:
    with engine.connect() as conn:
        tables = set(conn.exec_driver_sql("SELECT name FROM sqlite_master WHERE type = 'table'").scalars())
    assert len(TABLES) == 30
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
    with engine.connect() as conn:
        names = set(
            conn.exec_driver_sql(
                "SELECT name FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL"
            ).scalars()
        )
    assert names == NAMED_INDEXES
