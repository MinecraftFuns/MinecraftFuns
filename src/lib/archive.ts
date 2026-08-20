import type { RootedPath } from "../schema.ts";
import { andThen, invalid, ok, type Parsed } from "../prelude/adt.ts";
import { LANG_SOURCE, type Lang } from "./lang.ts";
import { SLUG_SOURCE } from "./slug.ts";
import { monthOf, yearOf, type IsoDate } from "./time.ts";

/**
 * The archive scheme: an article is the folder `YYYY/MM/slug`, holding one
 * file per language rendition, and is served from `/blog/YYYY/MM/slug/`.
 *
 * The folder owns the slug, so "one slug, one article" is a fact of the
 * filesystem: two renditions of an article are two files in one directory,
 * and a second file for the same language is the same path, which cannot
 * exist twice. The language lives in the filename and nowhere else; a
 * frontmatter `lang` field would be a second copy for the first to disagree
 * with.
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
 * The glob stays `**\/*.md` rather than tightening to `*\/*\/*\/*.md`: a
 * pattern that excludes a misplaced file makes it vanish silently, where
 * loading and refusing it names the file and fails the build. A flat
 * `slug.md` from the pre-rendition layout arrives here and is refused with
 * the shape it should have taken.
 */

declare const postPathBrand: unique symbol;

/**
 * An article's identity: where it sits in the archive, with no language in
 * it. Branded, so `routeOf` and `hrefOf` cannot be handed a record assembled
 * by hand; the sole assertion is in `parseRenditionId` below, which is the
 * only thing that establishes it.
 *
 * The brand states shape and deliberately not agreement with the article's
 * date. That is a property of the *pair* `(id, date)` rather than of this
 * value, so it is `reconcile`'s to check and no type here can carry it.
 */
export type PostPath = {
  readonly year: string;
  readonly month: string;
  readonly slug: string;
  readonly [postPathBrand]: true;
};

/**
 * One file of the collection, decoded: which article it belongs to and which
 * language it renders. A product, not a wider `PostPath`: the path is shared
 * by every rendition of an article and is what routes and hrefs are built
 * from, while the language belongs to this file alone.
 */
export type RenditionId = {
  readonly path: PostPath;
  readonly lang: Lang;
};

/**
 * Four digits, a real month, a kebab-case slug, and a declared language.
 * Anchored, so nothing deeper than `YYYY/MM/slug/lang` parses; an extra
 * folder level is a mistake rather than a silently accepted nesting. The
 * language alternation is derived from `LANGS`, so the pattern cannot admit
 * a language the union does not name.
 */
const RENDITION_ID = new RegExp(
  `^(\\d{4})/(0[1-9]|1[0-2])/(${SLUG_SOURCE})/(${LANG_SOURCE})$`,
);

/**
 * Total: every string maps to a variant, none throws.
 *
 * The four captures are read by destructuring rather than by index, because
 * `RegExp` is typed without reference to its pattern: to the checker a group
 * that the anchored expression above guarantees is indistinguishable from one
 * that may not have participated. Testing them costs one comparison each and
 * keeps the module free of an assertion that only a reader of the pattern can
 * discharge. There is still exactly one way to fail.
 */
export const parseRenditionId = (id: string): Parsed<RenditionId> => {
  const [, year, month, slug, lang] = RENDITION_ID.exec(id) ?? [];

  return year === undefined ||
    month === undefined ||
    slug === undefined ||
    lang === undefined
    ? invalid(
        `expected YYYY/MM/kebab-case-slug/language, got ${JSON.stringify(id)}; ` +
          `an article is a folder holding one file per language, ` +
          `src/content/blog/YYYY/MM/slug/(${LANG_SOURCE}).md`,
      )
    : /* Two assertions, each discharged by the anchored pattern: the brand by
         the shape as a whole, the `Lang` by an alternation derived from
         `LANGS`, which can therefore match nothing outside the union. */
      ok({ path: { year, month, slug } as PostPath, lang: lang as Lang });
};

/** The archive folder an article's own date says it belongs in. */
export const archiveOf = (date: IsoDate): string => `${yearOf(date)}/${monthOf(date)}`;

/**
 * An id parsed *and* reconciled against the date it claims to encode. The
 * only constructor callers should use: `parseRenditionId` alone proves the
 * shape is well formed, which is the weaker of the two properties that
 * matter.
 */
export const reconcile = (id: string, date: IsoDate): Parsed<RenditionId> =>
  andThen(parseRenditionId(id), (rendition) => {
    const declared = `${rendition.path.year}/${rendition.path.month}`;
    const expected = archiveOf(date);

    return declared === expected
      ? ok(rendition)
      : invalid(
          `filed under ${declared} but dated ${date}, which belongs in ${expected}`,
        );
  });

/** The route parameter for `/blog/[...slug]`: the article, no language. */
export const routeOf = (path: PostPath): string =>
  `${path.year}/${path.month}/${path.slug}`;

/** The article's site-relative URL, before the deployment base is applied. */
export const hrefOf = (path: PostPath): RootedPath => `/blog/${routeOf(path)}`;

/**
 * Where a language-suffixed copy of the article is served. Mechanical on
 * purpose: whether a given rendition *should* live at a suffixed URL, or at
 * the bare one, is `lib/article.ts`'s policy, and this function only spells
 * the suffixed form.
 */
export const langRouteOf = (path: PostPath, lang: Lang): string =>
  `${routeOf(path)}/${lang}`;

export const langHrefOf = (path: PostPath, lang: Lang): RootedPath =>
  `/blog/${langRouteOf(path, lang)}`;
