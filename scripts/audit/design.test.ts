import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ALIGNMENT_TOLERANCE,
  classifyMeasurement,
  designFindings,
  GRID_BASE,
  isNearMiss,
  rhythmBreaks,
} from "./design.ts";
import type { Finding } from "./checks.ts";

/*
 * The probe runs in a browser CI can start but this machine cannot. Splitting
 * observation from judgement means the judgement (every rule that decides
 * whether something is a defect) is testable here, with synthetic
 * measurements standing in for a real page.
 *
 * These are mostly adversarial: values that *should* pass sit right next to
 * values that should not, because a conformance checker whose threshold is off
 * by a pixel either floods the report or says nothing.
 */

const TOKENS = [4, 8, 12, 16, 24, 32, 48, 64];

const context = { page: "/", viewport: "desktop" };
const rules = (findings: readonly Finding[]): readonly string[] =>
  findings.map((finding) => finding.rule);

describe("classifyMeasurement", () => {
  it("accepts exact tokens", () => {
    for (const token of TOKENS) {
      assert.equal(classifyMeasurement(token, TOKENS), "token");
    }
  });

  it("accepts zero: absent spacing is not a scale error", () => {
    assert.equal(classifyMeasurement(0, TOKENS), "token");
  });

  it("tolerates sub-pixel rounding around a token", () => {
    // Browsers return fractional geometry from rem and clamp values.
    assert.equal(classifyMeasurement(15.6, TOKENS), "token");
    assert.equal(classifyMeasurement(16.4, TOKENS), "token");
  });

  it("separates on-grid non-tokens from outright off-grid values", () => {
    // 20 is 5x the base but not a token: plausible, worth a glance.
    assert.equal(classifyMeasurement(20, TOKENS), "on-grid");
    assert.equal(classifyMeasurement(40, TOKENS), "on-grid");
    // 13, 17, 22 are the signature of a hand-tweaked value.
    assert.equal(classifyMeasurement(13, TOKENS), "off-grid");
    assert.equal(classifyMeasurement(17, TOKENS), "off-grid");
    assert.equal(classifyMeasurement(22, TOKENS), "off-grid");
  });

  it("uses the declared base", () => {
    assert.equal(classifyMeasurement(10, [], GRID_BASE), "off-grid");
    assert.equal(classifyMeasurement(10, [], 5), "on-grid");
  });

  it("is total: every input yields a classification", () => {
    for (const value of [0, -4, 0.1, 1e6, 3.7]) {
      assert.ok(["token", "on-grid", "off-grid"].includes(classifyMeasurement(value, TOKENS)));
    }
  });
});

describe("isNearMiss", () => {
  it("treats exact and sub-pixel equality as aligned", () => {
    assert.equal(isNearMiss(100, 100), false);
    assert.equal(isNearMiss(100, 100.4), false);
  });

  it("flags the uncanny interval", () => {
    // Visible, but too small to read as a decision.
    for (const delta of [1, 2, 3, 4]) {
      assert.ok(isNearMiss(100, 100 + delta), `missed a ${delta}px near-miss`);
    }
  });

  it("treats a clear offset as intentional", () => {
    assert.equal(isNearMiss(100, 124), false);
    assert.equal(isNearMiss(100, 100 + ALIGNMENT_TOLERANCE + 1), false);
  });

  it("is symmetric", () => {
    assert.equal(isNearMiss(100, 102), isNearMiss(102, 100));
  });
});

describe("rhythmBreaks", () => {
  it("reports nothing for a constant sequence", () => {
    assert.deepEqual(rhythmBreaks([24, 24, 24]), []);
  });

  it("tolerates sub-pixel variation", () => {
    assert.deepEqual(rhythmBreaks([24, 24.4, 23.8]), []);
  });

  it("reports the distinct gaps when rhythm breaks", () => {
    const breaks = rhythmBreaks([24, 24, 32]);
    assert.equal(breaks.length, 2);
    assert.ok(breaks.includes(24) && breaks.includes(32));
  });

  it("needs at least two gaps to have a rhythm at all", () => {
    assert.deepEqual(rhythmBreaks([]), []);
    assert.deepEqual(rhythmBreaks([24]), []);
  });
});

