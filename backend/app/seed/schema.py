"""The shapes of the seed files, and the content rules about each record in them.

Every JSON file in `data/` parses into one of the `*File` models below. Exercises and history steps
are discriminated unions on their `type` and `kind`. Each model's validators check the rules that
concern that record alone (an exercise, a lesson, a node, the catalogue...); the rules that span
files live in `app.seed.validate`, which also turns every problem into a line with its JSON path.
"""

import re
from collections import Counter
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import time
from itertools import pairwise
from types import MappingProxyType
from typing import Annotated, Final, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, PositiveInt, field_validator, model_validator
from pydantic.alias_generators import to_camel

from app.domain.enums import (
    AchievementCode,
    AchievementMetric,
    ExerciseType,
    NodeKind,
    QuestIcon,
    QuestMetric,
    ShopItemCode,
    ShopItemKind,
    ShopSection,
    TextLang,
    UnitColor,
)
from app.domain.grading import BLANK, answer_language, normalize
from app.domain.rules import (
    BOT_POOL_SIZE,
    DAILY_GOAL_OPTIONS,
    LEAGUE_TIERS,
    LEGENDARY_MAX_MISTAKES,
    MAX_HEARTS,
)
from app.seed.illustrations import ILLUSTRATION_KEYS

# The sample learner joined at noon, local time, `joinedDaysAgo` days before the seed day.
JOIN_TIME: Final = time(12, 0)
# Word-bank tiles are the primary answer's words with this punctuation removed from either end.
TILE_EDGE_PUNCTUATION: Final = ".,!?¿¡;:"

# Inclusive (fewest, most) counts.
MULTIPLE_CHOICE_OPTIONS: Final = (3, 4)
FILL_BLANK_OPTIONS: Final = (2, 4)
WORD_BANK_TILES: Final = (4, 12)
MATCH_PAIRS: Final = (3, 5)
LESSON_EXERCISES: Final = (5, 8)
SKILL_LESSONS: Final = (2, 3)
REVIEW_EXERCISES: Final = 8
MIN_EXERCISE_TYPES: Final = 4  # every lesson mixes at least four of the five exercise types


@dataclass(frozen=True)
class PaceClass:
    """How many bots of one pace the pool holds, and the daily XP range of that pace."""

    count: int
    min_daily_xp: int
    max_daily_xp: int


# The seeded league result depends on these classes: any 29 of the 35 bots include at least 10
# light bots, and a light bot's Bronze week always stays below the sample learner's.
PACE_CLASSES: Final = MappingProxyType(
    {"light": PaceClass(16, 4, 10), "medium": PaceClass(13, 20, 45), "heavy": PaceClass(6, 60, 110)}
)

Pace = Literal["light", "medium", "heavy"]
Text = Annotated[str, Field(min_length=1)]
HexColor = Annotated[str, Field(pattern=r"^#[0-9A-Fa-f]{6}$")]


class SeedModel(BaseModel):
    """Base of every seed-file model: camelCase keys, no unknown keys, immutable once loaded."""

    model_config = ConfigDict(alias_generator=to_camel, extra="forbid", frozen=True)


# ---- helpers shared by the validators ----


def answer_tiles(answer: str) -> list[str]:
    """The word-bank tiles that spell an answer: its words, without punctuation at either end."""
    words = (word.strip(TILE_EDGE_PUNCTUATION) for word in answer.split())
    return [word for word in words if word]


def _raise_if(problems: list[str]) -> None:
    """A record may break several rules at once: report them together."""
    if problems:
        raise ValueError("; ".join(problems))


def _count_problem(what: str, count: int, bounds: tuple[int, int]) -> list[str]:
    """A problem unless `count` lies within the inclusive bounds."""
    fewest, most = bounds
    return [] if fewest <= count <= most else [f"needs {fewest} to {most} {what}, has {count}"]


def _one_correct_problem(correct_flags: Iterable[bool]) -> list[str]:
    """A problem unless exactly one option is marked correct."""
    correct = sum(correct_flags)
    return [] if correct == 1 else [f"needs exactly one correct option, has {correct}"]


