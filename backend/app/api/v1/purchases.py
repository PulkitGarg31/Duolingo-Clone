"""Purchases: buying shop items (with an Idempotency-Key) and reading a purchase back."""

from typing import Annotated

from fastapi import APIRouter, Request, Response, status

from app.api.deps import CtxDep, DbDep, IdempotencyKeyDep, id_path
from app.api.problems import problem_responses
from app.schemas.shop import PurchaseIn, PurchaseOut
from app.services import shop_service

router = APIRouter(tags=["shop"])


@router.post(
    "/me/purchases",
    response_model=PurchaseOut,
    status_code=status.HTTP_201_CREATED,
    operation_id="createPurchase",
    summary="Buy a shop item",
    responses={
        status.HTTP_200_OK: {
            "model": PurchaseOut,
            "description": "A repeated request: the original purchase",
        },
        **problem_responses(400, 403, 404, 409, 422),
    },
)
def create_purchase(
    body: PurchaseIn, key: IdempotencyKeyDep, request: Request, response: Response, db: DbDep, ctx: CtxDep
) -> PurchaseOut:
    """Buy an item; this is the only way to refill hearts. The Idempotency-Key header makes a repeated
    request return the original purchase (200) instead of buying again (201)."""
    result, created = shop_service.purchase(db, ctx, body.item_code, key)
    db.commit()
    if created:
        response.headers["Location"] = request.app.url_path_for("get_purchase", purchaseId=result.id)
    else:
        response.status_code = status.HTTP_200_OK
    return result


@router.get(
    "/me/purchases/{purchaseId}",
    response_model=PurchaseOut,
    operation_id="getPurchase",
    summary="A purchase",
    responses=problem_responses(403, 404, 422),
)
def get_purchase(purchase_id: Annotated[int, id_path("purchaseId")], db: DbDep, ctx: CtxDep) -> PurchaseOut:
    """One of the learner's purchases, with their current gems and state."""
    return shop_service.get_purchase(db, ctx, purchase_id)
