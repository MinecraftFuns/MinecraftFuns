import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  firstPage,
  nextHref,
  pageHref,
  paginate,
  parsePageSize,
  prevHref,
  restPages,
  type Page,
  type PageSize,
} from "./paging.ts";
import { orThrow } from "../prelude/adt.ts";

const size = (n: number): PageSize => orThrow(parsePageSize(n), "test");

/** The pages of a listing, or an empty list when there are none. */
const pagesOf = <T>(items: readonly T[], n: number): readonly Page<T>[] => {
  const listing = paginate(items, size(n));
  return listing.tag === "empty" ? [] : listing.pages;
};

const upTo = (n: number): readonly number[] => Array.from({ length: n }, (_, i) => i + 1);

describe("parsePageSize", () => {
  it("accepts a whole number of rows", () => {
    for (const n of [1, 12, 500]) assert.equal(parsePageSize(n).tag, "ok");
  });

  it("refuses sizes that would make a route per post, or no route at all", () => {
    for (const n of [0, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.equal(parsePageSize(n).tag, "invalid", `${n} should be refused`);
    }
  });
});

describe("paginate: the laws", () => {
  it("concatenating the pages returns the input, in order", () => {
    for (const n of [1, 2, 3, 5, 12, 50]) {
      const items = upTo(47);
      assert.deepEqual(
        pagesOf(items, n).flatMap((page) => [...page.items]),
        items,
        `size ${n} must lose and reorder nothing`,
      );
    }
  });

  it("produces ceil(n / size) pages", () => {
    for (const [count, per, expected] of [
      [47, 12, 4],
      [48, 12, 4],
      [49, 12, 5],
      [1, 12, 1],
      [12, 12, 1],
      [13, 12, 2],
    ] as const) {
      assert.equal(pagesOf(upTo(count), per).length, expected, `${count}/${per}`);
    }
  });

  it("fills every page but the last", () => {
    const pages = pagesOf(upTo(47), 12);
    const lengths = pages.map((page) => page.items.length);
    assert.deepEqual(lengths, [12, 12, 12, 11]);
  });

  it("numbers pages 1..total, and every page agrees on the total", () => {
    const pages = pagesOf(upTo(47), 12);
    assert.deepEqual(
      pages.map((page) => page.index),
      [1, 2, 3, 4],
    );
    assert.ok(pages.every((page) => page.total === pages.length));
  });

  it("has no empty page: a listing with nothing in it is the empty variant", () => {
    assert.deepEqual(paginate([], size(12)), { tag: "empty" });
    assert.ok(pagesOf(upTo(47), 12).every((page) => page.items.length > 0));
  });

  it("makes one full page when the count divides exactly", () => {
    // The off-by-one that would otherwise mint a trailing empty page.
    assert.equal(pagesOf(upTo(24), 12).length, 2);
  });
});

describe("pageHref: page one is the listing's own route", () => {
  it("never mints a /page/1/ address", () => {
    assert.equal(pageHref("/blog", 1), "/blog/");
    assert.equal(pageHref("/blog", 0), "/blog/");
    assert.equal(pageHref("/blog/tags/editorial", 1), "/blog/tags/editorial/");
  });

  it("hangs later pages off a literal segment, clear of the article shape", () => {
    // `/blog/2/` would sit in the same namespace as `/blog/2020/01/slug/`.
    assert.equal(pageHref("/blog", 2), "/blog/page/2/");
    assert.equal(pageHref("/blog/tags/editorial", 3), "/blog/tags/editorial/page/3/");
  });
});

describe("neighbours", () => {
  const pages = pagesOf(upTo(47), 12);

  it("has no previous on the first page and no next on the last", () => {
    assert.equal(prevHref("/blog", pages[0]!), undefined);
    assert.equal(nextHref("/blog", pages[3]!), undefined);
  });

  it("walks to the listing's own route rather than to /page/1/", () => {
    assert.equal(prevHref("/blog", pages[1]!), "/blog/");
  });

  it("walks forward and back through the middle", () => {
    assert.equal(nextHref("/blog", pages[1]!), "/blog/page/3/");
    assert.equal(prevHref("/blog", pages[2]!), "/blog/page/2/");
  });

  it("offers no neighbours at all when everything fits on one page", () => {
    const [only] = pagesOf(upTo(5), 12);
    assert.equal(prevHref("/blog", only!), undefined);
    assert.equal(nextHref("/blog", only!), undefined);
  });
});

describe("route generation", () => {
  it("leaves page one to the listing's own route", () => {
    assert.deepEqual(
      restPages(paginate(upTo(47), size(12))).map((page) => page.index),
      [2, 3, 4],
    );
  });

  it("generates nothing extra for a listing that fits on one page", () => {
    assert.deepEqual(restPages(paginate(upTo(5), size(12))), []);
    assert.deepEqual(restPages(paginate([], size(12))), []);
  });

  it("hands back the first page, or nothing when there is none", () => {
    assert.equal(firstPage(paginate(upTo(47), size(12)))?.index, 1);
    assert.equal(firstPage(paginate([], size(12))), undefined);
  });
});
