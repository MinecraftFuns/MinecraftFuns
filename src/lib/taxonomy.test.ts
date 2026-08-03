import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { taxonomy } from "./taxonomy.ts";

type Item = { readonly name: string; readonly labels: readonly string[] };

const item = (name: string, ...labels: string[]): Item => ({ name, labels });
const labelsOf = (found: Item) => found.labels;

const build = (items: readonly Item[]) => taxonomy(items, labelsOf, "test labels");

describe("taxonomy", () => {
  it("groups items under each of their labels", () => {
    const taxa = build([item("a", "Networking", "Mail"), item("b", "Mail")]);

    assert.deepEqual(
      taxa.map(({ label, slug, items }) => [label, slug, items.map((i) => i.name)]),
      [
        ["Mail", "mail", ["a", "b"]],
        ["Networking", "networking", ["a"]],
      ],
    );
  });

  it("orders taxa by label, not by first appearance", () => {
    const taxa = build([item("a", "Zone transfers"), item("b", "Ansible")]);
    assert.deepEqual(
      taxa.map(({ label }) => label),
      ["Ansible", "Zone transfers"],
    );
  });

  /* Items keep the order they arrived in, so each collection's own ordering
     (recency for posts, title for docs) survives into its taxon pages. */
  it("preserves the incoming order of items within a taxon", () => {
    const taxa = build([item("first", "x"), item("second", "x"), item("third", "x")]);
    assert.deepEqual(
      taxa[0].items.map((i) => i.name),
      ["first", "second", "third"],
    );
  });

  it("is total on an empty collection", () => {
    assert.deepEqual(build([]), []);
  });

  /*
   * The reason this module owns slug derivation rather than each caller.
   * `slugify` is many-to-one, so two labels can land on one segment, and two
   * pages at one URL is not a state a build should resolve arbitrarily.
   */
  it("fails the build when two different labels collapse to one slug", () => {
    assert.throws(
      () => build([item("a", "Mail Routing"), item("b", "mail  routing")]),
      /both become "mail-routing"/,
    );
  });

  it("names both offenders and the segment they collide on", () => {
    assert.throws(
      () => build([item("a", "A-B"), item("b", "a b")]),
      (error: Error) => {
        assert.match(error.message, /test labels/);
        assert.match(error.message, /"A-B"/);
        assert.match(error.message, /"a b"/);
        return true;
      },
    );
  });

  /* Same spelling is the same label, not a collision: it groups. */
  it("does not mistake one label used twice for a collision", () => {
    const taxa = build([item("a", "Mail"), item("b", "Mail")]);
    assert.equal(taxa.length, 1);
    assert.equal(taxa[0].items.length, 2);
  });

  it("fails the build when a label has no usable URL segment", () => {
    assert.throws(() => build([item("a", "!!!")]), /no usable URL segment/);
  });

  /* A label exists only by being on an item, so a taxon is never empty. The
     type says so; this checks the construction agrees. */
  it("never produces an empty taxon", () => {
    const taxa = build([item("a", "x"), item("b", "y", "x")]);
    taxa.forEach(({ items }) => assert.ok(items.length > 0));
  });
});
