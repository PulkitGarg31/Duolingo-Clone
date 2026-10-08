import type { Transition } from "motion/react";

/**
 * When a refresh reorders the board (bots climbing, the learner back from a lesson), rows and zone lines glide
 * to their new place: a 400 ms layout animation on the --ease-standard curve.
 */
export const ROW_LAYOUT_TRANSITION: Transition = { layout: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } };
