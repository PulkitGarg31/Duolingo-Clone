"""Purchases: buying shop items (with an Idempotency-Key) and reading a purchase back."""

from fastapi import APIRouter

router = APIRouter(tags=["shop"])
