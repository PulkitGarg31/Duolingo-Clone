"""The shop catalogue and purchases (POST /me/purchases is the only way to refill hearts)."""

from datetime import datetime
from typing import Literal

from pydantic import Field

from app.domain.enums import ShopItemCode, ShopItemKind, ShopSection
from app.schemas.base import ApiModel
from app.schemas.common import HeartsOut

# Why an item can't be bought right now; each value is also the error code a purchase would get.
ShopUnavailableReason = Literal[
    "HEARTS_ALREADY_FULL", "MAX_FREEZES_EQUIPPED", "INSUFFICIENT_GEMS", "ITEM_UNAVAILABLE"
]


class ShopItemOut(ApiModel):
    """A shop item with its availability for the caller, so the UI can explain a disabled button."""

    code: ShopItemCode
    kind: ShopItemKind
    section: ShopSection
    name: str
    description: str
    price_gems: int
    duration_minutes: int | None
    owned: int | None
    max_owned: int | None
    active_until: datetime | None
    available: bool
    unavailable_reason: ShopUnavailableReason | None


class ShopOut(ApiModel):
    """The catalogue and the learner's gem balance."""

    gems: int
    items: list[ShopItemOut]


class PurchaseIn(ApiModel):
    """A purchase request; it must carry an Idempotency-Key header."""

    # A plain string rather than the enum: an unknown code is a missing catalogue item (404).
    item_code: str = Field(min_length=1, max_length=64)


class PurchaseEffect(ApiModel):
    """The learner's state after a purchase."""

    hearts: HeartsOut
    streak_freezes: int
    xp_boost_until: datetime | None


class PurchaseOut(ApiModel):
    """A purchase. On a replay the purchase fields are the original ones and `gems`/`effect` are current."""

    id: int
    item_code: ShopItemCode
    price_gems: int
    purchased_at: datetime
    replayed: bool
    gems: int
    effect: PurchaseEffect
