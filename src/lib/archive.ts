import { andThen, invalid, ok, type Parsed } from "./adt.ts";
import { SLUG_SOURCE } from "./slug.ts";
import { monthOf, yearOf, type IsoDate } from "./time.ts";

/**
 * The archive scheme: a post lives at `YYYY/MM/slug` and is served from
 * `/blog/YYYY/MM/slug/`.
 *
 * The folders restate the first two components of the frontmatter `date`,
 * which is authoritative, so the interesting question is what happens when the
 * two disagree. A file dated 2026-08-01 sitting in `2026/07/` is representable
 * and invisible: the folder listing and the rendered page each look correct.
 *
 * Redundancy is safe exactly when one copy is authoritative and something
 * checks the other against it. `reconcile` is that check, and it runs at the
 * collection boundary, so every path downstream already agrees with its date.
 *
 * The glob stays `**\/*.md` rather than tightening to `*\/*\/*.md`: a pattern
 * that excludes a misplaced file makes it vanish silently, where loading and
 * refusing it names the file and fails the build.
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
const POST_ID = new RegExp(`^(\\d{4})/(0[1-9]|1[0-2])/(${SLUG_SOURCE})$`);

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
export const reconcile = (id: string, date: IsoDate): Parsed<PostPath> =>
  andThen(parsePostPath(id), (path) => {
    const declared = `${path.year}/${path.month}`;
    const expected = archiveOf(date);

    return declared === expected
      ? ok(path)
      : invalid(
          `filed under ${declared} but dated ${date}, which belongs in ${expected}`,
        );
  });

/** The route parameter for `/blog/[...slug]`. */
export const routeOf = (path: PostPath): string =>
  `${path.year}/${path.month}/${path.slug}`;

/** The site-relative URL, before the deployment base is applied. */
export const hrefOf = (path: PostPath): string => `/blog/${routeOf(path)}`;
