"""Tiny builders for tests: learners, a small course, and the catalogues the services read.

They insert rows directly (no service runs), flush, and return what a test needs. On the seeded
demo, `add_learner` adds a second human for proving per-user isolation with X-User-Id; on an empty
database, `add_catalog` and `add_mini_course` give the services a small world to work in.
"""

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domain.enums import (
    ExerciseType,
    GemReason,
    NodeKind,
    QuestIcon,
    QuestMetric,
    ShopItemKind,
    ShopSection,
    TextLang,
    UnitColor,
)
from app.domain.rules import LEAGUE_TIERS, MAX_HEARTS
from app.models import (
    Course,
    Exercise,
    ExerciseAnswer,
    ExerciseOption,
    ExercisePair,
    GemTransaction,
    GlossaryTerm,
    League,
    Lesson,
    PathNode,
    Quest,
    ShopItem,
    Unit,
    User,
    UserSettings,
    UserStats,
)

LEAGUE_COLORS = (
    "#D4A880",
    "#C9D6E2",
    "#FCD440",
    "#34B8F4",
    "#FC6060",
    "#88CC1C",
    "#CE82FF",
    "#FFAADE",
    "#4B4B57",
    "#38D0D0",
)


# ---- people ----


def add_learner(
    db: Session,
    *,
    username: str,
    joined_at: datetime,
    timezone: str = "Asia/Kolkata",
    gems: int = 0,
    hearts: int = MAX_HEARTS,
) -> User:
    """A human learner of the first course: default settings, no streak, Bronze, and `gems` recorded
    in the gem ledger so the cached balance matches it."""
    learner = User(
        username=username,
        display_name=username.title(),
        avatar_color="#58CC02",
        timezone=timezone,
        timezone_confirmed=True,
        current_course_id=_first_course_id(db),
        joined_at=joined_at,
        settings=UserSettings(updated_at=joined_at),
        stats=UserStats(
            gems=gems,
            hearts=hearts,
            hearts_regen_anchor_at=None if hearts == MAX_HEARTS else joined_at,
            updated_at=joined_at,
        ),
    )
    db.add(learner)
    db.flush()
    if gems:
        db.add(
            GemTransaction(
                user_id=learner.id,
                delta=gems,
                balance_after=gems,
                reason=GemReason.SEED,
                created_at=joined_at,
            )
        )
        db.flush()
    return learner


# ---- catalogues ----


def add_catalog(db: Session) -> None:
    """The ten league tiers, the four shop items and the nine daily quests (no achievements)."""
    db.add_all(
        League(
            tier=row.tier,
            name=row.name,
            color=color,
            promote_count=row.promote_count,
            demote_count=row.demote_count,
        )
        for row, color in zip(LEAGUE_TIERS, LEAGUE_COLORS, strict=True)
    )
    db.add_all(
        [
            _shop_item(1, "heart_refill", ShopItemKind.HEART_REFILL, ShopSection.HEARTS, 350),
            _shop_item(2, "unlimited_hearts", ShopItemKind.SUPER, ShopSection.HEARTS, 0, available=False),
            _shop_item(3, "streak_freeze", ShopItemKind.STREAK_FREEZE, ShopSection.POWER_UPS, 200),
            _shop_item(4, "xp_boost_15", ShopItemKind.XP_BOOST, ShopSection.POWER_UPS, 100, minutes=15),
        ]
    )
    quests = [
        ("daily_goal", 1, "Earn {n} XP", QuestMetric.DAILY_GOAL_XP, None, 10, QuestIcon.BOLT),
        ("lessons_2", 2, "Complete {n} lessons", QuestMetric.LESSONS, 2, 10, QuestIcon.BOOK),
        ("perfect_1", 2, "Complete {n} perfect lesson", QuestMetric.PERFECT_LESSONS, 1, 10, QuestIcon.TARGET),
        ("combo_10", 2, "Earn {n} Combo Bonus XP", QuestMetric.COMBO_XP, 10, 10, QuestIcon.FLAME),
        (
            "streak5_2",
            2,
            "Get 5 in a row correct in {n} lessons",
            QuestMetric.STREAK5_LESSONS,
            2,
            10,
            QuestIcon.FLAME,
        ),
        ("lessons_3", 3, "Complete {n} lessons", QuestMetric.LESSONS, 3, 15, QuestIcon.BOOK),
        (
            "perfect_3",
            3,
            "Complete {n} perfect lessons",
            QuestMetric.PERFECT_LESSONS,
            3,
            15,
            QuestIcon.TARGET,
        ),
        ("combo_20", 3, "Earn {n} Combo Bonus XP", QuestMetric.COMBO_XP, 20, 15, QuestIcon.FLAME),
        (
            "streak5_4",
            3,
            "Get 5 in a row correct in {n} lessons",
            QuestMetric.STREAK5_LESSONS,
            4,
            15,
            QuestIcon.FLAME,
        ),
    ]
    db.add_all(
        Quest(
            code=code,
            slot=slot,
            title_template=title,
            metric=metric,
            target=target,
            reward_gems=reward,
            icon=icon.value,
            position=position,
        )
        for position, (code, slot, title, metric, target, reward, icon) in enumerate(quests, start=1)
    )
    db.flush()


