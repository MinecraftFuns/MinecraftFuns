import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { facts, missing } from "./check-readme.ts";

describe("check-readme", () => {
  it("derives at least the standing, the profiles, and the blog", () => {
    const labels = facts.map((fact) => fact.label);
    ["academic year", "institution", "major", "blog"].forEach((label) => {
      assert.ok(labels.includes(label), label);
    });
  });

  it("passes a README that states every fact", () => {
    const readme = facts.map((fact) => fact.needle).join("\n");
    assert.deepEqual(missing(readme, facts), []);
  });

  it("names each absent fact, not merely the first", () => {
    const [first, ...rest] = facts;
    const readme = rest.map((fact) => fact.needle).join("\n");
    assert.deepEqual(missing(readme, facts), [first]);
    assert.equal(missing("", facts).length, facts.length);
  });

  it("is a substring check, deliberately: phrasing stays the README's own", () => {
    const wrapped = facts
      .map((fact) => `...prose around ${fact.needle} continues...`)
      .join(" ");
    assert.deepEqual(missing(wrapped, facts), []);
  });
});
