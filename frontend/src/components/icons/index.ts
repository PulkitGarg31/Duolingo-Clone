/**
 * Original SVG icons. Every icon takes `size` (width in px), `className` and `title`, and is decorative
 * (aria-hidden) unless it has a title. Brand-coloured icons keep their colours in both themes; one-colour icons
 * and glyphs use `currentColor`, so set their colour with a text utility (`text-fg-3`, `text-white`, ...).
 */
export type { IconProps } from "./Icon";

// Navigation (32 × 32)
export { LearnIcon } from "./LearnIcon";
export { PracticeIcon } from "./PracticeIcon";
export { LeaderboardsIcon } from "./LeaderboardsIcon";
export { QuestsIcon } from "./QuestsIcon";
export { ShopIcon } from "./ShopIcon";
export { MoreIcon } from "./MoreIcon";

// Stats, hearts and power-ups (32 × 32)
export { FlameIcon, type FlameVariant } from "./FlameIcon";
export { BoltIcon } from "./BoltIcon";
export { GemIcon, type GemVariant } from "./GemIcon";
export { HeartIcon, type HeartVariant } from "./HeartIcon";
export { HeartBrokenIcon } from "./HeartBrokenIcon";
export { HeartRefillIcon } from "./HeartRefillIcon";
export { UnlimitedHeartIcon } from "./UnlimitedHeartIcon";
export { FreezeIcon } from "./FreezeIcon";
export { XpPotionIcon } from "./XpPotionIcon";

// Path node glyphs (32 × 32, currentColor: white on a node, grey when locked)
export { StarGlyph } from "./StarGlyph";
export { CheckGlyph } from "./CheckGlyph";
export { LockGlyph } from "./LockGlyph";
export { DumbbellGlyph } from "./DumbbellGlyph";
export { BookGlyph } from "./BookGlyph";
export { HeadphonesGlyph } from "./HeadphonesGlyph";
export { TrophyGlyph } from "./TrophyGlyph";

// Rewards
export { CrownIcon, type CrownVariant } from "./CrownIcon";
export { ChestIcon, type ChestVariant } from "./ChestIcon";
export { GemPileIcon } from "./GemPileIcon";
export { GemBowlIcon } from "./GemBowlIcon";
export { GemChestIcon } from "./GemChestIcon";
export { LegendaryTrophyIcon } from "./LegendaryTrophyIcon";

// Lesson (24 × 24 unless noted)
export { CloseIcon } from "./CloseIcon";
export { SpeakerIcon } from "./SpeakerIcon";
export { TurtleIcon } from "./TurtleIcon";
export { ReportFlagIcon } from "./ReportFlagIcon";
export { CheckIcon } from "./CheckIcon";
export { CrossIcon } from "./CrossIcon";
export { SparkleIcon } from "./SparkleIcon";
export { RefreshIcon } from "./RefreshIcon";
export { LightbulbIcon } from "./LightbulbIcon";

// Interface (24 × 24, currentColor unless noted)
export { SettingsIcon } from "./SettingsIcon";
export { ClockIcon } from "./ClockIcon";
export { StopwatchIcon } from "./StopwatchIcon";
export { TargetIcon } from "./TargetIcon";
export { ArrowIcon } from "./ArrowIcon";
export { ChevronIcon, type ChevronDirection } from "./ChevronIcon";
export { PlusIcon } from "./PlusIcon";
export { PencilIcon } from "./PencilIcon";
export { ShareIcon } from "./ShareIcon";
export { PersonPlusIcon } from "./PersonPlusIcon";
export { SunIcon } from "./SunIcon";
export { MoonIcon } from "./MoonIcon";
export { NotebookIcon } from "./NotebookIcon";

// Flags, medals and badges
export { FlagIcon, isFlagCode, type FlagCode } from "./FlagIcon";
export { MedalIcon, type MedalRank } from "./MedalIcon";
export { LeagueBadge } from "./LeagueBadge";
export { AchievementArt, type AchievementArtCode } from "./AchievementArt";
export { AchievementBadge, type AchievementBadgeVariant } from "./AchievementBadge";
