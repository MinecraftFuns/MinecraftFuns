import type { RootedPath } from "../schema.ts";
import {
  collect,
  inContext,
  mapParsed,
  nonEmpty,
  okUnless,
  type NonEmpty,
  type Parsed,
} from "../prelude/adt.ts";
import { clashesBy } from "../prelude/distinct.ts";
import { hrefOf, langHrefOf, routeOf, type PostPath } from "./archive.ts";
import { bcp47Of, byPreference, type Lang, type Translator } from "./lang.ts";
import type { PostTag } from "./labels.ts";
import { byRecencyWith, type IsoDate } from "./time.ts";

/**
 * The article algebra: renditions grouped by the folder that owns them, and
 * the invariants no single file can carry.
 *
 * Pure and generic in the entry payload `E`, so the whole of the multilingual
 * model is testable without `astro:content`; `lib/posts.ts` is the shell that
 * instantiates it at `CollectionEntry<"blog">`.
 *
 * There is no per-article "primary language" field anywhere in this model,
 * and that is the design: `LANGS` is a preference order, an article's
 * renditions are kept sorted by it, and the primary rendition is the *head*
 * of a `NonEmpty` list. A configured primary that an article lacks, the
 * classic invalid state of a default-language flag, is therefore not
 * representable: whatever the article has, its best rendition exists by the
 * type of the list it heads.
 *
 * Three facts hold of every `Article` this module returns, none of which a
 * per-file schema can see:
 *
 *  1. It has at least one rendition: `NonEmpty` says so.
 *  2. It has at least one *original*: an article whose every rendition is a
 *     translation has no source text anywhere, which is not a state to
 *     render but a mistake to name.
 *  3. Its renditions agree on the article-level facts, `date` and `tags`,
 *     and no two claim one language. Each file restates the shared facts,
 *     redundancy in the same sense as the archive folders restating the
 *     date: safe exactly because `assemble` checks it.
 *
 * That the list is preference-ordered is `assemble`'s to establish and, like
 * reconciliation in `lib/posts.ts`, holds by it being the only producer; a
 * property of the whole list is not one an element type can carry.
 */

// ---------------------------------------------------------------------------
// Renditions
// ---------------------------------------------------------------------------

/**
 * Who a rendition's text came from. A sum, not a nullable `Translator`: the
 * original is a positive fact about a file, not the absence of a field, even
 * though absence is how the frontmatter spells it.
 */
export type Provenance =
  { readonly tag: "original" } | { readonly tag: "translation"; readonly by: Translator };

/** The frontmatter decoding: no `translation` field means the original. */
export const provenanceOf = (translation: Translator | undefined): Provenance =>
  translation === undefined
    ? { tag: "original" }
    : { tag: "translation", by: translation };

/** One language's text of an article. */
export type Rendition<E> = {
  readonly lang: Lang;
  readonly provenance: Provenance;
  readonly entry: E;
};

export type Article<E> = {
  readonly path: PostPath;
  /** Agreed across renditions; `assemble` checked. */
  readonly date: IsoDate;
  /** Agreed across renditions, and monolingual: a tag is a `PostTag`, whose
   *  `Sluggable` proof only ASCII-representable labels can discharge. */
  readonly tags: readonly PostTag[];
  /** Distinct languages, sorted by `LANGS` preference; head is the primary. */
  readonly renditions: NonEmpty<Rendition<E>>;
};

// ---------------------------------------------------------------------------
// Elimination
// ---------------------------------------------------------------------------

/**
 * The rendition the bare URL serves: the article's best language by the
 * `LANGS` preference order. The head of a `NonEmpty`, so this is total and
 * needs no fallback branch; the fallback *is* the ordering.
 */
export const primary = <E>(article: Article<E>): Rendition<E> => article.renditions[0];

/** The rendition in `lang`, when the article has one. O(|LANGS|) at most. */
export const renditionOf = <E>(
  article: Article<E>,
  lang: Lang,
): Rendition<E> | undefined =>
  article.renditions.find((rendition) => rendition.lang === lang);

/**
 * Every rendition except the one in `lang`, in preference order: what a page
 * rendering that language links across to.
 */
export const othersOf = <E>(article: Article<E>, lang: Lang): readonly Rendition<E>[] =>
  article.renditions.filter((rendition) => rendition.lang !== lang);

/**
 * The rendition the translations were made from: the best-preferred one
 * marked original. For any rendition that *is* a translation this exists and
 * is a different rendition, by invariant 2; the `undefined` is for callers
 * asking about an article they have not checked.
 */
export const originalOf = <E>(article: Article<E>): Rendition<E> | undefined =>
  article.renditions.find((rendition) => rendition.provenance.tag === "original");

// ---------------------------------------------------------------------------
// URLs
// ---------------------------------------------------------------------------

/**
 * The canonical site-relative URL of one rendition: the bare URL for the
 * primary, the language-suffixed one for the rest. A sole rendition is its
 * article's primary whatever its language, so a Chinese-only article lives
 * at its slug: the language is metadata rather than identity.
 *
 * Every non-`SITE_LANG` rendition is additionally *served* at its suffixed
 * URL, primary or not (see `lib/posts.ts` and the blog route), so
 * `/blog/YYYY/MM/slug/zh/` holds from the day a Chinese rendition exists: a
 * better-preferred translation arriving later changes what the bare URL
 * renders, never where the Chinese lives. `SITE_LANG` alone needs no such
 * insurance, because nothing can ever displace it.
 */
