import { useId, type ReactNode } from "react";
import { ButtonLink } from "@/components/ui";
import { cn } from "@/lib/cn";

interface RailCardProps {
  /** The card's heading; cards without one (the Super promo) lay out their own top. */
  title?: ReactNode;
  /** A header link such as VIEW ALL. */
  link?: { label: string; href: string };
  children: ReactNode;
  className?: string;
}

/** The right rail's card: a 2 px outline, 16 px corners and padding, a title row with an optional link. */
export function RailCard({ title, link, children, className }: RailCardProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={title ? headingId : undefined}
      className={cn("rounded-lg border-2 border-line bg-page p-4", className)}
    >
      {title && (
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 id={headingId} className="text-card-title text-fg">
            {title}
          </h2>
          {link && (
            <ButtonLink href={link.href} variant="ghost" size="inline" className="shrink-0">
              {link.label}
            </ButtonLink>
          )}
        </div>
      )}
      {children}
    </section>
  );
}
