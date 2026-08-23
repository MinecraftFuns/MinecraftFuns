import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { clashesBy, distinctBy, groupBy } from "./distinct.ts";

type Row = { readonly id: string; readonly key: string };
const row = (id: string, key: string): Row => ({ id, key });
const ids = (rows: readonly Row[]) => rows.map((found) => found.id);

describe("groupBy", () => {
  it("collects every item claiming a key, in encounter order", () => {
    const grouped = groupBy([row("a", "x"), row("b", "y"), row("c", "x")], (r) => r.key);

    assert.deepEqual([...grouped.keys()], ["x", "y"]);
    assert.deepEqual(ids(grouped.get("x") ?? []), ["a", "c"]);
  });

  /* The non-emptiness the type claims: a present key has a readable head. */
  it("gives every group a head", () => {
    const grouped = groupBy([row("a", "x"), row("b", "x")], (r) => r.key);

    for (const group of grouped.values()) assert.ok(group[0]);
  });

  it("is total on an empty list", () => {
    assert.equal(groupBy([], (r: Row) => r.key).size, 0);
  });
});

describe("distinctBy", () => {
  it("keeps the first item claiming each key", () => {
    assert.deepEqual(
      ids(distinctBy([row("a", "x"), row("b", "x"), row("c", "y")], (r) => r.key)),
      ["a", "c"],
    );
  });

  /* The collection must keep the first claimant, not the last overwrite. */
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
  /* No clashes means the key is injective. */
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

  /* A clash report needs both the first and later claimant. */
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

  /* Non-primitive keys follow `Map` identity semantics. */
  it("compares keys as a Map does", () => {
    const shared = { name: "x" };
    assert.equal(clashesBy([row("a", "x"), row("b", "x")], () => shared).length, 1);
    assert.equal(clashesBy([row("a", "x"), row("b", "x")], () => ({})).length, 0);
  });
});
