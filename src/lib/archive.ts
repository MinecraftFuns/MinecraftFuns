import { invalid, ok, type Parsed } from "./adt.ts";
import { monthOf, yearOf, type IsoDate } from "./time.ts";

/**
 * The archive scheme: a post lives at `YYYY/MM/slug` and is served from
 * `/blog/YYYY/MM/slug/`.
 *
 * The month segments are redundant. A post's authoritative date is its
 * frontmatter `date`, and the folders restate the first two components of it,
 * so the interesting question is not how to build the URL but what happens
 * when the two disagree. A file dated 2026-08-01 sitting in `2026/07/` is a
 * representable state, and one nobody would notice: both the folder listing
 * and the rendered page look entirely correct on their own.
 *
 * Redundancy is safe exactly when one copy is authoritative and something
 * checks the other against it. `reconcile` is that check. It runs at the
 * collection boundary, so every value downstream carries a path already proven
 * to agree with the date it came from.
 *
 * The glob pattern stays `**\/*.md` rather than tightening to `*\/*\/*.md`,
 * because a pattern that excludes a misplaced file makes it vanish silently.
 * Loading it and refusing it names the file and fails the build.
 */

export type PostPath = {
  readonly year: string;
  readonly month: string;
  readonly slug: string;
};

/**
 * Four digits, a real month, and a kebab-case slug. Anchored, so nothing
 * deeper than `YYYY/MM/slug` parses; an extra folder level is a mistake
 * rather than a silently accepted nesting.
 */
const POST_ID = /^(\d{4})\/(0[1-9]|1[0-2])\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;

/** Total: every string maps to a variant, none throws. */
export const parsePostPath = (id: string): Parsed<PostPath> => {
  const match = POST_ID.exec(id);
  return match === null
    ? invalid(
        `expected YYYY/MM/kebab-case-slug, got ${JSON.stringify(id)}; a post file belongs at src/content/blog/YYYY/MM/slug.md`,
      )
    : ok({ year: match[1], month: match[2], slug: match[3] });
};

/** The archive folder a post's own date says it belongs in. */
export const archiveOf = (date: IsoDate): string =>
  `${yearOf(date)}/${monthOf(date)}`;

/**
 * A path parsed *and* reconciled against the date it claims to encode. The
 * only constructor callers should use: `parsePostPath` alone proves the shape
 * is well formed, which is the weaker of the two properties that matter.
 */
export const reconcile = (id: string, date: IsoDate): Parsed<PostPath> => {
  const parsed = parsePostPath(id);
  if (parsed.tag !== "ok") return parsed;

  const { year, month } = parsed.value;
  const declared = `${year}/${month}`;
  const expected = archiveOf(date);

  return declared === expected
    ? parsed
    : invalid(
        `filed under ${declared} but dated ${date}, which belongs in ${expected}`,
      );
};

/** The route parameter for `/blog/[...slug]`. */
export const routeOf = (path: PostPath): string =>
  `${path.year}/${path.month}/${path.slug}`;

/** The site-relative URL, before the deployment base is applied. */
export const hrefOf = (path: PostPath): string => `/blog/${routeOf(path)}`;
