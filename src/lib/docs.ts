import { getCollection, type CollectionEntry } from "astro:content";

import { orThrow } from "./adt.ts";
import { compareDocs, type DocOrder } from "./doc-order.ts";
import { readingMinutes } from "./reading.ts";
import { nav } from "../config/site.ts";
import { parseSlug } from "./slug.ts";
import { routeUrl } from "./url.ts";

/**
 * The docs read model, the flat counterpart to `lib/posts.ts`.
 *
 * The two differ in exactly two ways, and both follow from what a doc is. A
 * doc has no date, so it has no archive folders to reconcile and its slug is
 * the whole of its identity; and with no date there is no recency to sort by,
 * so the order is alphabetical, which is the order somebody scanning a
 * reference list expects.
 */

/**
 * An entry paired with its validated slug.
 *
 * The pairing is what makes the slug trustworthy downstream, exactly as
 * `PublishedPost` does for a post's path: a `CollectionEntry` carries a raw
 * `id` that nothing has checked, and this type can only be built by
 * `publishedDocs`, which refuses an id that is not a flat kebab-case slug.
 */
export type PublishedDoc = {
  readonly entry: CollectionEntry<"docs">;
  readonly slug: string;
};

declare const docCategoryBrand: unique symbol;

/**
 * The subject a doc belongs to. One per doc, and not a tag.
 *
 * Branded against `PostTag` rather than merely named differently. Both are
 * strings and both may spell "networking", but they index different
 * collections, so a list mixing them is meaningless. Making them separate
 * types is what stops the two taxonomies pooling the first time somebody
 * writes a helper that takes "the labels".
 */
export type DocCategory = string & { readonly [docCategoryBrand]: true };

export type DocSummary = {
  readonly title: string;
  readonly description: string;
  readonly href: string;
  readonly readingMinutes: number;
  readonly category: DocCategory;
};

/** The site-relative URL, before the deployment base is applied. */
export const hrefOf = (slug: string): string => `/docs/${slug}`;

/**
 * Docs are never in the site nav, and this is where that is enforced.
 *
 * The nav frames the personal site in the first person; docs are reference
 * material that deliberately drops the bar entirely, so an entry pointing here
 * would advertise a section and then strand the reader in it. A comment would
 * record the decision. `Extract` over the literal hrefs, which `as const`
 * preserves, makes adding one a typecheck failure instead: the assertion below
 * only holds while nothing under `/docs` appears in `nav`.
 */
type DocsInNav = Extract<(typeof nav)[number]["href"], `/docs${string}`>;

const _docsAreNotInNav: [DocsInNav] extends [never] ? true : never = true;
void _docsAreNotInNav;

export const summarise = ({ entry, slug }: PublishedDoc): DocSummary => ({
  title: entry.data.title,
  description: entry.data.description,
  href: routeUrl(hrefOf(slug)),
  readingMinutes: readingMinutes(entry.body ?? ""),
  /* Branded here, at the one place a doc's frontmatter becomes the read model.
     Nothing downstream can mint one. */
  category: entry.data.category as DocCategory,
});

/**
 * Published docs, in `compareDocs` order.
 *
 * `orThrow` rather than a filter: a doc nested in a folder is a mistake to
 * report, not a document to hide. Dropping it silently is how a page goes
 * missing and nobody notices for a year.
 */
export const publishedDocs = async (): Promise<readonly PublishedDoc[]> => {
  const entries = await getCollection("docs", ({ data }) => !data.draft);

  const docs = entries.map((entry) => ({
    entry,
    slug: orThrow(
      parseSlug(entry.id),
      `src/content/docs/${entry.id}.md: docs are flat, so the file belongs directly in src/content/docs`,
    ),
  }));

  const order = ({ entry, slug }: PublishedDoc): DocOrder => ({
    title: entry.data.title,
    slug,
  });

  return docs.toSorted((a, b) => compareDocs(order(a), order(b)));
};

export const docSummaries = async (): Promise<readonly DocSummary[]> =>
  (await publishedDocs()).map(summarise);
