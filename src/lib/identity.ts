import { standing } from "../config/about.ts";
import { site } from "../config/site.ts";
import type { EducationEntry } from "../schema.ts";
import { bcp47Of, SITE_LANG } from "./lang.ts";

/**
 * Who runs this site, in words: every sentence-shaped rendering of the facts
 * in `config/about.ts`, derived here once.
 *
 * The About page, the site description, and the education table each phrase
 * the same standing differently, and as authored prose they had already
 * drifted once ("second-year" against "third-year" against the truth).
 * Deriving the phrases makes the drift unrepresentable for every surface the
 * build renders; the README, which GitHub renders straight from the repo, is
 * the one surface derivation cannot reach, so `scripts/check-readme.ts`
 * reconciles it against the same atoms instead.
 *
 * Pure and total; formatting only.
 */

/**
 * "A and B", or "A, B and C": the chrome language's own list conjunction,
 * from the platform rather than a hand-rolled join that would re-derive
 * comma placement.
 */
const LIST = new Intl.ListFormat(bcp47Of(SITE_LANG), {
  style: "long",
  type: "conjunction",
});

/** "Computer Science and Cognitive Science". */
export const majorsPhrase: string = LIST.format(standing.majors);

/** "fourth-year": the token that actually drifts, spelled exactly once. */
export const standingPhrase: string = `${standing.ordinal}-year`;

/**
 * "Double major in X and Y", honest about the count: one major is not a
 * double major, and a third would make "double" a lie. The count is widened
 * to `number` first, because the config's tuple type makes today's length a
 * literal and the other branches statically dead; the branches are for the
 * config this file cannot see yet.
 */
const majorCount: number = standing.majors.length;

const CREDENTIAL_PREFIX: string =
  majorCount === 1 ? "Major in" : majorCount === 2 ? "Double major in" : "Majors in";

export const credentialPhrase: string = `${CREDENTIAL_PREFIX} ${majorsPhrase}`;

/** "Minor in Statistics", or nothing at all: never an empty line. */
export const minorPhrase: string | undefined =
  standing.minor === undefined ? undefined : `Minor in ${standing.minor}`;

/**
 * Mid-sentence forms: only the leading article is lowered, so the subject
 * names keep their capitals. "double major in Computer Science and
 * Cognitive Science", not "double major in computer science".
 */
const lowerFirst = (phrase: string): string =>
  `${phrase.charAt(0).toLowerCase()}${phrase.slice(1)}`;

export const credentialClause: string = lowerFirst(credentialPhrase);

export const minorClause: string | undefined =
  minorPhrase === undefined ? undefined : lowerFirst(minorPhrase);

/** "Fourth year", for the education table's period column. */
const period: string = `${standing.ordinal.charAt(0).toUpperCase()}${standing.ordinal.slice(1)} year`;

/**
 * The education table, derived rather than authored: the one entry the
 * standing describes. A second degree, when there is one, becomes config
 * again; today it would be placeholder shape with nothing true to hold.
 */
export const educationEntries: readonly EducationEntry[] = [
  {
    institution: standing.institution,
    credential: credentialPhrase,
    ...(minorPhrase === undefined ? {} : { detail: minorPhrase }),
    period,
  },
];

/**
 * The default document description: the studied facts, then the editorial
 * tail from `config/site.ts`, which is the only part of this sentence that
 * is authored rather than derived.
 */
export const siteDescription: string = `${majorsPhrase} at the ${standing.institution}. ${site.tagline}`;

/** The About page's own meta description. */
export const aboutDescription: string = `${site.name}. ${majorsPhrase} at the ${standing.institution}.`;
