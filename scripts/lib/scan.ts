/**
 * How a gate reads its input.
 *
 * Six gates had written the same three steps: read every file under a bounded
 * concurrency, hand the scanner a path relative to the working directory
 * because that is what a report cites, and flatten. Only the scanner differed.
 */

import { readFile } from "node:fs/promises";
import { relative } from "node:path";

import { mapConcurrent, READ_CONCURRENCY } from "./concurrent.ts";

/**
 * Scan every file, bounded so a large tree does not open all of it at once.
 * `scan` receives the path exactly as it will be reported, and the file's text.
 */
export const scanFiles = async <P>(
  files: readonly string[],
  scan: (path: string, source: string) => readonly P[],
): Promise<readonly P[]> =>
  (
    await mapConcurrent(files, READ_CONCURRENCY, async (path) =>
      scan(relative(process.cwd(), path), await readFile(path, "utf8")),
    )
  ).flat();

/** A line and the one-based number a gate cites it by. */
export type NumberedLine = { readonly text: string; readonly line: number };

/** Lines paired with their numbers, so the off-by-one is settled in one place. */
export const numberedLines = (source: string): readonly NumberedLine[] =>
  source.split("\n").map((text, index) => ({ text, line: index + 1 }));
