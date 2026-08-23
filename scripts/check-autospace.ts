#!/usr/bin/env node
/** Gate typed inter-script spaces in ideographic renditions. */

import { basename, resolve } from "node:path";

import { languages } from "../src/config/languages.ts";
import { filesUnder } from "./lib/files.ts";
import { each, isMain, report } from "./lib/gate.ts";
import { scanFiles } from "./lib/scan.ts";

/** Content root; only ideographic renditions are scanned. */
const ROOT = "src/content";

/** Primary subtags using ideographic scripts. */
const IDEOGRAPHIC = new Set(["zh", "ja", "ko"]);

/** The subtag before the first hyphen, or the whole tag when it has none. */
const primarySubtag = (tag: string): string => {
  const hyphen = tag.indexOf("-");
  return hyphen === -1 ? tag : tag.slice(0, hyphen);
};

/** Rendition filenames derived from the language table. */
const RENDITIONS = new Set(
  languages
    .filter(({ bcp47 }) => IDEOGRAPHIC.has(primarySubtag(bcp47)))
    .map(({ code }) => `${code}.md`),
);

/* Characters treated as ideographs; punctuation is excluded. */
const IDEOGRAPH = "\\p{sc=Han}\\p{sc=Hiragana}\\p{sc=Katakana}";
const ALPHANUMERIC = "0-9A-Za-z";

/** Match the boundary space itself so its index is the reported column. */
const BOUNDARY = new RegExp(
  `(?<=[${IDEOGRAPH}]) (?=[${ALPHANUMERIC}])|(?<=[${ALPHANUMERIC}]) (?=[${IDEOGRAPH}])`,
  "gu",
);

const IDEOGRAPH_CHAR = new RegExp(`[${IDEOGRAPH}]`, "u");
const ALPHANUMERIC_CHAR = new RegExp(`[${ALPHANUMERIC}]`);

/** Keep spaces when the engine cannot balance both ends of the token. */
const balanced = (line: string, at: number): boolean => {
  const inward = IDEOGRAPH_CHAR.test(line[at - 1] ?? "") ? 1 : -1;

  const stops = (index: number): boolean => {
    const char = line[index];
    return char === undefined || char === " " || IDEOGRAPH_CHAR.test(char);
  };

  let end = at + inward;
  while (!stops(end)) end += inward;

  /* Inspect token end and the character beyond an optional gap. */
  const tip = line[end - inward] ?? "";
  const beyond = line[line[end] === " " ? end + inward : end] ?? "";

  return ALPHANUMERIC_CHAR.test(tip) || !IDEOGRAPH_CHAR.test(beyond);
};

/* Mask quoted spans without shifting source columns. */
const QUOTED = [
  /(`+)[^\n]*?\1/g /* inline code, longest-run delimited */,
  /\]\([^)\n]*\)/g /* link and image destinations */,
  /:[a-z][a-z0-9-]*\[[^\]\n]*\]/g /* directive payloads, `:backup[url]` */,
  /<[^>\s]*>/g /* autolinks and raw tags */,
  /https?:\/\/\S+/g /* bare URLs */,
] as const;

/** Non-matching filler that preserves source-column positions. */
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

/** A reported boundary with enough context to judge it. */
export type Site = {
  readonly path: string;
  readonly line: number;
  /** One-based, counting the space itself. */
  readonly column: number;
  /** Boundary context for the report. */
  readonly context: string;
};

/** How much of the line to quote on each side of the space. */
const WINDOW = 24;

/** Find boundaries in one pass while tracking frontmatter and code fences. */
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
      /* A closer must use the same marker and be no shorter. */
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

/** A rendition is named by its language, so the basename decides. */
const isRendition = (path: string): boolean => RENDITIONS.has(basename(path));

const main = async () => {
  /* Named files form a rerunnable migration worklist. */
  const requested = process.argv.slice(2);
  const files =
    requested.length > 0
      ? requested.map((path) => resolve(path))
      : (await filesUnder(ROOT)).filter(isRendition);

  const found = await scanFiles(files, sites);

  report({
    name: "check-autospace",
    problems: found,
    passed: `${files.length} file(s) leave inter-script spacing to the engine`,
    body: each(
      ({ path, line, column, context }) =>
        `  ${path}:${line}:${column}\n    ${context}\n    → delete the space; the engine inserts it`,
    ),
  });
};

if (isMain(import.meta.url)) await main();
