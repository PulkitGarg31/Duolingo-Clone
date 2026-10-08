import { LINE, SvgIcon, type IconProps } from "./Icon";

/** Guidebook: a ruled notebook with binding rings on its left edge (`currentColor`). */
export function NotebookIcon(props: IconProps) {
  return (
    <SvgIcon box={[24, 24]} {...props}>
      <rect x={6} y={3} width={13.5} height={18} rx={2.5} {...LINE} />
      <path d="M10 8.5H15.5M10 12H15.5M10 15.5H13.5" {...LINE} strokeWidth={2.2} />
      <path d="M3.8 7.5H7.6M3.8 12H7.6M3.8 16.5H7.6" {...LINE} strokeWidth={2.2} />
    </SvgIcon>
  );
}
