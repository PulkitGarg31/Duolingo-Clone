/** The break between two units on the path: two rules with the next unit's title between them. */
export function UnitDivider({ id, title }: { id: string; title: string }) {
  return (
    <div className="mt-10 mb-8 flex items-center gap-4 px-4 md:px-0">
      <span aria-hidden="true" className="h-0.5 min-w-12 flex-1 bg-line" />
      <h2 id={id} className="text-center text-subtitle text-fg-3">
        {title}
      </h2>
      <span aria-hidden="true" className="h-0.5 min-w-12 flex-1 bg-line" />
    </div>
  );
}
