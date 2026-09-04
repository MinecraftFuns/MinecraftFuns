/**
 * Speculation rules, in the standard's own vocabulary.
 *
 * The engine is told which links this document considers worth loading ahead
 * of the click, and how strong a hint a hover is. Everything here is
 * declarative: the rules are a data block, never executed, and an engine that
 * has never heard of them ignores the element and navigates as before.
 *
 * The pattern is built from the deployment's base rather than written down as
 * `/*`, because the mirror lives under `/MinecraftFuns/` on an origin it does
 * not own alone. A bare `/*` there would offer to prefetch every other project
 * published under `minecraftfuns.github.io`, which is not this site's traffic
 * to spend.
 */

import type { NonEmpty } from "../prelude/adt.ts";
import type { Eagerness } from "../schema.ts";
import { slashTerminated } from "./url.ts";

/**
 * A document rule: the engine reads the links out of the page itself and keeps
 * the ones the predicate admits. `source` is inferable from `where`, and is
 * written anyway so the rule says what it is at the call site.
 */
export type DocumentRule = {
  readonly source: "document";
  readonly where: { readonly href_matches: string };
  readonly eagerness: Eagerness;
};

/** One action, at least one rule: an empty rule set is not worth emitting. */
export type Rules = { readonly prefetch: NonEmpty<DocumentRule> };

/** Every same-origin route under this deployment, and nothing above it. */
export const hrefPattern = (base: string): string => `${slashTerminated(base)}*`;

export const prefetchRules = (base: string, eagerness: Eagerness): Rules => ({
  prefetch: [
    { source: "document", where: { href_matches: hrefPattern(base) }, eagerness },
  ],
});

/**
 * Serialise for a data block.
 *
 * An HTML parser ends a script element at the first `</script`, so JSON headed
 * into one must not be able to spell it. Escaping `<` at the source removes the
 * question rather than answering it for the inputs we happen to pass today:
 * the result is still the same JSON value, since `<` is how JSON spells
 * that character.
 */
export const serialise = (rules: Rules): string =>
  JSON.stringify(rules).replaceAll("<", "\\u003c");
