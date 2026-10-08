import { useId } from "react";
import { OwlBeak, OwlBody, OwlEyes, OwlFace, OwlNeck, OwlTuft } from "./owl/parts";

interface OwlHeadProps {
  /** Width and height in px. */
  size?: number;
  className?: string;
  /** Accessible name. Without one the head is decorative and hidden from assistive technology. */
  title?: string;
}

/**
 * The owl cropped to its head and scarf: the logo glyph where there is no room for the wordmark (the icon rail
 * and the favicon). Same parts as the full owl, so the two never drift apart. It does not move.
 */
export function OwlHead({ size = 40, className, title }: OwlHeadProps) {
  const bodyClipId = useId();
  return (
    <svg
      viewBox="30 -4 140 140"
      width={size}
      height={size}
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title && <title>{title}</title>}
      <OwlTuft />
      <OwlBody clipId={bodyClipId} />
      <OwlFace />
      <OwlEyes state={{ kind: "open" }} />
      <OwlBeak open={false} />
      <OwlNeck wear="band" clipId={bodyClipId} />
    </svg>
  );
}
