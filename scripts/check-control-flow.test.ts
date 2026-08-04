import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { jumps, type Jump } from "./check-control-flow.ts";

/*
 * The violating code lives in template literals rather than in this file's
 * own statements, so the gate can be tested without the test file failing it.
 *
 * Half of these are adversarial. A grep would report every one of the "not a
 * jump" cases, which is the whole argument for parsing: `break` and
 * `continue` are ordinary English words and perfectly good identifiers.
 */

const keywords = (found: readonly Jump[]): readonly string[] =>
  found.map(({ keyword }) => keyword);

describe("jumps", () => {
  it("finds a continue in a loop", () => {
    const source = "for (const x of xs) {\n  if (!x) continue;\n  use(x);\n}";
    assert.deepEqual(jumps("a.mjs", source), [
      { path: "a.mjs", line: 2, keyword: "continue" },
    ]);
  });

  it("finds a break in a loop", () => {
    const source = "while (true) {\n  break;\n}";
    assert.deepEqual(keywords(jumps("a.ts", source)), ["break"]);
  });

  it("finds a break inside a switch, which gets no exemption", () => {
    const source = "switch (k) {\n  case 1:\n    f();\n    break;\n}";
    assert.deepEqual(jumps("a.ts", source), [
      { path: "a.ts", line: 4, keyword: "break" },
    ]);
  });

  it("finds a labelled jump", () => {
    const source = "outer: for (;;) {\n  for (;;) {\n    break outer;\n  }\n}";
    assert.deepEqual(keywords(jumps("a.ts", source)), ["break"]);
  });

  it("finds jumps nested inside a function inside a loop", () => {
    // A shallow walk that stopped at the first function boundary would miss it.
    const source =
      "for (;;) {\n  g(() => {\n    for (;;) {\n      continue;\n    }\n  });\n}";
    assert.deepEqual(jumps("a.ts", source), [
      { path: "a.ts", line: 4, keyword: "continue" },
    ]);
  });

  it("reports every jump, not just the first", () => {
    const source = "for (;;) {\n  continue;\n}\nwhile (x) {\n  break;\n}";
    assert.deepEqual(keywords(jumps("a.ts", source)), ["continue", "break"]);
  });

  it("does not flag the words in a string", () => {
    const source = 'const m = "continue";\nconst n = `a break in the table`;\n';
    assert.deepEqual(jumps("a.ts", source), []);
  });

  it("does not flag the words in a comment", () => {
    const source =
      "// escape pipes so a message cannot break the table\n/* continue */\n";
    assert.deepEqual(jumps("a.ts", source), []);
  });

  it("does not flag identifiers or properties that contain them", () => {
    const source =
      "const breakpoint = 1;\nconst c = { continued: 2 }.continued;\nx.break();\n";
    assert.deepEqual(jumps("a.ts", source), []);
  });

  it("reads .astro frontmatter at the file's own line numbers", () => {
    // Blanking rather than slicing is what keeps this line number honest.
    const source =
      "---\nconst xs = [];\nfor (const x of ys) {\n  continue;\n}\n---\n<p>hi</p>\n";
    assert.deepEqual(jumps("a.astro", source), [
      { path: "a.astro", line: 4, keyword: "continue" },
    ]);
  });

  it("ignores an .astro template, which has no statements to jump out of", () => {
    const source = "---\nconst a = 1;\n---\n<p>break</p>\n<div>continue</div>\n";
    assert.deepEqual(jumps("a.astro", source), []);
  });

  it("is total on an .astro file with no frontmatter", () => {
    assert.deepEqual(jumps("a.astro", "<p>continue</p>\n"), []);
  });

  it("ignores a file it has no dialect for", () => {
    assert.deepEqual(jumps("a.md", "for (;;) { break; }"), []);
  });

  it("recovers rather than throwing on a file that does not parse", () => {
    assert.doesNotThrow(() => jumps("a.ts", "const = = ;;; {{{"));
  });
});
