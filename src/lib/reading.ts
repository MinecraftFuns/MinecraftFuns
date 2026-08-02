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

  /* Count the runs of non-whitespace directly. Splitting on whitespace and
     then discarding the empties filters away an artefact of the split rather
     than anything about the prose. */
  const words = prose.match(/\S+/g)?.length ?? 0;

  // Never zero: "0 min" reads as broken rather than as short.
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
};
