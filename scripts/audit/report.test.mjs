import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { compareFindings, dedupeFindings, summarise } from "./checks.mjs";
import { toJson, toMarkdown } from "./report.mjs";

/*
 * The browser-driven half of the audit cannot run here, so these cover the
 * half that can: deduplication, ordering, summarising, and rendering. A report
 * that silently drops or miscounts findings is worse than no report, because
 * it is believed.
 */

const finding = (overrides = {}) => ({
  category: "accessibility",
  rule: "color-contrast",
  impact: "serious",
  page: "/",
  viewport: "desktop",
  colorScheme: "light",
  selector: ".x",
  message: "insufficient contrast",
  ...overrides,
});

const META = {
  generatedAt: "2026-08-01T00:00:00.000Z",
  target: "http://localhost:4321/MinecraftFuns/",
  pages: ["/", "/blog/"],
  viewports: 4,
};

describe("dedupeFindings", () => {
  it("collapses the same fault seen across viewports and schemes", () => {
    const deduped = dedupeFindings([
      finding({ viewport: "desktop", colorScheme: "light" }),
      finding({ viewport: "desktop", colorScheme: "dark" }),
      finding({ viewport: "narrow", colorScheme: "light" }),
    ]);
    assert.equal(deduped.length, 1);
    assert.deepEqual(deduped[0].contexts, [
      "desktop/light",
      "desktop/dark",
      "narrow/light",
    ]);
  });

  it("keeps faults apart when they differ in any identifying field", () => {
    const deduped = dedupeFindings([
      finding(),
      finding({ page: "/blog/" }),
      finding({ rule: "target-size" }),
      finding({ selector: ".y" }),
      finding({ category: "readability" }),
    ]);
    assert.equal(deduped.length, 5);
  });

  it("does not repeat an identical context", () => {
    const deduped = dedupeFindings([finding(), finding()]);
    assert.deepEqual(deduped[0].contexts, ["desktop/light"]);
  });

  it("handles findings with no viewport or scheme", () => {
    const deduped = dedupeFindings([
      finding({ viewport: undefined, colorScheme: undefined }),
    ]);
    assert.deepEqual(deduped[0].contexts, []);
  });

  it("returns an empty list for no input", () => {
    assert.deepEqual(dedupeFindings([]), []);
  });
});

describe("compareFindings", () => {
  it("orders by impact, most severe first", () => {
    const sorted = [
      finding({ impact: "minor", rule: "a" }),
      finding({ impact: "critical", rule: "b" }),
      finding({ impact: "moderate", rule: "c" }),
    ].sort(compareFindings);
    assert.deepEqual(
      sorted.map((entry) => entry.impact),
      ["critical", "moderate", "minor"],
    );
  });

  it("treats a missing impact as the least severe", () => {
    const sorted = [
      finding({ impact: undefined, rule: "a" }),
      finding({ impact: "minor", rule: "b" }),
    ].sort(compareFindings);
    assert.equal(sorted[0].impact, "minor");
  });
});

describe("summarise", () => {
  it("counts by category and impact", () => {
    const summary = summarise([
      finding({ category: "accessibility", impact: "serious" }),
      finding({ category: "accessibility", impact: "minor" }),
      finding({ category: "runtime", impact: "serious" }),
    ]);
    assert.equal(summary.total, 3);
    assert.deepEqual(summary.byCategory, { accessibility: 2, runtime: 1 });
    assert.deepEqual(summary.byImpact, { serious: 2, minor: 1 });
  });

  it("reports zero for no findings", () => {
    assert.deepEqual(summarise([]), { total: 0, byCategory: {}, byImpact: {} });
  });
});

describe("toJson", () => {
  it("emits parseable JSON carrying every finding", () => {
    const parsed = JSON.parse(toJson(dedupeFindings([finding(), finding({ page: "/blog/" })]), META));
    assert.equal(parsed.summary.total, 2);
    assert.equal(parsed.findings.length, 2);
    assert.equal(parsed.target, META.target);
    assert.deepEqual(parsed.pagesAudited, META.pages);
  });

  it("stays parseable when a message contains quotes and newlines", () => {
    const nasty = finding({ message: 'he said "no"\nthen left' });
    assert.doesNotThrow(() => JSON.parse(toJson([nasty], META)));
  });
});

describe("toMarkdown", () => {
  it("states plainly when there is nothing to report", () => {
    const markdown = toMarkdown([], META);
    assert.match(markdown, /No findings/);
  });

  it("never claims accessibility from a clean run", () => {
    // Automated checks cover a minority of WCAG; a green report that implies
    // otherwise is actively misleading.
    for (const markdown of [toMarkdown([], META), toMarkdown([finding()], META)]) {
      assert.match(markdown, /minority of WCAG/);
    }
  });

  it("groups findings under their page", () => {
    const markdown = toMarkdown(
      dedupeFindings([finding(), finding({ page: "/blog/" })]),
      META,
    );
    assert.match(markdown, /`\/`/);
    assert.match(markdown, /`\/blog\/`/);
  });

  it("escapes pipes so a message cannot break the table", () => {
    const markdown = toMarkdown([finding({ message: "a | b | c" })], META);
    const tableRows = markdown
      .split("\n")
      .filter((line) => line.startsWith("| ") && line.includes("color-contrast"));
    assert.equal(tableRows.length, 1);
    // Five columns means six pipes; an unescaped message would add more.
    assert.equal((tableRows[0].match(/(?<!\\)\|/g) ?? []).length, 6);
  });

  it("marks non-blocking status explicitly", () => {
    assert.match(toMarkdown([finding()], META), /never blocks a deploy/);
  });

  it("includes the impact and the rule for each finding", () => {
    const markdown = toMarkdown([finding({ rule: "target-size" })], META);
    assert.match(markdown, /serious/);
    assert.match(markdown, /target-size/);
  });
});
