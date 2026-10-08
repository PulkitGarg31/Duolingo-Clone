"""GET /me/quests: today's three daily quests. Rewards are paid automatically."""

from datetime import date, datetime
from typing import Literal

from app.domain.enums import QuestIcon
from app.schemas.base import ApiModel

# 1: the daily-goal quest, 2: a core quest, 3: a hard quest.
QuestSlot = Literal[1, 2, 3]


class QuestOut(ApiModel):
    """One daily quest. `progress` is capped at `target`; `completed` means the reward was paid."""

    code: str
    slot: QuestSlot
    title: str
    icon: QuestIcon
    progress: int
    target: int
    reward_gems: int
    completed: bool


class QuestsOut(ApiModel):
    """Today's quests. They reset at the learner's next local midnight (`resetsAt`)."""

    local_date: date
    resets_at: datetime
    server_now: datetime
    completed_count: int
    quests: list[QuestOut]
