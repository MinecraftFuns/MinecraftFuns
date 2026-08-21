#!/usr/bin/env node
/** Gate literal em dashes in authored prose; entities and Chinese renditions are exempt. */

import { readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { mapConcurrent, READ_CONCURRENCY } from "./lib/concurrent.ts";
import { filesUnder } from "./lib/files.ts";
import { each, report } from "./lib/gate.ts";

const EM_DASH = String.fromCodePoint(0x2014);

/** Authored trees and extensions to scan. */
const ROOTS = ["src", "scripts", ".github/workflows"];
const EXTENSIONS = [".ts", ".astro", ".mjs", ".js", ".css", ".md", ".yml", ".yaml"];
const LOOSE = ["astro.config.ts", "README.md"];

/** One banned character, where it sits, and the line it sits on. */
export type EmDash = {
  readonly path: string;
  readonly line: number;
  readonly text: string;
};

/** Every occurrence in one file, with its line. */
export const emDashes = (path: string, source: string): readonly EmDash[] =>
  source
    .split("\n")
    .map((text, index) => ({ text, line: index + 1 }))
    .filter(({ text }) => text.includes(EM_DASH))
    .map(({ text, line }) => ({ path, line, text: text.trim() }));

/** Chinese rendition excluded by the header policy. */
const CHINESE_RENDITION = /[\\/]zh\.md$/;

/** Authored prose this gate reads, once the walk has found every file. */
const authored = (path: string): boolean =>
  EXTENSIONS.some((extension) => path.endsWith(extension)) &&
  !CHINESE_RENDITION.test(path);

const main = async () => {
  const files = [
    ...(await Promise.all(ROOTS.map(filesUnder))).flat().filter(authored),
    ...LOOSE.map((path) => resolve(path)),
  ];

  const found = (
    await mapConcurrent(files, READ_CONCURRENCY, async (path) =>
      emDashes(relative(process.cwd(), path), await readFile(path, "utf8")),
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
