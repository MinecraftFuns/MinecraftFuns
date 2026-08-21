import { standing } from "../config/about.ts";
import { site } from "../config/site.ts";
import type { EducationEntry } from "../schema.ts";
import { bcp47Of, SITE_LANG } from "./lang.ts";

/** Derive identity phrases from `config/about.ts`. */

/** Locale-aware conjunctions for major names. */
const LIST = new Intl.ListFormat(bcp47Of(SITE_LANG), {
  style: "long",
  type: "conjunction",
});

export const majorsPhrase: string = LIST.format(standing.majors);

export const standingPhrase: string = `${standing.ordinal}-year`;

/** Capitalize a clause stored mid-sentence. */
const sentenceCase = (clause: string): string =>
  `${clause.charAt(0).toUpperCase()}${clause.slice(1)}`;

/** Major-count wording; tuple length keeps supported cases explicit. */
const CREDENTIAL_PREFIXES: Readonly<Record<number, string>> = {
  1: "major in",
  2: "double major in",
};

const CREDENTIAL_PREFIX: string =
  CREDENTIAL_PREFIXES[standing.majors.length] ?? "majors in";

export const credentialClause: string = `${CREDENTIAL_PREFIX} ${majorsPhrase}`;

/** Minor wording, or nothing. */
export const minorClause: string | undefined =
  standing.minor === undefined ? undefined : `minor in ${standing.minor}`;

/** Build education row from standing facts. */
export const educationEntries: readonly EducationEntry[] = [
  {
    institution: standing.institution,
    credential: sentenceCase(credentialClause),
    /* Omit absent detail. */
    ...(minorClause === undefined ? {} : { detail: sentenceCase(minorClause) }),
    period: sentenceCase(`${standing.ordinal} year`),
  },
];

/** Home-page site description. */
export const siteDescription: string = `${site.name}. ${site.tagline}`;

/** The About page's own meta description. */
export const aboutDescription: string = `${site.name}. ${majorsPhrase} at the ${standing.institution}.`;
