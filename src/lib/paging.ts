import { invalid, nonEmpty, ok, type NonEmpty, type Parsed } from "../prelude/adt.ts";
import type { RootedPath } from "../schema.ts";
import { routeUrl, type Href } from "./url.ts";

/** Pure pagination independent of Astro; page one uses the listing route. */

/** Positive integer rows per page. */
declare const pageSizeBrand: unique symbol;
export type PageSize = number & { readonly [pageSizeBrand]: true };

export const parsePageSize = (size: number): Parsed<PageSize> =>
  Number.isInteger(size) && size >= 1
    ? ok(size as PageSize)
    : invalid(`${size} is not a whole number of rows per page, at least one`);

/** Non-empty page; navigation derives from its 1-based index and total. */
export type Page<T> = {
  readonly items: NonEmpty<T>;
  readonly index: number;
  readonly total: number;
};

/** Empty listing or non-empty pages. */
export type Listing<T> =
  | { readonly tag: "empty" }
  | { readonly tag: "pages"; readonly pages: NonEmpty<Page<T>> };

/** Cut ordered items into non-empty pages and stamp their totals. */
export const paginate = <T>(items: readonly T[], size: PageSize): Listing<T> => {
  const chunks: NonEmpty<T>[] = [];

  for (let start = 0; start < items.length; start += size) {
    const chunk = nonEmpty(items.slice(start, start + size));
    /* Narrow instead of asserting; empty chunks are impossible here. */
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

/** Page one uses `base`; later pages use `/page/N/`. */
export const pageHref = (base: RootedPath, index: number): Href =>
  index <= 1 ? routeUrl(base) : routeUrl(`${base}/page/${index}`);

/** Previous page, absent on the first. */
export const prevHref = (base: RootedPath, page: Page<unknown>): Href | undefined =>
  page.index <= 1 ? undefined : pageHref(base, page.index - 1);

/** Next page, absent on the last. */
export const nextHref = (base: RootedPath, page: Page<unknown>): Href | undefined =>
  page.index >= page.total ? undefined : pageHref(base, page.index + 1);

/** Pages after the first; route files generate these. */
export const restPages = <T>(listing: Listing<T>): readonly Page<T>[] =>
  listing.tag === "empty" ? [] : listing.pages.filter((page) => page.index > 1);

/** First page, or nothing for an empty listing. */
export const firstPage = <T>(listing: Listing<T>): Page<T> | undefined =>
  listing.tag === "empty" ? undefined : listing.pages[0];
