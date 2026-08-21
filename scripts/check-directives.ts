#!/usr/bin/env node
/** Gate hand-rolled link markers where a directive belongs. */

import { readFile } from "node:fs/promises";
import { relative } from "node:path";

import { mapConcurrent, READ_CONCURRENCY } from "./lib/concurrent.ts";
import { filesUnder } from "./lib/files.ts";
import { each, report } from "./lib/gate.ts";

/** Content root; every rendition and document under it is prose. */
const ROOT = "src/content";

/**
 * A link whose visible text is a math span.
 *
 * The archive was written before `:backup[url]` existed, and marked archived
 * links by typesetting the English word: `[$^\mathrm{Backup}$](url)`. It
 * renders, so nothing complained, and it says "Backup" in a Chinese article
 * because a math span has no language. The directive is what knows the
 * rendition it sits in, so the hand-rolled form has to stay gone.
 *
 * Real mathematics is never a whole link text, so this cannot fire on it.
 */
const TYPESET_LABEL = /\[\$[^\]\n]*\$\]\((\S*?)\)/g;

/** One hand-rolled marker, and the link it was standing in for. */
export type Marker = {
  readonly path: string;
  readonly line: number;
  readonly text: string;
  readonly href: string;
};

export const markers = (path: string, source: string): readonly Marker[] =>
  source.split("\n").flatMap((text, index) =>
    [...text.matchAll(TYPESET_LABEL)].map((found) => ({
      path,
      line: index + 1,
      text: found[0],
      href: found[1] ?? "",
    })),
  );

const main = async () => {
  const files = (await filesUnder(ROOT)).filter((path) => path.endsWith(".md"));

  const found = (
    await mapConcurrent(files, READ_CONCURRENCY, async (path) =>
      markers(relative(process.cwd(), path), await readFile(path, "utf8")),
    )
  ).flat();

  report({
    name: "check-directives",
    problems: found,
    passed: `${files.length} file(s) mark archived links with a directive`,
    failed: "",
    body: each(
      ({ path, line, text, href }) =>
        `  ${path}:${line}\n    ${text}\n    → write :backup[${href}], which reads in the rendition's own language`,
    ),
  });
};

/* Run only as a program, so the tests can import the pure half. */
if (process.argv[1] === new URL(import.meta.url).pathname) {
  await main();
}
