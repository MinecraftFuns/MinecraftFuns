import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { captures } from "./captures.ts";

describe("captures", () => {
  it("reads the first group of every match by default", () => {
    assert.deepEqual([...captures("a=1 b=2".matchAll(/(\w)=\d/g))], ["a", "b"]);
  });

  it("reads a named position when asked", () => {
    assert.deepEqual([...captures("a=1 b=2".matchAll(/(\w)=(\d)/g), 2)], ["1", "2"]);
  });

  /*
   * The reason this exists. An alternation leaves one branch's group absent on
   * every match, which the pattern makes impossible for the branch that fired
   * and the type cannot tell apart from a missing capture.
   */
  it("drops a group that did not participate", () => {
    assert.deepEqual([...captures(`"a" 'b'`.matchAll(/"(\w)"|'(\w)'/g))], ["a"]);
    assert.deepEqual([...captures(`"a" 'b'`.matchAll(/"(\w)"|'(\w)'/g), 2)], ["b"]);
  });

  it("is total on no matches", () => {
    assert.deepEqual([...captures("nothing".matchAll(/(\d)/g))], []);
  });

  it("is total on a group index the pattern does not have", () => {
    assert.deepEqual([...captures("a=1".matchAll(/(\w)=(\d)/g), 9)], []);
  });
});
