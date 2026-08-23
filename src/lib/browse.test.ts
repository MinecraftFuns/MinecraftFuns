import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { browse, byCoverage, parsePreviewSize, type PreviewSize } from "./browse.ts";
import { nonEmpty, orThrow } from "../prelude/adt.ts";
import type { Taxon } from "./taxonomy.ts";

const keep = (n: number): PreviewSize => orThrow(parsePreviewSize(n), "test");

/** A taxon carrying only what ranking reads: its label and how many items. */
const taxon = (label: string, count: number): Taxon<string, number> => {
  const items = nonEmpty(Array.from({ length: count }, (_, i) => i));
  assert.ok(items, "test taxa carry at least one item");
  return { label, slug: label.toLowerCase(), items };
};

/** The archive's real shape: a short head and a long flat tail. */
const archive = [
  taxon("Editorial", 10),
  taxon("Notes", 8),
  taxon("Codeforces", 6),
  taxon("Tools", 5),
  taxon("Repost", 4),
  taxon("Guide", 4),
  taxon("Security", 3),
  taxon("Reading", 3),
  taxon("Windows", 1),
];

describe("parsePreviewSize", () => {
  it("refuses a strip that shows nothing, or a fractional number of chips", () => {
    for (const n of [0, -3, 1.5, Number.NaN]) {
      assert.equal(parsePreviewSize(n).tag, "invalid", `${n} should be refused`);
    }
    assert.equal(parsePreviewSize(6).tag, "ok");
  });
});

describe("byCoverage", () => {
  it("puts the most-written-about first", () => {
    const ranked = [...archive].sort(byCoverage).map((t) => t.label);
    assert.deepEqual(ranked.slice(0, 4), ["Editorial", "Notes", "Codeforces", "Tools"]);
  });

  it("breaks ties by label, so a build cannot reorder them on its own", () => {
    // Repost and Guide both hold four; the tail holds three each.
    const ranked = [...archive].sort(byCoverage).map((t) => t.label);
    assert.deepEqual(ranked.slice(4, 8), ["Guide", "Repost", "Reading", "Security"]);
  });

  it("is a total order: sorting a shuffle is stable in the result", () => {
    const shuffled = [archive[3]!, archive[7]!, archive[0]!, archive[5]!];
    assert.deepEqual(
      [...shuffled].sort(byCoverage).map((t) => t.label),
      [...shuffled]
        .reverse()
        .sort(byCoverage)
        .map((t) => t.label),
    );
  });
});

describe("browse", () => {
  it("shows the requested number and counts what it withheld", () => {
    const strip = browse(archive, keep(6));
    assert.deepEqual(
      strip?.shown.map((t) => t.label),
      ["Editorial", "Notes", "Codeforces", "Tools", "Guide", "Repost"],
    );
    assert.equal(strip?.rest, 3);
  });

  it("withholds nothing when everything fits, so no button is offered", () => {
    // `rest` is the button: zero means there is nothing more to go and see.
    assert.equal(browse(archive.slice(0, 4), keep(6))?.rest, 0);
    assert.equal(browse(archive.slice(0, 6), keep(6))?.rest, 0);
  });

  it("is absent, rather than empty, when there is no taxonomy yet", () => {
    assert.equal(browse([], keep(6)), undefined);
  });

  it("never shows more than it has", () => {
    const strip = browse(archive.slice(0, 2), keep(6));
    assert.equal(strip?.shown.length, 2);
    assert.equal(strip?.rest, 0);
  });
});
