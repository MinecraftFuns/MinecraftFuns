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
 * Clauses below are stored mid-sentence; this is the only place they are
 * raised. Subject names keep their own capitals.
 */
const sentenceCase = (clause: string): string =>
  `${clause.charAt(0).toUpperCase()}${clause.slice(1)}`;

/**
 * A table, not a comparison chain: `majors` is a `const` tuple, so its `length`
 * is a literal type and the checker refuses `=== 1` against a tuple of two.
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
