#!/usr/bin/env node
/** Gate that the stylesheet realises every variant the type system declares. */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { TONES, toneClass } from "../src/components/control.ts";
import { each, isMain, report } from "./lib/gate.ts";

/** Where every component class the project owns is defined. */
const STYLESHEET = "src/styles/global.css";

/**
 * A variant the type declares, and the selector that would realise it.
 *
 * The union and the stylesheet are two halves of one sum type living in two
 * languages, and only one half is typechecked. Nothing in CSS fails when a rule
 * is deleted from under a class that markup still emits: the page builds, the
 * gates pass, and the control renders as bare text. This isn't hypothetical:
 * the control block was lost this way once.
 */
export type Variant = {
  readonly name: string;
  readonly selector: string;
};

/** Every variant that must exist, derived from the vocabulary itself. */
export const required = (): readonly Variant[] =>
  TONES.map((tone) => ({ name: `tone ${tone}`, selector: `.${toneClass(tone)}` }));

/** A selector is realised when the stylesheet defines a rule for it. */
export const undefinedIn = (
  css: string,
  variants: readonly Variant[],
): readonly Variant[] =>
  variants.filter(
    ({ selector }) => !new RegExp(`\\${selector}(?![\\w-])\\s*(?:,|\\{)`, "u").test(css),
  );

const main = async () => {
  const css = await readFile(resolve(STYLESHEET), "utf8");
  const variants = required();
  const missing = undefinedIn(css, variants);

  report({
    name: "check-vocabulary",
    problems: missing,
    passed: `${STYLESHEET} defines all ${variants.length} declared variant(s)`,
    body: each(
      ({ name, selector }) =>
        `  ${name}\n    ${selector} is emitted into markup but defined nowhere\n    → define it in ${STYLESHEET}, or drop it from the vocabulary`,
    ),
  });
};

if (isMain(import.meta.url)) await main();
