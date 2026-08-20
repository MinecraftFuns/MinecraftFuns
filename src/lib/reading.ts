/** Estimated reading time derived from body text, never authored in frontmatter. */

/** Words per minute for technical prose, which reads slower than fiction. */
const WORDS_PER_MINUTE = 200;

/** Han text uses character rate because whitespace cannot define its words. */
const HAN_PER_MINUTE = 300;

const HAN = /\p{Script=Han}/gu;

/** Count non-whitespace runs containing a letter or digit, excluding punctuation. */
const WORD = /\S*[\p{L}\p{N}]\S*/gu;

/** Strip Markdown syntax and estimate words plus Han characters; rounding makes regexes sufficient. */
export const readingMinutes = (markdown: string): number => {
  const prose = markdown
    .replace(/```[\s\S]*?```/g, " ") // fenced code
    .replace(/`[^`]*`/g, " ") // inline code
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // links and images, keeping the text
    .replace(/^\s{0,3}(?:#{1,6}|>|[-*+]|\d+\.)\s+/gm, " ") // markers
    .replace(/[*_~]/g, " ");

  /* Count Han and non-Han text separately so mixed runs use both rates. */
  const han = prose.match(HAN)?.length ?? 0;
  const words = prose.replace(HAN, " ").match(WORD)?.length ?? 0;

  // Never zero: "0 min" reads as broken.
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE + han / HAN_PER_MINUTE));
};
