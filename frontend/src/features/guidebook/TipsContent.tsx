import { Fragment } from "react";
import { LightbulbIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import type { MdBlock, MdSpan } from "@/lib/markdownLite";

const BODY = "text-[17px] leading-[27px] font-semibold text-fg";

/** The unit's grammar tips: one "## " heading per tip, then its paragraphs, bullet lists and callouts. */
export function TipsContent({ blocks }: { blocks: readonly MdBlock[] }) {
  return (
    <div className="mt-4">
      {blocks.map((block, index) => (
        <TipBlock key={index} block={block} />
      ))}
    </div>
  );
}

function TipBlock({ block }: { block: MdBlock }) {
  switch (block.type) {
    case "heading":
      return (
        <h2 className="mt-10 mb-3 text-heading text-fg-strong">
          <Spans spans={block.spans} />
        </h2>
      );
    case "paragraph":
      return (
        <p className={cn("my-3", BODY)}>
          <Spans spans={block.spans} />
        </p>
      );
    case "list":
      return (
        <ul className={cn("my-3 list-disc space-y-1 pl-6 marker:text-fg-3", BODY)}>
          {block.items.map((item, index) => (
            <li key={index}>
              <Spans spans={item} />
            </li>
          ))}
        </ul>
      );
    case "callout":
      return (
        <aside className="my-5 flex gap-3 rounded-md bg-selected p-4">
          <LightbulbIcon size={24} className="mt-0.5 shrink-0" />
          <p className={BODY}>
            <Spans spans={block.spans} />
          </p>
        </aside>
      );
  }
}

/** Text runs as React text nodes: tips can never inject markup. */
function Spans({ spans }: { spans: readonly MdSpan[] }) {
  return spans.map((span, index) =>
    span.bold ? (
      <strong key={index} className="font-extrabold">
        {span.text}
      </strong>
    ) : (
      <Fragment key={index}>{span.text}</Fragment>
    ),
  );
}
