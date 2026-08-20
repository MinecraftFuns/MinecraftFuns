import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { explain } from "../prelude/adt.ts";
import {
  archiveOf,
  hrefOf,
  langHrefOf,
  langRouteOf,
  parseRenditionId,
  reconcile,
  routeOf,
} from "./archive.ts";
import { isoDate } from "./time.ts";

const parsed = (id: string) => {
  const result = parseRenditionId(id);
  assert.equal(result.tag, "ok", `expected ${id} to parse`);
  return result.tag === "ok" ? result.value : undefined;
};

describe("parseRenditionId", () => {
  it("splits a well-formed rendition id into article and language", () => {
    const rendition = parsed("2026/08/calendar-dates-are-not-instants/en");
    assert.deepEqual(rendition?.path, {
      year: "2026",
      month: "08",
      slug: "calendar-dates-are-not-instants",
    });
    assert.equal(rendition?.lang, "en");
  });

  it("accepts each declared language", () => {
    assert.equal(parsed("2026/01/hello/en")?.lang, "en");
    assert.equal(parsed("2026/01/hello/zh")?.lang, "zh");
  });

  it("rejects the pre-rendition flat layout, naming the shape to take", () => {
    const result = parseRenditionId("2026/08/calendar-dates-are-not-instants");
    assert.equal(result.tag, "invalid");
    if (result.tag === "invalid") {
      assert.match(explain(result), /YYYY\/MM\/kebab-case-slug\/language/);
    }
  });

  it("rejects a language the union does not declare", () => {
    assert.equal(parseRenditionId("2026/08/post/fr").tag, "invalid");
    assert.equal(parseRenditionId("2026/08/post/EN").tag, "invalid");
  });

  it("rejects a post left at the collection root", () => {
    assert.equal(parseRenditionId("calendar-dates-are-not-instants").tag, "invalid");
  });

  it("rejects a month outside 01-12, which a date regex alone would admit", () => {
    assert.equal(parseRenditionId("2026/13/post/en").tag, "invalid");
    assert.equal(parseRenditionId("2026/00/post/en").tag, "invalid");
  });

  it("rejects an unpadded month, so the folder sorts lexicographically", () => {
    assert.equal(parseRenditionId("2026/8/post/en").tag, "invalid");
  });

  it("rejects nesting deeper than YYYY/MM/slug/lang", () => {
    assert.equal(parseRenditionId("2026/08/drafts/post/en").tag, "invalid");
  });

  it("rejects a slug that is not kebab-case", () => {
    assert.equal(parseRenditionId("2026/08/My_Post/en").tag, "invalid");
    assert.equal(parseRenditionId("2026/08/trailing-/en").tag, "invalid");
  });

  it("is total: no input throws", () => {
    const inputs = ["", "/", "////", "2026", "2026/08", "2026/08/post/", "a/b/c/d"];
    inputs.forEach((input) => {
      assert.doesNotThrow(() => parseRenditionId(input));
    });
  });
});

describe("archiveOf", () => {
  it("reads the folder off the calendar date without touching a clock", () => {
    assert.equal(archiveOf(isoDate("2026-08-01")), "2026/08");
  });

  // The whole point of a calendar date: the answer cannot depend on a zone,
  // because no instant is ever constructed.
  it("gives the same answer whatever the host zone is", () => {
    const date = isoDate("2026-01-01");
    const original = process.env.TZ;
    const answers = ["UTC", "Pacific/Auckland", "America/Los_Angeles"].map((zone) => {
      process.env.TZ = zone;
      return archiveOf(date);
    });
    process.env.TZ = original;
    assert.deepEqual(answers, ["2026/01", "2026/01", "2026/01"]);
  });
});

describe("reconcile", () => {
  it("accepts a rendition whose folder agrees with its date", () => {
    const result = reconcile("2026/08/a-post/en", isoDate("2026-08-01"));
    assert.equal(result.tag, "ok");
  });

  it("accepts any day within the filed month", () => {
    assert.equal(reconcile("2026/08/a-post/zh", isoDate("2026-08-31")).tag, "ok");
  });

  it("rejects a rendition filed in the wrong month", () => {
    const result = reconcile("2026/07/a-post/en", isoDate("2026-08-01"));
    assert.equal(result.tag, "invalid");
    // The reason has to name both halves, or the author has to go find them.
    if (result.tag === "invalid") {
      assert.match(explain(result), /2026\/07/);
      assert.match(explain(result), /2026\/08/);
    }
  });

  it("rejects a rendition filed in the wrong year", () => {
    assert.equal(reconcile("2025/08/a-post/en", isoDate("2026-08-01")).tag, "invalid");
  });

  it("propagates a malformed id rather than reporting a mismatch", () => {
    const result = reconcile("a-post", isoDate("2026-08-01"));
    assert.equal(result.tag, "invalid");
    if (result.tag === "invalid") {
      assert.match(explain(result), /YYYY\/MM/);
    }
  });
});

describe("routes and hrefs", () => {
  it("rebuild the article path the rendition id was parsed from", () => {
    const rendition = parsed("2026/08/calendar-dates-are-not-instants/zh")!;
    assert.equal(routeOf(rendition.path), "2026/08/calendar-dates-are-not-instants");
  });

  it("mount the article route under /blog, with no language in it", () => {
    assert.equal(hrefOf(parsed("2026/08/a-post/zh")!.path), "/blog/2026/08/a-post");
  });

  it("suffix the language-addressed forms with the language alone", () => {
    const { path } = parsed("2026/08/a-post/en")!;
    assert.equal(langRouteOf(path, "zh"), "2026/08/a-post/zh");
    assert.equal(langHrefOf(path, "zh"), "/blog/2026/08/a-post/zh");
  });
});
