"""SQLite engine and session factory, tuned for one serialized writer.

Every connection turns on foreign keys, WAL and a busy timeout. Every transaction starts with
BEGIN IMMEDIATE, which takes the write lock up front. GET requests write during the lazy sync and
a page fires several queries at once. With deferred transactions, two requests can both start
reading and then one of them fails to upgrade to the write lock ("database is locked", which no
busy timeout fixes). Taking the lock at BEGIN makes the requests queue instead.
"""

import sqlite3
from pathlib import Path

from sqlalchemy import Connection, Engine, create_engine, event
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import ConnectionPoolEntry

from app.core.config import get_settings

_CONNECTION_PRAGMAS = (
    "foreign_keys = ON",  # off by default, and set per connection
    "journal_mode = WAL",  # readers never block the writer (an in-memory database ignores it)
    "synchronous = NORMAL",  # durable enough with WAL, with far fewer fsyncs
    "busy_timeout = 5000",  # wait up to 5 s for the write lock instead of failing at once
)


def ensure_sqlite_dir(database_url: str) -> None:
    """Create the directory that will hold the SQLite file (SQLite creates the file, not its folder).

    Startup calls this before the first connection. An in-memory database needs nothing.
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

    Making it touches nothing on disk; the first connection opens the file (see ensure_sqlite_dir).
    """
    if make_url(database_url).get_backend_name() != "sqlite":
        raise ValueError(f"only SQLite is supported, got {database_url!r}")
    # Requests run on a thread pool, so a pooled connection may be used by several threads in turn.
    engine = create_engine(database_url, connect_args={"check_same_thread": False})
    event.listen(engine, "connect", _on_connect)
    event.listen(engine, "begin", _on_begin)
    return engine


def make_session_factory(engine: Engine) -> sessionmaker[Session]:
    """Sessions whose objects stay readable after commit, so a response can be built from them."""
    return sessionmaker(engine, expire_on_commit=False)


engine = make_engine(get_settings().database_url)
SessionLocal = make_session_factory(engine)
