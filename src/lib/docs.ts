import { getCollection, type CollectionEntry } from "astro:content";

import { collect, inContext, mapParsed, orThrow } from "./adt.ts";
import { compareDocs, type DocOrder } from "./doc-order.ts";
import { readingMinutes } from "./reading.ts";
import { nav } from "../config/site.ts";
import { parseSlug, slugify } from "./slug.ts";
import { taxonomy, type Taxon } from "./taxonomy.ts";
import { routeUrl } from "./url.ts";

/**
 * The docs read model, the flat counterpart to `lib/posts.ts`. Both
 * differences follow from a doc having no date: no archive folders to
 * reconcile, so the slug is the whole of its identity, and no recency to sort
 * by, so the order is alphabetical.
 */

/**
 * An entry paired with its validated slug, as `PublishedPost` is with its
 * path. Only `publishedDocs` can build one, and it refuses an id that is not a
 * flat kebab-case slug.
 */
export type PublishedDoc = {
  readonly entry: CollectionEntry<"docs">;
  readonly slug: string;
};

declare const docCategoryBrand: unique symbol;

/**
 * The subject a doc belongs to. One per doc, and not a tag: branded against
 * `PostTag`, since both may spell "networking" while indexing different
 * collections. Separate types are what stop the two taxonomies pooling the
 * first time somebody writes a helper that takes "the labels".
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
 * Docs are never in the site nav: the nav frames the personal site in the
 * first person, and docs drop that bar entirely, so an entry pointing here
 * would advertise a section and strand the reader in it. `Extract` over the
 * literal hrefs makes adding one a typecheck failure rather than a comment.
 */
type DocsInNav = Extract<(typeof nav)[number]["href"], `/docs${string}`>;

const _docsAreNotInNav: [DocsInNav] extends [never] ? true : never = true;
void _docsAreNotInNav;

export const summarise = ({ entry, slug }: PublishedDoc): DocSummary => ({
  title: entry.data.title,
  description: entry.data.description,
  href: routeUrl(hrefOf(slug)),
  readingMinutes: readingMinutes(entry.body ?? ""),
  /* Branded at the one place frontmatter becomes the read model. */
  category: entry.data.category as DocCategory,
});

/**
 * Published docs, in `compareDocs` order. `orThrow` rather than a filter: a
 * doc nested in a folder is a mistake to report, not a document to hide.
 */
export const publishedDocs = async (): Promise<readonly PublishedDoc[]> => {
  const entries = await getCollection("docs", ({ data }) => !data.draft);

  /* Every nested file named at once, for the reason `publishedPosts` collects
     its own: the mistakes are independent of each other. */
  const docs = collect(
    entries.map((entry) =>
      mapParsed(inContext(parseSlug(entry.id), `${entry.id}.md`), (slug) => ({
        entry,
        slug,
      })),
    ),
  );

  const order = ({ entry, slug }: PublishedDoc): DocOrder => ({
    title: entry.data.title,
    slug,
  });

  return orThrow(docs, "src/content/docs holds one file per doc, with no folders")
    .toSorted((a, b) => compareDocs(order(a), order(b)));
};

export const docSummaries = async (): Promise<readonly DocSummary[]> =>
  (await publishedDocs()).map(summarise);

/** Where a category leads. One function, as `tagHref` is for a tag. */
export const categoryHref = (category: DocCategory): string =>
  routeUrl(`/docs/categories/${slugify(category)}`);

/**
 * The docs' categories, alphabetically, each with its docs by title. A doc has
 * exactly one category, so the singleton list is not a limitation worked
 * around: it is what "one category" looks like to a function taking labels.
 */
export const docCategories = async (): Promise<
  readonly Taxon<DocCategory, DocSummary>[]
> => taxonomy(await docSummaries(), (doc) => [doc.category], "doc categories");