def _repeat_problem(what: str, values: Iterable[str]) -> list[str]:
    """A problem naming the values that appear more than once, if any."""
    repeated = [value for value, count in Counter(values).items() if count > 1]
    return [f"{what} repeat: {', '.join(repeated)}"] if repeated else []


def _accepted_answer_problems(answers: Sequence[str], lang: TextLang) -> list[str]:
    """At least one accepted answer, and no two that the grader would read as the same answer."""
    if not answers:
        return ["needs at least one accepted answer"]
    return _repeat_problem("accepted answers (after normalization)", (normalize(a, lang) for a in answers))


def _template_problem(field: str, template: str) -> list[str]:
    """A template may only use the {n} placeholder."""
    try:
        template.format(n=1)
    except (KeyError, IndexError, ValueError):
        return [f"{field} may only use the {{n}} placeholder"]
    return []


# ---- unit files: exercises ----


class PictureChoiceSeed(SeedModel):
    """A multiple-choice option; `image` names a picture card."""

    text: Text
    image: str | None = None
    correct: bool = False


class ChoiceSeed(SeedModel):
    """A fill-in-the-blank option."""

    text: Text
    correct: bool = False


class _ExerciseSeed(SeedModel):
    """What every exercise has: its heading, and whether it introduces a new word."""

    instruction: Text
    new_word: bool = False  # NEW WORD label in lessons


class MultipleChoiceSeed(_ExerciseSeed):
    """Pick a meaning: picture cards (no sentence), or a list of translations of `text`."""

    type: Literal[ExerciseType.MULTIPLE_CHOICE]
    text: Text | None = None
    lang: TextLang | None = None
    options: list[PictureChoiceSeed]

    @model_validator(mode="after")
    def _check_options(self) -> Self:
        """3 to 4 options, exactly one correct, distinct texts, and registered pictures on all or none."""
        problems = [] if (self.text is None) == (self.lang is None) else ["text and lang go together"]
        problems += _count_problem("options", len(self.options), MULTIPLE_CHOICE_OPTIONS)
        problems += _one_correct_problem(option.correct for option in self.options)
        problems += _repeat_problem("option texts", (option.text.casefold() for option in self.options))
        images = [option.image for option in self.options if option.image is not None]
        if images and len(images) != len(self.options):
            problems.append("give every option an image, or none")
        unknown = [image for image in images if image not in ILLUSTRATION_KEYS]
        if unknown:
            problems.append(f"unknown picture keys: {', '.join(unknown)}")
        _raise_if(problems)
        return self


class TranslateSeed(_ExerciseSeed):
    """Translate `text`, written in `lang`, with the word bank or the keyboard."""

    type: Literal[ExerciseType.TRANSLATE]
    text: Text
    lang: TextLang
    answers: list[Text]  # the first is the primary answer, which the word bank spells
    distractors: list[Text] = []

    @model_validator(mode="after")
    def _check_word_bank(self) -> Self:
        """Distinct answers, and 4 to 12 tiles where no distractor is a word of the primary answer."""
        answer_lang = answer_language(self.lang, audio_only=False)
        problems = _accepted_answer_problems(self.answers, answer_lang)
        if self.answers:
            tiles = answer_tiles(self.answers[0])
            words = {normalize(tile, answer_lang) for tile in tiles}
            clashing = [d for d in self.distractors if normalize(d, answer_lang) in words]
            if clashing:
                problems.append(f"distractors must not be words of the primary answer: {', '.join(clashing)}")
            tile_count = len(tiles) + len(self.distractors)
            problems += _count_problem(
                "word-bank tiles (answer words and distractors)", tile_count, WORD_BANK_TILES
            )
        _raise_if(problems)
        return self


