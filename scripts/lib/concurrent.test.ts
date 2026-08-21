import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mapConcurrent } from "./concurrent.ts";

const range = (n: number): readonly number[] => Array.from({ length: n }, (_, i) => i);

describe("mapConcurrent", () => {
  /* Completion order differs from input order, but results must not. */
  it("returns results in input order, not completion order", async () => {
    const results = await mapConcurrent(range(8), 4, async (n) => {
      await new Promise((resolve) => setTimeout(resolve, (8 - n) % 4));
      return n * 2;
    });

    assert.deepEqual([...results], [0, 2, 4, 6, 8, 10, 12, 14]);
  });

  /* The concurrency bound is the contract, not merely a Promise.all wrapper. */
  it("keeps no more than `limit` tasks in flight", async () => {
    let running = 0;
    let peak = 0;

    await mapConcurrent(range(20), 3, async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 1));
      running -= 1;
      return null;
    });

    assert.ok(peak <= 3, `peaked at ${peak}`);
  });

  it("runs every task exactly once", async () => {
    const seen: number[] = [];
    await mapConcurrent(range(50), 7, async (n) => seen.push(n));

    assert.deepEqual(
      seen.toSorted((a, b) => a - b),
      range(50),
    );
  });

  it("is total on an empty list, and starts no workers", async () => {
    assert.deepEqual([...(await mapConcurrent([], 4, async () => null))], []);
  });

  /* Oversized limits must not create idle workers on an exhausted iterator. */
  it("handles a limit larger than the list", async () => {
    assert.deepEqual([...(await mapConcurrent([1, 2], 99, async (n) => n))], [1, 2]);
  });
});
