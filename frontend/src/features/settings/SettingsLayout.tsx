import { useId, type ReactNode } from "react";
import { ComingSoonPill } from "@/components/ui";
import { cn } from "@/lib/cn";

/*
 * The settings page's building blocks: titled sections, label-and-control rows split by 2 px rules, and
 * rows for options that are not built yet.
 */

const LABEL = "text-body font-extrabold text-fg";

interface SettingsSectionProps {
  title: string;
  /** Lets links and the section menu scroll here ("/settings#daily-goal"). */
  id?: string;
  children: ReactNode;
}

export function SettingsSection({ title, id, children }: SettingsSectionProps) {
  const headingId = useId();
  return (
    <section id={id} aria-labelledby={headingId} className="scroll-mt-24">
      <h2 id={headingId} className="mt-8 mb-2 text-heading text-fg-strong">
        {title}
      </h2>
      {children}
    </section>
  );
}

interface SettingRowProps {
  label: ReactNode;
  /** The control's id, so clicking the label reaches the control. */
  htmlFor?: string;
  /** For wide controls (a select): the control drops under the label on narrow phones. */
  stackOnPhones?: boolean;
  children: ReactNode;
}

/** A label on the left and its control (switch, select) on the right. */
export function SettingRow({ label, htmlFor, stackOnPhones = false, children }: SettingRowProps) {
  return (
    <div
      className={cn(
        "flex min-h-[78px] justify-between gap-4 border-b-2 border-line py-4",
        stackOnPhones ? "flex-col gap-y-3 sm:flex-row sm:items-center" : "items-center",
      )}
    >
      {htmlFor ? (
        <label htmlFor={htmlFor} className={cn(LABEL, "cursor-pointer")}>
          {label}
        </label>
      ) : (
        <div className={LABEL}>{label}</div>
      )}
      {children}
    </div>
  );
}

/** An option we have not built yet. It stays clickable and opens the Coming soon modal. */
export function ComingSoonRow({ label, onSelect }: { label: string; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex min-h-[78px] w-full cursor-pointer items-center justify-between gap-4 border-b-2 border-line py-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <span className={LABEL}>{label}</span>
      <ComingSoonPill />
    </button>
  );
}

/** The label above a full-width field (display name, time zone). */
export function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className={LABEL}>
      {children}
    </label>
  );
}
