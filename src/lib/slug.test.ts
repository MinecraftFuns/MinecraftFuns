import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parsePostPath } from "./archive.ts";
import { parseSlug, SLUG_SOURCE } from "./slug.ts";

describe("parseSlug", () => {
  it("accepts lowercase words joined by single hyphens", () => {
    ["a", "warp", "multiset-cloudflare-warp", "rfc-9309", "x1"].forEach((raw) =>
      assert.equal(parseSlug(raw).tag, "ok", raw),
    );
  });

  /*
   * The separator case is what keeps a flat collection flat: a doc nested in a
   * folder arrives with a slash in its id and is refused by name rather than
   * published at a URL the collection does not model.
   */
  it("rejects a nested path, which is how flatness is enforced", () => {
    assert.equal(parseSlug("guides/warp").tag, "invalid");
  });

  it("rejects capitals, spaces, underscores and doubled or edge hyphens", () => {
    ["Warp", "two words", "snake_case", "a--b", "-lead", "trail-"].forEach((raw) =>
      assert.equal(parseSlug(raw).tag, "invalid", raw),
    );
  });

  it("rejects the empty string", () => {
    assert.equal(parseSlug("").tag, "invalid");
  });

  it("is total: no input throws", () => {
    ["", "/", "///", "..", "%%%"].forEach((raw) =>
      assert.doesNotThrow(() => parseSlug(raw)),
    );
  });
});

describe("SLUG_SOURCE", () => {
  /*
   * The point of exporting the source: the archive's `YYYY/MM/slug` pattern is
   * built from it, so a slug the docs accept is a slug a post accepts. Two
   * copies of the shape would agree today and drift on the first change.
   */
  it("is the same shape the archive accepts for a post's last segment", () => {
    assert.ok(SLUG_SOURCE.length > 0);

    ["multiset-cloudflare-warp", "rfc-9309"].forEach((slug) => {
      assert.equal(parseSlug(slug).tag, "ok", slug);
      assert.equal(parsePostPath(`2026/08/${slug}`).tag, "ok", slug);
    });

    ["Warp", "snake_case", "a--b"].forEach((slug) => {
      assert.equal(parseSlug(slug).tag, "invalid", slug);
      assert.equal(parsePostPath(`2026/08/${slug}`).tag, "invalid", slug);
    });
  });
});
