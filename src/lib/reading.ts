/**
 * Reading time.
 *
 * Derived from the post body rather than authored by hand: a number typed into
 * frontmatter is wrong the moment the post is edited, and nothing would catch
 * it. This is an estimate presented as an estimate; the point is a reader's
 * rough expectation, not precision.
 */

/** Words per minute for technical prose, which reads slower than fiction. */
const WORDS_PER_MINUTE = 200;

/**
 * Characters per minute for Han text, which has no word boundaries to count:
 * a Chinese paragraph is one unbroken run, so a word count rates a
 * three-thousand-character post at a minute. Characters are the unit that
 * reading-speed studies measure Chinese in; 300 a minute sits at the careful
 * end of their range, matching the 200 above for technical prose.
 */
const HAN_PER_MINUTE = 300;

const HAN = /\p{Script=Han}/gu;

/**
 * A run of non-whitespace containing at least one letter or digit. Bare
 * punctuation is excluded deliberately: with Han characters lifted out, a
 * Chinese sentence leaves its 。and ，behind, and counting those as words
 * would let punctuation density masquerade as prose.
 */
const WORD = /\S*[\p{L}\p{N}]\S*/gu;

/**
 * Total: every string maps to a positive integer.
 *
 * Markdown syntax is stripped before counting so that fences, link targets,
 * and image URLs do not inflate the estimate: a post is not longer because it
 * links to somewhere with a verbose URL.
 *
 * Patterns rather than a parser, and this is the case where that is the right
 * call rather than a shortcut. Markdown is structured and a real parse is
 * available in principle, since the toolchain already runs remark; but the
 * output feeds a word count that is rounded to whole minutes and presented as
 * an approximation. A parser would have to be threaded through the content
 * pipeline to change an estimate by less than its own rounding. The patterns
 * below approximate, which is all the answer needs to be, and each says which
 * construct it is approximating.
 */
export const readingMinutes = (markdown: string): number => {
  const prose = markdown
    .replace(/```[\s\S]*?```/g, " ") // fenced code
    .replace(/`[^`]*`/g, " ") // inline code
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // links and images, keeping the text
    .replace(/^\s{0,3}(?:#{1,6}|>|[-*+]|\d+\.)\s+/gm, " ") // markers
    .replace(/[*_~]/g, " ");

  /* Two counts on two clocks: Han characters at theirs, and what remains at
     the word rate. Lifting the Han text out first keeps a run like "用TypeScript写"
     from being one "word": its Latin core is counted as a word and its three
     Han characters as characters. */
  const han = prose.match(HAN)?.length ?? 0;
  const words = prose.replace(HAN, " ").match(WORD)?.length ?? 0;

  // Never zero: "0 min" reads as broken rather than as short.
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE + han / HAN_PER_MINUTE));
};
