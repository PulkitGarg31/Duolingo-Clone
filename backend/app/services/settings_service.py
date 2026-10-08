"""The learner's preferences: reading and updating them, including the time zone days are counted in."""

from datetime import datetime

from sqlalchemy.orm import Session

from app.domain.enums import ActivityKind, TimezoneEffect
from app.models import User, UserSettings
from app.repositories import ledger_repo
from app.schemas.settings import SettingsOut, SettingsPatchIn, SettingsUpdateOut
from app.services import streak_service
from app.services.context import RequestContext


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


def update(db: Session, ctx: RequestContext, patch: SettingsPatchIn) -> SettingsUpdateOut:
    """Apply a partial update and report what a time-zone change did.

    A new daily goal also becomes the goal of today's calendar day, if today already counts.
    """
    preferences = {name: value for name, value in patch.changes().items() if name != "timezone"}
    if preferences:
        _apply(ctx.preferences, preferences, ctx.now)
    if patch.daily_goal_xp is not None:
        _set_todays_goal(db, ctx, patch.daily_goal_xp)
    effect = TimezoneEffect.NONE if patch.timezone is None else change_timezone(ctx, patch.timezone)
    settings = settings_out(ctx.user, ctx.preferences)
    return SettingsUpdateOut(**settings.model_dump(by_alias=False), timezone_effect=effect)


def change_timezone(ctx: RequestContext, new_timezone: str) -> TimezoneEffect:
    """Adopt a time zone and mark it as confirmed (the app adopts the device's zone once).

    The same zone is only confirmed. A new zone shifts the streak's last covered day by the day
    difference between the two zones, so the streak is neither broken nor inflated.
    """
    ctx.user.timezone_confirmed = True
    if new_timezone == ctx.user.timezone:
        return TimezoneEffect.NONE
    streak_service.shift_for_timezone(ctx, new_timezone)
    ctx.user.timezone = new_timezone
    return TimezoneEffect.SHIFTED


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
