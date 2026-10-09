"""The API contract the frontend codes against, recorded key by key.

For every TypeScript interface of the contract: the camelCase keys of its JSON object. A response
always carries every key (null where the type allows it); a request may leave optional keys out.
The Pydantic schema with the same name must declare exactly these fields, under these aliases.
The union types are recorded by their allowed values.
"""

from typing import Any


def names(text: str) -> frozenset[str]:
    """The space-separated names in `text`, as a set."""
    return frozenset(text.split())


INTERFACE_KEYS: dict[str, frozenset[str]] = {
    # ---- shared ----
    "HeartsOut": names("current max nextHeartAt fullAt regenIntervalSeconds refillPriceGems"),
    "LeagueBrief": names("tier name color"),
    "CourseBrief": names("id slug title learningLanguage fromLanguage ttsLocale flagKey isPublished"),
    # ---- system ----
    "HealthOut": names("status seeded bootId bootedAt serverTime version"),
    # ---- /me ----
    "MeUser": names("id username displayName avatarColor timezone timezoneConfirmed joinedAt"),
    "MeXp": names("total today thisWeek"),
    "MeStreak": names(
        "current longest status extendedToday frozenYesterday freezesEquipped maxFreezes nextMilestone"
    ),
    "DailyGoalOut": names("goalXp earnedXp met"),
    "MeLeague": names(
        "tier name color unlocked lessonsToUnlock joinedThisWeek rank weeklyXp zone xpToPassNext"
        " cohortSize promoteCount demoteCount weekEndsAt"
    ),
    "XpBoostOut": names("active endsAt multiplier"),
    "ActiveSessionRef": names("id kind nodeId"),
    "LeagueResultOut": names("membershipId weekStart league finalRank finalXp outcome newLeague seen"),
    "SettingsOut": names(
        "dailyGoalXp theme soundEffects animations motivationalMessages listeningExercises timezone"
    ),
    "DevInfo": names("enabled clockOffsetSeconds"),
    "MeOut": names(
        "user course serverNow localDate xp gems hearts streak dailyGoal league xpBoost activeSession"
        " pendingLeagueResult settings dev"
    ),
    "SettingsPatchIn": names(
        "dailyGoalXp theme soundEffects animations motivationalMessages listeningExercises timezone"
    ),
    "SettingsUpdateOut": names(
        "dailyGoalXp theme soundEffects animations motivationalMessages listeningExercises timezone"
        " timezoneEffect"
    ),
    "ActivityDayOut": names("date xp goalXp goalMet state"),
    "ActivityOut": names("from to today items"),
    # ---- path and content ----
    "PathNodeActions": names(
        "canStart startXp canPractice practiceXp canLegendary legendaryXp legendaryPriceGems"
    ),
    "PathNodeOut": names(
        "id position kind title state crownLevel lessonsCompleted lessonCount nextLessonNumber chestGems"
        " actions"
    ),
    "PathUnitOut": names("id number section title description color state hasGuidebook nodes"),
    "PathOut": names("course currentNodeId units"),
    "ChestClaimOut": names("nodeId gemsAwarded gems replayed"),
    "GuidebookOut": names("unit ttsLocale keyPhrases tipsMd"),
    "CoursesOut": names("items"),
    # ---- league ----
    "LeagueTierOut": names("tier name color reached"),
    "LeagueRowOut": names("rank userId displayName avatarColor xp streak isMe zone"),
    "LeagueOut": names(
        "unlocked lessonsToUnlock joined league tiers weekStart weekEndsAt serverNow promoteCount"
        " demoteCount cohortSize rows lastWeekResult"
    ),
    "LeagueAckOut": names("membershipId seenAt"),
    # ---- quests ----
    "QuestOut": names("code slot title icon progress target rewardGems completed"),
    "QuestsOut": names("localDate resetsAt serverNow completedCount quests"),
    # ---- shop and purchases ----
    "ShopItemOut": names(
        "code kind section name description priceGems durationMinutes owned maxOwned activeUntil available"
        " unavailableReason"
    ),
    "ShopOut": names("gems items"),
    "PurchaseIn": names("itemCode"),
    "PurchaseEffect": names("hearts streakFreezes xpBoostUntil"),
    "PurchaseOut": names("id itemCode priceGems purchasedAt replayed gems effect"),
    # ---- profile ----
    "AchievementTierOut": names("level threshold unlockedAt"),
    "AchievementOut": names("code name color level maxLevel currentValue nextThreshold description tiers"),
    "ProfileUser": names("id username displayName avatarColor joinedAt isMe isBot"),
    "ProfileStats": names(
        "currentStreak longestStreak totalXp league topThreeFinishes wordsLearned lessonsCompleted crowns"
    ),
    "ProfileOut": names("user stats achievements"),
    # ---- sessions ----
    "StartSessionIn": names("kind nodeId"),
    "PromptSegment": names("text hint"),
    "PromptOut": names("text language speak segments"),
    "ChoiceOptionOut": names("id text imageKey"),
    "TokenOut": names("id text"),
    "MultipleChoiceExercise": names("id type instruction prompt layout options"),
    "TranslateExercise": names("id type instruction prompt answerLanguage tiles specialCharacters"),
    "MatchPairsExercise": names("id type instruction left right"),
    "FillBlankExercise": names("id type instruction prompt before after translation options"),
    "TypeAnswerExercise": names("id type instruction prompt audioOnly answerLanguage specialCharacters"),
    "SessionItemOut": names("id seq origin label result note exercise"),
    "SessionNodeRef": names("id kind title unitId unitNumber unitColor"),
    "SessionLessonRef": names("id number count"),
    "SessionRules": names("heartsEnabled retryPolicy hintsEnabled maxMistakes"),
    "TimerOut": names("startSeconds bonusSeconds expiresAt"),
    "LivesOut": names("max left"),
    "ProgressOut": names("completed total"),
    "SessionOut": names(
        "id kind status endReason resumed node lesson rules timer startedAt serverNow hearts lives"
        " progress mistakes combo bestCombo currentItemId blockedReason canComplete items"
    ),
    "SessionStateOut": names("status endReason blockedReason canComplete currentItemId livesLeft expiresAt"),
    "AnswerResultOut": names(
        "itemId replayed result isCorrect note correctAnswer meaning heartLost hearts progress mistakes"
        " combo bestCombo appendedItem session"
    ),
    "XpLineOut": names("reason amount"),
    "StreakDayOut": names("date state"),
    "CompletionStats": names("accuracyPercent durationSeconds mistakes bestCombo perfect itemCount"),
    "CompletionStreak": names("before after extendedToday isNewRecord milestone week"),
    "CompletionDailyGoal": names("goalXp before after justMet"),
    "CompletionNode": names(
        "id kind title lessonsCompleted lessonCount completedNow legendaryNow unlockedNodeIds"
    ),
    "QuestCompletedOut": names("code title rewardGems"),
    "AchievementUnlockOut": names("code name level threshold description color"),
    "CompletionLeague": names("joinedNow league weeklyXp rankBefore rankAfter"),
    "TimedResultOut": names("correct answered timeUp"),
    "CompletionOut": names(
        "sessionId kind replayed xp stats streak dailyGoal node heartsGained questsCompleted"
        " achievementsUnlocked league timed recentSessionCount me"
    ),
    "QuitOut": names("sessionId status endReason replayed hearts"),
    # ---- dev tools ----
    "ClockOut": names(
        "realNow offsetSeconds now timezone localNow localDate leagueWeekStart leagueWeekEndsAt"
    ),
    "ClockAdvanceIn": names("minutes hours days"),
    "SyncEffectsOut": names("heartsGained streak leagueResults sessionsExpired"),
    "ClockChangeOut": names("clock effects"),
    "DevLearnerPatchIn": names("hearts gems"),
    "DevResetOut": names("reset seededAt me"),
    # ---- errors ----
    "FieldError": names("field message kind"),
    "ProblemDetails": names(
        "type title status detail instance code requestId errors nextHeartAt requiredGems balance"
        " sessionStatus endReason expiresAt currentItemId"
    ),
}

