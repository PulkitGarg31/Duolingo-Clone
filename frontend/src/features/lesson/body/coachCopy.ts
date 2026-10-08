import type { OwlPose } from "@/components/mascot/Owl";
import type { CoachMessage, CoachTrigger } from "@/lib/lesson/lessonMachine";

const LINES: Record<CoachTrigger, readonly string[]> = {
  combo5: [
    "5 in a row!",
    "Your hard work is paying off!",
    "Cool! 5 in a row!",
    "Amazing! 5 in a row!",
    "You're getting good at this!",
    "Super impressive!",
  ],
  combo10: [
    "10 in a row!",
    "10 in a row! You've learned so much!",
    "You worked hard and got 10 right in a row!",
    "Outstanding! 10 in a row!",
    "Nice! Practice always pays off.",
    "I'm so proud of you!",
  ],
  wrong3: [
    "Don't worry! Mistakes help you learn.",
    "Mistakes are the best way to learn!",
    "I believe in you!",
    "You can do it!",
    "Don't give up!",
    "Keep going! Practice makes perfect.",
  ],
  lastHeart: ["Careful! One more mistake and it's over."],
};

/** The owl cheers a streak with a wink and a thumbs-up, and looks worried about the last heart. */
const POSES: Record<CoachTrigger, OwlPose> = {
  combo5: "cheer",
  combo10: "cheer",
  wrong3: "cheer",
  lastHeart: "think",
};

/** The owl's words and pose for a coach slide; the message's variant picks the line. */
export function coachLine({ trigger, variant }: CoachMessage): { text: string; pose: OwlPose } {
  const lines = LINES[trigger];
  return { text: lines[variant % lines.length], pose: POSES[trigger] };
}
