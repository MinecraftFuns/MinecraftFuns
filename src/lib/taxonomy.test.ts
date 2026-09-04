import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { explain } from "../prelude/adt.ts";
import type { Sluggable } from "./labels.ts";
import { taxonomy } from "./taxonomy.ts";

type Item = { readonly name: string; readonly labels: readonly Sluggable[] };

/* Fixtures model labels after schema decoding; label validation is tested elsewhere. */
const label = (raw: string): Sluggable => raw as Sluggable;

const item = (name: string, ...labels: string[]): Item => ({
  name,
  labels: labels.map(label),
});

const labelsOf = (found: Item) => found.labels;
const build = (items: readonly Item[]) => taxonomy(items, labelsOf);

/** The taxa of a collection expected to hold no collisions. */
const taxaOf = (items: readonly Item[]) => {
  const result = build(items);
  assert.equal(result.tag, "ok", explain(result));
  return result.tag === "ok" ? result.value : [];
};

describe("taxonomy", () => {
  it("groups items under each of their labels", () => {
    assert.deepEqual(
      taxaOf([item("a", "Networking", "Mail"), item("b", "Mail")]).map(
        ({ label: found, slug, items }) => [found, slug, items.map((i) => i.name)],
      ),
      [
        ["Mail", "mail", ["a", "b"]],
        ["Networking", "networking", ["a"]],
      ],
    );
  });

  it("orders taxa by label, not by first appearance", () => {
    assert.deepEqual(
      taxaOf([item("a", "Zone transfers"), item("b", "Ansible")]).map((t) => t.label),
      ["Ansible", "Zone transfers"],
    );
  });

  /* Preserve the collection's incoming order within each taxon. */
  it("preserves the incoming order of items within a taxon", () => {
    assert.deepEqual(
      taxaOf([item("first", "x"), item("second", "x"), item("third", "x")]).map((t) =>
        t.items.map((i) => i.name),
      ),
      [["first", "second", "third"]],
    );
  });

  it("is total on an empty collection", () => {
    assert.deepEqual(taxaOf([]), []);
  });

  /* Label validity is decoded earlier; slug collisions are collection-level. */
  it("refuses two different labels that collapse to one slug", () => {
    const result = build([item("a", "Mail Routing"), item("b", "mail  routing")]);
    assert.equal(result.tag, "invalid");
    assert.match(explain(result), /both become "mail-routing"/);
  });

  it("names both offenders and the segment they collide on", () => {
    const result = build([item("a", "A-B"), item("b", "a b")]);
    assert.match(explain(result), /"A-B"/);
    assert.match(explain(result), /"a b"/);
  });

  /* Report every independent collision. */
  it("reports every collision rather than the first", () => {
    const result = build([
      item("a", "Mail Routing"),
      item("b", "mail  routing"),
      item("c", "Zone Transfers"),
      item("d", "zone  transfers"),
    ]);

    assert.equal(result.tag, "invalid");
    assert.equal(result.tag === "invalid" ? result.reasons.length : 0, 2);
  });

  /* Same spelling is the same label, not a collision: it groups. */
  it("does not mistake one label used twice for a collision", () => {
    assert.deepEqual(
      taxaOf([item("a", "Mail"), item("b", "Mail")]).map((t) => t.items.length),
      [2],
    );
  });
});
