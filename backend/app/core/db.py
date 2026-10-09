"""SQLite engine and session factory, tuned for one serialized writer.

Every connection turns on foreign keys, WAL and a busy timeout. Every transaction starts with
BEGIN IMMEDIATE, which takes the write lock up front. GET requests write during the lazy sync and
a page fires several queries at once. With deferred transactions, two requests can both start
reading and then one of them fails to upgrade to the write lock ("database is locked", which no
busy timeout fixes). Taking the lock at BEGIN makes the requests queue instead.

`create_tables` builds the schema, rebuilding a database file that was made for another one.
"""

import hashlib
import sqlite3
from pathlib import Path

from sqlalchemy import Connection, Engine, MetaData, create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import ConnectionPoolEntry
from sqlalchemy.schema import CreateIndex, CreateTable

from app.core.config import get_settings

_CONNECTION_PRAGMAS = (
    "foreign_keys = ON",  # off by default, and set per connection
    "journal_mode = WAL",  # readers never block the writer (an in-memory database ignores it)
    "synchronous = NORMAL",  # durable enough with WAL, with far fewer fsyncs
    "busy_timeout = 5000",  # wait up to 5 s for the write lock instead of failing at once
)


def ensure_sqlite_dir(database_url: str) -> None:
    """Create the directory that will hold the SQLite file (SQLite creates the file, not its folder).

    make_engine() calls it, so any engine can open a brand-new database. An in-memory database
    needs nothing.
    """
    database = make_url(database_url).database
    if database and database != ":memory:":
        Path(database).parent.mkdir(parents=True, exist_ok=True)


def _on_connect(dbapi_connection: sqlite3.Connection, _record: ConnectionPoolEntry) -> None:
    # Disable the driver's own transaction handling so that SQLAlchemy emits BEGIN itself.
    dbapi_connection.isolation_level = None
    cursor = dbapi_connection.cursor()
    for pragma in _CONNECTION_PRAGMAS:
        cursor.execute(f"PRAGMA {pragma}")
    cursor.close()


def _on_begin(connection: Connection) -> None:
    connection.exec_driver_sql("BEGIN IMMEDIATE")


def make_engine(database_url: str) -> Engine:
    """An engine with the connection PRAGMAs and BEGIN IMMEDIATE transactions, for the app and tests.

    The database's folder is created first; the first connection then creates the file itself.
    """
    if make_url(database_url).get_backend_name() != "sqlite":
        raise ValueError(f"only SQLite is supported, got {database_url!r}")
    ensure_sqlite_dir(database_url)
    # Requests run on a thread pool, so a pooled connection may be used by several threads in turn.
    # The driver's lock timeout (5 s, like busy_timeout) also covers the PRAGMAs that run before it.
    engine = create_engine(database_url, connect_args={"check_same_thread": False, "timeout": 5})
    event.listen(engine, "connect", _on_connect)
    event.listen(engine, "begin", _on_begin)
    return engine


def schema_fingerprint(engine: Engine, metadata: MetaData) -> int:
    """A positive 31-bit fingerprint of the schema `metadata` describes: a hash of its DDL, the same in
    every process, small enough for SQLite's user_version."""
    ddl = [str(CreateTable(table).compile(engine)) for table in metadata.sorted_tables]
    ddl += [
        str(CreateIndex(index).compile(engine))
        for table in metadata.sorted_tables
        for index in sorted(table.indexes, key=lambda index: str(index.name))
    ]
    digest = hashlib.sha256("\n".join(ddl).encode()).digest()
    return int.from_bytes(digest[:4], "big") & 0x7FFF_FFFF or 1  # 0 means "never set"


def create_tables(engine: Engine, metadata: MetaData) -> bool:
    """Create the tables `metadata` describes; True when an outdated database was dropped first.

    There are no migrations: the database holds demo data only, and the hosted demo starts from an
    empty file on every boot. A file built for another schema (by an older version, say) is told
    apart by the fingerprint kept in SQLite's user_version, and is rebuilt from scratch instead of
    failing on its first query; the caller then seeds it again. `create_all` alone would leave an
    existing table as it is, missing any column added since.
    """
    expected = schema_fingerprint(engine, metadata)
    with engine.begin() as conn:
        stored = conn.exec_driver_sql("PRAGMA user_version").scalar_one()
        # SQLite's own tables (sqlite_sequence, ...) don't count.
        has_tables = conn.exec_driver_sql(
            "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite%'"
        ).scalar_one()
        outdated = bool(has_tables) and stored != expected
        if outdated:
            stale = MetaData()
            stale.reflect(conn)
            stale.drop_all(conn)  # children before parents, so no foreign key is left dangling
        metadata.create_all(conn)
        conn.exec_driver_sql(f"PRAGMA user_version = {expected:d}")
    return outdated


def make_session_factory(engine: Engine) -> sessionmaker[Session]:
    """Sessions whose objects stay readable after commit, so a response can be built from them."""
    return sessionmaker(engine, expire_on_commit=False)


engine = make_engine(get_settings().database_url)
SessionLocal = make_session_factory(engine)
