import { SvgIcon, type IconProps } from "./Icon";

const CUP =
  "M9.6 4H22.4A1.6 1.6 0 0 1 24 5.6V11C24 15.8 20.4 19.4 16 19.4C11.6 19.4 8 15.8 8 11V5.6" +
  "A1.6 1.6 0 0 1 9.6 4Z";
const HANDLES =
  "M8.2 7.2H5.8C4.8 7.2 4 8 4 9C4 12.4 6.2 14.6 9.2 14.9" +
  "M23.8 7.2H26.2C27.2 7.2 28 8 28 9C28 12.4 25.8 14.6 22.8 14.9";

/** Path glyph for the unit review: a cup with two loop handles, a stem and a base (`currentColor`). */
export function TrophyGlyph(props: IconProps) {
  return (
    <SvgIcon box={[32, 32]} {...props}>
      <path d={HANDLES} fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" />
      <path d={CUP} fill="currentColor" />
      <rect x={14.4} y={18.8} width={3.2} height={4.8} fill="currentColor" />
      <rect x={9.4} y={23} width={13.2} height={5} rx={1.8} fill="currentColor" />
    </SvgIcon>
  );
}