class MatchPairsSeed(_ExerciseSeed):
    """Match each Spanish text with its English meaning."""

    type: Literal[ExerciseType.MATCH_PAIRS]
    pairs: list[tuple[Text, Text]]  # (learning language, native language)

    @model_validator(mode="after")
    def _check_pairs(self) -> Self:
        """3 to 5 pairs, and each text appears once on its side."""
        problems = _count_problem("pairs", len(self.pairs), MATCH_PAIRS)
        problems += _repeat_problem("left sides", (left.casefold() for left, _ in self.pairs))
        problems += _repeat_problem("right sides", (right.casefold() for _, right in self.pairs))
        _raise_if(problems)
        return self


class FillBlankSeed(_ExerciseSeed):
    """Choose the word that fills the one blank in `text`."""

    type: Literal[ExerciseType.FILL_BLANK]
    text: Text
    lang: TextLang
    translation: Text  # the meaning line under the sentence
    options: list[ChoiceSeed]

    @model_validator(mode="after")
    def _check_blank(self) -> Self:
        """Exactly one blank in the sentence, and 2 to 4 options with exactly one correct."""
        problems = [] if self.text.count(BLANK) == 1 else [f'text must contain exactly one "{BLANK}"']
        problems += _count_problem("options", len(self.options), FILL_BLANK_OPTIONS)
        problems += _one_correct_problem(option.correct for option in self.options)
        _raise_if(problems)
        return self


class TypeAnswerSeed(_ExerciseSeed):
    """Type a translation of `text`, or, with `audioOnly`, type the Spanish sentence you hear."""

    type: Literal[ExerciseType.TYPE_ANSWER]
    text: Text
    lang: TextLang
    answers: list[Text]
    audio_only: bool = False
    translation: Text | None = None  # the meaning shown under a listening exercise

    @model_validator(mode="after")
    def _check_answers(self) -> Self:
        """Distinct answers; a listening exercise speaks Spanish, has a translation, accepts what it says."""
        answer_lang = answer_language(self.lang, audio_only=self.audio_only)
        problems = _accepted_answer_problems(self.answers, answer_lang)
        if self.audio_only:
            if self.lang != TextLang.ES:
                problems.append("a listening exercise speaks Spanish: lang must be es")
            if self.translation is None:
                problems.append("a listening exercise needs a translation")
            heard = normalize(self.text, self.lang)
            misheard = [answer for answer in self.answers if normalize(answer, self.lang) != heard]
            if misheard:
                problems.append(f"a listening exercise only accepts its own text, not: {', '.join(misheard)}")
        _raise_if(problems)
        return self


ExerciseSeed = Annotated[
    MultipleChoiceSeed | TranslateSeed | MatchPairsSeed | FillBlankSeed | TypeAnswerSeed,
    Field(discriminator="type"),
]


# ---- unit files: lessons, nodes, guidebook, glossary ----


class LessonSeed(SeedModel):
    """One lesson's exercises, in play order."""

    exercises: list[ExerciseSeed]

    @model_validator(mode="after")
    def _check_mix(self) -> Self:
        """5 to 8 exercises, of at least four different types."""
        problems = _count_problem("exercises", len(self.exercises), LESSON_EXERCISES)
        types = {exercise.type for exercise in self.exercises}
        if len(types) < MIN_EXERCISE_TYPES:
            problems.append(f"needs at least {MIN_EXERCISE_TYPES} different exercise types, has {len(types)}")
        _raise_if(problems)
        return self


class NodeSeed(SeedModel):
    """A stop on the path: a skill (2 to 3 lessons), a treasure chest (gems) or the unit review."""

    key: Text  # a stable id such as 'u1.hello', used by the glossary and the history script
    kind: NodeKind
    title: Text
    lessons: list[LessonSeed] = []
    chest_gems: int | None = None

    @model_validator(mode="after")
    def _check_kind(self) -> Self:
        """A chest holds gems and no lessons, a skill 2 to 3 lessons, a review one lesson of 8 exercises."""
        problems: list[str] = []
        if self.kind == NodeKind.CHEST:
            if self.chest_gems is None or self.chest_gems <= 0:
                problems.append("a chest needs chestGems above 0")
            if self.lessons:
                problems.append("a chest has no lessons")
        elif self.chest_gems is not None:
            problems.append(f"only a chest has chestGems, not a {self.kind}")
        if self.kind == NodeKind.SKILL:
            problems += _count_problem("lessons", len(self.lessons), SKILL_LESSONS)
        if self.kind == NodeKind.REVIEW:
            if len(self.lessons) != 1:
                problems.append(f"a review has exactly 1 lesson, has {len(self.lessons)}")
            elif len(self.lessons[0].exercises) != REVIEW_EXERCISES:
                problems.append(f"a review lesson has exactly {REVIEW_EXERCISES} exercises")
        _raise_if(problems)
        return self


