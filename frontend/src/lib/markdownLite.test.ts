import { describe, expect, it } from "vitest";
import { parseMarkdownLite, parseSpans } from "./markdownLite";

const plain = (text: string) => ({ text, bold: false });
const bold = (text: string) => ({ text, bold: true });

describe("parseMarkdownLite", () => {
  it("reads a ## heading", () => {
    expect(parseMarkdownLite("## Nouns have gender")).toEqual([{ type: "heading", spans: [plain("Nouns have gender")] }]);
  });

  it("joins the lines of a paragraph and starts a new one after a blank line", () => {
    expect(parseMarkdownLite("Every noun is\nmasculine or feminine.\n\nLearn the article too.")).toEqual([
      { type: "paragraph", spans: [plain("Every noun is masculine or feminine.")] },
      { type: "paragraph", spans: [plain("Learn the article too.")] },
    ]);
  });

  it("ends a heading at its own line, so text right below it is a paragraph", () => {
    expect(parseMarkdownLite("## Nouns have gender\nSpanish nouns are masculine (**el** pan).")).toEqual([
      { type: "heading", spans: [plain("Nouns have gender")] },
      { type: "paragraph", spans: [plain("Spanish nouns are masculine ("), bold("el"), plain(" pan).")] },
    ]);
  });

  it("groups consecutive - lines into one bullet list", () => {
    expect(parseMarkdownLite("- **el** pan\n- **la** leche")).toEqual([
      { type: "list", items: [[bold("el"), plain(" pan")], [bold("la"), plain(" leche")]] },
    ]);
  });

  it("groups consecutive > lines into one callout", () => {
    expect(parseMarkdownLite("> Learn each noun\n> with its article.")).toEqual([
      { type: "callout", spans: [plain("Learn each noun with its article.")] },
    ]);
  });

  it("switches blocks when the kind of line changes", () => {
    expect(parseMarkdownLite("Two verbs:\n- como\n- bebo\n> Both end in -o.").map((block) => block.type)).toEqual([
      "paragraph",
      "list",
      "callout",
    ]);
  });

  it("keeps everything outside the subset as plain text", () => {
    const source = "# Big title\n\n### Small title\n\n1. first *item* [a link](https://example.com) | a | b |";
    expect(parseMarkdownLite(source)).toEqual([
      { type: "paragraph", spans: [plain("# Big title")] },
      { type: "paragraph", spans: [plain("### Small title")] },
      { type: "paragraph", spans: [plain("1. first *item* [a link](https://example.com) | a | b |")] },
    ]);
  });

  it("never turns markup into HTML: tags stay literal text", () => {
    const source = '<b>hi</b> <script>alert("x")</script> <img src=x onerror=alert(1)>';
    expect(parseMarkdownLite(source)).toEqual([{ type: "paragraph", spans: [plain(source)] }]);
  });

  it("returns no blocks for missing, empty or blank input", () => {
    expect(parseMarkdownLite(null)).toEqual([]);
    expect(parseMarkdownLite(undefined)).toEqual([]);
    expect(parseMarkdownLite("")).toEqual([]);
    expect(parseMarkdownLite("  \n\n \t")).toEqual([]);
  });

  it("accepts Windows line endings and surrounding spaces", () => {
    expect(parseMarkdownLite("  ## Tú and usted  \r\n\r\n- **tú**: friends\r\n")).toEqual([
      { type: "heading", spans: [plain("Tú and usted")] },
      { type: "list", items: [[bold("tú"), plain(": friends")]] },
    ]);
  });

  it("parses a complete tip", () => {
    const tip = [
      "## Questions and exclamations",
      "",
      "Spanish opens every question with **¿** and every exclamation with **¡**.",
      "",
      "- **¿Cómo estás?** How are you?",
      "- **¡Hola, Ana!** Hello, Ana!",
      "",
      "> You never have to type ¿ or ¡ in an answer.",
    ].join("\n");
    expect(parseMarkdownLite(tip)).toEqual([
      { type: "heading", spans: [plain("Questions and exclamations")] },
      {
        type: "paragraph",
        spans: [plain("Spanish opens every question with "), bold("¿"), plain(" and every exclamation with "), bold("¡"), plain(".")],
      },
      {
        type: "list",
        items: [
          [bold("¿Cómo estás?"), plain(" How are you?")],
          [bold("¡Hola, Ana!"), plain(" Hello, Ana!")],
        ],
      },
      { type: "callout", spans: [plain("You never have to type ¿ or ¡ in an answer.")] },
    ]);
  });
});

describe("parseSpans", () => {
  it("returns one plain span for text without markers", () => {
    expect(parseSpans("Mi hermano es alto.")).toEqual([plain("Mi hermano es alto.")]);
  });

  it("reads several bold runs", () => {
    expect(parseSpans("**alto** and **alta** mean tall")).toEqual([bold("alto"), plain(" and "), bold("alta"), plain(" mean tall")]);
  });

  it("leaves an unpaired ** as literal text", () => {
    expect(parseSpans("**como** I eat, **comes")).toEqual([bold("como"), plain(" I eat, **comes")]);
  });

  it("treats an empty pair as literal text", () => {
    expect(parseSpans("a **** b")).toEqual([plain("a **** b")]);
  });
});
