import type { IllustrationProps } from "./parts";
import { ILLUSTRATIONS, isIllustrationKey } from "./registry";

interface Props extends IllustrationProps {
  /** A content image key, e.g. an option's `imageKey` from the API. */
  name: string;
}

/** The picture-card drawing for an image key; renders nothing for a key without one. */
export function Illustration({ name, ...props }: Props) {
  if (!isIllustrationKey(name)) return null;
  const Drawing = ILLUSTRATIONS[name];
  return <Drawing {...props} />;
}