class KeyPhraseSeed(SeedModel):
    """A Guidebook key phrase and its translation."""

    text: Text
    translation: Text


# Guidebook tips use a small Markdown subset: "## " headings, paragraphs, **bold**, "- " bullets and
# "> " callouts. Each pattern finds a construct outside that subset.
_OUTSIDE_MARKDOWN_SUBSET: Final = (
    (re.compile(r"^#(?!# [^#\s])"), "headings must be level 2 ('## ')"),
    (re.compile(r"^\s*\|"), "tables are not supported"),
    (re.compile(r"\[[^\]]*\]\([^)]*\)"), "links and images are not supported"),
    (re.compile(r"</?[A-Za-z!][^>]*>"), "HTML is not supported"),
    (re.compile(r"`"), "code is not supported"),
    (re.compile(r"^\s*\d+[.)]\s"), "numbered lists are not supported, use '- ' bullets"),
    (re.compile(r"^\s*[*+]\s"), "bullets must start with '- '"),
    (re.compile(r"^\s+\S"), "lines must not be indented"),
)


def markdown_problems(text: str) -> list[str]:
    """The constructs of `text` that fall outside the Guidebook's Markdown subset, line by line."""
    problems = []
    for number, line in enumerate(text.split("\n"), start=1):
        problems += [
            f"line {number}: {why}" for pattern, why in _OUTSIDE_MARKDOWN_SUBSET if pattern.search(line)
        ]
        if line.count("**") % 2 or "*" in line.replace("**", ""):
            problems.append(f"line {number}: only balanced **bold** emphasis is supported")
    return problems


class GuidebookSeed(SeedModel):
    """A unit's Guidebook: key phrases, and optional tips in the Markdown subset."""

    key_phrases: list[KeyPhraseSeed] = []
    tips_md: str | None = None

    @field_validator("tips_md")
    @classmethod
    def _check_markdown(cls, value: str | None) -> str | None:
        """Tips stay inside the Markdown subset the Guidebook renders."""
        if value is not None:
            _raise_if(markdown_problems(value))
        return value


class GlossaryEntrySeed(SeedModel):
    """A word hint: a normalized term, its meaning, and the node that introduces it."""

    term: Text
    hint: Text
    node: Text


class UnitFile(SeedModel):
    """A unit file: the unit's banner, Guidebook, glossary and path nodes, in order."""

    title: Text
    description: Text
    color: UnitColor
    guidebook: GuidebookSeed
    glossary: list[GlossaryEntrySeed] = []
    nodes: list[NodeSeed]

    @field_validator("nodes")
    @classmethod
    def _check_ends_with_review(cls, nodes: list[NodeSeed]) -> list[NodeSeed]:
        """The unit's last node is its one review."""
        reviews = sum(1 for node in nodes if node.kind == NodeKind.REVIEW)
        if not nodes or nodes[-1].kind != NodeKind.REVIEW or reviews != 1:
            raise ValueError("a unit ends with exactly one review node")
        return nodes


# ---- course.json ----


class CourseSeed(SeedModel):
    """A course in the course menu; only published courses can be played."""

    slug: Text
    title: Text
    learning_language: Text
    from_language: Text
    tts_locale: Text
    flag_key: Text
    is_published: bool
    units: list[Text] = []  # unit file names, in path order

    @model_validator(mode="after")
    def _check_languages(self) -> Self:
        """A course teaches a language other than the one it is taught from."""
        if self.learning_language == self.from_language:
            raise ValueError("learningLanguage and fromLanguage must differ")
        return self


