"""Sessions: starting or resuming one, its item queue, answering items and quitting."""

from datetime import datetime
from typing import Annotated, Literal, Self

from pydantic import Field, model_validator
from pydantic_core import PydanticCustomError

from app.domain.enums import (
    EndReason,
    ExerciseType,
    GradeNote,
    ItemLabel,
    ItemOrigin,
    ItemResult,
    NodeKind,
    RetryPolicy,
    SessionKind,
    SessionStatus,
    UnitColor,
)
from app.schemas.base import ApiModel
from app.schemas.common import HeartsOut
from app.schemas.exercises import ExerciseOut

# A lesson at 0 hearts is blocked rather than ended: a refill purchase continues it.
BlockedReason = Literal["OUT_OF_HEARTS"]

_NODE_REQUIRED = frozenset({SessionKind.LESSON, SessionKind.LEGENDARY})


class StartSessionIn(ApiModel):
    """Start a session, or resume the active one when the kind and node match."""

    kind: SessionKind
    node_id: int | None = None  # required for lesson and legendary, forbidden for timed practice

    @model_validator(mode="after")
    def _node_matches_kind(self) -> Self:
        if self.kind in _NODE_REQUIRED and self.node_id is None:
            raise PydanticCustomError(
                "node_required", "A {kind} session needs a nodeId", {"kind": str(self.kind)}
            )
        if self.kind is SessionKind.TIMED and self.node_id is not None:
            raise PydanticCustomError("node_forbidden", "Timed practice takes no nodeId")
        return self


# ---- the session view ----


class SessionItemOut(ApiModel):
    """One attempt in the queue. `result` and `note` are filled once it is answered."""

    id: int
    seq: int
    origin: ItemOrigin
    label: ItemLabel | None
    result: ItemResult | None
    note: GradeNote | None
    exercise: ExerciseOut


class SessionNodeRef(ApiModel):
    """The path node a session plays."""

    id: int
    kind: NodeKind
    title: str
    unit_id: int
    unit_number: int
    unit_color: UnitColor


class SessionLessonRef(ApiModel):
    """Which lesson of its node a lesson session is ("Lesson 2 of 3")."""

    id: int
    number: int
    count: int


class SessionRules(ApiModel):
    """How this kind of session plays: hearts, retries, hints and the mistake limit."""

    hearts_enabled: bool
    retry_policy: RetryPolicy
    hints_enabled: bool
    max_mistakes: int | None


class TimerOut(ApiModel):
    """Timed practice's moving deadline. Each correct answer adds its type's bonus seconds."""

    start_seconds: int
    # Keyed by exercise type; the keys stay snake_case, as only field names are camelCased.
    bonus_seconds: dict[ExerciseType, int]
    expires_at: datetime


class LivesOut(ApiModel):
    """A legendary run's lives, shown instead of hearts."""

    max: int
    left: int


class ProgressOut(ApiModel):
    """The progress bar: resolved exercises (correct answers in timed practice) out of the total."""

    completed: int
    total: int


class SessionOut(ApiModel):
    """A whole session, enough to render the lesson player and to resume it after a refresh."""

    id: int
    kind: SessionKind
    status: SessionStatus
    end_reason: EndReason | None
    resumed: bool
    node: SessionNodeRef | None
    lesson: SessionLessonRef | None
    rules: SessionRules
    timer: TimerOut | None
    started_at: datetime
    server_now: datetime
    hearts: HeartsOut
    lives: LivesOut | None
    progress: ProgressOut
    mistakes: int
    combo: int
    best_combo: int
    current_item_id: int | None  # the lowest unanswered item
    blocked_reason: BlockedReason | None
    can_complete: bool
    items: list[SessionItemOut]


# ---- answering ----

AnswerText = Annotated[str, Field(min_length=1, max_length=200)]


class MultipleChoiceAnswer(ApiModel):
    """The option the learner picked."""

    type: Literal["multiple_choice"]
    option_id: int


class FillBlankAnswer(ApiModel):
    """The option the learner put in the blank."""

    type: Literal["fill_blank"]
    option_id: int


class TranslateAnswer(ApiModel):
    """Word-bank tiles in answer order, or typed text ("USE KEYBOARD"): exactly one of the two."""

    type: Literal["translate"]
    tile_ids: list[int] | None = Field(default=None, min_length=1)
    text: AnswerText | None = None

    @model_validator(mode="after")
    def _exactly_one_answer(self) -> Self:
        if (self.tile_ids is None) == (self.text is None):
            raise PydanticCustomError("tiles_or_text", "Send exactly one of tileIds or text")
        return self


class MatchPairIn(ApiModel):
    """One matched pair; it is right when both ids are the same."""

    left_id: int
    right_id: int


class MatchPairsAnswer(ApiModel):
    """The final matching. `mistakes` counts the red taps along the way: it is kept with the stored
    answer as a record, but neither grading nor any statistic uses it, and it costs no heart."""

    type: Literal["match_pairs"]
    pairs: list[MatchPairIn]
    mistakes: int = Field(ge=0)


class TypeAnswerAnswer(ApiModel):
    """The typed answer."""

    type: Literal["type_answer"]
    text: AnswerText


class SkipAnswer(ApiModel):
    """Skip the exercise; it counts as a wrong answer."""

    type: Literal["skip"]


class CantListenAnswer(ApiModel):
    """The "Can't listen now" button: resolves every unanswered listening item with no penalty."""

    type: Literal["cant_listen"]


AnswerIn = Annotated[
    MultipleChoiceAnswer
    | FillBlankAnswer
    | TranslateAnswer
    | MatchPairsAnswer
    | TypeAnswerAnswer
    | SkipAnswer
    | CantListenAnswer,
    Field(discriminator="type"),
]


class SessionStateOut(ApiModel):
    """The session after an answer: whether it ended, is blocked or can be completed."""

    status: SessionStatus
    end_reason: EndReason | None
    blocked_reason: BlockedReason | None
    can_complete: bool
    current_item_id: int | None
    lives_left: int | None
    expires_at: datetime | None


class AnswerResultOut(ApiModel):
    """The grade of one answer, for the feedback bar, and the session after it.

    A replay (the same answer sent again) repeats the verdict: result, note, correctAnswer, meaning,
    heartLost and appendedItem. Hearts, progress, combos and `session` show the session as it is now.
    """

    item_id: int
    replayed: bool
    result: ItemResult
    is_correct: bool
    note: GradeNote | None
    correct_answer: str | None
    meaning: str | None  # the English meaning under a listening exercise
    heart_lost: bool
    hearts: HeartsOut
    progress: ProgressOut
    mistakes: int
    combo: int
    best_combo: int
    appended_item: SessionItemOut | None  # the retry queued by this answer
    session: SessionStateOut


class QuitOut(ApiModel):
    """A session ended early. The outcome is decided by the server; quitting twice replays it."""

    session_id: int
    status: SessionStatus
    end_reason: EndReason
    replayed: bool
    hearts: HeartsOut
