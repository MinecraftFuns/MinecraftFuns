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

  /* Identity, not just equality: callers rely on the cached value being the
     same object, which is what makes a shared `Intl` formatter shared. */
  it("returns the same value, not an equal one", () => {
    const f = memoiseBy(
      (n: number) => String(n),
      () => ({}),
    );
    assert.equal(f(1), f(1));
    assert.notEqual(f(1), f(2));
  });

  /* The key is what distinguishes calls, so arguments that collapse to one key
     are one call. `time.ts` relies on this for (zone, locale) pairs. */
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

  /*
   * On a promise it caches the promise, not the value, so concurrent callers
   * share one run rather than racing to start several. This is what makes it
   * correct for `publishedPosts`, which several pages await at once.
   */
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

  /* A rejection is cached too. The work here is build-time, and a build that
     failed once fails; re-running would only fail again more slowly. */
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
