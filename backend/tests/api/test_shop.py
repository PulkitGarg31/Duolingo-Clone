"""The shop: the catalogue with each item's availability, and purchases made idempotent by their key.

The seeded learner has 820 gems, 4 hearts and 1 Streak Freeze equipped. Prices: refill 350,
Streak Freeze 200, XP Boost (15 minutes) 100; Unlimited Hearts are coming soon.
"""

from fastapi.testclient import TestClient
from sqlalchemy import Engine, func, select
from sqlalchemy.orm import Session

from app.core.clock import FrozenClock
from app.domain.enums import GemReason
from app.models import GemTransaction, Purchase
from tests.helpers import (
    API,
    Json,
    answer_items,
    as_user,
    assert_problem,
    buy,
    complete,
    get_me,
    node_at,
    play_lesson,
    set_learner,
    start_session,
)

KEY = "0d6c6f5e-55a8-4b6f-9a7e-2f0f4e3e7d11"

SEEDED_SHOP = {
    "gems": 820,
    "items": [
        {
            "code": "heart_refill",
            "kind": "heart_refill",
            "section": "hearts",
            "name": "Refill Hearts",
            "description": "Get full hearts so you can worry less about making mistakes in a lesson",
            "priceGems": 350,
            "durationMinutes": None,
            "owned": None,
            "maxOwned": None,
            "activeUntil": None,
            "available": True,
            "unavailableReason": None,
        },
        {
            "code": "unlimited_hearts",
            "kind": "super",
            "section": "hearts",
            "name": "Unlimited Hearts",
            "description": "Never run out of hearts with Super!",
            "priceGems": 0,
            "durationMinutes": None,
            "owned": None,
            "maxOwned": None,
            "activeUntil": None,
            "available": False,
            "unavailableReason": "ITEM_UNAVAILABLE",
        },
        {
            "code": "streak_freeze",
            "kind": "streak_freeze",
            "section": "power_ups",
            "name": "Streak Freeze",
            "description": (
                "Streak Freeze allows your streak to remain in place for one full day of inactivity."
            ),
            "priceGems": 200,
            "durationMinutes": None,
            "owned": 1,
            "maxOwned": 2,
            "activeUntil": None,
            "available": True,
            "unavailableReason": None,
        },
        {
            "code": "xp_boost_15",
            "kind": "xp_boost",
            "section": "power_ups",
            "name": "XP Boost",
            "description": "Double your XP in lessons for the next 15 minutes.",
            "priceGems": 100,
            "durationMinutes": 15,
            "owned": None,
            "maxOwned": None,
            "activeUntil": None,
            "available": True,
            "unavailableReason": None,
        },
    ],
}


def shop_item(client: TestClient, code: str) -> Json:
    item: Json = next(
        item for item in client.get(f"{API}/shop/items").json()["items"] if item["code"] == code
    )
    return item


def purchases_with_key(engine: Engine, key: str) -> tuple[int, int]:
    """How many purchases use the key, and how many gem rows paid for them."""
    with Session(engine) as db:
        bought = db.scalar(select(func.count()).where(Purchase.idempotency_key == key)) or 0
        paid = db.scalar(
            select(func.count())
            .select_from(GemTransaction)
            .join(Purchase, Purchase.id == GemTransaction.purchase_id)
            .where(Purchase.idempotency_key == key, GemTransaction.reason == GemReason.PURCHASE)
        )
        return bought, paid or 0


def test_the_shop_lists_each_item_with_its_availability(client: TestClient) -> None:
    response = client.get(f"{API}/shop/items")
    assert response.status_code == 200
    assert response.json() == SEEDED_SHOP


def test_a_refill_fills_the_hearts_and_is_located(client: TestClient) -> None:
    response = buy(client, "heart_refill", key=KEY)
    purchase = response.json()
    assert response.status_code == 201
    assert response.headers["location"] == f"{API}/me/purchases/{purchase['id']}"
    assert purchase == {
        "id": purchase["id"],
        "itemCode": "heart_refill",
        "priceGems": 350,
        "purchasedAt": "2026-10-08T12:00:00Z",
        "replayed": False,
        "gems": 470,
        "effect": {
            "hearts": {
                "current": 5,
                "max": 5,
                "nextHeartAt": None,
                "fullAt": None,
                "regenIntervalSeconds": 18000,
                "refillPriceGems": 350,
            },
            "streakFreezes": 1,
            "xpBoostUntil": None,
        },
    }
    assert get_me(client)["hearts"]["current"] == 5


def test_the_same_key_twice_buys_once(client: TestClient, clock: FrozenClock, seeded_engine: Engine) -> None:
    first = buy(client, "heart_refill", key=KEY)
    clock.advance(minutes=1)
    again = buy(client, "heart_refill", key=KEY)
    assert (first.status_code, again.status_code) == (201, 200)
    assert "location" not in again.headers
    assert again.json() == first.json() | {"replayed": True}  # the original purchase; the state is current
    assert get_me(client)["gems"] == 470
    assert purchases_with_key(seeded_engine, KEY) == (1, 1)


def test_a_key_cannot_buy_another_item(client: TestClient) -> None:
    assert buy(client, "streak_freeze", key=KEY).status_code == 201
    assert_problem(buy(client, "xp_boost_15", key=KEY), 422, "IDEMPOTENCY_KEY_REUSED")
    assert get_me(client)["gems"] == 620


