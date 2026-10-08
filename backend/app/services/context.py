"""The per-request context every use case receives."""

from dataclasses import dataclass
from datetime import date, datetime

from app.core.config import Settings
from app.models import User, UserSettings, UserStats


@dataclass(frozen=True)
class RequestContext:
    """Who is asking and when, already brought up to date.

    `now` is the request's single instant: every timestamp the request writes uses it. `today` is
    the learner's local date at that instant. `settings` is the server configuration; the
    learner's own preferences are `preferences`.
    """

    user: User
    stats: UserStats
    now: datetime
    today: date
    settings: Settings

    @property
    def preferences(self) -> UserSettings:
        """The learner's own settings (daily goal, listening exercises, ...)."""
        preferences = self.user.settings
        if preferences is None:  # every human learner is created with a settings row
            raise RuntimeError(f"learner {self.user.id} has no settings row")
        return preferences