# Objects the contract spells out inline rather than as named interfaces, by their schema names.
INLINE_OBJECT_KEYS: dict[str, frozenset[str]] = {
    "CompletionXp": names("total lines boostActive"),  # CompletionOut.xp
    "GuidebookUnitRef": names("id number title color"),  # GuidebookOut.unit
    "KeyPhraseOut": names("text translation"),  # GuidebookOut.keyPhrases[]
    "SyncStreakOut": names("before after freezesUsed lost"),  # SyncEffectsOut.streak
    "MatchPairIn": names("leftId rightId"),  # AnswerIn (match_pairs).pairs[]
    # The members of the AnswerIn union.
    "MultipleChoiceAnswer": names("type optionId"),
    "FillBlankAnswer": names("type optionId"),
    "TranslateAnswer": names("type tileIds text"),
    "MatchPairsAnswer": names("type pairs mistakes"),
    "TypeAnswerAnswer": names("type text"),
    "SkipAnswer": names("type"),
    "CantListenAnswer": names("type"),
}

# The cached part of a completion response: everything except the fresh `me`.
RECEIPT_KEYS: dict[str, frozenset[str]] = {"CompletionReceipt": INTERFACE_KEYS["CompletionOut"] - {"me"}}

CONTRACT_KEYS: dict[str, frozenset[str]] = {**INTERFACE_KEYS, **INLINE_OBJECT_KEYS, **RECEIPT_KEYS}

