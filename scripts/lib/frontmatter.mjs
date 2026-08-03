/**
 * The frontmatter fence of an `.astro` file, parsed once for every gate.
 *
 * Two source checks need to tell the module body from the template, and a
 * fence matched by two different patterns is a fence with two definitions of
 * where it ends. This is the one.
 *
 * Offsets, not substrings alone: a caller that reports a position needs the
 * body's place in the file, and recovering that from the body's length is
 * exactly how the two drift apart.
 */

/** Opening fence, module body, closing fence. */
const FENCE = /^(---\r?\n)([\s\S]*?)(\r?\n---)/;

/**
 * `{ body, start, after }` for a fenced file, or `undefined` for one without
 * frontmatter. `start` indexes the body's first character; `after` indexes
 * the template's, so the two halves partition the file exactly.
 */
export const frontmatter = (source) => {
  const match = FENCE.exec(source);
  if (match === null) return undefined;

  return {
    body: match[2],
    start: match[1].length,
    after: match[0].length,
  };
};

/**
 * The file rewritten so only its module body survives, with every other
 * character replaced by a space and every newline kept.
 *
 * This is what lets a parser read `.astro` frontmatter while still reporting
 * positions that match the file on disk: blanking preserves offsets, whereas
 * slicing the body out would make every line number a lie by however many
 * lines the fence occupies.
 */
export const moduleBodyOnly = (source) => {
  const parsed = frontmatter(source);
  if (parsed === undefined) return blank(source);

  return (
    blank(source.slice(0, parsed.start)) +
    parsed.body +
    blank(source.slice(parsed.start + parsed.body.length))
  );
};

/** Same length, same lines, no content. */
const blank = (text) => text.replaceAll(/[^\n]/g, " ");
