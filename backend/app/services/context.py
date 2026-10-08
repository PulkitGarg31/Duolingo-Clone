"""The per-request context every use case receives."""

from dataclasses import dataclass
from datetime import date, datetime

from app.core.config import Settings
from app.models import User, UserStats


@dataclass(frozen=True)
class RequestContext:
    """Who is asking and when, already brought up to date.

    `now` is the request's single instant: every timestamp the request writes uses it. `today` is
    the learner's local date at that instant. `settings` is the server configuration; the
    learner's own preferences are `user.settings`.
    """

    user: User
    stats: UserStats
    now: datetime
    today: date
    settings: Settings