class CourseFile(SeedModel):
    """course.json: every course, in menu order. The first published course is the learner's."""

    courses: list[CourseSeed]

    @field_validator("courses")
    @classmethod
    def _check_courses(cls, courses: list[CourseSeed]) -> list[CourseSeed]:
        """Slugs are unique, and the first published course (the learner's) has units."""
        problems = _repeat_problem("slugs", (course.slug for course in courses))
        published = [course for course in courses if course.is_published]
        if not published or not published[0].units:
            problems.append("the first published course is the learner's, so it needs units")
        _raise_if(problems)
        return courses


# ---- catalog.json ----


class LeagueSeed(SeedModel):
    """A league tier and how many members move up or down each week."""

    tier: int
    name: Text
    color: HexColor
    promote_count: int = Field(ge=0)
    demote_count: int = Field(ge=0)


class AchievementTierSeed(SeedModel):
    """One level of an achievement; `description` replaces the template for this level only."""

    level: int = Field(ge=1)
    threshold: int = Field(gt=0)
    description: Text | None = None


class AchievementSeed(SeedModel):
    """A profile achievement, measured by one statistic across its levels."""

    code: AchievementCode
    name: Text
    description_template: Text
    metric: AchievementMetric
    color: HexColor
    tiers: list[AchievementTierSeed]

    @model_validator(mode="after")
    def _check_levels(self) -> Self:
        """Levels run 1, 2, 3... with strictly increasing thresholds; the template uses only {n}."""
        problems = _template_problem("descriptionTemplate", self.description_template)
        if [tier.level for tier in self.tiers] != list(range(1, len(self.tiers) + 1)):
            problems.append("tier levels must run 1, 2, 3... in order")
        thresholds = [tier.threshold for tier in self.tiers]
        if not thresholds or any(lower >= higher for lower, higher in pairwise(thresholds)):
            problems.append("tier thresholds must strictly increase with the level")
        _raise_if(problems)
        return self


class QuestSeed(SeedModel):
    """A daily quest. Only the daily-goal quest has no fixed target: it uses the learner's goal."""

    code: Text
    slot: Literal[1, 2, 3]
    title_template: Text
    metric: QuestMetric
    target: int | None = Field(default=None, gt=0)
    reward_gems: int = Field(gt=0)
    icon: QuestIcon

    @model_validator(mode="after")
    def _check_target(self) -> Self:
        """Only the daily-goal quest has no target; the title template uses only {n}."""
        problems = _template_problem("titleTemplate", self.title_template)
        if (self.metric == QuestMetric.DAILY_GOAL_XP) != (self.target is None):
            problems.append("the daily-goal quest has no target, and every other quest has one")
        _raise_if(problems)
        return self


class ShopItemSeed(SeedModel):
    """A shop item; `durationMinutes` belongs to XP boosts only."""

    code: ShopItemCode
    kind: ShopItemKind
    section: ShopSection
    name: Text
    description: Text
    price_gems: int = Field(ge=0)
    duration_minutes: int | None = Field(default=None, gt=0)
    is_available: bool = True

    @model_validator(mode="after")
    def _check_duration(self) -> Self:
        """Only an XP boost lasts a number of minutes."""
        if (self.kind == ShopItemKind.XP_BOOST) != (self.duration_minutes is not None):
            raise ValueError("an XP boost has durationMinutes, and no other item does")
        return self


