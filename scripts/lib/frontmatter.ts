/**
 * The frontmatter fence of an `.astro` file, parsed once for every gate: a
 * fence matched by two patterns is a fence with two definitions of where it
 * ends. Offsets are returned alongside the body, since a caller that reports a
 * position needs the body's place in the file.
 */

/** Opening fence, module body, closing fence. */
const FENCE = /^(---\r?\n)([\s\S]*?)(\r?\n---)/;

/**
 * `{ body, start, after }` for a fenced file, or `undefined` for one without
 * frontmatter. `start` indexes the body's first character; `after` indexes
 * the template's, so the two halves partition the file exactly.
 */
export type Frontmatter = {
  readonly body: string;
  /** Index of the body's first character. */
  readonly start: number;
  /** Index of the template's first character. */
  readonly after: number;
};

export const frontmatter = (source: string): Frontmatter | undefined => {
  /* Destructured rather than indexed: `RegExp` is typed without reference to
     its pattern, so a group this one guarantees looks optional to a checker.
     Naming the three costs one comparison and leaves `body` a definite string
     for every caller downstream. */
  const [whole, open, body] = FENCE.exec(source) ?? [];
  if (whole === undefined || open === undefined || body === undefined) return undefined;

  return { body, start: open.length, after: whole.length };
};

/**
 * The file with everything outside the module body blanked to spaces, newlines
 * kept. Blanking preserves offsets, so a parser reads `.astro` frontmatter and
 * still reports lines that match the file; slicing the body out would put
 * every line number off by the height of the fence.
 */
export const moduleBodyOnly = (source: string): string => {
  const parsed = frontmatter(source);
  if (parsed === undefined) return blank(source);

  return (
    blank(source.slice(0, parsed.start)) +
    parsed.body +
    blank(source.slice(parsed.start + parsed.body.length))
  );
};

/** Same length, same lines, no content. */
const blank = (text: string): string => text.replaceAll(/[^\n]/g, " ");
