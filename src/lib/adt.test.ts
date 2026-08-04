import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  andThen,
  assertNever,
  both,
  collect,
  explain,
  inContext,
  invalid,
  mapParsed,
  nonEmpty,
  ok,
  orThrow,
  type Parsed,
} from "./adt.ts";

/*
 * The algebra every other module is written against, and the only one whose
 * laws nothing else can check: a module downstream that miscounts reasons
 * still typechecks and still fails builds, just with less to say.
 */

const reasons = (parsed: Parsed<unknown>): readonly string[] =>
  parsed.tag === "invalid" ? parsed.reasons : [];

describe("nonEmpty", () => {
  it("refuses the empty list", () => {
    assert.equal(nonEmpty([]), undefined);
  });

  it("returns the same list when it has elements", () => {
    const items = [1, 2];
    assert.equal(nonEmpty(items), items);
  });
});

describe("mapParsed", () => {
  it("changes the value", () => {
    assert.deepEqual(
      mapParsed(ok(2), (n) => n + 1),
      ok(3),
    );
  });

  /* Functor: a failure passes through untouched, reasons and all. */
  it("leaves a failure alone", () => {
    const failed = invalid<number>("a", "b");
    assert.deepEqual(
      mapParsed(failed, (n) => n + 1),
      failed,
    );
  });
});

describe("andThen", () => {
  it("runs the continuation on a success", () => {
    assert.deepEqual(
      andThen(ok(2), (n) => ok(n + 1)),
      ok(3),
    );
  });

  /*
   * Fail-fast, and this is the property that makes `collect` a separate
   * function rather than a fold over this one: after a failure there is no
   * value to continue with, so no second reason ever comes into existence.
   */
  it("never runs the continuation after a failure", () => {
    let ran = false;
    const result = andThen(invalid<number>("first"), (n) => {
      ran = true;
      return ok(n);
    });
    assert.equal(ran, false);
    assert.deepEqual(reasons(result), ["first"]);
  });
});

describe("collect", () => {
  it("gathers the values, in order, when every element parses", () => {
    assert.deepEqual(collect([ok(1), ok(2), ok(3)]), ok([1, 2, 3]));
  });

  it("is ok on no elements at all", () => {
    assert.deepEqual(collect([]), ok([]));
  });

  /* Applicative accumulation: the reason this is not `andThen` in a loop. */
  it("keeps every reason, not the first", () => {
    const result = collect([ok(1), invalid<number>("a"), ok(2), invalid<number>("b")]);
    assert.deepEqual(reasons(result), ["a", "b"]);
  });

  it("keeps every reason of a single multi-reason failure", () => {
    assert.deepEqual(reasons(collect([invalid<number>("a", "b")])), ["a", "b"]);
  });
});

describe("both", () => {
  it("pairs two successes", () => {
    assert.deepEqual(both(ok(1), ok("x")), ok([1, "x"]));
  });

  /*
   * The whole reason `both` exists: `andThen` would typecheck here and report
   * the first failure only, so a config with a bad header *and* a bad redirect
   * would confess to one of them per build.
   */
  it("reports both sides when both fail", () => {
    assert.deepEqual(reasons(both(invalid("a"), invalid("b"))), ["a", "b"]);
  });

  it("reports the failing side when only one fails", () => {
    assert.deepEqual(reasons(both(ok(1), invalid("b"))), ["b"]);
    assert.deepEqual(reasons(both(invalid("a"), ok(1))), ["a"]);
  });
});

describe("inContext", () => {
  it("leaves a success alone", () => {
    assert.deepEqual(inContext(ok(1), "where"), ok(1));
  });

  /*
   * Every reason, not just the first. An accumulated failure has one context
   * and several mistakes, so labelling the batch once would leave every reason
   * after the first unattributed.
   */
  it("labels every reason of an accumulated failure", () => {
    assert.deepEqual(reasons(inContext(invalid("a", "b"), "file.md")), [
      "file.md: a",
      "file.md: b",
    ]);
  });
});

describe("explain", () => {
  it("gives every reason, one per line", () => {
    assert.match(explain(invalid("a", "b")), /a\n\s+b/);
  });

  /* The unit of the monoid the reasons live in: a success has nothing to add. */
  it("gives nothing for a success", () => {
    assert.equal(explain(ok(1)), "");
  });
});

describe("orThrow", () => {
  it("returns the value of a success", () => {
    assert.equal(orThrow(ok(7), "context"), 7);
  });

  it("throws naming the context and every reason", () => {
    assert.throws(
      () => orThrow(invalid("a", "b"), "config"),
      (error: Error) => {
        assert.match(error.message, /config: a/);
        assert.match(error.message, /config: b/);
        return true;
      },
    );
  });
});

describe("assertNever", () => {
  /*
   * Unreachable from typed code by construction, so it is reached here the
   * only way it can be at runtime: untyped data crossing a boundary.
   */
  it("throws when untyped data reaches an exhausted eliminator", () => {
    assert.throws(() => assertNever("surprise" as never), TypeError);
  });
});
