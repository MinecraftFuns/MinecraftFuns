#!/usr/bin/env node
/** Source gate rejecting non-local loop jumps; AST parsing avoids text matches. */

import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import ts from "typescript";

import { mapConcurrent, READ_CONCURRENCY } from "./lib/concurrent.ts";
import { filesUnder } from "./lib/files.ts";
import { moduleBodyOnly } from "./lib/frontmatter.ts";
import { each, report } from "./lib/gate.ts";

/** Extension to how TypeScript should read the file. */
const DIALECT: Readonly<Record<string, ts.ScriptKind>> = {
  ".ts": ts.ScriptKind.TS,
  ".mjs": ts.ScriptKind.JS,
  ".js": ts.ScriptKind.JS,
  /* Astro frontmatter contains statements; its template does not. */
  ".astro": ts.ScriptKind.TS,
};

const extensionOf = (path: string): string => `.${path.split(".").pop()}`;

/** A forbidden jump: which file, which line, and which keyword. */
export type Jump = {
  readonly path: string;
  readonly line: number;
  readonly keyword: Keyword;
};

export const jumps = (path: string, source: string): readonly Jump[] => {
  const kind = DIALECT[extensionOf(path)];
  if (kind === undefined) return [];

  const text =
    kind === ts.ScriptKind.TS && path.endsWith(".astro")
      ? moduleBodyOnly(source)
      : source;
  const parsed = ts.createSourceFile(path, text, ts.ScriptTarget.ESNext, true, kind);

  const found: Jump[] = [];
  const visit = (node: ts.Node): void => {
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

/** Jumps this gate refuses. */
type Keyword = "break" | "continue";

/** Preferred structural replacement for each forbidden jump. */
const REMEDY: Readonly<Record<Keyword, string>> = {
  continue:
    "lift the condition into a predicate, or return `undefined` from a function the loop pushes when present",
  break: "use `find`, `some`, or `every`; in a `switch`, return from the case",
};

/** Directories to scan, and the extensions worth parsing in each. */
const ROOTS = ["src", "scripts"];

/** Only the dialects the parser knows; `jumps` would skip the rest anyway. */
const parsable = (path: string): boolean => extensionOf(path) in DIALECT;

const main = async () => {
  const files = [
    ...(await Promise.all(ROOTS.map(filesUnder))).flat().filter(parsable),
    resolve("astro.config.ts"),
  ];

  const found = (
    await mapConcurrent(files, READ_CONCURRENCY, async (path) =>
      jumps(relative(process.cwd(), path), await readFile(path, "utf8")),
    )
  ).flat();

  report({
    name: "check-control-flow",
    problems: found,
    passed: `${files.length} file(s) carry no break or continue`,
    failed: "",
    body: each(
      ({ path, line, keyword }) =>
        `  ${path}:${line}\n    ${keyword} is forbidden\n    → ${REMEDY[keyword]}`,
    ),
  });
};

/* Run only as a program, so the tests can import the pure half. */
if (process.argv[1] === new URL(import.meta.url).pathname) {
  await main();
}
