"""Mounts every version 1 router; the app serves them under /api/v1."""

from fastapi import APIRouter

from app.api.problems import DEFAULT_PROBLEM_RESPONSES
from app.api.v1 import auth, content, dev, health, league, me, path, purchases, quests, sessions, shop, users

API_V1_PREFIX = "/api/v1"

# Groups the operations in the API docs, in this order.
OPENAPI_TAGS = [
    {"name": "system", "description": "Health and the server's boot identity."},
    {"name": "auth", "description": "Accounts and private demos. No token: the shared demo learner."},
    {"name": "me", "description": "The learner's state, settings and activity history."},
    {"name": "path", "description": "The learning path and its treasure chests."},
    {"name": "sessions", "description": "Lessons, practice, legendary runs and timed practice."},
    {"name": "league", "description": "Weekly leagues and their results."},
    {"name": "quests", "description": "Daily quests."},
    {"name": "shop", "description": "The shop catalogue and purchases."},
    {"name": "profile", "description": "Learner and bot profiles with achievements."},
    {"name": "content", "description": "Public course content: the course menu and Guidebooks."},
    {"name": "dev", "description": "Demo tools, for the caller only: time travel, tweaks and a reset."},
]

api_v1_router = APIRouter(responses=DEFAULT_PROBLEM_RESPONSES)
api_v1_router.include_router(health.router)
api_v1_router.include_router(auth.router)
api_v1_router.include_router(me.router)
api_v1_router.include_router(path.router)
api_v1_router.include_router(sessions.router)
api_v1_router.include_router(league.router)
api_v1_router.include_router(quests.router)
api_v1_router.include_router(purchases.router)
api_v1_router.include_router(shop.router)
api_v1_router.include_router(users.router)
api_v1_router.include_router(content.router)
api_v1_router.include_router(dev.router)
