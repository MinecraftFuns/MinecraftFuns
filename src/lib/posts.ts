import { getCollection, type CollectionEntry } from "astro:content";

import { blog } from "../config/blog.ts";

import { andThen, collect, inContext, mapParsed, orThrow } from "../prelude/adt.ts";
import { memoiseBy, once } from "../prelude/memo.ts";
import { reconcile } from "./archive.ts";
import {
  assemble,
  canonicalPathOf,
  primary,
  provenanceOf,
  type Article,
  type Rendition,
} from "./article.ts";
import type { Lang } from "./lang.ts";
import type { PostTag } from "./labels.ts";
import { readingMinutes } from "./reading.ts";
import { browse, parsePreviewSize, type Browse, type PreviewSize } from "./browse.ts";
import { paginate, parsePageSize, type Listing, type PageSize } from "./paging.ts";
import { slugify } from "./slug.ts";
import { taxonomy, type Taxon } from "./taxonomy.ts";
import type { IsoDate } from "./time.ts";
import { routeUrl, type Href } from "./url.ts";
import type { RootedPath } from "../schema.ts";

/* Re-exported: a tag is part of the blog's vocabulary, and no consumer should
   need to know which leaf module the brand is declared in. */
export type { PostTag } from "./labels.ts";

/**
 * The blog's read model. Pages consume these types rather than raw collection
 * entries, so the shape a template renders is decided once. Reading time and
 * URL are derived, so neither can drift out of sync with the post.
 *
 * This module is the effect shell around `lib/article.ts`: it reads the
 * collection, decodes each file at the boundary, and hands the pure core a
 * list of records. Everything the core establishes, grouping, agreement,
 * the original's existence, arrives here already proved.
 */

/** An article of the blog collection: the shape every page consumes. */
export type PublishedArticle = Article<CollectionEntry<"blog">>;

export type PublishedRendition = Rendition<CollectionEntry<"blog">>;

export type PostSummary = {
  readonly title: string;
  readonly description: string;
  readonly href: Href;
  readonly date: IsoDate;
  /** The language of the rendition the row links to: the article's primary. */
  readonly lang: Lang;
  readonly readingMinutes: number;
  readonly tags: readonly PostTag[];
};

/*
 * Keyed by entry id, because reading time is a function of one rendition's
 * body and the build reads the same bodies from several pages: the index, the
 * tag pages, and each article. `readingMinutes` scans the whole body, so an
 * archive of P bodies read from K pages was O(P x K) full-body scans and is
 * now O(P). Shared by the summary and the article page, so a row and the
 * header it leads to cannot disagree.
 */
export const minutesOf = memoiseBy(
  (entry: CollectionEntry<"blog">) => entry.id,
  (entry: CollectionEntry<"blog">) => readingMinutes(entry.body ?? ""),
);

/*
 * A summary is of the article's *primary* rendition: the text the bare URL
 * serves and the row's link leads to. Title and description are that
 * rendition's own, in its language; date and tags are the article's,
 * rendition-independent by `assemble`'s check.
 */
export const summarise = memoiseBy(
  ({ path }: PublishedArticle) => `${path.year}/${path.month}/${path.slug}`,
  (article: PublishedArticle): PostSummary => {
    const rendition = primary(article);
    return {
      title: rendition.entry.data.title,
      description: rendition.entry.data.description,
      href: routeUrl(canonicalPathOf(article, rendition.lang)),
      date: article.date,
      lang: rendition.lang,
      readingMinutes: minutesOf(rendition.entry),
      /* Already `PostTag[]`: the collection schema decodes each tag through
         `parsePostTag`, so nothing is asserted here. */
      tags: article.tags,
    };
  },
);

/**
 * Published articles, newest first. Three policies live here rather than in
 * each page: draft filtering, since a draft leaking onto the one page that
 * forgot the predicate is what a choke point removes; path reconciliation,
 * since a misfiled file should fail the build once rather than render a
 * plausible wrong URL everywhere it is listed; and article assembly, which
 * checks what no single file can carry.
 *
 * Drafting is per rendition on purpose: an unfinished translation stays off
 * the site while the original publishes, and the article simply presents as
 * monolingual until the draft flag comes off.
 */
export const publishedArticles = once(async (): Promise<readonly PublishedArticle[]> => {
  const entries = await getCollection("blog", ({ data }) => !data.draft);

  /* `collect`, not `orThrow` per entry: three misfiled files are three facts
       about the archive, and reporting them one build at a time turns one
       mistake into three builds. Each reason carries its own file, since the
       batch has one context and the mistakes have several. */
  const records = collect(
    entries.map((entry) =>
      mapParsed(
        inContext(reconcile(entry.id, entry.data.date), `${entry.id}.md`),
        (rendition) => ({
          ...rendition,
          provenance: provenanceOf(entry.data.translation),
          date: entry.data.date,
          tags: entry.data.tags,
          entry,
        }),
      ),
    ),
  );

  /* Fail-fast between the stages of necessity: `assemble` groups by paths
       that only a successful decode produced. Within each stage, failures
       still accumulate. */
  return orThrow(andThen(records, assemble), "src/content/blog");
});

/**
 * Published articles as summaries, newest first. Truncation happens before
 * summarising: `summarise` scans the full body for reading time, so mapping
 * first would make the home page pay that scan for the whole archive.
 *
 * "All of them" is a limit like any other, spelled as the one number that
 * cannot truncate. An optional parameter would have made absence a second way
 * to say it, and a branch to tell the two apart.
 */
export const postSummaries = async (
  limit: number = Number.POSITIVE_INFINITY,
): Promise<readonly PostSummary[]> =>
  (await publishedArticles()).slice(0, limit).map(summarise);

/**
 * Where a tag leads, derived rather than stored, so the link a post renders
 * and the route `taxonomy` generates are two calls to one function. A tag with
 * no usable segment, or two sharing one, fails the build in `postTags`.
 */
export const tagHref = (tag: PostTag): Href => routeUrl(tagBase(tag));

/** The blog's tags, alphabetically, each with its posts newest first. */
export const postTags = async (): Promise<readonly Taxon<PostTag, PostSummary>[]> =>
  orThrow(
    taxonomy(await postSummaries(), (post) => post.tags),
    "blog tags",
  );

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

/**
 * The blog's listing shape, parsed from config at import so a page size of
 * zero fails the build rather than producing a route per post, or none.
 */
export const PAGE_SIZE: PageSize = orThrow(
  parsePageSize(blog.pageSize),
  "src/config/blog.ts pageSize",
);

export const TAG_PREVIEW: PreviewSize = orThrow(
  parsePreviewSize(blog.tagPreview),
  "src/config/blog.ts tagPreview",
);

/** Where the blog's own listing lives; every page of it derives from this. */
export const BLOG_BASE = "/blog" as const satisfies RootedPath;

/** Where a tag's listing lives. One function, so links and routes agree. */
export const tagBase = (tag: PostTag): RootedPath => `/blog/tags/${slugify(tag)}`;

/** All posts, cut into pages. */
export const postPages = async (): Promise<Listing<PostSummary>> =>
  paginate(await postSummaries(), PAGE_SIZE);

/** The tags the browse strip shows, and how many it leaves for the directory. */
export const tagBrowse = async (): Promise<
  Browse<Taxon<PostTag, PostSummary>> | undefined
> => browse(await postTags(), TAG_PREVIEW);
