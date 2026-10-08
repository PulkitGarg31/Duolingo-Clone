/** A run of the solution's text, `changed` when the learner's answer did not have it. */
export interface Highlighted {
  text: string;
  changed: boolean;
}

const WORD = /[\p{L}\p{N}'’]+/gu;
const LETTER = /[\p{L}\p{N}]/u;

/**
 * The solution with the words the learner's answer lacks marked, for a wrong typed or word-bank answer.
 * Words are compared without case, punctuation or accents; the solution's own text is kept as written.
 */
export function highlightWords(given: string, solution: string): Highlighted[] {
  const parts = splitWords(solution);
  const solutionWords = parts.filter((part) => part.word).map((part) => normalizeWord(part.text));
  const givenWords = (given.match(WORD) ?? []).map(normalizeWord);
  const kept = commonMask(solutionWords, givenWords);
  let index = 0;
  return merge(parts.map((part) => ({ text: part.text, changed: part.word ? !kept[index++] : false })));
}

/**
 * The solution with the letters that differ from the learner's answer marked: a typo's wrong letter or a
 * missing accent. Case is ignored, and so are spaces and punctuation.
 */
export function highlightCharacters(given: string, solution: string): Highlighted[] {
  const characters = Array.from(solution);
  const letters = characters.filter((character) => LETTER.test(character)).map(lower);
  const givenLetters = Array.from(given).filter((character) => LETTER.test(character)).map(lower);
  const kept = commonMask(letters, givenLetters);
  let index = 0;
  return merge(characters.map((text) => ({ text, changed: LETTER.test(text) ? !kept[index++] : false })));
}

function splitWords(text: string): { text: string; word: boolean }[] {
  const parts: { text: string; word: boolean }[] = [];
  let end = 0;
  for (const match of text.matchAll(WORD)) {
    if (match.index > end) parts.push({ text: text.slice(end, match.index), word: false });
    parts.push({ text: match[0], word: true });
    end = match.index + match[0].length;
  }
  if (end < text.length) parts.push({ text: text.slice(end), word: false });
  return parts;
}

function normalizeWord(word: string): string {
  return lower(word.normalize("NFD").replace(/\p{M}/gu, "").replace("’", "'"));
}

function lower(text: string): string {
  return text.toLocaleLowerCase("es");
}

/**
 * For each entry of `a`, whether it belongs to a longest common subsequence of `a` and `b`: the entries the
 * learner got, in order. The rest are the differences to mark.
 */
function commonMask(a: readonly string[], b: readonly string[]): boolean[] {
  // lengths[i][j] = length of the longest common subsequence of a[i..] and b[j..].
  const lengths = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lengths[i][j] = a[i] === b[j] ? lengths[i + 1][j + 1] + 1 : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }
  const mask = new Array<boolean>(a.length).fill(false);
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      mask[i] = true;
      i += 1;
      j += 1;
    } else if (lengths[i + 1][j] >= lengths[i][j + 1]) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return mask;
}

/** Joins neighbouring runs with the same mark. */
function merge(runs: Highlighted[]): Highlighted[] {
  const merged: Highlighted[] = [];
  for (const run of runs) {
    const last = merged.at(-1);
    if (last && last.changed === run.changed) last.text += run.text;
    else merged.push({ ...run });
  }
  return merged;
}
