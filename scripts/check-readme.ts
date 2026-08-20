#!/usr/bin/env node
/**
 * Source gate: the profile README agrees with the site's config.
 *
 * `README.md` is the GitHub profile, rendered by GitHub straight from the
 * repository: the one identity surface no Astro build step can derive from
 * `src/config`. Every other surface now interpolates its facts
 * (`lib/identity.ts`), so the README is the last place a stale year or a
 * renamed account can survive unnoticed; it is where "second-year" outlived
 * the truth once already.
 *
 * Redundancy is safe exactly when one copy is authoritative and something
 * checks the other against it. Config is authoritative; this is the check.
 * It asserts *facts appear*, not phrasing: the README's sentences stay its
 * own, and the gate only demands that the standing tokens, the profile
 * URLs, and the canonical blog address occur somewhere in them.
 */

import { readFile } from "node:fs/promises";

import { standing } from "../src/config/about.ts";
import { deployments } from "../src/config/deployments.ts";
import { profiles } from "../src/lib/contact.ts";
import { standingPhrase } from "../src/lib/identity.ts";
import { each, report } from "./lib/gate.ts";

/** A fact the README must state, and the string that proves it does. */
export type Fact = {
  readonly label: string;
  readonly needle: string;
};

export const facts: readonly Fact[] = [
  /* The year counter: the value with a schedule for going stale. */
  { label: "academic year", needle: standingPhrase },
  { label: "institution", needle: standing.institution },
  ...standing.majors.map((major) => ({ label: "major", needle: major })),
  ...(standing.minor === undefined ? [] : [{ label: "minor", needle: standing.minor }]),
  /* Each profile URL, derived through the same table the footer uses, so a
     renamed account changes config once and this gate names the README. */
  ...profiles.map((profile) => ({
    label: `${profile.label} profile`,
    needle: String(profile.href),
  })),
  /* The blog lives on the canonical origin; a link to the superseded host
     or a mirror would send profile readers to the copy asking not to be
     indexed. */
  { label: "blog", needle: `${deployments.canonical.origin}/blog/` },
];

/** The facts a given README fails to state. Pure and total. */
export const missing = (readme: string, wanted: readonly Fact[]): readonly Fact[] =>
  wanted.filter(({ needle }) => !readme.includes(needle));

// ---------------------------------------------------------------------------
// Effect boundary
// ---------------------------------------------------------------------------

const main = async () => {
  const readme = await readFile("README.md", "utf8");

  report({
    name: "check-readme",
    problems: missing(readme, facts),
    passed: `README.md states all ${facts.length} configured facts`,
    failed: "in README.md",
    body: each(
      ({ label, needle }) =>
        `  ${label}: expected ${JSON.stringify(needle)} to appear\n    → update README.md, or the config it drifted from`,
    ),
  });
};

/* Run only as a program, so the tests can import the pure half. */
if (process.argv[1] === new URL(import.meta.url).pathname) {
  await main();
}
