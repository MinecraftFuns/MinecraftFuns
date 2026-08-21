import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { countedNoun } from "./plural.ts";

describe("countedNoun", () => {
  it("agrees in number", () => {
    assert.equal(countedNoun(1, "post"), "1 post");
    assert.equal(countedNoun(2, "post"), "2 posts");
  });

  /* Zero is plural in English, which the `=== 1` test gets right by accident
     and a truthiness test would get wrong. */
  it("treats zero as plural", () => {
    assert.equal(countedNoun(0, "guide"), "0 guides");
  });

  it("takes an irregular plural when the default will not do", () => {
    assert.equal(countedNoun(3, "entry", "entries"), "3 entries");
    assert.equal(countedNoun(1, "entry", "entries"), "1 entry");
  });
});
