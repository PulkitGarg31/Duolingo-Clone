"""Daily quests: today's three quests, their progress, and the rewards paid when a session completes one.

Which quests a learner gets and how far along they are is derived from facts (the day's XP lines),
never stored. A `quest_claims` row records that a reward was paid, once per quest and local day, so
a new day means new quests.
"""

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.domain import quests
from app.domain.calendar import next_local_midnight
from app.domain.enums import GemReason, QuestIcon
from app.domain.quests import EarnedXp, QuestDef, QuestProgress
from app.models import Quest, QuestClaim
from app.repositories import gamification_repo, ledger_repo
from app.schemas.completion import QuestCompletedOut
from app.schemas.quests import QuestOut, QuestsOut
from app.services import gems_service
from app.services.context import RequestContext


@dataclass(frozen=True)
class _TodaysQuest:
    """One of today's quests: its catalogue row (for its id) and where it stands."""

    row: Quest
    progress: QuestProgress


def todays_view(db: Session, ctx: RequestContext) -> QuestsOut:
    """Today's three quests with their progress; `completed` means the reward was already paid."""
    claimed = gamification_repo.claimed_quest_ids(db, ctx.user.id, ctx.today)
    quests_today = [
        QuestOut(
            code=quest.row.code,
            slot=quest.row.slot,
            title=quest.progress.title,
            icon=QuestIcon(quest.row.icon),
            progress=quest.progress.progress,
            target=quest.progress.target,
            reward_gems=quest.row.reward_gems,
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
        gems_service.credit(
            db, ctx.user.id, quest.row.reward_gems, GemReason.QUEST, now=ctx.now, quest_claim_id=claim.id
        )
        paid.append(
            QuestCompletedOut(
                code=quest.row.code, title=quest.progress.title, reward_gems=quest.row.reward_gems
            )
        )
    return paid


def _todays_quests(db: Session, ctx: RequestContext) -> list[_TodaysQuest]:
    """The learner's quests for today, in slot order, measured against today's XP lines."""
    rows = {row.code: row for row in gamification_repo.quests(db)}
    picked = quests.todays_quests(ctx.user.id, ctx.today, [_definition(row) for row in rows.values()])
    lines = ledger_repo.xp_lines_on(db, ctx.user.id, ctx.today)
    metrics = quests.quest_metrics(
        EarnedXp(line.session_id, line.reason, line.amount, line.mistakes, line.best_combo) for line in lines
    )
    goal = ctx.preferences.daily_goal_xp
    return [_TodaysQuest(rows[quest.code], quests.quest_progress(quest, metrics, goal)) for quest in picked]


def _definition(row: Quest) -> QuestDef:
    return QuestDef(
        code=row.code,
        slot=row.slot,
        title_template=row.title_template,
        metric=row.metric,
        target=row.target,
        reward_gems=row.reward_gems,
        icon=QuestIcon(row.icon),
    )
