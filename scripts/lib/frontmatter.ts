/** Parse an `.astro` frontmatter fence and preserve source offsets. */

/** Opening fence, module body, closing fence. */
const FENCE = /^(---\r?\n)([\s\S]*?)(\r?\n---)/;

/** Return the module body and its start/end offsets, if fenced. */
export type Frontmatter = {
  readonly body: string;
  /** Index of the body's first character. */
  readonly start: number;
  /** Index of the template's first character. */
  readonly after: number;
};

export const frontmatter = (source: string): Frontmatter | undefined => {
  /* Destructuring narrows the groups for downstream callers. */
  const [whole, open, body] = FENCE.exec(source) ?? [];
  if (whole === undefined || open === undefined || body === undefined) return undefined;

  return { body, start: open.length, after: whole.length };
};

/** Blank the template while preserving module-body offsets and line numbers. */
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
