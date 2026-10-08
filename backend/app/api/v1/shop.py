"""The shop catalogue with each item's availability for the caller."""

from fastapi import APIRouter

from app.api.deps import CtxDep, DbDep
from app.api.problems import problem_responses
from app.schemas.shop import ShopOut
from app.services import shop_service

router = APIRouter(tags=["shop"])


@router.get(
    "/shop/items",
    response_model=ShopOut,
    operation_id="listShopItems",
    summary="The shop catalogue",
    responses=problem_responses(403, 404),
)
def list_shop_items(db: DbDep, ctx: CtxDep) -> ShopOut:
    """Every item with whether the learner can buy it now, and the reason when not."""
    return shop_service.list_items(db, ctx)
