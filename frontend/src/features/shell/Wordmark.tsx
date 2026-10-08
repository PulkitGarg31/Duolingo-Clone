import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

/** The product name set as a wordmark: lowercase, extra-heavy, in the brand green. It links home to the path. */
export function Wordmark() {
  return (
    <Link
      href="/learn"
      aria-label={`${APP_NAME}, go to Learn`}
      className="inline-block rounded-sm text-[34px] leading-[30px] font-black tracking-[-0.03em] text-owl lowercase focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-focus"
    >
      {APP_NAME}
    </Link>
  );
}
