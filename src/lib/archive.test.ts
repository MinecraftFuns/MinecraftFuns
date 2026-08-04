import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { explain } from "../prelude/adt.ts";
import { archiveOf, hrefOf, parsePostPath, reconcile, routeOf } from "./archive.ts";
import { isoDate } from "./time.ts";

const parsed = (id: string) => {
  const result = parsePostPath(id);
  assert.equal(result.tag, "ok", `expected ${id} to parse`);
  return result.tag === "ok" ? result.value : undefined;
};

describe("parsePostPath", () => {
  it("splits a well-formed archive path", () => {
    assert.deepEqual(parsed("2026/08/calendar-dates-are-not-instants"), {
      year: "2026",
      month: "08",
      slug: "calendar-dates-are-not-instants",
    });
  });

  it("accepts a single-word slug", () => {
    assert.equal(parsed("2026/01/hello")?.slug, "hello");
  });

  it("rejects a post left at the collection root", () => {
    assert.equal(parsePostPath("calendar-dates-are-not-instants").tag, "invalid");
  });

  it("rejects a month outside 01-12, which a date regex alone would admit", () => {
    assert.equal(parsePostPath("2026/13/post").tag, "invalid");
    assert.equal(parsePostPath("2026/00/post").tag, "invalid");
  });

  it("rejects an unpadded month, so the folder sorts lexicographically", () => {
    assert.equal(parsePostPath("2026/8/post").tag, "invalid");
  });

  it("rejects nesting deeper than YYYY/MM/slug", () => {
    assert.equal(parsePostPath("2026/08/drafts/post").tag, "invalid");
  });

  it("rejects a slug that is not kebab-case", () => {
    assert.equal(parsePostPath("2026/08/My_Post").tag, "invalid");
    assert.equal(parsePostPath("2026/08/trailing-").tag, "invalid");
  });

  it("is total: no input throws", () => {
    const inputs = ["", "/", "////", "2026", "2026/08", "2026/08/", "a/b/c"];
    inputs.forEach((input) => {
      assert.doesNotThrow(() => parsePostPath(input));
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
  it("accepts a post whose folder agrees with its date", () => {
    const result = reconcile("2026/08/a-post", isoDate("2026-08-01"));
    assert.equal(result.tag, "ok");
  });

  it("accepts any day within the filed month", () => {
    assert.equal(reconcile("2026/08/a-post", isoDate("2026-08-31")).tag, "ok");
  });

  it("rejects a post filed in the wrong month", () => {
    const result = reconcile("2026/07/a-post", isoDate("2026-08-01"));
    assert.equal(result.tag, "invalid");
    // The reason has to name both halves, or the author has to go find them.
    if (result.tag === "invalid") {
      assert.match(explain(result), /2026\/07/);
      assert.match(explain(result), /2026\/08/);
    }
  });

  it("rejects a post filed in the wrong year", () => {
    assert.equal(reconcile("2025/08/a-post", isoDate("2026-08-01")).tag, "invalid");
  });

  it("propagates a malformed path rather than reporting a mismatch", () => {
    const result = reconcile("a-post", isoDate("2026-08-01"));
    assert.equal(result.tag, "invalid");
    if (result.tag === "invalid") {
      assert.match(explain(result), /YYYY\/MM/);
    }
  });
});

describe("routeOf and hrefOf", () => {
  it("rebuild the path they were parsed from", () => {
    const id = "2026/08/calendar-dates-are-not-instants";
    assert.equal(routeOf(parsed(id)!), id);
  });

  it("mount the route under /blog", () => {
    assert.equal(hrefOf(parsed("2026/08/a-post")!), "/blog/2026/08/a-post");
  });
});
