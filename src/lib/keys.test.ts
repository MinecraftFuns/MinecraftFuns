import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { formatFingerprint, ownershipProblems, type PublishedKey } from "./keys.ts";
import { wkdHash } from "./wkd.ts";

/*
 * Only the pure half. Loading a key runs `import.meta.glob`, a build-time
 * transform, so `load` cannot run here at all; what it delegates to can, which
 * is why the ownership check was lifted out of it.
 */

const key = (name: string, ...locals: readonly string[]): PublishedKey => ({
  name,
  fingerprint: "0".repeat(40),
  armored: "",
  binary: Uint8Array.of(),
  addresses: locals.map((local) => ({
    local,
    address: `${local}@joefang.org`,
    hash: wkdHash(local),
  })),
});

describe("ownershipProblems", () => {
  it("accepts keys whose addresses are disjoint", () => {
    assert.deepEqual(ownershipProblems([key("a", "me"), key("b", "other")]), []);
  });

  it("accepts an empty directory", () => {
    assert.deepEqual(ownershipProblems([]), []);
  });

  /*
   * The defect the check exists for. Two keys at one directory entry would put
   * two files at one URL, and a client fetching it would get whichever the
   * build happened to write last.
   */
  it("reports an address claimed by two keys, naming both", () => {
    const [problem, ...rest] = ownershipProblems([
      key("first", "me"),
      key("second", "me"),
    ]);

    assert.deepEqual(rest, []);
    assert.match(problem ?? "", /me@joefang\.org/);
    assert.match(problem ?? "", /first\.asc/);
    assert.match(problem ?? "", /second\.asc/);
  });

  /* One key carrying an address twice is one directory entry, not a clash;
     this key really does have two User IDs for the same address. */
  it("does not mistake one key's repeated address for a clash", () => {
    assert.deepEqual(ownershipProblems([key("only", "me", "me")]), []);
  });

  /* Accumulating, as everywhere else here: three clashes are three facts
     about src/keys, not three builds. */
  it("reports every clash rather than the first", () => {
    const problems = ownershipProblems([
      key("first", "me", "hello"),
      key("second", "me"),
      key("third", "hello"),
    ]);

    assert.equal(problems.length, 2);
    assert.match(problems.join("\n"), /second\.asc/);
    assert.match(problems.join("\n"), /third\.asc/);
  });

  /* Every clash is reported against the first claimant, so the message names
     the key that keeps the entry rather than an arbitrary other loser. */
  it("blames the first claimant when three keys collide", () => {
    const problems = ownershipProblems([key("a", "me"), key("b", "me"), key("c", "me")]);

    assert.equal(problems.length, 2);
    problems.forEach((problem) => assert.match(problem, /a\.asc/));
  });
});

describe("formatFingerprint", () => {
  /* Derived rather than written down, because rotating a key changes the file
     while leaving a printed fingerprint looking perfectly plausible. */
  it("upper-cases and groups in fours, as people transcribe them", () => {
    assert.equal(formatFingerprint("abcd1234ef567890"), "ABCD 1234 EF56 7890");
  });

  it("leaves a trailing partial group rather than padding it", () => {
    assert.equal(formatFingerprint("abcde"), "ABCD E");
  });

  it("is total on an empty fingerprint", () => {
    assert.equal(formatFingerprint(""), "");
  });
});