class CatalogFile(SeedModel):
    """catalog.json: league tiers, achievements, daily quests and shop items, each in display order."""

    leagues: list[LeagueSeed]
    achievements: list[AchievementSeed]
    quests: list[QuestSeed]
    shop_items: list[ShopItemSeed]

    @field_validator("leagues")
    @classmethod
    def _check_ladder(cls, leagues: list[LeagueSeed]) -> list[LeagueSeed]:
        """Tiers 1 to 10, matching the league table the game rules use."""
        if [league.tier for league in leagues] != [row.tier for row in LEAGUE_TIERS]:
            raise ValueError(f"league tiers must be exactly 1 to {len(LEAGUE_TIERS)}, in order")
        # The league rules read the same ladder from app.domain.rules, so the two must agree.
        _raise_if(
            [
                f"tier {row.tier} must be {row.name} (promote {row.promote_count}, demote {row.demote_count})"
                for league, row in zip(leagues, LEAGUE_TIERS, strict=True)
                if (league.name, league.promote_count, league.demote_count)
                != (row.name, row.promote_count, row.demote_count)
            ]
        )
        return leagues

    @field_validator("achievements")
    @classmethod
    def _check_achievements(cls, achievements: list[AchievementSeed]) -> list[AchievementSeed]:
        """Achievement codes are unique."""
        _raise_if(_repeat_problem("achievement codes", (achievement.code for achievement in achievements)))
        return achievements

    @field_validator("quests")
    @classmethod
    def _check_slots(cls, quests: list[QuestSeed]) -> list[QuestSeed]:
        """Slot 1 holds the one daily-goal quest; slots 2 and 3 have quests to draw from."""
        problems = _repeat_problem("quest codes", (quest.code for quest in quests))
        in_slot_1 = [quest for quest in quests if quest.slot == 1]
        goal_quests = [quest for quest in quests if quest.metric == QuestMetric.DAILY_GOAL_XP]
        if len(in_slot_1) != 1 or in_slot_1 != goal_quests:
            problems.append("slot 1 holds exactly one quest, the only daily_goal_xp quest")
        filled = {quest.slot for quest in quests}
        problems += [f"slot {slot} needs at least one quest" for slot in (2, 3) if slot not in filled]
        _raise_if(problems)
        return quests

    @field_validator("shop_items")
    @classmethod
    def _check_shop(cls, items: list[ShopItemSeed]) -> list[ShopItemSeed]:
        """Codes are unique, and the shop sells a heart refill and a streak freeze."""
        codes = [item.code for item in items]
        problems = _repeat_problem("shop item codes", codes)
        needed = (ShopItemCode.HEART_REFILL, ShopItemCode.STREAK_FREEZE)
        problems += [f"the shop must sell {code}" for code in needed if code not in codes]
        _raise_if(problems)
        return items


# ---- users.json ----


class LearnerSeed(SeedModel):
    """The one human learner the demo signs in as."""

    username: Text
    display_name: Text
    avatar_color: HexColor


class BotSeed(LearnerSeed):
    """A league competitor: its pace class, daily XP and lifetime baselines."""

    pace: Pace
    daily_xp: int = Field(gt=0)
    baseline_xp: int = Field(ge=0)
    baseline_streak: int = Field(ge=0)

    @model_validator(mode="after")
    def _check_pace(self) -> Self:
        """A bot's daily XP lies within its pace class."""
        pace = PACE_CLASSES[self.pace]
        if not pace.min_daily_xp <= self.daily_xp <= pace.max_daily_xp:
            low, high = pace.min_daily_xp, pace.max_daily_xp
            raise ValueError(f"a {self.pace} bot earns {low} to {high} XP a day, not {self.daily_xp}")
        return self


class UsersFile(SeedModel):
    """users.json: the learner and the pool of league bots."""

    learner: LearnerSeed
    bots: list[BotSeed]

    @model_validator(mode="after")
    def _check_pool(self) -> Self:
        """Exactly 35 bots, unique lower-case usernames, and the exact count of each pace class."""
        bots = len(self.bots)
        problems = [] if bots == BOT_POOL_SIZE else [f"needs exactly {BOT_POOL_SIZE} bots, has {bots}"]
        usernames = [self.learner.username, *(bot.username for bot in self.bots)]
        problems += _repeat_problem("usernames", usernames)
        not_lower = [name for name in usernames if name != name.lower()]
        if not_lower:
            problems.append(f"usernames must be lower-case: {', '.join(not_lower)}")
        paces = Counter(bot.pace for bot in self.bots)
        problems += [
            f"needs exactly {pace.count} {name} bots, has {paces[name]}"
            for name, pace in PACE_CLASSES.items()
            if paces[name] != pace.count
        ]
        _raise_if(problems)
        return self


