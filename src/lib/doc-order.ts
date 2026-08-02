import { site } from "../config/site.ts";

/**
 * How the docs list is ordered.
 *
 * Separate from `lib/docs.ts` for the reason `lib/archive.ts` is separate from
 * `lib/posts.ts`: this half is pure and can be tested on its own, while the
 * other half reaches for the content collection and cannot. Ordering is
 * precisely the sort of rule that deserves a test.
 */

/** Everything the order depends on, and nothing else. */
export type DocOrder = {
  readonly title: string;
  readonly slug: string;
};

/*
 * Built once and reused. `localeCompare` negotiates a collator on every call,
 * and a comparator is called O(n log n) times; the same reason the audit's
 * severity ranks are a `Map` rather than an array scan.
 *
 * The site's locale rather than the machine's, so the order is a property of
 * the site and not of whoever ran the build.
 */
const COLLATOR = new Intl.Collator(site.locale);

/**
 * A *total* order, so the list is a function of the docs rather than of the
 * order the loader happened to walk the directory in.
 *
 * Title alone is not enough. Sorting is stable, so two docs sharing a title
 * would keep whatever order the filesystem handed over, which is not a
 * property of the content and can differ between machines. The slug breaks the
 * tie, and slugs are unique because they are file names, so no two docs can
 * compare equal and the order is fully determined.
 */
export const compareDocs = (a: DocOrder, b: DocOrder): number => {
  const byTitle = COLLATOR.compare(a.title, b.title);
  return byTitle !== 0 ? byTitle : COLLATOR.compare(a.slug, b.slug);
};
