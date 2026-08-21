import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { memoiseBy, once } from "./memo.ts";

describe("memoiseBy", () => {
  it("builds once per distinct key", () => {
    let built = 0;
    const f = memoiseBy(
      (n: number) => String(n),
      (n: number) => {
        built += 1;
        return { n };
      },
    );

    assert.equal(f(1).n, 1);
    assert.equal(f(1).n, 1);
    assert.equal(f(2).n, 2);
    assert.equal(built, 2);
  });

  /* Callers depend on cached results preserving object identity. */
  it("returns the same value, not an equal one", () => {
    const f = memoiseBy(
      (n: number) => String(n),
      () => ({}),
    );
    assert.equal(f(1), f(1));
    assert.notEqual(f(1), f(2));
  });

  /* Distinct argument tuples must produce distinct keys. */
  it("distinguishes calls by key alone", () => {
    let built = 0;
    const f = memoiseBy(
      (a: string, b: string) => `${a} ${b}`,
      (a: string, b: string) => {
        built += 1;
        return { a, b };
      },
    );

    f("x", "y");
    f("x", "y");
    assert.equal(built, 1);
    f("x", "z");
    assert.equal(built, 2);
  });
});

describe("once", () => {
  it("evaluates the thunk at most once", () => {
    let built = 0;
    const f = once(() => {
      built += 1;
      return {};
    });

    assert.equal(f(), f());
    assert.equal(built, 1);
  });

  /* Caching the promise makes concurrent callers share one run. */
  it("caches the promise, so concurrent callers share one run", async () => {
    let runs = 0;
    const f = once(async () => {
      runs += 1;
      return {};
    });

    const [a, b] = await Promise.all([f(), f()]);
    assert.equal(a, b);
    assert.equal(runs, 1);
  });

  /* Rejections are cached too; build-time work must not retry implicitly. */
  it("caches a rejection rather than retrying", async () => {
    let runs = 0;
    const f = once(async () => {
      runs += 1;
      throw new Error("nope");
    });

    await assert.rejects(f());
    await assert.rejects(f());
    assert.equal(runs, 1);
  });
});