describe("designFindings", () => {
  it("returns nothing for a conformant page", () => {
    const probe = {
      tokens: { spacing: TOKENS, radius: [4, 8, 12], text: [16, 20] },
      alignmentGroups: [{ container: "div.a", lefts: [10, 10], rights: [200, 200] }],
      rhythmGroups: [{ container: "ul.rows", signature: "li", gaps: [24, 24, 24] }],
      measurements: {
        spacing: [{ value: 16, selector: "div.a", property: "padding-top" }],
        radii: [{ value: 12, selector: "div.a", property: "borderRadius" }],
        fontSizes: [{ value: 16, selector: "p", property: "fontSize" }],
      },
      asymmetricPadding: [],
    };
    assert.deepEqual(designFindings(probe, context), []);
  });

  /*
   * The regression the rule exists for. Two components placed in one slot
   * brought opposite margins, one leading and one trailing, so the tag row on
   * the blog index sat flush on the rule beneath it. Every other rule passed:
   * both blocks were aligned, and every value they did declare was a token.
   */
  it("catches siblings that meet with no gap", () => {
    const probe = {
      flushPairs: [{ container: "main", before: "nav.tags", after: "section" }],
    };
    const found = designFindings(probe, context);
    assert.deepEqual(rules(found), ["siblings-flush"]);
    assert.match(found[0]?.message ?? "", /no space between them/);
    assert.equal(found[0]?.selector, "main > section");
  });

  it("reports nothing when no pair is flush", () => {
    assert.deepEqual(designFindings({ flushPairs: [] }, context), []);
  });

  it("is total on a probe that predates the rule", () => {
    assert.deepEqual(designFindings({}, context), []);
  });

  it("catches a near-miss alignment", () => {
    const probe = {
      alignmentGroups: [{ container: "div.card", lefts: [24, 26], rights: [] }],
    };
    const found = designFindings(probe, context);
    assert.deepEqual(rules(found), ["near-miss-alignment"]);
    assert.match(found[0]?.message ?? "", /2px apart/);
  });

  it("does not flag a deliberate offset as a near miss", () => {
    const probe = {
      alignmentGroups: [{ container: "div.card", lefts: [24, 72], rights: [] }],
    };
    assert.deepEqual(designFindings(probe, context), []);
  });

  it("reports each distinct near-miss pair once", () => {
    const probe = {
      alignmentGroups: [{ container: "div.card", lefts: [24, 26, 24, 26], rights: [] }],
    };
    // Duplicated edge values must not multiply into duplicated findings.
    assert.equal(designFindings(probe, context).length, 1);
  });

  it("catches uneven rhythm between repeated siblings", () => {
    const probe = {
      rhythmGroups: [{ container: "ul.rows", signature: "li.row", gaps: [24, 24, 31] }],
    };
    const found = designFindings(probe, context);
    assert.deepEqual(rules(found), ["uneven-rhythm"]);
    assert.match(found[0]?.message ?? "", /not constant/);
  });

  it("grades off-grid more seriously than off-token", () => {
    const probe = {
      tokens: { spacing: TOKENS, radius: [], text: [] },
      measurements: {
        spacing: [
          { value: 13, selector: "div.a", property: "padding-top" },
          { value: 20, selector: "div.b", property: "padding-top" },
        ],
        radii: [],
        fontSizes: [],
      },
    };
    const found = designFindings(probe, context);
    const offGrid = found.find((f) => f.rule === "off-scale-spacing");
    const offToken = found.find((f) => f.rule === "off-token-spacing");
    assert.equal(offGrid?.impact, "moderate");
    assert.equal(offToken?.impact, "minor");
  });

  it("checks radii and font sizes against their own scales", () => {
    const probe = {
      tokens: { spacing: [], radius: [4, 8, 12], text: [14, 16] },
      measurements: {
        spacing: [],
        radii: [{ value: 7, selector: "div.a", property: "borderRadius" }],
        fontSizes: [{ value: 15, selector: "p", property: "fontSize" }],
      },
    };
    const found = designFindings(probe, context);
    assert.ok(rules(found).includes("off-scale-radii"));
    assert.ok(rules(found).includes("off-scale-fontSizes"));
  });

  it("catches asymmetric horizontal padding", () => {
    const probe = {
      asymmetricPadding: [{ selector: "div.a", left: 16, right: 20 }],
    };
    const found = designFindings(probe, context);
    assert.deepEqual(rules(found), ["asymmetric-padding"]);
  });

  it("is total on an empty or partial probe", () => {
    // A probe that failed halfway must not crash the whole audit.
    for (const probe of [{}, { alignmentGroups: [] }, { measurements: {} }]) {
      assert.doesNotThrow(() => designFindings(probe, context));
      assert.deepEqual(designFindings(probe, context), []);
    }
  });

  it("carries page and viewport onto every finding", () => {
    const probe = { alignmentGroups: [{ container: "div", lefts: [10, 12], rights: [] }] };
    const found = designFindings(probe, { page: "/blog/", viewport: "mobile" });
    assert.equal(found[0]?.page, "/blog/");
    assert.equal(found[0]?.viewport, "mobile");
    assert.equal(found[0]?.category, "design");
  });
});
