"""Daily quests: today's three quests, their progress, and the rewards paid when a session completes one.

Which quests a learner gets and how far along they are is derived from facts (the day's XP lines),
never stored. A `quest_claims` row records that a reward was paid, once per quest and local day, so
a new day means new quests.
"""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.domain import quests
from app.domain.calendar import next_local_midnight
from app.domain.catalog import QuestRow
from app.domain.enums import GemReason
from app.domain.quests import EarnedXp, QuestProgress
from app.models import QuestClaim
from app.repositories import gamification_repo, ledger_repo
from app.schemas.completion import QuestCompletedOut
from app.schemas.quests import QuestOut, QuestsOut
from app.services import gems_service, reference
from app.services.context import RequestContext


@dataclass(frozen=True)
class _TodaysQuest:
    """One of today's quests: its catalogue row (for its id) and where it stands."""

    row: QuestRow
    progress: QuestProgress


def todays_view(db: Session, ctx: RequestContext) -> QuestsOut:
    """Today's three quests with their progress; `completed` means the reward was already paid."""
    claimed = gamification_repo.claimed_quest_ids(db, ctx.user.id, ctx.today)
    quests_today = [
        QuestOut(
            code=quest.row.definition.code,
            slot=quest.row.definition.slot,
            title=quest.progress.title,
            icon=quest.row.definition.icon,
            progress=quest.progress.progress,
            target=quest.progress.target,
            reward_gems=quest.row.definition.reward_gems,
            completed=quest.row.id in claimed,
        )
        for quest in _todays_quests(db, ctx)
    ]
    return QuestsOut(
        local_date=ctx.today,
        resets_at=next_local_midnight(ctx.now, ctx.user.timezone),
        server_now=ctx.now,
        completed_count=sum(quest.completed for quest in quests_today),
        quests=quests_today,
    )


def reward_newly_completed(db: Session, ctx: RequestContext) -> list[QuestCompletedOut]:
    """Pay every quest of today that has reached its target and was not paid yet (runs in completion).

    Each payment records the claim first, then credits the gems against it.
    """
    claimed = gamification_repo.claimed_quest_ids(db, ctx.user.id, ctx.today)
    paid: list[QuestCompletedOut] = []
    for quest in _todays_quests(db, ctx):
        if not quest.progress.reached or quest.row.id in claimed:
            continue
        claim = QuestClaim(
            user_id=ctx.user.id, quest_id=quest.row.id, local_date=ctx.today, claimed_at=ctx.now
        )
        db.add(claim)
        db.flush()  # the gem row points at the claim
        reward = quest.row.definition.reward_gems
        gems_service.credit(db, ctx.user.id, reward, GemReason.QUEST, now=ctx.now, quest_claim_id=claim.id)
        paid.append(
            QuestCompletedOut(code=quest.row.definition.code, title=quest.progress.title, reward_gems=reward)
        )
    return paid


def _todays_quests(db: Session, ctx: RequestContext) -> list[_TodaysQuest]:
    """The learner's quests for today, in slot order, measured against today's XP lines."""
    rows = {row.definition.code: row for row in reference.catalog(db).quests}
    picked = quests.todays_quests(ctx.user.id, ctx.today, [row.definition for row in rows.values()])
    lines = ledger_repo.xp_lines_on(db, ctx.user.id, ctx.today)
    metrics = quests.quest_metrics(
        EarnedXp(line.session_id, line.reason, line.amount, line.mistakes, line.best_combo) for line in lines
    )
    goal = ctx.preferences.daily_goal_xp
    return [_TodaysQuest(rows[quest.code], quests.quest_progress(quest, metrics, goal)) for quest in picked]
