#!/usr/bin/env node
/**
 * Prettier over what changed, rather than over the repository.
 *
 * Formatting the whole tree is correct and slow, and it puts every file in the
 * diff of a change that touched three. This selects from git instead, so a run
 * costs what the edit cost.
 *
 * Two scopes, because the question has two forms and they are not the same
 * set. The working tree is what a person or an agent is holding; the index is
 * what a commit is about to contain.
 *
 * In `--staged` mode a file with *both* staged and unstaged edits is reported
 * and left alone. Formatting it would have to re-add the whole file, which
 * silently commits the half the author had deliberately held back. Refusing is
 * the only answer that cannot surprise.
 */

import { execFileSync } from "node:child_process";

const git = (...args: readonly string[]): string =>
  execFileSync("git", args, { encoding: "utf8" });

/** Non-empty lines, since `git diff` prints nothing rather than an empty list. */
const lines = (text: string): readonly string[] =>
  text.split("\n").filter((line) => line !== "");

/**
 * Split the staged set into what can be formatted and what must not be.
 * Pure: the two inputs are file lists, the output partitions the first.
 */
export type Partition = {
  readonly format: readonly string[];
  readonly skip: readonly string[];
};

export const partitionStaged = (
  staged: readonly string[],
  alsoUnstaged: readonly string[],
): Partition => {
  const held = new Set(alsoUnstaged);
  return {
    format: staged.filter((path) => !held.has(path)),
    skip: staged.filter((path) => held.has(path)),
  };
};

/* Added, Copied, Modified, Renamed: the states in which a file exists to be
   formatted. Deleted is the one that does not. */
const FILTER = "--diff-filter=ACMR";

/** A partition plus whether the formatted files must go back into the index. */
type Selection = Partition & { readonly restage: boolean };

const SCOPES: Readonly<Record<"tree" | "staged", () => Selection>> = {
  tree: () => ({
    format: [
      ...lines(git("diff", "--name-only", FILTER, "HEAD")),
      ...lines(git("ls-files", "--others", "--exclude-standard")),
    ],
    skip: [],
    restage: false,
  }),
  staged: () =>
    Object.assign(
      partitionStaged(
        lines(git("diff", "--name-only", "--cached", FILTER)),
        lines(git("diff", "--name-only", FILTER)),
      ),
      { restage: true },
    ),
};

// ---------------------------------------------------------------------------
// Effect boundary
// ---------------------------------------------------------------------------

const main = () => {
  const scope = process.argv.includes("--staged") ? "staged" : "tree";
  const { format, skip, restage } = SCOPES[scope]();

  skip.forEach((path) =>
    console.warn(`format-changed: ${path} has unstaged edits; left unformatted`),
  );

  if (format.length === 0) {
    console.log(`format-changed: nothing changed in the ${scope}`);
    return;
  }

  /* `--ignore-unknown` is what makes a git-driven list safe: the set contains
     images, keys, and lockfiles, and prettier should pass over them rather
     than fail on the first one it has no parser for. */
  execFileSync(
    process.execPath,
    ["node_modules/prettier/bin/prettier.cjs", "--write", "--ignore-unknown", ...format],
    { stdio: "inherit" },
  );

  /* Re-stage exactly what was formatted. Sound because every path here had no
     unstaged edits, so the file on disk and the indexed version differ only by
     what prettier just did. */
  if (restage) git("add", "--", ...format);
};

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}
