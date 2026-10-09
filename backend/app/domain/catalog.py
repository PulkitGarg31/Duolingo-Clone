"""The catalogues the game ranks, rewards and sells from: frozen copies of the catalogue rows.

They never change while the server runs, so one copy serves every request (services/reference.py
reads it once per database).
"""

from collections.abc import Mapping
from dataclasses import dataclass

from app.domain.achievements import AchievementDef
from app.domain.enums import ShopItemCode, ShopItemKind, ShopSection
from app.domain.quests import QuestDef


@dataclass(frozen=True)
class LeagueRow:
    """A league tier: its badge and how many move up or down when a week ends."""

    tier: int
    name: str
    color: str
    promote_count: int
    demote_count: int


@dataclass(frozen=True)
class QuestRow:
    """A catalogue quest: the row id that quest claims point at, and its definition."""

    id: int
    definition: QuestDef


@dataclass(frozen=True)
class ShopItemRow:
    """A shop item and its gem price."""

    id: int
    code: str
    kind: ShopItemKind
    section: ShopSection
    name: str
    description: str
    price_gems: int
    duration_minutes: int | None  # XP boosts only
    is_available: bool  # False: shown as coming soon


@dataclass(frozen=True)
class Catalog:
    """What the game ranks, rewards and sells, each in display order."""

    leagues: Mapping[int, LeagueRow]  # by tier, Bronze first
    achievements: tuple[AchievementDef, ...]
    quests: tuple[QuestRow, ...]
    shop_items: tuple[ShopItemRow, ...]

    def league(self, tier: int) -> LeagueRow:
        league = self.leagues.get(tier)
        if league is None:  # the ten tiers are seeded reference data
            raise ValueError(f"league tier {tier} is missing")
        return league

    def shop_item(self, code: str) -> ShopItemRow | None:
        return next((item for item in self.shop_items if item.code == code), None)

    def shop_item_by_id(self, item_id: int) -> ShopItemRow | None:
        return next((item for item in self.shop_items if item.id == item_id), None)

    @property
    def refill_price(self) -> int:
        """The one price of a heart refill."""
        item = self.shop_item(ShopItemCode.HEART_REFILL)
        if item is None:  # the seed validator requires this item
            raise ValueError("the shop catalogue has no heart refill")
        return item.price_gems