# The bodies a client sends; every other object of the contract is something the API answers with.
REQUEST_BODIES: frozenset[str] = names(
    "StartSessionIn SettingsPatchIn PurchaseIn ClockAdvanceIn DevLearnerPatchIn MatchPairIn"
    " MultipleChoiceAnswer FillBlankAnswer TranslateAnswer MatchPairsAnswer TypeAnswerAnswer SkipAnswer"
    " CantListenAnswer"
)

# The fields that hold another object of the contract, by the type they hold. "X[]" is an array of X,
# and a union (ExerciseOut) is resolved by its `type`. A field typed `X | null` is listed as X.
OBJECT_FIELDS: dict[str, dict[str, str]] = {
    # ---- /me ----
    "MeOut": {
        "user": "MeUser",
        "course": "CourseBrief",
        "xp": "MeXp",
        "hearts": "HeartsOut",
        "streak": "MeStreak",
        "dailyGoal": "DailyGoalOut",
        "league": "MeLeague",
        "xpBoost": "XpBoostOut",
        "activeSession": "ActiveSessionRef",
        "pendingLeagueResult": "LeagueResultOut",
        "settings": "SettingsOut",
        "dev": "DevInfo",
    },
    "LeagueResultOut": {"league": "LeagueBrief", "newLeague": "LeagueBrief"},
    "ActivityOut": {"items": "ActivityDayOut[]"},
    # ---- path and content ----
    "PathOut": {"course": "CourseBrief", "units": "PathUnitOut[]"},
    "PathUnitOut": {"nodes": "PathNodeOut[]"},
    "PathNodeOut": {"actions": "PathNodeActions"},
    "GuidebookOut": {"unit": "GuidebookUnitRef", "keyPhrases": "KeyPhraseOut[]"},
    "CoursesOut": {"items": "CourseBrief[]"},
    # ---- league, quests, shop, profile ----
    "LeagueOut": {
        "league": "LeagueBrief",
        "tiers": "LeagueTierOut[]",
        "rows": "LeagueRowOut[]",
        "lastWeekResult": "LeagueResultOut",
    },
    "QuestsOut": {"quests": "QuestOut[]"},
    "ShopOut": {"items": "ShopItemOut[]"},
    "PurchaseEffect": {"hearts": "HeartsOut"},
    "PurchaseOut": {"effect": "PurchaseEffect"},
    "AchievementOut": {"tiers": "AchievementTierOut[]"},
    "ProfileStats": {"league": "LeagueBrief"},
    "ProfileOut": {"user": "ProfileUser", "stats": "ProfileStats", "achievements": "AchievementOut[]"},
    # ---- sessions ----
    "PromptOut": {"segments": "PromptSegment[]"},
    "MultipleChoiceExercise": {"prompt": "PromptOut", "options": "ChoiceOptionOut[]"},
    "TranslateExercise": {"prompt": "PromptOut", "tiles": "TokenOut[]"},
    "MatchPairsExercise": {"left": "TokenOut[]", "right": "TokenOut[]"},
    "FillBlankExercise": {"prompt": "PromptOut", "options": "TokenOut[]"},
    "TypeAnswerExercise": {"prompt": "PromptOut"},
    "SessionItemOut": {"exercise": "ExerciseOut"},
    "SessionOut": {
        "node": "SessionNodeRef",
        "lesson": "SessionLessonRef",
        "rules": "SessionRules",
        "timer": "TimerOut",
        "hearts": "HeartsOut",
        "lives": "LivesOut",
        "progress": "ProgressOut",
        "items": "SessionItemOut[]",
    },
    "AnswerResultOut": {
        "hearts": "HeartsOut",
        "progress": "ProgressOut",
        "appendedItem": "SessionItemOut",
        "session": "SessionStateOut",
    },
    "CompletionXp": {"lines": "XpLineOut[]"},
    "CompletionStreak": {"week": "StreakDayOut[]"},
    "CompletionLeague": {"league": "LeagueBrief"},
    "CompletionOut": {
        "xp": "CompletionXp",
        "stats": "CompletionStats",
        "streak": "CompletionStreak",
        "dailyGoal": "CompletionDailyGoal",
        "node": "CompletionNode",
        "questsCompleted": "QuestCompletedOut[]",
        "achievementsUnlocked": "AchievementUnlockOut[]",
        "league": "CompletionLeague",
        "timed": "TimedResultOut",
        "me": "MeOut",
    },
    "QuitOut": {"hearts": "HeartsOut"},
    # ---- dev tools ----
    "SyncEffectsOut": {"streak": "SyncStreakOut", "leagueResults": "LeagueResultOut[]"},
    "ClockChangeOut": {"clock": "ClockOut", "effects": "SyncEffectsOut"},
    "DevResetOut": {"me": "MeOut"},
    # ---- errors ----
    "ProblemDetails": {"errors": "FieldError[]"},
}

