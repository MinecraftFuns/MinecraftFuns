import type { BlogConfig } from "../schema.ts";

/**
 * How the blog's listings are cut up.
 *
 * `pageSize` twelve is about a screen and a half of rows, and leaves the last
 * page of the current archive nearly full rather than holding a stray two.
 *
 * `tagPreview` six is where the archive's own tag distribution divides: the
 * six most-written-about tags cover four posts or more, and everything below
 * them holds three or fewer, so the cut falls on a gap rather than through a
 * crowd. Raise it and the strip starts listing tags with a single post on
 * them; lower it and it stops naming what the blog is mostly about.
 */
export const blog = {
  pageSize: 12,
  tagPreview: 6,
} as const satisfies BlogConfig;