def _shop_item(
    position: int,
    code: str,
    kind: ShopItemKind,
    section: ShopSection,
    price: int,
    *,
    available: bool = True,
    minutes: int | None = None,
) -> ShopItem:
    return ShopItem(
        code=code,
        kind=kind,
        section=section,
        name=code.replace("_", " ").title(),
        description=f"The {code.replace('_', ' ')}.",
        price_gems=price,
        duration_minutes=minutes,
        is_available=available,
        position=position,
    )


# ---- content ----


@dataclass(frozen=True)
class MiniCourse:
    """The ids of a one-unit course: a two-lesson skill, a chest and a one-lesson review."""

    course_id: int
    skill_id: int
    chest_id: int
    review_id: int


def add_mini_course(db: Session) -> MiniCourse:
    """A Spanish course with one unit: skill (2 lessons) -> chest (20 gems) -> review (1 lesson).

    Every lesson holds one exercise of each of the five types, the last one a listening exercise.
    """
    course = Course(
        slug="es-en",
        title="Spanish",
        learning_language="es",
        from_language="en",
        tts_locale="es-ES",
        flag_key="es",
        is_published=True,
        position=1,
    )
    unit = Unit(position=1, title="Greet people", description="Say hello", color=UnitColor.GREEN)
    skill = PathNode(position=1, key="mini.hello", kind=NodeKind.SKILL, title="Say hello")
    chest = PathNode(position=2, key="mini.chest", kind=NodeKind.CHEST, title="Treasure chest", chest_gems=20)
    review = PathNode(position=3, key="mini.review", kind=NodeKind.REVIEW, title="Unit 1 review")
    skill.lessons = [_lesson(skill.key, 1), _lesson(skill.key, 2)]
    review.lessons = [_lesson(review.key, 1)]
    unit.nodes = [skill, chest, review]
    course.units = [unit]
    db.add(course)
    db.flush()
    db.add_all(
        GlossaryTerm(course_id=course.id, node_id=skill.id, language=TextLang.ES, term=term, hint=hint)
        for term, hint in (
            ("hola", "hello"),
            ("agua", "water"),
            ("bebo", "I drink"),
            ("buenas noches", "good night"),
        )
    )
    db.flush()
    return MiniCourse(course.id, skill.id, chest.id, review.id)


def _lesson(node_key: str, position: int) -> Lesson:
    """One exercise of each type: picture choice, translation, match pairs, fill-in and listening."""
    key = f"{node_key}.l{position}"
    return Lesson(
        position=position,
        exercises=[
            Exercise(
                position=1,
                key=f"{key}.e1",
                type=ExerciseType.MULTIPLE_CHOICE,
                instruction="Which one of these is “the water”?",
                is_new_word=True,
                options=[
                    ExerciseOption(position=1, text="el agua", image_key="water", is_correct=True),
                    ExerciseOption(position=2, text="la leche", image_key="milk"),
                    ExerciseOption(position=3, text="el pan", image_key="bread"),
                ],
            ),
            Exercise(
                position=2,
                key=f"{key}.e2",
                type=ExerciseType.TRANSLATE,
                instruction="Write this in English",
                text="Yo bebo agua.",
                text_language=TextLang.ES,
                options=[
                    ExerciseOption(position=n, text=text)
                    for n, text in enumerate(("water", "I", "milk", "drink", "eat"), start=1)
                ],
                answers=[
                    ExerciseAnswer(text="I drink water.", is_primary=True),
                    ExerciseAnswer(text="I am drinking water."),
                ],
            ),
            Exercise(
                position=3,
                key=f"{key}.e3",
                type=ExerciseType.MATCH_PAIRS,
                instruction="Tap the matching pairs",
                pairs=[
                    ExercisePair(position=n, learning_text=es, native_text=en)
                    for n, (es, en) in enumerate(
                        (("hola", "hello"), ("agua", "water"), ("pan", "bread")), start=1
                    )
                ],
            ),
            Exercise(
                position=4,
                key=f"{key}.e4",
                type=ExerciseType.FILL_BLANK,
                instruction="Fill in the blank",
                text="Yo ___ agua.",
                text_language=TextLang.ES,
                text_translation="I drink water.",
                options=[
                    ExerciseOption(position=1, text="bebo", is_correct=True),
                    ExerciseOption(position=2, text="bebes"),
                    ExerciseOption(position=3, text="beber"),
                ],
            ),
            Exercise(
                position=5,
                key=f"{key}.e5",
                type=ExerciseType.TYPE_ANSWER,
                instruction="Type what you hear",
                text="Buenas noches.",
                text_language=TextLang.ES,
                text_translation="Good night.",
                audio_only=True,
                answers=[ExerciseAnswer(text="Buenas noches.", is_primary=True)],
            ),
        ],
    )


def _first_course_id(db: Session) -> int:
    course_id = db.scalar(select(Course.id).order_by(Course.position).limit(1))
    if course_id is None:
        raise LookupError("add a course before adding users")
    return course_id
