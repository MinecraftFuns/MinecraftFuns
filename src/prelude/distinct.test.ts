import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { clashesBy, distinctBy } from "./distinct.ts";

type Row = { readonly id: string; readonly key: string };
const row = (id: string, key: string): Row => ({ id, key });
const ids = (rows: readonly Row[]) => rows.map((found) => found.id);

describe("distinctBy", () => {
  it("keeps the first item claiming each key", () => {
    assert.deepEqual(
      ids(distinctBy([row("a", "x"), row("b", "x"), row("c", "y")], (r) => r.key)),
      ["a", "c"],
    );
  });

  /* First wins, stated rather than left to a collection's overwrite rule,
     which keeps the last. The two differ on exactly this input. */
  it("keeps the first rather than the last", () => {
    assert.deepEqual(ids(distinctBy([row("a", "x"), row("b", "x")], (r) => r.key)), [
      "a",
    ]);
  });

  it("preserves encounter order across distinct keys", () => {
    assert.deepEqual(
      ids(distinctBy([row("c", "z"), row("a", "x"), row("b", "y")], (r) => r.key)),
      ["c", "a", "b"],
    );
  });

  it("is total on an empty list", () => {
    assert.deepEqual(
      distinctBy([], (r: Row) => r.key),
      [],
    );
  });
});

describe("clashesBy", () => {
  /* Empty exactly when the key is injective, which is the property every
     caller is really asking about. */
  it("is empty when every key is distinct", () => {
    assert.deepEqual(
      clashesBy([row("a", "x"), row("b", "y")], (r) => r.key),
      [],
    );
  });

  it("pairs a later claim with the first, not with its predecessor", () => {
    const clashes = clashesBy(
      [row("a", "x"), row("b", "x"), row("c", "x")],
      (r) => r.key,
    );

    assert.deepEqual(
      clashes.map(([first, later]) => [first.id, later.id]),
      [
        ["a", "b"],
        ["a", "c"],
      ],
    );
  });

  /* Both halves, because every caller reports both: "X and Y both become Z"
     needs the first as much as the second. */
  it("reports every clash rather than the first", () => {
    const clashes = clashesBy(
      [row("a", "x"), row("b", "x"), row("c", "y"), row("d", "y")],
      (r) => r.key,
    );

    assert.deepEqual(
      clashes.map(([first, later]) => [first.id, later.id]),
      [
        ["a", "b"],
        ["c", "d"],
      ],
    );
  });

  it("is total on an empty list", () => {
    assert.deepEqual(
      clashesBy([], (r: Row) => r.key),
      [],
    );
  });

  /* Keys are compared by `Map` identity, so a non-primitive key is compared by
     reference. Every caller here uses a string; this pins the contract. */
  it("compares keys as a Map does", () => {
    const shared = { name: "x" };
    assert.equal(clashesBy([row("a", "x"), row("b", "x")], () => shared).length, 1);
    assert.equal(clashesBy([row("a", "x"), row("b", "x")], () => ({})).length, 0);
  });
});
