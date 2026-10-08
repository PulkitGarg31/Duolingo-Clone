"""The shop: the catalogue with each item's availability for the caller, and idempotent purchases.

A purchase is the only way to refill hearts. Every purchase carries the client's Idempotency-Key:
repeating the request with the same key returns the first purchase instead of buying again.
"""

from datetime import datetime, timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import (
    AppError,
    ErrorCode,
    HeartsAlreadyFull,
    IdempotencyKeyReused,
    ItemUnavailable,
    MaxFreezesEquipped,
    NotFound,
)
from app.domain import xp
from app.domain.enums import GemReason, ShopItemKind
from app.domain.rules import MAX_HEARTS, MAX_STREAK_FREEZES
from app.models import Purchase, ShopItem, UserStats
from app.repositories import gamification_repo, ledger_repo
from app.schemas.shop import PurchaseEffect, PurchaseOut, ShopItemOut, ShopOut
from app.services import gems_service, hearts_service
from app.services.context import RequestContext


def list_items(db: Session, ctx: RequestContext) -> ShopOut:
    """The catalogue in display order, each item saying whether the learner can buy it now and why not."""
    return ShopOut(
        gems=ctx.stats.gems, items=[_item_out(item, ctx) for item in gamification_repo.shop_items(db)]
    )


def purchase(db: Session, ctx: RequestContext, item_code: str, key: str) -> tuple[PurchaseOut, bool]:
    """Buy an item; True when this request made the purchase, False when it replayed an earlier one.

    In order: a key already used replays its purchase (or is refused for another item); the item
    must exist and be on sale; its effect must make sense (hearts not full, fewer than two freezes);
    then the price is debited (INSUFFICIENT_GEMS rolls everything back) and the effect applied.
    """
    earlier = ledger_repo.purchase_by_key(db, ctx.user.id, key)
    if earlier is not None:
        return _replay(db, ctx, earlier, item_code), False
    item = gamification_repo.shop_item_by_code(db, item_code)
    if item is None:
        raise NotFound("There is no shop item with that code.")
    refusal = _refusal(item, ctx.stats)
    if refusal is not None:
        raise refusal
    bought = Purchase(
        user_id=ctx.user.id,
        shop_item_id=item.id,
        price_gems=item.price_gems,
        idempotency_key=key,
        purchased_at=ctx.now,
    )
    try:
        # A savepoint: should a concurrent request have used the key first, only this insert is undone.
        with db.begin_nested():
            db.add(bought)
    except IntegrityError:
        concurrent = ledger_repo.purchase_by_key(db, ctx.user.id, key)
        if concurrent is None:
            raise
        return _replay(db, ctx, concurrent, item_code), False
    gems_service.debit(
        db, ctx.user.id, item.price_gems, GemReason.PURCHASE, now=ctx.now, purchase_id=bought.id
    )
    _apply_effect(ctx, item)
    return _purchase_out(db, ctx, bought, item, replayed=False), True


def get_purchase(db: Session, ctx: RequestContext, purchase_id: int) -> PurchaseOut:
    """One of the learner's purchases, with their current gems and state."""
    bought = ledger_repo.get_purchase(db, ctx.user.id, purchase_id)
    if bought is None:
        raise NotFound("There is no purchase with that id.")
    return _purchase_out(db, ctx, bought, _item_of(db, bought), replayed=False)


def _replay(db: Session, ctx: RequestContext, earlier: Purchase, item_code: str) -> PurchaseOut:
    """The purchase a key already made; the same key may not buy a different item."""
    item = _item_of(db, earlier)
    if item.code != item_code:
        raise IdempotencyKeyReused()
    return _purchase_out(db, ctx, earlier, item, replayed=True)


def _refusal(item: ShopItem, stats: UserStats) -> AppError | None:
    """Why the item can't be bought now regardless of price, or None."""
    if not item.is_available:
        return ItemUnavailable()
    if item.kind == ShopItemKind.HEART_REFILL and stats.hearts >= MAX_HEARTS:
        return HeartsAlreadyFull()
    if item.kind == ShopItemKind.STREAK_FREEZE and stats.streak_freezes >= MAX_STREAK_FREEZES:
        return MaxFreezesEquipped()
    return None


def _apply_effect(ctx: RequestContext, item: ShopItem) -> None:
    """What the item does: full hearts, one more equipped freeze, or a longer Double XP window."""
    match item.kind:
        case ShopItemKind.HEART_REFILL:
            hearts_service.refill(ctx)
        case ShopItemKind.STREAK_FREEZE:
            ctx.stats.streak_freezes += 1
        case ShopItemKind.XP_BOOST if item.duration_minutes is not None:
            # Boosts stack: a new one starts when the running one ends.
            start = max(ctx.now, ctx.stats.xp_boost_until or ctx.now)
            ctx.stats.xp_boost_until = start + timedelta(minutes=item.duration_minutes)
    ctx.stats.updated_at = ctx.now


def _item_out(item: ShopItem, ctx: RequestContext) -> ShopItemOut:
    stats = ctx.stats
    freeze = item.kind == ShopItemKind.STREAK_FREEZE
    reason = _unavailable_reason(item, stats)
    return ShopItemOut(
        code=item.code,
        kind=item.kind,
        section=item.section,
        name=item.name,
        description=item.description,
        price_gems=item.price_gems,
        duration_minutes=item.duration_minutes,
        owned=stats.streak_freezes if freeze else None,
        max_owned=MAX_STREAK_FREEZES if freeze else None,
        active_until=_boost_until(stats, ctx.now) if item.kind == ShopItemKind.XP_BOOST else None,
        available=reason is None,
        unavailable_reason=reason,
    )


def _unavailable_reason(item: ShopItem, stats: UserStats) -> str | None:
    """The error code a purchase would get right now, so the UI can explain a disabled button."""
    refusal = _refusal(item, stats)
    if refusal is not None:
        return refusal.code.value
    if stats.gems < item.price_gems:
        return ErrorCode.INSUFFICIENT_GEMS.value
    return None


def _purchase_out(
    db: Session, ctx: RequestContext, bought: Purchase, item: ShopItem, *, replayed: bool
) -> PurchaseOut:
    """The purchase as it was made, with the learner's gems and state as they are now."""
    return PurchaseOut(
        id=bought.id,
        item_code=item.code,
        price_gems=bought.price_gems,
        purchased_at=bought.purchased_at,
        replayed=replayed,
        gems=ctx.stats.gems,
        effect=PurchaseEffect(
            hearts=hearts_service.hearts_out(db, ctx.stats, ctx.settings),
            streak_freezes=ctx.stats.streak_freezes,
            xp_boost_until=_boost_until(ctx.stats, ctx.now),
        ),
    )


def _boost_until(stats: UserStats, now: datetime) -> datetime | None:
    """When the running Double XP window ends; None when none is running."""
    return stats.xp_boost_until if xp.is_boost_active(stats.xp_boost_until, now) else None


def _item_of(db: Session, bought: Purchase) -> ShopItem:
    item = gamification_repo.get_shop_item(db, bought.shop_item_id)
    if item is None:  # a purchase's item can't be deleted (ON DELETE RESTRICT)
        raise RuntimeError(f"shop item {bought.shop_item_id} is missing")
    return item
