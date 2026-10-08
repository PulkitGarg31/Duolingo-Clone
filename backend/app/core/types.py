"""Column types that encode the schema conventions: UTC instants, checked enums and booleans."""

from datetime import UTC, datetime
from enum import StrEnum

import sqlalchemy as sa
from sqlalchemy.engine import Dialect
from sqlalchemy.types import TypeDecorator


class UTCDateTime(TypeDecorator[datetime]):
    """A DATETIME that holds UTC instants only.

    Binding a naive datetime raises instead of guessing its zone. Values are stored as naive UTC
    text, which sorts chronologically, and come back with tzinfo=UTC attached.
    """

    impl = sa.DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError(f"refusing to store naive datetime {value.isoformat()}; pass an aware instant")
        return value.astimezone(UTC).replace(tzinfo=None)

    def process_result_value(self, value: datetime | None, dialect: Dialect) -> datetime | None:
        return None if value is None else value.replace(tzinfo=UTC)


def str_enum(enum_cls: type[StrEnum], name: str, length: int, *, check: bool = True) -> sa.Enum:
    """VARCHAR(length) holding the enum's values, plus a CHECK named ck_<table>_<name>.

    Pass check=False when the table declares its own CHECK that already lists the values.
    """
    return sa.Enum(
        enum_cls,
        native_enum=False,
        create_constraint=check,
        length=length,
        values_callable=lambda members: [member.value for member in members],
        name=name,
    )


def checked_bool(name: str) -> sa.Boolean:
    """INTEGER 0/1 with a CHECK named ck_<table>_<name>, so no other value can be stored."""
    return sa.Boolean(create_constraint=True, name=name)
