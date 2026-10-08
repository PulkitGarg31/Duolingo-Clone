"""Declarative base: the constraint naming convention and the UTC datetime mapping."""

from datetime import datetime

from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase

from app.core.types import UTCDateTime

# Deterministic constraint names, so an IntegrityError says which rule broke, for example
# "CHECK constraint failed: ck_user_stats_hearts_range". Each CHECK passes a short name that fills
# %(constraint_name)s. Partial unique indexes are named by hand as ux_<table>_<purpose>.
NAMING_CONVENTION = {
    "pk": "pk_%(table_name)s",
    "fk": "fk_%(table_name)s_%(column_0_N_name)s_%(referred_table_name)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ix": "ix_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
}


class Base(DeclarativeBase):
    """Base class of every model. Any `Mapped[datetime]` column stores a UTC instant."""

    metadata = MetaData(naming_convention=NAMING_CONVENTION)
    type_annotation_map = {datetime: UTCDateTime()}
