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
 * The archive it was written for is migrated, so this now runs in `npm run
 * rules` and the interesting case is no longer the thousand it found but the
 * one it has yet to see.
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
 * - English renditions. A Chinese term quoted inside an English sentence,
 *   `the nickname 司马马克丁`, is separated by an English word space, and an
 *   engine that replaced it with 0.125ic would be tightening a gap that was
 *   never inter-script spacing. The unit of migration is a rendition written
 *   in an ideographic language, not a boundary found anywhere at all.
 */

import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import { languages } from "../src/config/languages.ts";
import { each, report } from "./lib/gate.ts";

/** The archive. Nothing outside it is written in Chinese. */
const ROOT = "src/content";

/**
 * Primary language subtags whose writing system is set with ideographs. A fact
 * about scripts rather than about this site, which is why it is spelled here
 * and not in the language table.
 */
const IDEOGRAPHIC = new Set(["zh", "ja", "ko"]);

/**
 * The rendition filenames this gate reads, derived from the language table so
 * that adding Japanese to the blog adds it to the gate in the same edit.
 */
const RENDITIONS = new Set(
  languages
    .filter(({ bcp47 }) => IDEOGRAPHIC.has(bcp47.split("-")[0] ?? ""))
    .map(({ code }) => `${code}.md`),
);

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

const IDEOGRAPH_CHAR = new RegExp(`[${IDEOGRAPH}]`, "u");
const ALPHANUMERIC_CHAR = new RegExp(`[${ALPHANUMERIC}]`);

/**
 * Whether the engine can space *both* ends of the Latin token this space sits
 * against, which is the condition for deleting the space to be an improvement
 * rather than a lopsided gap.
 *
 * The engine spaces an ideograph against a letter or a digit and against
 * nothing else. A token that closes on punctuation, `O(n)` or `parity(a)`, is
 * therefore only half eligible: delete the space in front of it and
 * `差分 O(n) 处理` renders a hairline gap on the left against a full word
 * space on the right. There is no stylesheet that repairs this. The missing
 * value is `ideograph-symbol`, proposed in csswg-drafts#9479 and still open,
 * and the `replace` keyword that would even the two out is specified but
 * unimplemented everywhere.
 *
 * So symmetry is a property of the token, not of the boundary, and a token the
 * engine cannot finish keeps its typed spaces at both ends. Walks to the far
 * end of the token: O(token length), and tokens are words.
 */
const balanced = (line: string, at: number): boolean => {
  const inward = IDEOGRAPH_CHAR.test(line[at - 1] ?? "") ? 1 : -1;

  const stops = (index: number): boolean => {
    const char = line[index];
    return char === undefined || char === " " || IDEOGRAPH_CHAR.test(char);
  };

  let end = at + inward;
  while (!stops(end)) end += inward;

  /* The token's far character, and whatever it faces across an optional gap. */
  const tip = line[end - inward] ?? "";
  const beyond = line[line[end] === " " ? end + inward : end] ?? "";

  return ALPHANUMERIC_CHAR.test(tip) || !IDEOGRAPH_CHAR.test(beyond);
};

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
      ...[...masked.matchAll(BOUNDARY)]
        .filter(({ index: at }) => balanced(masked, at))
        .map(({ index: at }) => ({
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

const renditionsUnder = async (dir: string): Promise<readonly string[]> => {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && RENDITIONS.has(entry.name))
    .map((entry) => resolve(entry.parentPath, entry.name));
};

const main = async () => {
  /*
   * Named files narrow the gate to one worklist at a time, which is what a
   * migration needs: a column is only valid until the line it points into is
   * edited, so the loop has to be re-run per file rather than read once. A
   * named file is read whatever it is called, since naming it is the caller's
   * assertion that it wants that file; the rendition filter governs the walk.
   */
  const requested = process.argv.slice(2);
  const files =
    requested.length > 0
      ? requested.map((path) => resolve(path))
      : await renditionsUnder(ROOT);

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
