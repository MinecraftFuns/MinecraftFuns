import type { RootedPath } from "../schema.ts";
import { andThen, invalid, ok, type Parsed } from "../prelude/adt.ts";
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

declare const postPathBrand: unique symbol;

/**
 * An archive path whose shape has been checked. Branded, so `routeOf` and
 * `hrefOf` cannot be handed a record assembled by hand; the sole assertion is
 * in `parsePostPath` below, which is the only thing that establishes it.
 *
 * The brand states shape and deliberately not agreement with the post's date.
 * That is a property of the *pair* `(id, date)` rather than of this value, so
 * it is `reconcile`'s to check and no type here can carry it.
 */
export type PostPath = {
  readonly year: string;
  readonly month: string;
  readonly slug: string;
  readonly [postPathBrand]: true;
};

/**
 * Four digits, a real month, and a kebab-case slug. Anchored, so nothing
 * deeper than `YYYY/MM/slug` parses; an extra folder level is a mistake
 * rather than a silently accepted nesting.
 */
const POST_ID = new RegExp(`^(\\d{4})/(0[1-9]|1[0-2])/(${SLUG_SOURCE})$`);

/**
 * Total: every string maps to a variant, none throws.
 *
 * The three captures are read by destructuring rather than by index, because
 * `RegExp` is typed without reference to its pattern: to the checker a group
 * that the anchored expression above guarantees is indistinguishable from one
 * that may not have participated. Testing them costs one comparison and keeps
 * the module free of an assertion that only a reader of the pattern can
 * discharge. There is still exactly one way to fail.
 */
export const parsePostPath = (id: string): Parsed<PostPath> => {
  const [, year, month, slug] = POST_ID.exec(id) ?? [];

  return year === undefined || month === undefined || slug === undefined
    ? invalid(
        `expected YYYY/MM/kebab-case-slug, got ${JSON.stringify(id)}; a post file belongs at src/content/blog/YYYY/MM/slug.md`,
      )
    : ok({ year, month, slug } as PostPath);
};

/** The archive folder a post's own date says it belongs in. */
export const archiveOf = (date: IsoDate): string => `${yearOf(date)}/${monthOf(date)}`;

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
export const hrefOf = (path: PostPath): RootedPath => `/blog/${routeOf(path)}`;