def test_a_purchase_needs_an_idempotency_key(client: TestClient) -> None:
    for headers in ({}, {"Idempotency-Key": ""}, {"Idempotency-Key": "k" * 65}):
        response = client.post(f"{API}/me/purchases", json={"itemCode": "heart_refill"}, headers=headers)
        assert_problem(response, 400, "IDEMPOTENCY_KEY_REQUIRED")
    assert get_me(client)["gems"] == 820


def test_a_purchase_beyond_the_balance_changes_nothing(client: TestClient, seeded_engine: Engine) -> None:
    set_learner(client, gems=100)
    problem = assert_problem(buy(client, "heart_refill", key=KEY), 409, "INSUFFICIENT_GEMS")
    assert (problem["requiredGems"], problem["balance"]) == (350, 100)
    me = get_me(client)
    assert (me["gems"], me["hearts"]["current"]) == (100, 4)
    assert purchases_with_key(seeded_engine, KEY) == (0, 0)
    assert shop_item(client, "heart_refill")["unavailableReason"] == "INSUFFICIENT_GEMS"


def test_a_refill_needs_a_missing_heart(client: TestClient) -> None:
    set_learner(client, hearts=5)
    assert_problem(buy(client, "heart_refill"), 409, "HEARTS_ALREADY_FULL")
    refill = shop_item(client, "heart_refill")
    assert (refill["available"], refill["unavailableReason"]) == (False, "HEARTS_ALREADY_FULL")
    assert get_me(client)["gems"] == 820


def test_at_most_two_freezes_can_be_equipped(client: TestClient) -> None:
    second = buy(client, "streak_freeze")
    assert (second.status_code, second.json()["effect"]["streakFreezes"]) == (201, 2)
    freeze = shop_item(client, "streak_freeze")
    assert (freeze["owned"], freeze["available"], freeze["unavailableReason"]) == (
        2,
        False,
        "MAX_FREEZES_EQUIPPED",
    )
    assert_problem(buy(client, "streak_freeze"), 409, "MAX_FREEZES_EQUIPPED")
    me = get_me(client)
    assert (me["gems"], me["streak"]["freezesEquipped"]) == (620, 2)


def test_unlimited_hearts_are_coming_soon(client: TestClient) -> None:
    assert_problem(buy(client, "unlimited_hearts"), 409, "ITEM_UNAVAILABLE")


def test_an_unknown_item_is_not_found(client: TestClient) -> None:
    assert_problem(buy(client, "gem_pack"), 404, "NOT_FOUND")


def test_boosts_stack_and_double_the_next_lesson(client: TestClient, seeded_engine: Engine) -> None:
    first = buy(client, "xp_boost_15").json()
    assert first["effect"]["xpBoostUntil"] == "2026-10-08T12:15:00Z"
    second = buy(client, "xp_boost_15").json()
    assert second["effect"]["xpBoostUntil"] == "2026-10-08T12:30:00Z"  # starts when the running one ends
    assert get_me(client)["xpBoost"] == {"active": True, "endsAt": "2026-10-08T12:30:00Z", "multiplier": 2}
    assert shop_item(client, "xp_boost_15")["activeUntil"] == "2026-10-08T12:30:00Z"

    receipt = play_lesson(client, seeded_engine, node_at(client, 2, 2))
    assert receipt["xp"] == {
        "total": 30,
        "lines": [
            {"reason": "lesson", "amount": 10},
            {"reason": "combo", "amount": 5},
            {"reason": "boost", "amount": 15},
        ],
        "boostActive": True,
    }


def test_a_boost_ends_after_its_minutes(
    client: TestClient, clock: FrozenClock, seeded_engine: Engine
) -> None:
    buy(client, "xp_boost_15")
    clock.advance(minutes=15)  # the boost ran until 12:15, exclusive
    assert get_me(client)["xpBoost"] == {"active": False, "endsAt": None, "multiplier": 2}
    receipt = play_lesson(client, seeded_engine, node_at(client, 2, 2))
    assert [line["reason"] for line in receipt["xp"]["lines"]] == ["lesson", "combo"]


def test_a_boost_never_applies_to_timed_practice(
    client: TestClient, clock: FrozenClock, seeded_engine: Engine
) -> None:
    buy(client, "xp_boost_15")
    run = start_session(client, {"kind": "timed"})
    answer_items(client, seeded_engine, run, limit=2)
    clock.advance(minutes=1)
    receipt = complete(client, run["id"])
    assert receipt["xp"] == {"total": 2, "lines": [{"reason": "timed", "amount": 2}], "boostActive": False}


def test_a_purchase_reads_back_for_its_owner_only(client: TestClient, learner2: int) -> None:
    created = buy(client, "streak_freeze").json()
    response = client.get(f"{API}/me/purchases/{created['id']}")
    assert response.status_code == 200
    assert response.json() == created  # the same shape, with the current state
    assert_problem(
        client.get(f"{API}/me/purchases/{created['id']}", headers=as_user(learner2)), 404, "NOT_FOUND"
    )
    assert_problem(client.get(f"{API}/me/purchases/999999"), 404, "NOT_FOUND")


def test_each_learner_has_their_own_keys_and_wallet(client: TestClient, learner2: int) -> None:
    theirs = as_user(learner2)
    set_learner(client, gems=400, headers=theirs)
    assert buy(client, "streak_freeze", key=KEY).status_code == 201
    assert buy(client, "streak_freeze", key=KEY, headers=theirs).status_code == 201  # a key is per learner
    assert (get_me(client)["gems"], get_me(client, headers=theirs)["gems"]) == (620, 200)
