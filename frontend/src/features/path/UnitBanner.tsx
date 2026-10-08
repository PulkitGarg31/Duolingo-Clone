"use client";

import { motion } from "motion/react";
import Link from "next/link";
import type { Ref } from "react";
import { NotebookIcon } from "@/components/icons";
import { useValueChange } from "@/features/shell/useValueChange";
import type { PathUnitOut } from "@/lib/api/types";
import { cn } from "@/lib/cn";
import { unitColorVariables } from "./unitColors";

interface UnitBannerProps {
  /** The unit in view under the banner. */
  unit: PathUnitOut;
  ref?: Ref<HTMLDivElement>;
}

/**
 * The sticky header of the path: two solid segments in the unit colour (the unit's name, and the GUIDEBOOK
 * button) sharing one lip. It stays pinned under the top bars and switches as the next unit scrolls under it:
 * the colour fades over 300 ms and the text crossfades. In dark mode the segments turn dark grey.
 */
export function UnitBanner({ unit, ref }: UnitBannerProps) {
  const change = useValueChange(unit.id);
  return (
    <div
      ref={ref}
      style={unitColorVariables(unit.color)}
      className={cn(
        "sticky top-(--topbar-h) z-(--z-topbar) bg-page lg:top-16 lg:z-(--z-sticky) xl:top-0 xl:pt-6",
        "[--banner-bg:var(--unit)] [--banner-lip:var(--unit-lip)] [--banner-rule:var(--unit-lip)]",
        "dark:[--banner-bg:var(--c-bg-subtle)] dark:[--banner-lip:#182329] dark:[--banner-rule:var(--c-line)]",
      )}
    >
      <div className="mb-1 flex text-on-color-fixed">
        <div className="min-h-[82px] min-w-0 flex-1 bg-(--banner-bg) px-4 shadow-[0_4px_0_var(--banner-lip)] transition-[background-color,box-shadow] duration-300 md:rounded-l-md">
          <motion.div
            key={unit.id}
            initial={change.count > 0 ? { opacity: 0 } : false}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.15 }}
          >
            <p className="mt-3 mb-0.5 text-overline uppercase opacity-70">
              Section {unit.section}, Unit {unit.number}
            </p>
            <p className="mb-3 text-[19px] leading-[22px] font-extrabold md:text-[22px] md:leading-7">{unit.title}</p>
          </motion.div>
        </div>
        {unit.hasGuidebook && (
          <Link
            href={`/guidebook/${unit.id}`}
            aria-label="Opens Guidebook for this unit"
            className={cn(
              "pressable flex shrink-0 items-center gap-2 border-l-2 border-(--banner-rule) bg-(--banner-bg) p-4 [--lip:4px] md:rounded-r-md md:p-6",
              "shadow-[0_4px_0_var(--banner-lip)] transition-[background-color,box-shadow] duration-300 hover:brightness-110",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
            )}
          >
            <NotebookIcon size={24} />
            <span className="hidden text-label tracking-[0.8px] uppercase xl:inline">Guidebook</span>
          </Link>
        )}
      </div>
    </div>
  );
}
