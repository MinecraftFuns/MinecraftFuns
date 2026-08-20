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
 * Multilingual article model. `assemble` enforces nonempty renditions, one
 * original, shared date/tags, unique languages, and preference ordering.
 * `NonEmpty` makes the best available rendition the head, so no primary flag
 * can name a language an article lacks.
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

/** Decode absent `translation` as the original rendition. */
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
  /** Shared across renditions; `assemble` checks agreement. */
  readonly date: IsoDate;
  /** Shared tags; `PostTag` carries the sluggable proof. */
  readonly tags: readonly PostTag[];
  /** Unique, preference-ordered languages; head is primary. */
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

/** Find the rendition in `lang`, if present. */
export const renditionOf = <E>(
  article: Article<E>,
  lang: Lang,
): Rendition<E> | undefined =>
  article.renditions.find((rendition) => rendition.lang === lang);

/** Renditions other than `lang`, still preference ordered. */
export const othersOf = <E>(article: Article<E>, lang: Lang): readonly Rendition<E>[] =>
  article.renditions.filter((rendition) => rendition.lang !== lang);

/** Find the original rendition; unchecked articles may have none. */
export const originalOf = <E>(article: Article<E>): Rendition<E> | undefined =>
  article.renditions.find((rendition) => rendition.provenance.tag === "original");

// ---------------------------------------------------------------------------
// URLs
// ---------------------------------------------------------------------------

/** Bare URL for primary; language-suffixed URL for every other rendition. */
export const canonicalPathOf = <E>(article: Article<E>, lang: Lang): RootedPath =>
  lang === primary(article).lang ? hrefOf(article.path) : langHrefOf(article.path, lang);

/** A language alternate, site-relative; the layout resolves it. */
export type Alternate = {
  readonly hrefLang: string;
  readonly route: RootedPath;
};

/** Build reciprocal `hreflang` links plus `x-default` for multilingual articles. */
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

/** One decoded file: identity plus facts reconciled against its path. */
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

/** Validate one article's files, accumulating independent findings. */
const article = <E>(records: readonly RenditionRecord<E>[]): Parsed<Article<E>[]> => {
  /* Filesystem paths are unique per language; keep duplicate input handling total. */
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

  /* A translation-only article has no source and must fail validation. */
  const orphaned = records.some((record) => record.provenance.tag === "original")
    ? []
    : [
        "every rendition is marked translation:, so the original is missing; the rendition the others were translated from carries no translation: field",
      ];

  /* Establish preference order once; `toSorted` leaves input records untouched. */
  const renditions = nonEmpty(
    records
      .toSorted((a, b) => byPreference(a.lang, b.lang))
      .map(({ lang, provenance, entry }) => ({ lang, provenance, entry })),
  );

  /* Keep the empty case explicit so totality stays checkable without assertion. */
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

/** Group, validate, and recency-sort articles in one collection pass. */
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
