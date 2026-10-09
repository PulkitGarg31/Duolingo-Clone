"""The learner's preferences: reading and updating them, including the time zone days are counted in."""

from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from app.domain.calendar import local_date
from app.domain.enums import ActivityKind, TimezoneEffect
from app.models import User, UserSettings
from app.repositories import ledger_repo, play_repo, system_repo
from app.schemas.settings import SettingsOut, SettingsPatchIn, SettingsUpdateOut
from app.seed.sample_learner import reset_demo
from app.services import streak_service
from app.services.context import RequestContext


@dataclass(frozen=True)
class SettingsUpdate:
    """The answer to a PATCH, and the request's instant after it: rebuilding the sample history puts
    the demo clock back on real time, as the demo reset does."""

    out: SettingsUpdateOut
    now: datetime


@dataclass(frozen=True)
class TimezoneChange:
    """What a time-zone update did, and the request context after it (a new one after a rebuild)."""

    effect: TimezoneEffect
    ctx: RequestContext


def settings_out(user: User, preferences: UserSettings) -> SettingsOut:
    """The preferences, plus the IANA time zone the learner's days are counted in."""
    return SettingsOut(
        daily_goal_xp=preferences.daily_goal_xp,
        theme=preferences.theme,
        sound_effects=preferences.sound_effects,
        animations=preferences.animations,
        motivational_messages=preferences.motivational_messages,
        listening_exercises=preferences.listening_exercises,
        timezone=user.timezone,
    )


def current(ctx: RequestContext) -> SettingsOut:
    """The learner's settings as they are now."""
    return settings_out(ctx.user, ctx.preferences)


def update(db: Session, ctx: RequestContext, patch: SettingsPatchIn) -> SettingsUpdate:
    """Apply a partial update and report what a time-zone change did.

    The time zone goes first: rebuilding the sample history replaces the learner's settings, so the
    other fields of the same PATCH apply to the rebuilt ones. A new daily goal also becomes the goal
    of today's calendar day, if today already counts.
    """
    change = TimezoneChange(TimezoneEffect.NONE, ctx)
    if patch.timezone is not None:
        change = change_timezone(db, ctx, patch.timezone)
    ctx = change.ctx
    preferences = {name: value for name, value in patch.changes().items() if name != "timezone"}
    if preferences:
        _apply(ctx.preferences, preferences, ctx.now)
    if patch.daily_goal_xp is not None:
        _set_todays_goal(db, ctx, patch.daily_goal_xp)
    settings = settings_out(ctx.user, ctx.preferences)
    out = SettingsUpdateOut(**settings.model_dump(by_alias=False), timezone_effect=change.effect)
    return SettingsUpdate(out=out, now=ctx.now)


def change_timezone(db: Session, ctx: RequestContext, new_timezone: str) -> TimezoneChange:
    """Adopt a time zone and mark it as confirmed (the app adopts the device's zone once).

    The same zone is only confirmed. A new zone for the sample learner, who has never confirmed one and
    has neither played nor spent since the demo was seeded, rebuilds the sample history in that zone,
    so every stored day (XP, calendar, quests) is a day of the new zone. Any other new zone shifts the
    streak's last covered day by the day difference between the two zones, so the streak is neither
    broken nor inflated; the days already stored keep their dates.
    """
    user = ctx.user
    if new_timezone == user.timezone:
        user.timezone_confirmed = True
        return TimezoneChange(TimezoneEffect.NONE, ctx)
    if not user.timezone_confirmed and _is_untouched_sample_learner(db, ctx):
        return TimezoneChange(TimezoneEffect.RESEEDED, _rebuild_sample_history(db, ctx, new_timezone))
    streak_service.shift_for_timezone(ctx, new_timezone)
    user.timezone, user.timezone_confirmed = new_timezone, True
    return TimezoneChange(TimezoneEffect.SHIFTED, ctx)


def learner_is_pristine(db: Session, user_id: int, seeded_at: datetime) -> bool:
    """Whether the learner has neither started a session nor moved gems since the demo was seeded."""
    return not (
        play_repo.started_since(db, user_id, seeded_at)
        or ledger_repo.gems_moved_since(db, user_id, seeded_at)
    )


def _is_untouched_sample_learner(db: Session, ctx: RequestContext) -> bool:
    """Whether the learner is the seeded sample learner, untouched since the seed.

    Only the sample learner has a seeded history to rebuild; other learners exist in local runs and
    tests only, and a rebuild would erase what they did.
    """
    state = system_repo.get_state(db)
    return (
        state is not None
        and ctx.user.username == ctx.settings.default_username
        and learner_is_pristine(db, ctx.user.id, state.seeded_at)
    )


def _rebuild_sample_history(db: Session, ctx: RequestContext, new_timezone: str) -> RequestContext:
    """Re-seed the demo with the sample history replayed in `new_timezone`, relative to real time,
    and return the request context afterwards, with the new zone confirmed."""
    real_now = ctx.now - timedelta(seconds=system_repo.offset_seconds(db))
    reset_demo(db, real_now, ctx.settings, tz=new_timezone)
    db.flush()
    db.expire_all()  # the rebuild rewrote rows with bulk statements: read them back from the database
    user = ctx.user
    user.timezone_confirmed = True  # the rebuild leaves the flag as it was
    stats = user.stats
    if stats is None:  # the rebuild gives the learner fresh stats
        raise RuntimeError(f"rebuilding the sample history left learner {user.id} without stats")
    return RequestContext(
        user=user,
        stats=stats,
        now=real_now,
        today=local_date(real_now, user.timezone),
        settings=ctx.settings,
    )


def _apply(preferences: UserSettings, changes: dict[str, object], now: datetime) -> None:
    # Every setting except the time zone is a user_settings column of the same name.
    for name, value in changes.items():
        setattr(preferences, name, value)
    preferences.updated_at = now


def _set_todays_goal(db: Session, ctx: RequestContext, goal_xp: int) -> None:
    """Today's calendar row keeps the goal in force; frozen days have none."""
    today = ledger_repo.activity_day(db, ctx.user.id, ctx.today)
    if today is not None and today.kind == ActivityKind.ACTIVE:
        today.goal_xp = goal_xp