export const canonicalPathOf = <E>(article: Article<E>, lang: Lang): RootedPath =>
  lang === primary(article).lang ? hrefOf(article.path) : langHrefOf(article.path, lang);

/** A language alternate, site-relative; the layout resolves it. */
export type Alternate = {
  readonly hrefLang: string;
  readonly route: RootedPath;
};

/**
 * The `hreflang` alternates every page of a multilingual article declares:
 * one per rendition plus `x-default` at the bare URL. Empty for a
 * monolingual article, which has no alternative to declare.
 */
export const alternatesOf = <E>(article: Article<E>): readonly Alternate[] =>
  article.renditions.length < 2
    ? []
    : [
        ...article.renditions.map((rendition) => ({
          hrefLang: bcp47Of(rendition.lang),
          route: canonicalPathOf(article, rendition.lang),
        })),
        { hrefLang: "x-default", route: hrefOf(article.path) },
      ];

// ---------------------------------------------------------------------------
// Assembly
// ---------------------------------------------------------------------------

/** One decoded file, as the shell hands it over: identity plus restated facts. */
export type RenditionRecord<E> = {
  readonly path: PostPath;
  readonly lang: Lang;
  readonly provenance: Provenance;
  readonly date: IsoDate;
  readonly tags: readonly PostTag[];
  readonly entry: E;
};

const sameTags = (a: readonly PostTag[], b: readonly PostTag[]): boolean =>
  a.length === b.length && a.every((tag, index) => tag === b[index]);

/**
 * The invariants of one folder's worth of files. Accumulating: an article
 * disagreeing on its date *and* missing its original is two findings, and
 * reporting them one build at a time turns one mistake into two builds.
 */
const article = <E>(records: readonly RenditionRecord<E>[]): Parsed<Article<E>[]> => {
  /* Unreachable through the filesystem, where two files for one language are
     one path, but this function is total over its actual input. */
  const duplicated = clashesBy(records, (record) => record.lang).map(
    ([, later]) => `two files both claim the ${later.lang} rendition`,
  );

  const [first, ...rest] = records;
  if (first === undefined) return okUnless(duplicated, []);

  const disagreements = rest.flatMap((record) => [
    ...(record.date === first.date
      ? []
      : [
          `renditions disagree on the date: ${first.lang}.md says ${first.date}, ${record.lang}.md says ${record.date}`,
        ]),
    ...(sameTags(record.tags, first.tags)
      ? []
      : [
          `renditions disagree on the tags: ${first.lang}.md lists [${first.tags.join(", ")}], ${record.lang}.md lists [${record.tags.join(", ")}]`,
        ]),
  ]);

  /* Invariant 2. This is also what refuses a lone translation: a single
     rendition marked `translation:` is an article whose source text exists
     nowhere. */
  const orphaned = records.some((record) => record.provenance.tag === "original")
    ? []
    : [
        "every rendition is marked translation:, so the original is missing; the rendition the others were translated from carries no translation: field",
      ];

  /*
   * The preference order is imposed here, once, where articles are minted:
   * every consumer downstream reads "best rendition" off the head of this
   * list rather than re-deriving the policy. `toSorted` keeps the input
   * untouched; the sort is over at most |LANGS| elements.
   */
  const renditions = nonEmpty(
    records
      .toSorted((a, b) => byPreference(a.lang, b.lang))
      .map(({ lang, provenance, entry }) => ({ lang, provenance, entry })),
  );

  /* `undefined` only when `records` was empty, which the destructuring above
     already returned on; spelled as a check rather than an assertion so the
     totality is the checker's to see. */
  return renditions === undefined
    ? okUnless(duplicated, [])
    : okUnless(
        [...duplicated, ...disagreements, ...orphaned],
        [
          {
            path: first.path,
            date: first.date,
            tags: first.tags,
            renditions,
          },
        ],
      );
};

/**
 * Group decoded files into articles and check what only the grouping can
 * check. One pass to group, one per article to verify: O(N) over the
 * collection with a `Map` keyed by the article route, against a filter per
 * article which would rescan the collection once per folder.
 *
 * Failures accumulate across articles, each labelled with the folder it
 * belongs to, and articles come back newest first: the one ordering every
 * consumer wants, established where the collection is admitted.
 */
export const assemble = <E>(
  records: readonly RenditionRecord<E>[],
): Parsed<readonly Article<E>[]> => {
  const grouped = new Map<string, RenditionRecord<E>[]>();

  for (const record of records) {
    const key = routeOf(record.path);
    const found = grouped.get(key);
    if (found === undefined) grouped.set(key, [record]);
    else found.push(record);
  }

  const articles = collect(
    [...grouped.entries()].map(([key, group]) =>
      inContext(article(group), `src/content/blog/${key}`),
    ),
  );

  return mapParsed(articles, (groups) =>
    byRecencyWith(groups.flat(), (item) => item.date),
  );
};
