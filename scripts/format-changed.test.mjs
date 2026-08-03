import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { partitionStaged } from "./format-changed.mjs";

/*
 * The one rule in this script that can lose work: a file with both staged and
 * unstaged edits must not be formatted, because re-adding it would commit the
 * half its author held back.
 */
describe("partitionStaged", () => {
  it("formats a file staged in full", () => {
    assert.deepEqual(partitionStaged(["a.ts"], []), { format: ["a.ts"], skip: [] });
  });

  it("refuses a file that is also modified in the working tree", () => {
    assert.deepEqual(partitionStaged(["a.ts", "b.ts"], ["b.ts"]), {
      format: ["a.ts"],
      skip: ["b.ts"],
    });
  });

  it("ignores unstaged files that are not staged at all", () => {
    assert.deepEqual(partitionStaged(["a.ts"], ["c.ts"]), {
      format: ["a.ts"],
      skip: [],
    });
  });

  it("partitions: every staged path lands in exactly one side", () => {
    const staged = ["a.ts", "b.ts", "c.ts"];
    const { format, skip } = partitionStaged(staged, ["b.ts"]);
    assert.deepEqual([...format, ...skip].sort(), [...staged].sort());
    assert.equal(
      format.some((path) => skip.includes(path)),
      false,
    );
  });

  it("is total on empty input", () => {
    assert.deepEqual(partitionStaged([], []), { format: [], skip: [] });
  });
});
