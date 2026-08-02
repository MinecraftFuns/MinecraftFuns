import { getCollection, type CollectionEntry } from "astro:content";

import { readingMinutes } from "./reading.ts";
import { byRecencyWith, type IsoDate } from "./time.ts";
import { withBase } from "./url.ts";

/**
 * The blog's read model.
 *
 * Pages consume `PostSummary` rather than raw collection entries, so the shape
 * a template renders is decided once, here, instead of in each page. Reading
 * time and URL are derived rather than stored — neither can drift out of sync
 * with the post, because neither is written down.
 */
export type PostSummary = {
  readonly title: string;
  readonly description: string;
  readonly href: string;
  readonly date: IsoDate;
  readonly readingMinutes: number;
  readonly tags: readonly string[];
};

export const summarise = (entry: CollectionEntry<"blog">): PostSummary => ({
  title: entry.data.title,
  description: entry.data.description,
  href: withBase(`/blog/${entry.id}`),
  date: entry.data.date,
  readingMinutes: readingMinutes(entry.body ?? ""),
  tags: entry.data.tags,
});

/**
 * Published posts, newest first.
 *
 * Draft filtering happens here rather than in each page: a draft leaking onto
 * one page because that page forgot the predicate is exactly the kind of
 * mistake a single choke point removes.
 */
export const publishedPosts = async (): Promise<
  readonly CollectionEntry<"blog">[]
> =>
  byRecencyWith(
    await getCollection("blog", ({ data }) => !data.draft),
    (post) => post.data.date,
  );

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
