"""Demo tools: the learner's own clock, learner tweaks and the reset of the learner's data.

Every tool acts on the caller alone, so each account is a sandbox. The routes are always mounted;
`require_dev_tools` answers 403 when the tools are switched off. A route that moves the clock
reports the new instant in the X-Server-Time header.
"""

from fastapi import APIRouter, Depends, Request

from app.api.deps import CtxDep, DbDep, require_dev_tools
from app.api.problems import problem_responses
from app.schemas.dev import ClockAdvanceIn, ClockChangeOut, ClockOut, DevLearnerPatchIn, DevResetOut
from app.schemas.me import MeOut
from app.services import dev_service, me_service

router = APIRouter(
    prefix="/dev",
    tags=["dev"],
    dependencies=[Depends(require_dev_tools)],
    responses=problem_responses(403, 404),
)


@router.get("/clock", response_model=ClockOut, operation_id="getDevClock", summary="The learner's clock")
def get_clock(ctx: CtxDep) -> ClockOut:
    """Real time, the learner's forward-only offset and the simulated time in their zone."""
    return dev_service.clock(ctx.user, ctx.now)


@router.post(
    "/clock/advance",
    response_model=ClockChangeOut,
    operation_id="advanceDevClock",
    summary="Move time forward",
    responses=problem_responses(422),
)
def advance_clock(body: ClockAdvanceIn, request: Request, db: DbDep, ctx: CtxDep) -> ClockChangeOut:
    """Move the learner's time forward by 1 minute to 60 days, then report what catching up changed."""
    return _commit_jump(request, db, dev_service.advance(db, ctx, body))


@router.post(
    "/clock/next-day", response_model=ClockChangeOut, operation_id="devNextDay", summary="Go to tomorrow"
)
def next_day(request: Request, db: DbDep, ctx: CtxDep) -> ClockChangeOut:
    """Jump just past the learner's next local midnight."""
    return _commit_jump(request, db, dev_service.next_day(db, ctx))


@router.post(
    "/clock/next-week",
    response_model=ClockChangeOut,
    operation_id="devNextWeek",
    summary="End the league week",
)
def next_week(request: Request, db: DbDep, ctx: CtxDep) -> ClockChangeOut:
    """Jump just past next Monday 00:00 UTC, which finalizes the league week."""
    return _commit_jump(request, db, dev_service.next_week(db, ctx))


@router.patch(
    "/learner",
    response_model=MeOut,
    operation_id="patchDevLearner",
    summary="Set hearts or gems",
    responses=problem_responses(422),
)
def patch_learner(body: DevLearnerPatchIn, db: DbDep, ctx: CtxDep) -> MeOut:
    """Set the learner's hearts and/or gems for a demo; gems still go through the gem ledger."""
    dev_service.patch_learner(db, ctx, body)
    db.commit()
    return me_service.build_me(db, ctx)


@router.post("/reset", response_model=DevResetOut, operation_id="resetDemo", summary="Reset my progress")
def reset_demo(request: Request, db: DbDep, ctx: CtxDep) -> DevResetOut:
    """Start the caller over with their clock back on real time: the demo learner gets the sample
    history again, any other account a new account's start. Nobody else is touched. The answer holds
    the caller's state after the reset."""
    reset = dev_service.reset(db, ctx)
    db.commit()
    request.state.now = reset.ctx.now
    return DevResetOut(seeded_at=reset.seeded_at, me=me_service.build_me(db, reset.ctx))


def _commit_jump(request: Request, db: DbDep, jump: dev_service.ClockJump) -> ClockChangeOut:
    """Commit a clock jump and report the new instant in the X-Server-Time header."""
    db.commit()
    request.state.now = jump.now
    return jump.change
