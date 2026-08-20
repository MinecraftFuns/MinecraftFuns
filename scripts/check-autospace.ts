#!/usr/bin/env node
/**
 * Source gate: no manual inter-script space in the blog archive.
 *
 * Chinese prose that embeds a Latin word wants a hairline gap around it. Until
 * recently the only way to get one was to type U+0020, so the archive is full
 * of them. `text-autospace: normal` in the stylesheet now asks the engine to
 * insert that gap itself, at the correct 0.125ic rather than a word space's
 * 0.25em, and the engine declines to insert anything where a space character
 * already sits. So every typed space is a boundary the engine has been told to
 * leave alone: the two mechanisms do not fight, they simply mean the wide gap
 * wins wherever the old habit reached first.
 *
 * This gate is the definition of "reached first". It enumerates the boundaries
 * so a migration has a finite, checkable worklist, and once that worklist is
 * empty it keeps the habit from creeping back into the next article.
 *
 * NOT YET IN `npm run rules`. The archive still carries roughly a thousand of
 * these; wiring it into the aggregate is the migration's last commit, not its
 * first. Until then it runs on its own as `npm run rules:autospace`.
 *
 * What it deliberately does not flag:
 *
 * - Front matter. `title` and `description` reach `<title>` and `<meta>`,
 *   which no stylesheet lays out. A space stripped there is a space lost in
 *   browser tabs, search snippets, and link previews, with no engine standing
 *   by to put it back.
 * - Code, fenced or inline, and link destinations. Code is quoted rather than
 *   typeset, and a URL is not prose.
 * - Spaces beside CJK punctuation. Autospacing is defined between ideographs
 *   and non-ideographs; a full stop is neither, so `。 Then` would keep its
 *   wide gap forever and stripping it produces `。Then` with nothing to
 *   restore. The character classes below say ideograph, not "CJK".
 */

import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { each, report } from "./lib/gate.ts";

/** The archive. Nothing outside it is written in Chinese. */
const ROOT = "src/content";

/*
 * The two sides of an autospace boundary, as the engine understands them.
 * Ideographs only: Han for Chinese, the kana for the occasional Japanese
 * quotation. CJK punctuation is excluded on purpose, per the header.
 */
const IDEOGRAPH = "\\p{sc=Han}\\p{sc=Hiragana}\\p{sc=Katakana}";
const ALPHANUMERIC = "0-9A-Za-z";

/**
 * A space with an ideograph on one side and an alphanumeric on the other.
 *
 * Written with look-around so the match is the space itself, which makes the
 * match index the column to report and keeps replacement out of the picture.
 */
const BOUNDARY = new RegExp(
  `(?<=[${IDEOGRAPH}]) (?=[${ALPHANUMERIC}])|(?<=[${ALPHANUMERIC}]) (?=[${IDEOGRAPH}])`,
  "gu",
);

/*
 * Spans within a prose line that are quoted rather than typeset. Masked, not
 * deleted, so every column index still refers to the real line.
 */
const QUOTED = [
  /(`+)[^\n]*?\1/g /* inline code, longest-run delimited */,
  /\]\([^)\n]*\)/g /* link and image destinations */,
  /:[a-z][a-z0-9-]*\[[^\]\n]*\]/g /* directive payloads, `:backup[url]` */,
  /<[^>\s]*>/g /* autolinks and raw tags */,
  /https?:\/\/\S+/g /* bare URLs */,
] as const;

/**
 * What a masked span is filled with: a character in neither class, so no
 * boundary can be found inside one. Length is preserved rather than the span
 * removed, which is what keeps a reported column pointing at the real one.
 */
const FILLER = "-";

const mask = (line: string): string =>
  QUOTED.reduce(
    (masked, pattern) => masked.replace(pattern, (span) => FILLER.repeat(span.length)),
    line,
  );

/** A fence opener or closer, and the run that delimits it. */
const FENCE = /^\s*(`{3,}|~{3,})/;

/** The delimiter that opens and closes YAML front matter. */
const FRONT_MATTER = "---";

/** One boundary, where it sits, and enough text either side to judge it. */
export type Site = {
  readonly path: string;
  readonly line: number;
  /** One-based, counting the space itself. */
  readonly column: number;
  /** The boundary with surrounding characters, for reading in the report. */
  readonly context: string;
};

/** How much of the line to quote on each side of the space. */
const WINDOW = 24;

/**
 * Every migratable boundary in one file. Pure and total.
 *
 * One left-to-right pass over the lines carrying the block state a Markdown
 * file needs to be read correctly: whether front matter is still open, and
 * which fence run, if any, is waiting to be closed. O(n) in characters.
 */
export const sites = (path: string, source: string): readonly Site[] => {
  const lines = source.split("\n");
  const found: Site[] = [];

  let openFence: string | undefined = undefined;
  let inFrontMatter = lines[0] === FRONT_MATTER;

  lines.forEach((line, index) => {
    if (inFrontMatter) {
      inFrontMatter = !(index > 0 && line === FRONT_MATTER);
      return;
    }

    const fence = FENCE.exec(line)?.[1];

    if (openFence !== undefined) {
      /* A closer is the same character, at least as long as the opener. */
      const closes =
        fence !== undefined &&
        fence[0] === openFence[0] &&
        fence.length >= openFence.length;
      openFence = closes ? undefined : openFence;
      return;
    }

    if (fence !== undefined) {
      openFence = fence;
      return;
    }

    const masked = mask(line);
    found.push(
      ...[...masked.matchAll(BOUNDARY)].map(({ index: at }) => ({
        path,
        line: index + 1,
        column: at + 1,
        context: line.slice(Math.max(0, at - WINDOW), at + WINDOW + 1),
      })),
    );
  });

  return found;
};

// ---------------------------------------------------------------------------
// Effect boundary
// ---------------------------------------------------------------------------

const markdownUnder = async (dir: string): Promise<readonly string[]> => {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => resolve(entry.parentPath, entry.name));
};

const main = async () => {
  /*
   * Named files narrow the gate to one worklist at a time, which is what a
   * migration needs: a column is only valid until the line it points into is
   * edited, so the loop has to be re-run per file rather than read once. With
   * no arguments the gate is the whole archive, which is what CI needs.
   */
  const requested = process.argv.slice(2);
  const files =
    requested.length > 0
      ? requested.map((path) => resolve(path))
      : await markdownUnder(ROOT);

  const found = (
    await Promise.all(
      files.map(async (path) =>
        sites(relative(process.cwd(), path), await readFile(path, "utf8")),
      ),
    )
  ).flat();

  report({
    name: "check-autospace",
    problems: found,
    passed: `${files.length} file(s) leave inter-script spacing to the engine`,
    failed: "",
    body: each(
      ({ path, line, column, context }) =>
        `  ${path}:${line}:${column}\n    ${context}\n    → delete the space; the engine inserts it`,
    ),
  });
};

/* Run only as a program, so the tests can import the pure half. */
if (process.argv[1] === new URL(import.meta.url).pathname) {
  await main();
}
