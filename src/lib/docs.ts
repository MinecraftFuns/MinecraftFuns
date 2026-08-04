import { getCollection, type CollectionEntry } from "astro:content";

import type { RootedPath } from "../schema.ts";
import { nav } from "../config/site.ts";
import { collect, inContext, mapParsed, orThrow } from "../prelude/adt.ts";
import { memoiseBy, once } from "../prelude/memo.ts";
import { compareDocs, type DocOrder } from "./doc-order.ts";
import type { DocCategory } from "./labels.ts";
import { readingMinutes } from "./reading.ts";
import { parseSlug, slugify } from "./slug.ts";
import { taxonomy, type Taxon } from "./taxonomy.ts";
import { routeUrl, type Href } from "./url.ts";

/* Re-exported, as `PostTag` is from `lib/posts.ts`. */
export type { DocCategory } from "./labels.ts";

/**
 * The docs read model, the flat counterpart to `lib/posts.ts`. Both
 * differences follow from a doc having no date: no archive folders to
 * reconcile, so the slug is the whole of its identity, and no recency to sort
 * by, so the order is alphabetical.
 */

/**
 * An entry paired with its validated slug, as `PublishedPost` is with its
 * path. The slug is a plain string rather than a branded one: `hrefOf` here
 * takes the same segment `slugify` produces for a category, and a brand would
 * oblige every such call site to handle a failure the taxonomy has already
 * ruled out. `publishedDocs` refusing a non-flat id is what holds it.
 */
export type PublishedDoc = {
  readonly entry: CollectionEntry<"docs">;
  readonly slug: string;
};

export type DocSummary = {
  readonly title: string;
  readonly description: string;
  readonly href: Href;
  readonly readingMinutes: number;
  readonly category: DocCategory;
};

/** The site-relative URL, before the deployment base is applied. */
export const hrefOf = (slug: string): RootedPath => `/docs/${slug}`;

/**
 * Docs are never in the site nav: the nav frames the personal site in the
 * first person, and docs drop that bar entirely, so an entry pointing here
 * would advertise a section and strand the reader in it. `Extract` over the
 * literal hrefs makes adding one a typecheck failure rather than a comment.
 */
type DocsInNav = Extract<(typeof nav)[number]["href"], `/docs${string}`>;

const _docsAreNotInNav: [DocsInNav] extends [never] ? true : never = true;
void _docsAreNotInNav;

/* Keyed by entry id, for the reason given in `lib/posts.ts`. */
export const summarise = memoiseBy(
  ({ entry }: PublishedDoc) => entry.id,
  ({ entry, slug }: PublishedDoc): DocSummary => ({
    title: entry.data.title,
    description: entry.data.description,
    href: routeUrl(hrefOf(slug)),
    readingMinutes: readingMinutes(entry.body ?? ""),
    /* Already a `DocCategory`, decoded by the collection schema. */
    category: entry.data.category,
  }),
);

/**
 * Published docs, in `compareDocs` order. `orThrow` rather than a filter: a
 * doc nested in a folder is a mistake to report, not a document to hide.
 */
export const publishedDocs = once(async (): Promise<readonly PublishedDoc[]> => {
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

  return orThrow(
    docs,
    "src/content/docs holds one file per doc, with no folders",
  ).toSorted((a, b) => compareDocs(order(a), order(b)));
});

export const docSummaries = async (): Promise<readonly DocSummary[]> =>
  (await publishedDocs()).map(summarise);

/** Where a category leads. One function, as `tagHref` is for a tag. */
export const categoryHref = (category: DocCategory): Href =>
  routeUrl(`/docs/categories/${slugify(category)}`);

/**
 * The docs' categories, alphabetically, each with its docs by title. A doc has
 * exactly one category, so the singleton list is not a limitation worked
 * around: it is what "one category" looks like to a function taking labels.
 */
export const docCategories = async (): Promise<
  readonly Taxon<DocCategory, DocSummary>[]
> =>
  orThrow(
    taxonomy(await docSummaries(), (doc) => [doc.category]),
    "doc categories",
  );
