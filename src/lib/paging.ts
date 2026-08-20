import { invalid, nonEmpty, ok, type NonEmpty, type Parsed } from "../prelude/adt.ts";
import type { RootedPath } from "../schema.ts";
import { routeUrl, type Href } from "./url.ts";

/**
 * Splitting a listing across addressable pages.
 *
 * Pure and total, and deliberately not Astro's `paginate()`: this runs under
 * `node --test` without a build, which is where the laws below are checked.
 *
 * The whole of the URL policy is one line, `pageHref`, and everything that
 * links a page goes through it. Page one is the listing's own route, so
 * `/blog/page/1/` is not merely unlinked but ungeneratable, and the archive
 * cannot serve one set of posts at two addresses.
 */

/** Rows per page: a whole number, at least one. Parsed from config. */
declare const pageSizeBrand: unique symbol;
export type PageSize = number & { readonly [pageSizeBrand]: true };

export const parsePageSize = (size: number): Parsed<PageSize> =>
  Number.isInteger(size) && size >= 1
    ? ok(size as PageSize)
    : invalid(`${size} is not a whole number of rows per page, at least one`);

/**
 * One page of a listing. `index` is 1-based and no greater than `total`.
 *
 * `items` is `NonEmpty` because a page a reader can navigate to always has
 * something on it; the listing with nothing in it is a different shape below,
 * not a page holding an empty list.
 *
 * There is deliberately no `prev`/`next` here. They are a function of `index`
 * and `total`, and storing them would put "prev is absent exactly when index
 * is 1" somewhere nothing enforces it.
 */
export type Page<T> = {
  readonly items: NonEmpty<T>;
  readonly index: number;
  readonly total: number;
};

/**
 * A listing: either nothing to show, or a run of pages each holding something.
 *
 * The sum is what keeps `Page.items` non-empty. Were `paginate` to always
 * return at least one page, the empty collection would need a page with no
 * items on it, and every consumer would carry a branch for a state that only
 * an empty blog produces.
 */
export type Listing<T> =
  | { readonly tag: "empty" }
  | { readonly tag: "pages"; readonly pages: NonEmpty<Page<T>> };

/**
 * Cut a list into pages, order preserved.
 *
 * Laws, checked in the tests: concatenating the pages returns the input
 * unchanged; there are `ceil(n / size)` of them; every page but the last holds
 * exactly `size` items; and `index` counts 1..total on every page.
 *
 * O(n) time and O(n) space for n items, in two passes: one to cut, one to
 * stamp each page with a total that is not known until the cutting is done.
 * Both are trivial at the scale of an archive, and the second pass is what
 * lets the total be *counted* rather than computed a second way.
 */
export const paginate = <T>(items: readonly T[], size: PageSize): Listing<T> => {
  const chunks: NonEmpty<T>[] = [];

  for (let start = 0; start < items.length; start += size) {
    const chunk = nonEmpty(items.slice(start, start + size));
    /* Always taken, `start` being less than the length; narrowing rather than
       asserting keeps the function total without a cast. */
    if (chunk !== undefined) chunks.push(chunk);
  }

  const pages = nonEmpty(
    chunks.map((page, position) => ({
      items: page,
      index: position + 1,
      total: chunks.length,
    })),
  );

  return pages === undefined ? { tag: "empty" } : { tag: "pages", pages };
};

/**
 * Where a page of a listing lives.
 *
 * Page one is the listing's own route, which is what keeps an archive from
 * answering at two addresses and splitting its own inbound links. Every other
 * page hangs off a literal `page` segment rather than sitting directly under
 * the listing, so `/blog/page/2/` cannot be confused with `/blog/2020/`, the
 * shape an article route already has.
 */
export const pageHref = (base: RootedPath, index: number): Href =>
  index <= 1 ? routeUrl(base) : routeUrl(`${base}/page/${index}`);

/** The page before this one, absent on the first. */
export const prevHref = (base: RootedPath, page: Page<unknown>): Href | undefined =>
  page.index <= 1 ? undefined : pageHref(base, page.index - 1);

/** The page after this one, absent on the last. */
export const nextHref = (base: RootedPath, page: Page<unknown>): Href | undefined =>
  page.index >= page.total ? undefined : pageHref(base, page.index + 1);

/**
 * The pages after the first, which are the ones a route file has to generate:
 * page one is served by the listing's own route.
 */
export const restPages = <T>(listing: Listing<T>): readonly Page<T>[] =>
  listing.tag === "empty" ? [] : listing.pages.filter((page) => page.index > 1);

/** The first page, or nothing when the listing is empty. */
export const firstPage = <T>(listing: Listing<T>): Page<T> | undefined =>
  listing.tag === "empty" ? undefined : listing.pages[0];
