/** Reading time derived from body text, not frontmatter. */

/** Technical-prose reading rate. */
const WORDS_PER_MINUTE = 200;

/** Han reading rate, since whitespace does not define words. */
const HAN_PER_MINUTE = 300;

const HAN = /\p{Script=Han}/gu;

/** Match non-whitespace runs containing letters or digits. */
const WORD = /\S*[\p{L}\p{N}]\S*/gu;

/** Strip Markdown syntax and count Latin words plus Han characters. */
export const readingMinutes = (markdown: string): number => {
  const prose = markdown
    .replace(/```[\s\S]*?```/g, " ") // fenced code
    .replace(/`[^`]*`/g, " ") // inline code
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // links and images, keeping the text
    .replace(/^\s{0,3}(?:#{1,6}|>|[-*+]|\d+\.)\s+/gm, " ") // markers
    .replace(/[*_~]/g, " ");

  /* Mixed text uses both rates. */
  const han = prose.match(HAN)?.length ?? 0;
  const words = prose.replace(HAN, " ").match(WORD)?.length ?? 0;

  // Keep short posts at one minute.
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE + han / HAN_PER_MINUTE));
};
