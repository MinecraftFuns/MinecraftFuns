#!/usr/bin/env node
/**
 * Source gate: no literal U+2014 EM DASH.
 *
 * The character is banned in this project's own prose because it stands in for
 * a decision about punctuation somebody should have made: a colon, a
 * semicolon, or a full stop each say something the dash leaves vague.
 *
 * The literal character is what is forbidden, not the concept. `&mdash;` in
 * `Epigraph.astro` is the conventional mark before an attribution, where the
 * meaning is fixed, and an entity is deliberately a different thing to write.
 *
 * Which is also why the needle below is built from its code point: a gate that
 * spelled the character out would be its own first violation.
 *
 * Vendored skill definitions are excluded, being instructions this project
 * follows rather than prose it authors.
 */

import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { each, report } from "./lib/gate.mjs";

const EM_DASH = String.fromCodePoint(0x2014);

/** Trees this project writes, and the extensions worth reading in each. */
const ROOTS = ["src", "scripts", ".github/workflows"];
const EXTENSIONS = [".ts", ".astro", ".mjs", ".js", ".css", ".md", ".yml", ".yaml"];
const LOOSE = ["astro.config.mjs", "README.md"];

/** Every occurrence in one file, with the line it sits on. Pure and total. */
export const emDashes = (path, source) =>
  source
    .split("\n")
    .map((text, index) => ({ text, line: index + 1 }))
    .filter(({ text }) => text.includes(EM_DASH))
    .map(({ text, line }) => ({ path, line, text: text.trim() }));

// ---------------------------------------------------------------------------
// Effect boundary
// ---------------------------------------------------------------------------

const sourcesUnder = async (dir) => {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter(
      (entry) =>
        entry.isFile() && EXTENSIONS.some((extension) => entry.name.endsWith(extension)),
    )
    .map((entry) => resolve(entry.parentPath, entry.name));
};

const main = async () => {
  const files = [
    ...(await Promise.all(ROOTS.map(sourcesUnder))).flat(),
    ...LOOSE.map((path) => resolve(path)),
  ];

  const found = (
    await Promise.all(
      files.map(async (path) =>
        emDashes(relative(process.cwd(), path), await readFile(path, "utf8")),
      ),
    )
  ).flat();

  report({
    name: "check-typography",
    problems: found,
    passed: `${files.length} file(s) carry no em dash`,
    failed: "",
    body: each(
      ({ path, line, text }) =>
        `  ${path}:${line}\n    ${text}\n    → use a colon, a semicolon, or a full stop`,
    ),
  });
};

/* Run only as a program, so the tests can import the pure half. */
if (process.argv[1] === new URL(import.meta.url).pathname) {
  await main();
}
