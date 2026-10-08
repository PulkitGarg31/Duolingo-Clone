/*
 * The tiny Markdown subset used by guidebook tips: "## " headings, paragraphs split by blank lines,
 * **bold**, "- " bullet items and "> " callout lines. It parses into plain data that components render as
 * React elements, so nothing in a tip can ever become HTML. Anything outside the subset stays literal text.
 */

/** A run of text, bold or not. */
export interface MdSpan {
  text: string;
  bold: boolean;
}

export type MdBlock =
  | { type: "heading"; spans: MdSpan[] }
  | { type: "paragraph"; spans: MdSpan[] }
  | { type: "list"; items: MdSpan[][] }
  | { type: "callout"; spans: MdSpan[] };

/** Lines that join the block above them when they are of the same kind; a heading always stands alone. */
type GroupKind = "text" | "bullet" | "callout";

type Line = { kind: "blank" } | { kind: "heading" | GroupKind; content: string };

interface Group {
  kind: GroupKind;
  lines: string[];
}

function classify(raw: string): Line {
  const line = raw.trim();
  if (line === "") return { kind: "blank" };
  if (line.startsWith("## ")) return { kind: "heading", content: line.slice(3).trim() };
  if (line.startsWith("- ")) return { kind: "bullet", content: line.slice(2).trim() };
  if (line === ">" || line.startsWith("> ")) return { kind: "callout", content: line.slice(1).trim() };
  return { kind: "text", content: line };
}

function toBlock({ kind, lines }: Group): MdBlock {
  switch (kind) {
    case "text":
      return { type: "paragraph", spans: parseSpans(lines.join(" ")) };
    case "callout":
      return { type: "callout", spans: parseSpans(lines.filter(Boolean).join(" ")) };
    case "bullet":
      return { type: "list", items: lines.map(parseSpans) };
  }
}

/** Splits a tip into blocks. Missing or blank input gives no blocks. */
export function parseMarkdownLite(source: string | null | undefined): MdBlock[] {
  const blocks: MdBlock[] = [];
  let open: Group | null = null;

  for (const line of (source ?? "").split(/\r?\n/).map(classify)) {
    if (open && line.kind === open.kind) {
      open.lines.push(line.content);
      continue;
    }
    if (open) blocks.push(toBlock(open));
    open = null;
    if (line.kind === "heading") blocks.push({ type: "heading", spans: parseSpans(line.content) });
    else if (line.kind !== "blank") open = { kind: line.kind, lines: [line.content] };
  }
  if (open) blocks.push(toBlock(open));
  return blocks;
}

/** Appends text to the last span when the weight matches, so neighbouring runs merge. */
function append(spans: MdSpan[], text: string, bold: boolean): void {
  if (!text) return;
  const last = spans.at(-1);
  if (last?.bold === bold) last.text += text;
  else spans.push({ text, bold });
}

/** Reads **bold** runs. An unpaired or empty pair of markers stays as literal text. */
export function parseSpans(text: string): MdSpan[] {
  const parts = text.split("**");
  // An even part count means the last marker has no partner: glue it back as text.
  if (parts.length % 2 === 0) parts.splice(-2, 2, `${parts.at(-2)}**${parts.at(-1)}`);

  const spans: MdSpan[] = [];
  parts.forEach((part, index) => {
    const between = index % 2 === 1;
    if (between && part.trim() === "") append(spans, `**${part}**`, false);
    else append(spans, part, between);
  });
  return spans;
}
