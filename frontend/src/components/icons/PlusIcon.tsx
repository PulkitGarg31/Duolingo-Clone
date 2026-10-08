import { LINE, SvgIcon, type IconProps } from "./Icon";

/** Add: a plus sign (`currentColor`). */
export function PlusIcon(props: IconProps) {
  return (
    <SvgIcon box={[24, 24]} {...props}>
      <path d="M12 5V19M5 12H19" {...LINE} />
    </SvgIcon>
  );
}
