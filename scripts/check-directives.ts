#!/usr/bin/env node
/** Gate hand-rolled link markers where a directive belongs. */

import { filesUnder } from "./lib/files.ts";
import { each, isMain, report } from "./lib/gate.ts";
import { numberedLines, scanFiles } from "./lib/scan.ts";

/** Content root; every rendition and document under it is prose. */
const ROOT = "src/content";

/**
 * A link whose visible text is a math span.
 *
 * Older prose marked archived links by typesetting the English word as math:
 * `[$^\mathrm{Backup}$](url)`. It renders, so nothing complained, but it says
 * "Backup" in a Chinese article because a math span has no language. The
 * directive knows the rendition it sits in, so the hand-rolled form must not
 * return.
 *
 * Real mathematics is never a whole link text, so this cannot fire on it.
 */
const TYPESET_LABEL = /\[\$[^\]\n]*\$\]\((\S*?)\)/g;

/** One hand-rolled marker, and the link it stands for. */
export type Marker = {
  readonly path: string;
  readonly line: number;
  readonly text: string;
  readonly href: string;
};

export const markers = (path: string, source: string): readonly Marker[] =>
  numberedLines(source).flatMap(({ text, line }) =>
    [...text.matchAll(TYPESET_LABEL)].map((found) => ({
      path,
      line,
      text: found[0],
      href: found[1] ?? "",
    })),
  );

const main = async () => {
  const files = (await filesUnder(ROOT)).filter((path) => path.endsWith(".md"));

  const found = await scanFiles(files, markers);

  report({
    name: "check-directives",
    problems: found,
    passed: `${files.length} file(s) mark archived links with a directive`,
    body: each(
      ({ path, line, text, href }) =>
        `  ${path}:${line}\n    ${text}\n    → write :backup[${href}], which reads in the rendition's own language`,
    ),
  });
};

if (isMain(import.meta.url)) await main();
