import { standing } from "../config/about.ts";
import { site } from "../config/site.ts";
import type { EducationEntry } from "../schema.ts";
import { bcp47Of, SITE_LANG } from "./lang.ts";

/** Derive every rendered identity phrase from `config/about.ts`. */

/** Format major names with the chrome locale's conjunction rules. */
const LIST = new Intl.ListFormat(bcp47Of(SITE_LANG), {
  style: "long",
  type: "conjunction",
});

/** "Computer Science and Cognitive Science". */
export const majorsPhrase: string = LIST.format(standing.majors);

/** "fourth-year": the token that actually drifts, spelled exactly once. */
export const standingPhrase: string = `${standing.ordinal}-year`;

/**
 * Raise the first character only; subject names keep their own capitals.
 *
 * The one case transformation in this module. Every clause below is stored in
 * the form that composes into running prose, and is raised where a sentence or
 * a table cell begins. Storing the raised form instead would need this
 * function's inverse as well, and two spellings of one clause are two things
 * that can disagree.
 */
const sentenceCase = (clause: string): string =>
  `${clause.charAt(0).toUpperCase()}${clause.slice(1)}`;

/**
 * One major reads "major in", two "double major in", anything else the plural.
 *
 * A table rather than a comparison chain, because `majors` is a `const` tuple:
 * its `length` is a literal type, and the checker rightly refuses `=== 1`
 * against a tuple of two as a comparison that cannot hold. Widening the count
 * to `number` would silence that, which is how the branches got to look live
 * while being decided at compile time. Indexing is partial under
 * `noUncheckedIndexedAccess`, so `??` is the totalizing step and says which
 * case is the default.
 */
const CREDENTIAL_PREFIXES: Readonly<Record<number, string>> = {
  1: "major in",
  2: "double major in",
};

const CREDENTIAL_PREFIX: string =
  CREDENTIAL_PREFIXES[standing.majors.length] ?? "majors in";

/** "double major in Computer Science and Cognitive Science". */
export const credentialClause: string = `${CREDENTIAL_PREFIX} ${majorsPhrase}`;

/** "minor in Statistics", or nothing at all: never an empty line. */
export const minorClause: string | undefined =
  standing.minor === undefined ? undefined : `minor in ${standing.minor}`;

/** Derive the education row from standing facts. */
export const educationEntries: readonly EducationEntry[] = [
  {
    institution: standing.institution,
    credential: sentenceCase(credentialClause),
    /* Omit absent detail rather than rendering an empty paragraph. */
    ...(minorClause === undefined ? {} : { detail: sentenceCase(minorClause) }),
    period: sentenceCase(`${standing.ordinal} year`),
  },
];

/** What the site is, for the home page. Who I am belongs on the About page. */
export const siteDescription: string = `${site.name}. ${site.tagline}`;

/** The About page's own meta description. */
export const aboutDescription: string = `${site.name}. ${majorsPhrase} at the ${standing.institution}.`;