# Every endpoint (A.1): its operation id, method, path under /api/v1 and the type of its success body.
ENDPOINTS: dict[str, tuple[str, str, str]] = {
    "getHealth": ("GET", "/health", "HealthOut"),
    "getMe": ("GET", "/me", "MeOut"),
    "getSettings": ("GET", "/me/settings", "SettingsOut"),
    "updateSettings": ("PATCH", "/me/settings", "SettingsUpdateOut"),
    "getActivity": ("GET", "/me/activity", "ActivityOut"),
    "getPath": ("GET", "/me/path", "PathOut"),
    "claimChest": ("POST", "/me/chests/{nodeId}/claim", "ChestClaimOut"),
    "getLeague": ("GET", "/me/league", "LeagueOut"),
    "ackLeagueResult": ("POST", "/me/league/results/{membershipId}/ack", "LeagueAckOut"),
    "getQuests": ("GET", "/me/quests", "QuestsOut"),
    "createPurchase": ("POST", "/me/purchases", "PurchaseOut"),
    "getPurchase": ("GET", "/me/purchases/{purchaseId}", "PurchaseOut"),
    "getProfile": ("GET", "/users/{userId}/profile", "ProfileOut"),
    "listCourses": ("GET", "/courses", "CoursesOut"),
    "getGuidebook": ("GET", "/units/{unitId}/guidebook", "GuidebookOut"),
    "listShopItems": ("GET", "/shop/items", "ShopOut"),
    "startSession": ("POST", "/sessions", "SessionOut"),
    "getSession": ("GET", "/sessions/{sessionId}", "SessionOut"),
    "submitAnswer": ("PUT", "/sessions/{sessionId}/items/{itemId}/answer", "AnswerResultOut"),
    "completeSession": ("POST", "/sessions/{sessionId}/complete", "CompletionOut"),
    "quitSession": ("POST", "/sessions/{sessionId}/quit", "QuitOut"),
    "getDevClock": ("GET", "/dev/clock", "ClockOut"),
    "advanceDevClock": ("POST", "/dev/clock/advance", "ClockChangeOut"),
    "devNextDay": ("POST", "/dev/clock/next-day", "ClockChangeOut"),
    "devNextWeek": ("POST", "/dev/clock/next-week", "ClockChangeOut"),
    "patchDevLearner": ("PATCH", "/dev/learner", "MeOut"),
    "resetDemo": ("POST", "/dev/reset", "DevResetOut"),
}

