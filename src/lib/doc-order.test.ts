import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { compareDocs, type DocOrder } from "./doc-order.ts";

const doc = (
  title: string,
  slug = title.toLowerCase().replaceAll(" ", "-"),
): DocOrder => ({
  title,
  slug,
});

const titlesInOrder = (docs: readonly DocOrder[]) =>
  docs.toSorted(compareDocs).map(({ title }) => title);

describe("compareDocs", () => {
  it("orders by title", () => {
    assert.deepEqual(
      titlesInOrder([doc("Zone transfers"), doc("Ansible"), doc("Mail routing")]),
      ["Ansible", "Mail routing", "Zone transfers"],
    );
  });

  /* Sorting must not depend on loader traversal order. */
  it("gives the same order whatever order the loader walked the directory in", () => {
    const docs = [
      doc("Mail routing", "mail-routing"),
      doc("Mail routing", "mail-routing-legacy"),
      doc("Ansible", "ansible"),
    ];

    const forwards = docs.toSorted(compareDocs);
    const backwards = docs.toReversed().toSorted(compareDocs);

    assert.deepEqual(forwards, backwards);
  });

  it("breaks a shared title on the slug, which is unique", () => {
    const first = doc("Mail routing", "a-mail-routing");
    const second = doc("Mail routing", "b-mail-routing");

    assert.ok(compareDocs(first, second) < 0);
    assert.ok(compareDocs(second, first) > 0);
  });

  /* Distinct filenames must not compare equal. */
  it("returns zero only for a doc against itself", () => {
    const only = doc("Mail routing", "mail-routing");
    assert.equal(compareDocs(only, only), 0);
    assert.notEqual(compareDocs(only, doc("Mail routing", "other")), 0);
  });

  it("is antisymmetric", () => {
    const a = doc("Ansible", "ansible");
    const b = doc("Zone transfers", "zone-transfers");
    assert.equal(Math.sign(compareDocs(a, b)), -Math.sign(compareDocs(b, a)));
  });

  /* Collated, not compared by code point, which would file every capital
     ahead of every lowercase word. */
  it("does not sort capitals ahead of lowercase words", () => {
    assert.ok(compareDocs(doc("apple"), doc("Banana")) < 0);
  });
});
