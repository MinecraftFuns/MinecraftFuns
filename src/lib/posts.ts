import { getCollection, type CollectionEntry } from "astro:content";

import { orThrow } from "./adt.ts";
import { hrefOf, reconcile, type PostPath } from "./archive.ts";
import { readingMinutes } from "./reading.ts";
import { byRecencyWith, type IsoDate } from "./time.ts";
import { withBase } from "./url.ts";

/**
 * The blog's read model.
 *
 * Pages consume these types rather than raw collection entries, so the shape a
 * template renders is decided once, here, instead of in each page. Reading time
 * and URL are derived rather than stored — neither can drift out of sync with
 * the post, because neither is written down.
 */

/**
 * An entry paired with its archive path, decoded once at the boundary.
 *
 * The pairing is what makes the path trustworthy downstream: a
 * `CollectionEntry` carries a raw `id` string that nothing has checked, while
 * this type can only be built by `publishedPosts`, which refuses any entry
 * whose folder contradicts its date.
 */
export type PublishedPost = {
  readonly entry: CollectionEntry<"blog">;
  readonly path: PostPath;
};

export type PostSummary = {
  readonly title: string;
  readonly description: string;
  readonly href: string;
  readonly date: IsoDate;
  readonly readingMinutes: number;
  readonly tags: readonly string[];
};

export const summarise = ({ entry, path }: PublishedPost): PostSummary => ({
  title: entry.data.title,
  description: entry.data.description,
  href: withBase(hrefOf(path)),
  date: entry.data.date,
  readingMinutes: readingMinutes(entry.body ?? ""),
  tags: entry.data.tags,
});

/**
 * Published posts, newest first.
 *
 * Two policies live here rather than in each page. Draft filtering, because a
 * draft leaking onto one page that forgot the predicate is exactly the mistake
 * a single choke point removes; and path reconciliation, because a misfiled
 * post should fail the build once rather than render a plausible wrong URL on
 * every page that lists it.
 */
export const publishedPosts = async (): Promise<readonly PublishedPost[]> => {
  const entries = await getCollection("blog", ({ data }) => !data.draft);

  const posts = entries.map((entry) => ({
    entry,
    path: orThrow(
      reconcile(entry.id, entry.data.date),
      `src/content/blog/${entry.id}.md`,
    ),
  }));

  return byRecencyWith(posts, (post) => post.entry.data.date);
};

/**
 * Published posts as summaries, newest first.
 *
 * Truncation happens before summarising, not after. `summarise` scans the full
 * body to derive reading time, so mapping first made the home page — which asks
 * for three — pay that scan for every post in the archive.
 */
export const postSummaries = async (
  limit?: number,
): Promise<readonly PostSummary[]> => {
  const posts = await publishedPosts();
  return (limit === undefined ? posts : posts.slice(0, limit)).map(summarise);
};
