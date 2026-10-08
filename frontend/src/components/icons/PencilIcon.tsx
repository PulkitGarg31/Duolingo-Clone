import { LINE, SvgIcon, type IconProps } from "./Icon";

/** Edit: a pencil on the diagonal (`currentColor`). */
export function PencilIcon(props: IconProps) {
  return (
    <SvgIcon box={[24, 24]} {...props}>
      <path
        d="M4.8 19.2 5.6 15.2 15.6 5.2C16.4 4.4 17.6 4.4 18.4 5.2L18.8 5.6C19.6 6.4 19.6 7.6 18.8 8.4L8.8 18.4Z"
        {...LINE}
      />
      <path d="M13.6 7.2 16.8 10.4" {...LINE} />
    </SvgIcon>
  );
}
