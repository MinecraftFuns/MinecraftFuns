#!/usr/bin/env node
/** Gate barrel imports of the icon set, which defeat per-icon shaking. */

import { readFile } from "node:fs/promises";
import { relative } from "node:path";

import { mapConcurrent, READ_CONCURRENCY } from "./lib/concurrent.ts";
import { filesUnder } from "./lib/files.ts";
import { each, report } from "./lib/gate.ts";

/** Authored trees that can import a package. */
const ROOTS = ["src", "scripts"];
const EXTENSIONS = [".ts", ".astro"];

/**
 * A package whose root export is a barrel, and the entry point that is not.
 *
 * `@lucide/astro` re-exports every icon it has from `.`, so one import of the
 * root pulls the whole set into the module graph. Nothing ships today, because
 * the icons compile to inline SVG and the bundle carries no JavaScript at all,
 * so a regression here costs build time and dependency graph rather than
 * bytes, which is the kind that goes unnoticed. Deep imports keep the cost
 * proportional to the two arrows actually drawn.
 */
const DEEP_ONLY = {
  barrel: "@lucide/astro",
  entry: "@lucide/astro/icons/",
  remedy: "import one icon, as `@lucide/astro/icons/arrow-right`",
} as const;

/** One barrel import, and where it sits. */
export type BarrelImport = {
  readonly path: string;
  readonly line: number;
  readonly text: string;
};

/** Match a module specifier in an import or a dynamic import. */
const specifier = (barrel: string): RegExp =>
  new RegExp(`(?<=from\\s|import\\()["'\`]${barrel.replace("/", "\\/")}["'\`]`, "u");

export const barrelImports = (path: string, source: string): readonly BarrelImport[] => {
  const pattern = specifier(DEEP_ONLY.barrel);
  return source
    .split("\n")
    .map((text, index) => ({ text: text.trim(), line: index + 1 }))
    .filter(({ text }) => pattern.test(text))
    .map(({ text, line }) => ({ path, line, text }));
};

const main = async () => {
  const files = (await Promise.all(ROOTS.map(filesUnder))).flat().filter(
    (path) =>
      EXTENSIONS.some((extension) => path.endsWith(extension)) &&
      /* A fixture quoting the barrel is a test of this gate, not a use. */
      !path.endsWith(".test.ts"),
  );

  const found = (
    await mapConcurrent(files, READ_CONCURRENCY, async (path) =>
      barrelImports(relative(process.cwd(), path), await readFile(path, "utf8")),
    )
  ).flat();

  report({
    name: "check-imports",
    problems: found,
    passed: `${files.length} file(s) import icons one at a time`,
    failed: "",
    body: each(
      ({ path, line, text }) =>
        `  ${path}:${line}\n    ${text}\n    → ${DEEP_ONLY.remedy}`,
    ),
  });
};

/* Run only as a program, so the tests can import the pure half. */
if (process.argv[1] === new URL(import.meta.url).pathname) {
  await main();
}
