import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  documentProbe,
  focusProbe,
  motionProbe,
  overflowProbe,
  pageProbe,
} from "./probe.mjs";

/*
 * `page.evaluate` serialises the function and nothing else: the browser gets
 * the source text, not the module. A probe that reaches for a module-scope
 * helper therefore throws `x is not defined` inside the page, at which point
 * the audit reports a driver failure instead of findings, and does so only in
 * CI, where the browser actually runs.
 *
 * This asserts statically what cannot be observed locally.
 */

/** Identifiers defined at module scope that a probe must not close over. */
const MODULE_SCOPE = [
  "EPSILON",
  "ALIGNMENT_TOLERANCE",
  "GRID_BASE",
  "near",
  "round",
  "SCALES",
  "EDGES",
  "IMPACT_RANK",
  "IMPACT_ORDER",
  "INTERACTIVE_SELECTOR",
  "classifyMeasurement",
  "nearMissPairs",
  "rhythmBreaks",
  "designFindings",
  "compareFindings",
  "LIMITS",
  "SPACING_PROPERTIES",
  "probeOptions",
  "TOKEN_NAMES",
];

/** Bare identifier use, ignoring property access such as `Math.round`. */
const usesBareIdentifier = (source, identifier) =>
  new RegExp(String.raw`(?<![.\w$])${identifier}\b`).test(source);

const localNames = (source) => {
  const declared = [
    ...source.matchAll(/(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/g),
  ].map((match) => match[1]);
  const parameters = (source.slice(0, source.indexOf(")")).match(/[A-Za-z_$][\w$]*/g) ?? []);
  return new Set([...declared, ...parameters]);
};

const PROBES = { pageProbe, documentProbe, motionProbe, focusProbe, overflowProbe };

describe("probe serialisation", () => {
  for (const [name, probe] of Object.entries(PROBES)) {
    it(`${name} closes over nothing from module scope`, () => {
      const source = probe.toString();
      const body = source.slice(source.indexOf("{"));
      const local = localNames(source);

      const leaked = MODULE_SCOPE.filter(
        (identifier) => usesBareIdentifier(body, identifier) && !local.has(identifier),
      );

      assert.deepEqual(
        leaked,
        [],
        `${name} would throw in the browser: ${leaked.join(", ")} is not defined there`,
      );
    });

    it(`${name} is a plain function that can be stringified`, () => {
      assert.equal(typeof probe, "function");
      assert.doesNotThrow(() => probe.toString());
      // A native or bound function cannot be serialised into the page.
      assert.doesNotMatch(probe.toString(), /\[native code\]/);
    });
  }

  it("detects a probe that would leak, so the check itself is trustworthy", () => {
    // Guards against the assertion silently passing because the regex broke.
    const leaky = "(a) => { return round(a) + EPSILON; }";
    const local = localNames(leaky);
    const leaked = MODULE_SCOPE.filter(
      (identifier) => usesBareIdentifier(leaky, identifier) && !local.has(identifier),
    );
    assert.deepEqual(leaked.sort(), ["EPSILON", "round"]);
  });

  it("does not mistake property access for a bare reference", () => {
    const fine = "() => Math.round(1) + obj.EPSILON";
    const leaked = MODULE_SCOPE.filter((id) => usesBareIdentifier(fine, id));
    assert.deepEqual(leaked, []);
  });
});
