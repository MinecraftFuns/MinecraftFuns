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
/** Choose singular, double, or plural major wording from configured count. */
const majorCount: number = standing.majors.length;

const CREDENTIAL_PREFIX: string =
  majorCount === 1 ? "Major in" : majorCount === 2 ? "Double major in" : "Majors in";

export const credentialPhrase: string = `${CREDENTIAL_PREFIX} ${majorsPhrase}`;

/** "Minor in Statistics", or nothing at all: never an empty line. */
export const minorPhrase: string | undefined =
  standing.minor === undefined ? undefined : `Minor in ${standing.minor}`;

/** Lower only the first character; subject names retain capitals. */
const lowerFirst = (phrase: string): string =>
  `${phrase.charAt(0).toLowerCase()}${phrase.slice(1)}`;

export const credentialClause: string = lowerFirst(credentialPhrase);

export const minorClause: string | undefined =
  minorPhrase === undefined ? undefined : lowerFirst(minorPhrase);

/** "Fourth year", for the education table's period column. */
const period: string = `${standing.ordinal.charAt(0).toUpperCase()}${standing.ordinal.slice(1)} year`;

/** Derive the education row from standing facts. */
export const educationEntries: readonly EducationEntry[] = [
  {
    institution: standing.institution,
    credential: credentialPhrase,
    ...(minorPhrase === undefined ? {} : { detail: minorPhrase }),
    period,
  },
];

/** Compose derived study facts with the authored site tagline. */
export const siteDescription: string = `${majorsPhrase} at the ${standing.institution}. ${site.tagline}`;

/** The About page's own meta description. */
export const aboutDescription: string = `${site.name}. ${majorsPhrase} at the ${standing.institution}.`;
