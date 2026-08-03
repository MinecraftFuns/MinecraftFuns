#!/usr/bin/env node
/**
 * Source gate: no `break`, no `continue`.
 *
 * Both are non-local jumps. They make where a loop body ends depend on how
 * deeply it is nested rather than on what it computes, so the exit condition
 * cannot be named, cannot be passed anywhere, and cannot be tested apart from
 * the loop it sits inside. Every loop in this repo is the backend of a fold,
 * a filter, or a partial map, and each of those has a place for the condition
 * that reads better than a jump:
 *
 *   continue on a predicate     a predicate, composed with `allOf`
 *   continue past a bad value   a function returning `undefined`, pushed when present
 *   break on a hit              `find`, `some`, or `every`
 *   break on a count            `slice` before the work, not a counter during it
 *   break in a `switch`         `return` from the case, which every one here does
 *
 * The last is why no exemption is carved out for `switch`. A case that breaks
 * is a case that falls through when someone forgets; a case that returns is a
 * case that cannot. Forbidding `break` outright makes the `switch` statements
 * in this repo expressions in all but syntax, which is what they already are.
 *
 * This parses rather than greps. `break` and `continue` are short words that
 * occur in prose, in identifiers, and in string literals, and a regex that
 * tried to exclude those would be a worse parser than the one already
 * installed for typechecking.
 */

import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import ts from "typescript";

import { moduleBodyOnly } from "./lib/frontmatter.mjs";

/** Extension to how TypeScript should read the file. */
const DIALECT = {
  ".ts": ts.ScriptKind.TS,
  ".mjs": ts.ScriptKind.JS,
  ".js": ts.ScriptKind.JS,
  /* An `.astro` file is its frontmatter, blanked back to its own offsets;
     the template holds markup, which has no statements to jump out of. */
  ".astro": ts.ScriptKind.TS,
};

const extensionOf = (path) => `.${path.split(".").pop()}`;

/**
 * Every jump in one file. Pure and total: an unparseable file yields
 * whatever TypeScript recovered from it rather than throwing, which is the
 * right failure mode for a gate that must not become the reason a build stops.
 */
export const jumps = (path, source) => {
  const kind = DIALECT[extensionOf(path)];
  if (kind === undefined) return [];

  const text = kind === ts.ScriptKind.TS && path.endsWith(".astro") ? moduleBodyOnly(source) : source;
  const parsed = ts.createSourceFile(path, text, ts.ScriptTarget.ESNext, true, kind);

  const found = [];
  const visit = (node) => {
    const keyword = ts.isBreakStatement(node)
      ? "break"
      : ts.isContinueStatement(node)
        ? "continue"
        : undefined;

    if (keyword !== undefined) {
      const { line } = parsed.getLineAndCharacterOfPosition(node.getStart(parsed));
      found.push({ path, line: line + 1, keyword });
    }

    ts.forEachChild(node, visit);
  };

  visit(parsed);
  return found;
};

/** What to reach for instead, keyed by the jump that was written. */
const REMEDY = {
  continue:
    "lift the condition into a predicate, or return `undefined` from a function the loop pushes when present",
  break: "use `find`, `some`, or `every`; in a `switch`, return from the case",
};

// ---------------------------------------------------------------------------
// Effect boundary
// ---------------------------------------------------------------------------

/** Directories to scan, and the extensions worth parsing in each. */
const ROOTS = ["src", "scripts"];

const sourcesUnder = async (dir) => {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && extensionOf(entry.name) in DIALECT)
    .map((entry) => resolve(entry.parentPath, entry.name));
};

const main = async () => {
  const files = [
    ...(await Promise.all(ROOTS.map(sourcesUnder))).flat(),
    resolve("astro.config.mjs"),
  ];

  const found = (
    await Promise.all(
      files.map(async (path) => jumps(relative(process.cwd(), path), await readFile(path, "utf8"))),
    )
  ).flat();

  if (found.length === 0) {
    console.log(`check-control-flow: OK, ${files.length} file(s) carry no break or continue`);
    return;
  }

  console.error(`check-control-flow: ${found.length} jump(s)\n`);
  found.forEach(({ path, line, keyword }) => {
    console.error(`  ${path}:${line}\n    ${keyword} is forbidden\n    → ${REMEDY[keyword]}\n`);
  });
  process.exitCode = 1;
};

/* Run only as a program, so the tests can import the pure half. */
if (process.argv[1] === new URL(import.meta.url).pathname) {
  await main();
}
