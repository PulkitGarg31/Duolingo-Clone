"""The per-request context every use case receives, and who counts as a demo learner."""

from dataclasses import dataclass
from datetime import date, datetime

from app.core.config import Settings
from app.models import User, UserSettings, UserStats


def is_demo_learner(user: User, settings: Settings) -> bool:
    """Whether `user` plays the sample demo rather than an account of their own: a guest (a visitor's
    private copy of the demo) or the shared seeded learner, whom a request without a token acts as."""
    return user.is_guest or user.username == settings.default_username


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
    def is_demo(self) -> bool:
        """Whether the learner plays the sample demo (a guest or the shared seeded learner) rather
        than an account of their own."""
        return is_demo_learner(self.user, self.settings)

    @property
    def preferences(self) -> UserSettings:
        """The learner's own settings (daily goal, listening exercises, ...)."""
        preferences = self.user.settings
        if preferences is None:  # every human learner is created with a settings row
            raise RuntimeError(f"learner {self.user.id} has no settings row")
        return preferences
