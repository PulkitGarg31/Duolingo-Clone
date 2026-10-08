"""Profiles: GET /users/{userId}/profile, for learners and league bots alike."""

from fastapi import APIRouter

router = APIRouter(tags=["profile"])
