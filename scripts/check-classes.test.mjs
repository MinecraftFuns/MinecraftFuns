import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { anonymousValues, classRegions } from "./check-classes.mjs";

const astro = (frontmatter, template) => `---\n${frontmatter}\n---\n${template}`;

const rulesFound = (source) => anonymousValues(source).map((found) => found.rule);

describe("classRegions", () => {
  it("returns the whole file when there is no frontmatter", () => {
    assert.deepEqual(classRegions('<p class="text-ink">x</p>'), [
      '<p class="text-ink">x</p>',
    ]);
  });

  it("includes frontmatter string literals, where an extracted class list hides", () => {
    const source = astro('const ENTRY = "grid gap-md";', "<div class={ENTRY} />");
    assert.ok(classRegions(source).includes("grid gap-md"));
  });
});

describe("anonymousValues", () => {
  it("catches an arbitrary value", () => {
    const found = anonymousValues('<p class="w-[437px]">x</p>');
    assert.deepEqual(found.map((f) => f.text), ["w-[437px]"]);
    assert.equal(found[0].rule, "arbitrary-value");
  });

  it("catches an arbitrary property", () => {
    assert.deepEqual(rulesFound('<p class="[overflow-wrap:anywhere]">x</p>'), [
      "arbitrary-property",
    ]);
  });

  it("catches an arbitrary variant", () => {
    assert.deepEqual(rulesFound('<div class="[&>:last-child]:border-b-0" />'), [
      "arbitrary-variant",
    ]);
  });

  it("catches a literal hidden in a frontmatter constant", () => {
    const source = astro('const ENTRY = "grid gap-[13px]";', "<div class={ENTRY} />");
    assert.deepEqual(rulesFound(source), ["arbitrary-value"]);
  });

  it("passes markup built only from named utilities", () => {
    const source = astro(
      'const ENTRY = "grid gap-md sm:grid-cols-entry";',
      '<div class={ENTRY}><p class="text-body-sm text-ink-subtle *:last:border-b-0">x</p></div>',
    );
    assert.deepEqual(anonymousValues(source), []);
  });

  // The patterns run over TypeScript as well as markup, so the shapes that
  // look like bracket syntax but are not must stay quiet.
  it("does not mistake a TypeScript index signature for an arbitrary property", () => {
    const source = astro("type T = { [key: string]: number };", "<p />");
    assert.deepEqual(anonymousValues(source), []);
  });

  it("does not mistake array indexing or array types for arbitrary values", () => {
    const source = astro(
      "const first = items[0];\nconst all: readonly ProjectKind[] = [];",
      "<p />",
    );
    assert.deepEqual(anonymousValues(source), []);
  });

  it("does not mistake class:list array syntax for an arbitrary value", () => {
    assert.deepEqual(anonymousValues('<a class:list={["a", VARIANT[v]]} />'), []);
  });
});
