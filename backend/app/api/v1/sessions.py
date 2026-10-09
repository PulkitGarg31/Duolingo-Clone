"""The lesson loop: start or resume a session, answer items, complete or quit."""

from typing import Annotated

from fastapi import APIRouter, Request, Response, status

from app.api.deps import CtxDep, DbDep, id_path
from app.api.problems import problem_responses
from app.schemas.completion import CompletionOut
from app.schemas.sessions import AnswerIn, AnswerResultOut, QuitOut, SessionOut, StartSessionIn
from app.services import me_service, session_service

router = APIRouter(tags=["sessions"])

SessionId = Annotated[int, id_path("sessionId")]
ItemId = Annotated[int, id_path("itemId")]


@router.post(
    "/sessions",
    response_model=SessionOut,
    status_code=status.HTTP_201_CREATED,
    operation_id="startSession",
    summary="Start or resume a session",
    responses={
        status.HTTP_200_OK: {
            "model": SessionOut,
            "description": "The active session of the same kind and node",
        },
        **problem_responses(403, 404, 409, 422),
    },
)
def start_session(
    body: StartSessionIn, request: Request, response: Response, db: DbDep, ctx: CtxDep
) -> SessionOut:
    """Start a lesson, practice, legendary run or timed practice (201). An active session of the same
    kind and node is resumed instead (200); any other active session is superseded."""
    result, created = session_service.start(db, ctx, body)
    db.commit()
    if created:
        response.headers["Location"] = request.app.url_path_for("get_session", sessionId=result.id)
    else:
        response.status_code = status.HTTP_200_OK
    return result


@router.get(
    "/sessions/{sessionId}",
    response_model=SessionOut,
    operation_id="getSession",
    summary="A session",
    responses=problem_responses(403, 404, 422),
)
def get_session(session_id: SessionId, db: DbDep, ctx: CtxDep) -> SessionOut:
    """The whole session, so a refreshed page resumes at its current item."""
    return session_service.get(db, ctx, session_id)


@router.put(
    "/sessions/{sessionId}/items/{itemId}/answer",
    response_model=AnswerResultOut,
    operation_id="submitAnswer",
    summary="Answer an item",
    responses=problem_responses(403, 404, 409, 422),
)
def submit_answer(
    session_id: SessionId, item_id: ItemId, body: AnswerIn, db: DbDep, ctx: CtxDep
) -> AnswerResultOut:
    """Grade one answer. Sending the same answer again replays the verdict; a different one is refused."""
    result = session_service.answer(db, ctx, session_id, item_id, body)
    db.commit()
    return result


@router.post(
    "/sessions/{sessionId}/complete",
    response_model=CompletionOut,
    operation_id="completeSession",
    summary="Complete a session",
    responses=problem_responses(403, 404, 409, 422),
)
def complete_session(session_id: SessionId, db: DbDep, ctx: CtxDep) -> CompletionOut:
    """Pay the session's rewards and return the receipt; completing again replays it. The learner's
    state (`me`) is built after the commit, so it is always fresh."""
    completion = session_service.complete(db, ctx, session_id)
    db.commit()
    me = me_service.build_me(db, ctx, completion.league_week)
    return CompletionOut(**completion.receipt.model_dump(), me=me)


@router.post(
    "/sessions/{sessionId}/quit",
    response_model=QuitOut,
    operation_id="quitSession",
    summary="Quit a session",
    responses=problem_responses(403, 404, 422),
)
def quit_session(session_id: SessionId, db: DbDep, ctx: CtxDep) -> QuitOut:
    """End a session early, with no XP; the server decides the outcome. Quitting again replays it."""
    result = session_service.quit_session(db, ctx, session_id)
    db.commit()
    return result
