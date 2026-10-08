import Link from "next/link";
import { LINE, SvgIcon } from "@/components/icons/Icon";

/** "← BACK" to the path, over a 2 px rule spanning the column. */
export function BackLink() {
  return (
    <div className="border-b-2 border-line pb-3">
      <Link
        href="/learn"
        className="inline-flex items-center gap-2 rounded-sm text-label text-fg-3 uppercase hover:text-fg-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
      >
        <SvgIcon box={[24, 24]} size={18}>
          <path d="M19 12H5.5M11.5 6 5.5 12l6 6" {...LINE} />
        </SvgIcon>
        Back
      </Link>
    </div>
  );
}