# The discriminated unions: each `type` value and the schema that carries it.
DISCRIMINATED_UNIONS: dict[str, dict[str, str]] = {
    "ExerciseOut": {
        "multiple_choice": "MultipleChoiceExercise",
        "translate": "TranslateExercise",
        "match_pairs": "MatchPairsExercise",
        "fill_blank": "FillBlankExercise",
        "type_answer": "TypeAnswerExercise",
    },
    "AnswerIn": {
        "multiple_choice": "MultipleChoiceAnswer",
        "fill_blank": "FillBlankAnswer",
        "translate": "TranslateAnswer",
        "match_pairs": "MatchPairsAnswer",
        "type_answer": "TypeAnswerAnswer",
        "skip": "SkipAnswer",
        "cant_listen": "CantListenAnswer",
    },
}

# Every union of literal values in the contract.
UNION_VALUES: dict[str, frozenset[str] | frozenset[int]] = {
    "TextLang": names("es en"),
    "SessionKind": names("lesson practice legendary timed"),
    "SessionStatus": names("active completed failed abandoned"),
    "EndReason": names("passed quit out_of_hearts too_many_mistakes idle_timeout superseded"),
    "NodeKind": names("skill chest review"),
    "NodeState": names("locked active available completed legendary"),
    "UnitState": names("locked in_progress completed"),
    "UnitColor": names("green purple teal blue pink orange red magenta brown"),
    "ExerciseType": names("multiple_choice translate match_pairs fill_blank type_answer"),
    "ItemOrigin": names("initial retry"),
    "ItemLabel": names("previous_mistake new_word"),
    "ItemResult": names("correct incorrect skipped cant_listen"),
    "GradeNote": names("alternate accent typo missing_word wrong_word"),
    "RetryPolicy": names("always once never"),
    "StreakStatus": names("inactive at_risk extended"),
    "DayState": names("active frozen none"),
    "Theme": names("system light dark"),
    "DailyGoalXp": frozenset({10, 20, 30, 50}),
    "LeagueZone": names("promotion safe demotion"),
    "LeagueOutcome": names("promoted stayed demoted"),
    "XpReason": names("lesson review practice legendary timed combo boost"),
    "ShopItemCode": names("heart_refill unlimited_hearts streak_freeze xp_boost_15"),
    "ShopItemKind": names("heart_refill super streak_freeze xp_boost"),
    "ShopSection": names("hearts power_ups"),
    "ShopUnavailableReason": names(
        "HEARTS_ALREADY_FULL MAX_FREEZES_EQUIPPED INSUFFICIENT_GEMS ITEM_UNAVAILABLE"
    ),
    "TimezoneEffect": names("none shifted reseeded"),
    "QuestSlot": frozenset({1, 2, 3}),
    "QuestIcon": names("bolt book target flame"),
    "AchievementCode": names("wildfire sage scholar sharpshooter champion winner legendary"),
    "BlockedReason": names("OUT_OF_HEARTS"),
    "ErrorCode": names(
        "VALIDATION_ERROR INVALID_ANSWER IDEMPOTENCY_KEY_REUSED IDEMPOTENCY_KEY_REQUIRED NOT_FOUND"
        " METHOD_NOT_ALLOWED BOT_ACCOUNT DEV_TOOLS_DISABLED NODE_LOCKED NODE_NOT_PLAYABLE"
        " NODE_ALREADY_COMPLETED ALREADY_LEGENDARY NOTHING_TO_PRACTICE CHEST_LOCKED OUT_OF_HEARTS"
        " INSUFFICIENT_GEMS HEARTS_ALREADY_FULL MAX_FREEZES_EQUIPPED ITEM_UNAVAILABLE SESSION_NOT_ACTIVE"
        " SESSION_EXPIRED SESSION_INCOMPLETE ITEM_OUT_OF_ORDER ITEM_ALREADY_ANSWERED"
        " LEAGUE_RESULT_NOT_READY INTERNAL_ERROR"
    ),
}


