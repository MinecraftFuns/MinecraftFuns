import type { StandingConfig } from "../schema.ts";

/**
 * Facts for the About page, the site description, and the profile README.
 *
 * Atoms only, and only verifiable ones. The sentences these facts appear in
 * are derived in `lib/identity.ts`, so updating a fact here updates every
 * surface that states it; the README, which no build step renders, is
 * checked against these values by `scripts/check-readme.ts` instead.
 *
 * Experience, skills and awards are deliberately absent rather than filled
 * with plausible placeholder text: an invented internship that ships to a
 * live CV is worse than a short one. The About page keeps a commented
 * template for the day there is something true to add.
 */
export const standing = {
  /* The year counter: the one value here that goes stale on a schedule.
     Bump it once, in this line, each September. */
  ordinal: "fourth",
  institution: "University of Toronto",
  majors: ["Computer Science", "Cognitive Science"],
  minor: "Statistics",
} as const satisfies StandingConfig;
