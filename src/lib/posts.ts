import { getCollection, type CollectionEntry } from "astro:content";

import { collect, inContext, mapParsed, orThrow } from "./adt.ts";
import { hrefOf, reconcile, type PostPath } from "./archive.ts";
import { readingMinutes } from "./reading.ts";
import { slugify } from "./slug.ts";
import { taxonomy, type Taxon } from "./taxonomy.ts";
import { byRecencyWith, type IsoDate } from "./time.ts";
import { routeUrl } from "./url.ts";

/**
 * The blog's read model. Pages consume these types rather than raw collection
 * entries, so the shape a template renders is decided once. Reading time and
 * URL are derived, so neither can drift out of sync with the post.
 */

/**
 * An entry paired with its archive path, decoded once at the boundary. A
 * `CollectionEntry` carries a raw `id` that nothing has checked; this can only
 * be built by `publishedPosts`, which refuses an entry whose folder
 * contradicts its date.
 */
export type PublishedPost = {
  readonly entry: CollectionEntry<"blog">;
  readonly path: PostPath;
};

declare const postTagBrand: unique symbol;

/**
 * A label in the blog's taxonomy, branded so it cannot be confused with
 * `DocCategory`. Both are plain strings at runtime and may spell the same word,
 * but "networking" as a post tag and as a doc category are claims about
 * different collections, and a function pooling them is a bug the type system
 * can refuse rather than a convention somebody must remember.
 */
export type PostTag = string & { readonly [postTagBrand]: true };

export type PostSummary = {
  readonly title: string;
  readonly description: string;
  readonly href: string;
  readonly date: IsoDate;
  readonly readingMinutes: number;
  readonly tags: readonly PostTag[];
};

export const summarise = ({ entry, path }: PublishedPost): PostSummary => ({
  title: entry.data.title,
  description: entry.data.description,
  href: routeUrl(hrefOf(path)),
  date: entry.data.date,
  readingMinutes: readingMinutes(entry.body ?? ""),
  /* Branded per element rather than by casting the array: `string[]` and
     `PostTag[]` do not overlap, and forcing it through `unknown` would assert
     what the element-wise narrowing actually proves. */
  tags: entry.data.tags.map((tag) => tag as PostTag),
});

/**
 * Published posts, newest first. Two policies live here rather than in each
 * page: draft filtering, since a draft leaking onto the one page that forgot
 * the predicate is what a choke point removes, and path reconciliation, since
 * a misfiled post should fail the build once rather than render a plausible
 * wrong URL everywhere it is listed.
 */
export const publishedPosts = async (): Promise<readonly PublishedPost[]> => {
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
};

/**
 * Published posts as summaries, newest first. Truncation happens before
 * summarising: `summarise` scans the full body for reading time, so mapping
 * first would make the home page pay that scan for the whole archive.
 */
export const postSummaries = async (limit?: number): Promise<readonly PostSummary[]> => {
  const posts = await publishedPosts();
  return (limit === undefined ? posts : posts.slice(0, limit)).map(summarise);
};

/**
 * Where a tag leads, derived rather than stored, so the link a post renders
 * and the route `taxonomy` generates are two calls to one function. A tag with
 * no usable segment, or two sharing one, fails the build in `postTags`.
 */
export const tagHref = (tag: PostTag): string => routeUrl(`/blog/tags/${slugify(tag)}`);

/** The blog's tags, alphabetically, each with its posts newest first. */
export const postTags = async (): Promise<readonly Taxon<PostTag, PostSummary>[]> =>
  taxonomy(await postSummaries(), (post) => post.tags, "blog tags");