# GET /me for the seeded demo, as documented for the frontend.
ME_EXAMPLE: dict[str, Any] = {
    "user": {
        "id": 1,
        "username": "alex",
        "displayName": "Alex",
        "avatarColor": "#1CB0F6",
        "timezone": "Asia/Kolkata",
        "timezoneConfirmed": True,
        "joinedAt": "2026-09-08T06:30:00Z",
    },
    "course": {
        "id": 1,
        "slug": "es-en",
        "title": "Spanish",
        "learningLanguage": "es",
        "fromLanguage": "en",
        "ttsLocale": "es-ES",
        "flagKey": "es",
        "isPublished": True,
    },
    "serverNow": "2026-10-08T12:00:00Z",
    "localDate": "2026-10-08",
    "xp": {"total": 373, "today": 0, "thisWeek": 42},
    "gems": 820,
    "hearts": {
        "current": 4,
        "max": 5,
        "nextHeartAt": "2026-10-08T16:00:00Z",
        "fullAt": "2026-10-08T16:00:00Z",
        "regenIntervalSeconds": 18000,
        "refillPriceGems": 350,
    },
    "streak": {
        "current": 13,
        "longest": 13,
        "status": "at_risk",
        "extendedToday": False,
        "frozenYesterday": False,
        "freezesEquipped": 1,
        "maxFreezes": 2,
        "nextMilestone": 14,
    },
    "dailyGoal": {"goalXp": 20, "earnedXp": 0, "met": False},
    "league": {
        "unlocked": True,
        "lessonsToUnlock": 0,
        "tier": 2,
        "name": "Silver",
        "color": "#C9D6E2",
        "joinedThisWeek": True,
        "rank": 17,
        "weeklyXp": 42,
        "zone": "safe",
        "xpToPassNext": 9,
        "cohortSize": 30,
        "promoteCount": 15,
        "demoteCount": 7,
        "weekEndsAt": "2026-10-12T00:00:00Z",
    },
    "xpBoost": {"active": False, "endsAt": None, "multiplier": 2},
    "activeSession": None,
    "pendingLeagueResult": {
        "membershipId": 31,
        "weekStart": "2026-09-28",
        "league": {"tier": 1, "name": "Bronze", "color": "#D4A880"},
        "finalRank": 6,
        "finalXp": 112,
        "outcome": "promoted",
        "newLeague": {"tier": 2, "name": "Silver", "color": "#C9D6E2"},
        "seen": False,
    },
    "settings": {
        "dailyGoalXp": 20,
        "theme": "system",
        "soundEffects": True,
        "animations": True,
        "motivationalMessages": True,
        "listeningExercises": True,
        "timezone": "Asia/Kolkata",
    },
    "dev": {"enabled": True, "clockOffsetSeconds": 0},
}