# ---- sample_learner.json ----


class HeartsSeed(SeedModel):
    """The hearts at seed time; below the maximum, the regeneration interval started a while ago."""

    current: int = Field(ge=0, le=MAX_HEARTS)
    anchor_minutes_ago: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def _check_anchor(self) -> Self:
        """A regeneration interval runs exactly when the hearts are below the maximum."""
        if (self.current < MAX_HEARTS) != (self.anchor_minutes_ago is not None):
            raise ValueError("anchorMinutesAgo is given exactly when hearts are below the maximum")
        return self


class _StepSeed(SeedModel):
    """When a step happens: a day counted from the seed day, at a local time."""

    day: int  # relative to the seed day: -1 is yesterday
    local_time: time = Field(alias="time")  # "19:10" in the learner's time zone


class _PlayStep(_StepSeed):
    """A session; `wrong` lists planned items answered wrong once, then right."""

    wrong: list[PositiveInt] = []  # planned items (1-based) answered wrong once, then right

    @field_validator("wrong")
    @classmethod
    def _check_unique(cls, wrong: list[int]) -> list[int]:
        """Each wrong item is listed once."""
        if len(set(wrong)) != len(wrong):
            raise ValueError("wrong item positions repeat")
        return wrong


class LessonStep(_PlayStep):
    """Play the node's next lesson."""

    kind: Literal["lesson"]
    node: Text


class PracticeStep(_PlayStep):
    """Practice one finished node, or every finished lesson when `node` is null."""

    kind: Literal["practice"]
    node: Text | None = None


class LegendaryStep(_PlayStep):
    """Pass a legendary run on a completed skill."""

    kind: Literal["legendary"]
    node: Text

    @field_validator("wrong")
    @classmethod
    def _check_pass(cls, wrong: list[int]) -> list[int]:
        """The run passes: it stays within the mistakes a legendary run allows."""
        if len(wrong) > LEGENDARY_MAX_MISTAKES:
            raise ValueError(f"a legendary run fails after {LEGENDARY_MAX_MISTAKES} mistakes")
        return wrong


class ChestStep(_StepSeed):
    """Open a reachable treasure chest."""

    kind: Literal["chest"]
    node: Text


class PurchaseStep(_StepSeed):
    """Buy a shop item."""

    kind: Literal["purchase"]
    item: ShopItemCode


PlayStep = LessonStep | PracticeStep | LegendaryStep
HistoryStep = Annotated[PlayStep | ChestStep | PurchaseStep, Field(discriminator="kind")]


class SampleLearnerFile(SeedModel):
    """sample_learner.json: the learner's history, on learner-local days before the seed day."""

    joined_days_ago: int = Field(ge=1)
    starting_gems: int = Field(ge=0)
    daily_goal_xp: int
    hearts: HeartsSeed
    last_week_league_tier: int = Field(ge=1, le=len(LEAGUE_TIERS))
    steps: list[HistoryStep]

    @model_validator(mode="after")
    def _check_timeline(self) -> Self:
        """A valid daily goal, and steps in time order between joining (noon) and yesterday."""
        problems = (
            []
            if self.daily_goal_xp in DAILY_GOAL_OPTIONS
            else [f"dailyGoalXp must be one of {DAILY_GOAL_OPTIONS}"]
        )
        joined = (-self.joined_days_ago, JOIN_TIME)
        previous: tuple[int, time] | None = None
        for index, step in enumerate(self.steps):
            moment = (step.day, step.local_time)
            if step.day >= 0:
                problems.append(f"steps[{index}] must happen before the seed day (day -1 or earlier)")
            elif moment <= joined:
                problems.append(
                    f"steps[{index}] must happen after the learner joined (day {joined[0]}, noon)"
                )
            if previous is not None and moment <= previous:
                problems.append(f"steps[{index}] must come after the step before it")
            previous = moment
        _raise_if(problems)
        return self
