import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  anonymousValues,
  classRegions,
  typeRoles,
  typeRolesSet,
} from "./check-classes.mjs";

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
    assert.deepEqual(
      found.map(({ rule, text }) => ({ rule, text })),
      [{ rule: "arbitrary-value", text: "w-[437px]" }],
    );
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
      '<div class={ENTRY}><p class="note *:last:border-b-0">x</p></div>',
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

const THEME = `
@theme {
  --text-*: initial;
  --text-shadow-*: initial;
  --text-body: 1rem;
  --text-body--line-height: 1.5;
  --text-body-sm: 0.875rem;
  --text-caption: 0.75rem;
}`;

describe("typeRoles", () => {
  it("reads the roles the theme declares", () => {
    assert.deepEqual(typeRoles(THEME), ["body", "body-sm", "caption"]);
  });

  /* A tuning property is not a utility, and the reset names no role at all. */
  it("drops line-height tuning and the namespace reset", () => {
    const roles = typeRoles(THEME);
    assert.equal(roles.includes("body--line-height"), false);
    assert.equal(roles.includes("*"), false);
  });

  it("is total: a stylesheet declaring no roles yields none", () => {
    assert.deepEqual(typeRoles(":root { --color-ink: black; }"), []);
  });
});

describe("typeRolesSet", () => {
  const roles = typeRoles(THEME);

  it("catches a role set in markup", () => {
    const found = typeRolesSet('<p class="text-caption">x</p>', roles);
    assert.deepEqual(
      found.map((problem) => problem.text),
      ["text-caption"],
    );
    assert.equal(found[0].rule, "type-in-page");
  });

  /*
   * The regression this rule exists for: one list whose rows each chose their
   * own size. Both are reported, and `text-body` is reported once rather than
   * also matching inside `text-body-sm`.
   */
  it("reports each role once, not once per shorter role it contains", () => {
    const found = typeRolesSet(
      '<p class="text-body">a</p><p class="text-body-sm">b</p>',
      roles,
    );
    assert.deepEqual(found.map((problem) => problem.text).sort(), [
      "text-body",
      "text-body-sm",
    ]);
  });

  /* Colour and layout are a page's business; only type is not. */
  it("leaves colour and layout utilities alone", () => {
    assert.deepEqual(
      typeRolesSet('<p class="text-ink-subtle grid gap-md rounded-pill">x</p>', roles),
      [],
    );
  });

  it("catches a role hidden in a frontmatter constant", () => {
    const source = astro('const ROW = "text-caption";', "<p class={ROW} />");
    assert.deepEqual(
      typeRolesSet(source, roles).map((problem) => problem.text),
      ["text-caption"],
    );
  });

  it("is total: no roles means nothing to report", () => {
    assert.deepEqual(typeRolesSet('<p class="text-body">x</p>', []), []);
  });
});

/*
 * The recipe rules. Each names a decision that had been made separately in
 * every component that needed it, so the tell is a *combination* rather than
 * a single class, and the pattern has to stay inside one attribute.
 */
describe("recipe rules", () => {
  const rules = (source) => anonymousValues(source).map(({ rule }) => rule);

  it("catches a hand-rolled accent link", () => {
    const source = astro("", '<a class="text-accent hover:text-accent-hover">x</a>');
    assert.deepEqual(rules(source), ["inline-link-style"]);
  });

  it("catches the metadata recipe in either order", () => {
    for (const list of [
      "text-ink-tertiary font-mono text-caption",
      "font-mono text-caption text-ink-tertiary",
    ]) {
      assert.deepEqual(rules(astro("", `<p class="${list}">x</p>`)), [
        "inline-meta-style",
      ]);
    }
  });

  it("catches the note recipe in either order", () => {
    for (const list of ["text-body-sm text-ink-subtle", "text-ink-subtle text-body-sm"]) {
      assert.deepEqual(rules(astro("", `<p class="${list}">x</p>`)), [
        "inline-note-style",
      ]);
    }
  });

  /* The regression the `[^"]*` bound exists for: two elements that each carry
     half of a recipe are not a recipe. */
  it("does not combine two elements into one violation", () => {
    const source = astro(
      "",
      '<p class="font-mono text-caption">a</p><span class="text-ink-tertiary">b</span>',
    );
    assert.deepEqual(rules(source), []);
  });

  it("leaves the named roles alone", () => {
    const source = astro(
      "",
      '<p class="meta shrink-0">a</p><p class="note mt-3xs">b</p>',
    );
    assert.deepEqual(rules(source), []);
  });

  it("leaves a mono value that is not metadata alone", () => {
    // The fingerprint is mono and small but must be readable, so not tertiary.
    const source = astro("", '<p class="font-mono text-caption wrap-anywhere">x</p>');
    assert.deepEqual(rules(source), []);
  });
});
