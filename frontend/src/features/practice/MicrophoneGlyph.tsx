import { LINE, SvgIcon, type IconProps } from "@/components/icons/Icon";

/** Speaking practice: a round-topped microphone in a cradle on a short stand (`currentColor`). */
export function MicrophoneGlyph(props: IconProps) {
  return (
    <SvgIcon box={[24, 24]} {...props}>
      <rect x={8.6} y={2.6} width={6.8} height={11.6} rx={3.4} fill="currentColor" />
      <path d="M5.4 10.6A6.6 6.6 0 0 0 18.6 10.6M12 17.4V21M8.6 21H15.4" {...LINE} />
    </SvgIcon>
  );
}
