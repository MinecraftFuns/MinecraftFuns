import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { explain } from "./adt.ts";
import { parseDocCategory, parsePostTag } from "./labels.ts";

/*
 * The check that used to run inside `taxonomy`, now at the point frontmatter
 * is decoded, so a bad label names the file it was written in.
 */

describe("parsePostTag", () => {
  it("accepts a label with a usable segment", () => {
    assert.equal(parsePostTag("Zone transfers").tag, "ok");
  });

  /* `slugify` is lossy and many-to-one, so a label of punctuation alone maps
     to the empty string, and a taxon with no segment is a page at no URL. */
  it("refuses a label that slugifies to nothing", () => {
    ["!!!", "---", "", "   ", "..."].forEach((raw) =>
      assert.equal(
        parsePostTag(raw).tag,
        "invalid",
        `expected ${JSON.stringify(raw)} to be refused`,
      ),
    );
  });

  /* Accents survive as letters rather than being dropped with their marks. */
  it("accepts a label whose segment survives decomposition", () => {
    assert.equal(parsePostTag("über").tag, "ok");
  });

  it("says what was wrong", () => {
    assert.match(explain(parsePostTag("!!!")), /"!!!" has no usable URL segment/);
  });

  it("is total: no input throws", () => {
    ["", "/", " ", "a".repeat(1000)].forEach((raw) =>
      assert.doesNotThrow(() => parsePostTag(raw)),
    );
  });
});

describe("parseDocCategory", () => {
  /* The same property, and deliberately a separate constructor: the two types
     never mix, even where a tag and a category spell the same word. */
  it("accepts and refuses on the same rule as a post tag", () => {
    assert.equal(parseDocCategory("Networking").tag, "ok");
    assert.equal(parseDocCategory("!!!").tag, "invalid");
  });
});
