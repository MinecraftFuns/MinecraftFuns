import type { RootedPath } from "../schema.ts";
import { andThen, invalid, ok, type Parsed } from "../prelude/adt.ts";
import { LANG_SOURCE, type Lang } from "./lang.ts";
import { SLUG_SOURCE } from "./slug.ts";
import { monthOf, yearOf, type IsoDate } from "./time.ts";

/**
 * Archive paths own article identity; filenames own rendition language.
 * Folder date components are redundant but authoritative `date` is reconciled
 * against them at the collection boundary. Broad globbing makes misplaced
 * files fail visibly instead of disappearing.
 */

declare const postPathBrand: unique symbol;

/** Branded archive identity; date agreement belongs to `reconcile`. */
export type PostPath = {
  readonly year: string;
  readonly month: string;
  readonly slug: string;
  readonly [postPathBrand]: true;
};

/** Decoded file identity: shared article path plus this file's language. */
export type RenditionId = {
  readonly path: PostPath;
  readonly lang: Lang;
};

/** Anchored `YYYY/MM/slug/lang` pattern with language alternation from `LANGS`. */
const RENDITION_ID = new RegExp(
  `^(\\d{4})/(0[1-9]|1[0-2])/(${SLUG_SOURCE})/(${LANG_SOURCE})$`,
);

/** Parse the anchored ID; explicit capture checks avoid an assertion. */
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
    : /* Pattern establishes both the branded path shape and closed language. */
      ok({ path: { year, month, slug } as PostPath, lang: lang as Lang });
};

/** The archive folder an article's own date says it belongs in. */
export const archiveOf = (date: IsoDate): string => `${yearOf(date)}/${monthOf(date)}`;

/** Parse an ID and reconcile its folder date with authoritative frontmatter. */
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

/** Spell a language-suffixed route; placement policy belongs to `article.ts`. */
export const langRouteOf = (path: PostPath, lang: Lang): string =>
  `${routeOf(path)}/${lang}`;

export const langHrefOf = (path: PostPath, lang: Lang): RootedPath =>
  `/blog/${langRouteOf(path, lang)}`;
