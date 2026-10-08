import { LINE, SvgIcon, type IconProps } from "./Icon";

/** Add friends: a person with a plus sign beside them (`currentColor`). */
export function PersonPlusIcon(props: IconProps) {
  return (
    <SvgIcon box={[24, 24]} {...props}>
      <circle cx={9.5} cy={8.2} r={3.6} {...LINE} />
      <path d="M3.5 20C3.5 16.4 6.2 13.8 9.5 13.8C12.8 13.8 15.5 16.4 15.5 20M19 8V14M16 11H22" {...LINE} />
    </SvgIcon>
  );
}
