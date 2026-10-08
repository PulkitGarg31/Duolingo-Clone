"""Load the demo data into an empty database.

The full loader validates the JSON files and bulk-inserts the catalogues, the course content,
the users and the sample learner's history. This placeholder version loads nothing.
"""

from datetime import datetime

from sqlalchemy.orm import Session

from app.core.config import Settings


def seed_if_empty(db: Session, real_now: datetime, settings: Settings) -> bool:
    """Seed the database unless it already holds data; True when this call seeded it."""
    return False
