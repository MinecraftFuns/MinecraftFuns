#!/usr/bin/env node
/** Format changed files only; staged files with unstaged edits are skipped. */

import { execFileSync } from "node:child_process";

const git = (...args: readonly string[]): string =>
  execFileSync("git", args, { encoding: "utf8" });

/** Split `git` output into non-empty lines. */
const lines = (text: string): readonly string[] =>
  text.split("\n").filter((line) => line !== "");

/** Partition staged files into format and skip sets. */
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

/* Format existing paths, not deleted files. */
const FILTER = "--diff-filter=ACMR";

/** Partition plus whether formatted files must be restaged. */
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

  /* Changed paths include non-source files; ignore unsupported formats. */
  execFileSync(
    process.execPath,
    ["node_modules/prettier/bin/prettier.cjs", "--write", "--ignore-unknown", ...format],
    { stdio: "inherit" },
  );

  /* Restage only files known to have no unstaged edits. */
  if (restage) git("add", "--", ...format);
};

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}
