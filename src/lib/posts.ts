import { getCollection, type CollectionEntry } from "astro:content";

import { collect, inContext, mapParsed, orThrow } from "../prelude/adt.ts";
import { memoiseBy, once } from "../prelude/memo.ts";
import { hrefOf, reconcile, type PostPath } from "./archive.ts";
import type { PostTag } from "./labels.ts";
import { readingMinutes } from "./reading.ts";
import { slugify } from "./slug.ts";
import { taxonomy, type Taxon } from "./taxonomy.ts";
import { byRecencyWith, type IsoDate } from "./time.ts";
import { routeUrl, type Href } from "./url.ts";

/* Re-exported: a tag is part of the blog's vocabulary, and no consumer should
   need to know which leaf module the brand is declared in. */
export type { PostTag } from "./labels.ts";

/**
 * The blog's read model. Pages consume these types rather than raw collection
 * entries, so the shape a template renders is decided once. Reading time and
 * URL are derived, so neither can drift out of sync with the post.
 */

/**
 * An entry paired with its archive path, decoded once at the boundary. A
 * `CollectionEntry` carries a raw `id` that nothing has checked, and `PostPath`
 * is branded, so the pair cannot be assembled around a hand-written path.
 *
 * What the type does not carry is that the path was *reconciled* against the
 * entry's date. That is a fact about the pairing rather than about either
 * half, so it holds by `publishedPosts` being the only producer, not by
 * construction.
 */
export type PublishedPost = {
  readonly entry: CollectionEntry<"blog">;
  readonly path: PostPath;
};

export type PostSummary = {
  readonly title: string;
  readonly description: string;
  readonly href: Href;
  readonly date: IsoDate;
  readonly readingMinutes: number;
  readonly tags: readonly PostTag[];
};

/*
 * Keyed by entry id, because a summary is a function of the post and the build
 * reads the same posts from several pages: the index, the tag pages, and each
 * article. `readingMinutes` scans the whole body, so an archive of P posts read
 * from K pages was O(P x K) full-body scans and is now O(P).
 *
 * Memoising here rather than over the whole list keeps the home page paying for
 * the three posts it shows rather than for every post ever written.
 */
export const summarise = memoiseBy(
  ({ entry }: PublishedPost) => entry.id,
  ({ entry, path }: PublishedPost): PostSummary => ({
    title: entry.data.title,
    description: entry.data.description,
    href: routeUrl(hrefOf(path)),
    date: entry.data.date,
    readingMinutes: readingMinutes(entry.body ?? ""),
    /* Already `PostTag[]`: the collection schema decodes each tag through
       `parsePostTag`, so nothing is asserted here. */
    tags: entry.data.tags,
  }),
);

/**
 * Published posts, newest first. Two policies live here rather than in each
 * page: draft filtering, since a draft leaking onto the one page that forgot
 * the predicate is what a choke point removes, and path reconciliation, since
 * a misfiled post should fail the build once rather than render a plausible
 * wrong URL everywhere it is listed.
 */
export const publishedPosts = once(async (): Promise<readonly PublishedPost[]> => {
  const entries = await getCollection("blog", ({ data }) => !data.draft);

  /* `collect`, not `orThrow` per entry: three misfiled posts are three facts
     about the archive, and reporting them one build at a time turns one
     mistake into three builds. Each reason carries its own file, since the
     batch has one context and the mistakes have several. */
  const posts = collect(
    entries.map((entry) =>
      mapParsed(
        inContext(reconcile(entry.id, entry.data.date), `${entry.id}.md`),
        (path) => ({ entry, path }),
      ),
    ),
  );

  return byRecencyWith(
    orThrow(posts, "src/content/blog"),
    (post) => post.entry.data.date,
  );
});

/**
 * Published posts as summaries, newest first. Truncation happens before
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
  (await publishedPosts()).slice(0, limit).map(summarise);

/**
 * Where a tag leads, derived rather than stored, so the link a post renders
 * and the route `taxonomy` generates are two calls to one function. A tag with
 * no usable segment, or two sharing one, fails the build in `postTags`.
 */
export const tagHref = (tag: PostTag): Href => routeUrl(`/blog/tags/${slugify(tag)}`);

/** The blog's tags, alphabetically, each with its posts newest first. */
export const postTags = async (): Promise<readonly Taxon<PostTag, PostSummary>[]> =>
  orThrow(
    taxonomy(await postSummaries(), (post) => post.tags),
    "blog tags",
  );
