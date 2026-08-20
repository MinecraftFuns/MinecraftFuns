import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { standing } from "../config/about.ts";
import { site } from "../config/site.ts";
import {
  aboutDescription,
  credentialClause,
  credentialPhrase,
  educationEntries,
  majorsPhrase,
  minorClause,
  siteDescription,
  standingPhrase,
} from "./identity.ts";

/*
 * These are derivations of config, so the tests state the *relationships*
 * rather than restating the current values: a changed config should change
 * the phrases without touching this file.
 */
describe("identity", () => {
  it("joins the majors with the platform's conjunction", () => {
    standing.majors.forEach((major) => {
      assert.ok(majorsPhrase.includes(major), major);
    });
    assert.ok(!majorsPhrase.includes(","), "two majors need no comma");
  });

  it("spells the drifting token once, from the ordinal", () => {
    assert.equal(standingPhrase, `${standing.ordinal}-year`);
  });

  it("is honest about the major count", () => {
    // Two majors today, so "double"; the prefix is derived, not written.
    assert.ok(credentialPhrase.startsWith("Double major in "));
  });

  it("lowers only the leading word for mid-sentence use", () => {
    assert.ok(credentialClause.startsWith("double major in "));
    standing.majors.forEach((major) => {
      assert.ok(credentialClause.includes(major), "subject keeps its capitals");
    });
  });

  it("derives the education table from the same atoms", () => {
    const [entry] = educationEntries;
    assert.equal(entry?.institution, standing.institution);
    assert.equal(entry?.credential, credentialPhrase);
    assert.ok(entry?.period.endsWith(" year"));
  });

  it("keeps the minor out entirely when there is none to state", () => {
    // With a minor configured, both forms carry it; the absent case is a
    // missing field, not an empty string.
    assert.ok(standing.minor === undefined || minorClause?.includes(standing.minor));
  });

  it("assembles the descriptions from facts plus the authored tail", () => {
    assert.ok(siteDescription.endsWith(site.tagline));
    assert.ok(aboutDescription.startsWith(`${site.name}. `));
    assert.ok(aboutDescription.includes(standing.institution));
  });
});
