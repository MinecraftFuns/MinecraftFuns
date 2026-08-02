#!/usr/bin/env node
/**
 * Source gate: no anonymous values in markup.
 *
 * The theme deletes Tailwind's default namespaces, so `p-4` and `text-red-500`
 * genuinely do not exist. One hole remains — bracket syntax compiles whatever
 * you put in it, so `w-[437px]` would reopen the whole space the theme just
 * closed. This closes it.
 *
 * The three forms and what each should have been:
 *
 *   text-[13px]            an entry in `@theme`
 *   [overflow-wrap:anywhere]   a real utility, or a rule in the components layer
 *   [&>:last-child]:...    a `@custom-variant` with a name
 *
 * A value worth using twice is worth naming once, and a value used once is
 * usually a mistake nobody will catch by reading. This is a source check
 * rather than an artifact check because by the time it reaches CSS the
 * literal has been compiled away into something that looks deliberate.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

/** Frontmatter fence and the module body it encloses. */
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---/;

const RULES = [
  {
    rule: "arbitrary-value",
    /* A utility name followed by a bracket: `w-[`, `grid-cols-[`, `aria-[`.
       The hyphen is what separates this from array indexing. */
    pattern: /\b[a-z][a-z0-9]*(?:-[a-z0-9]+)*-\[[^\]]*\]/g,
    remedy: "name the value in @theme and use the generated utility",
  },
  {
    rule: "arbitrary-property",
    /* Requires a class boundary before the bracket and no space after the
       colon, which is what distinguishes it from a TypeScript index
       signature such as `{ [key: string]: T }`. */
    pattern: /(?<=["'\s])\[[a-z-]+:[^\s\]]*\]/g,
    remedy: "use a utility, or add a rule to the components layer",
  },
  {
    rule: "arbitrary-variant",
    pattern: /\[&[^\]]*\]:/g,
    remedy: "declare a @custom-variant so the state has a name",
  },
];

/**
 * The regions of an `.astro` file that can carry class names: the whole
 * template, and any string literal in the frontmatter — a class list extracted
 * to a `const` is still markup, and is exactly where a literal would hide.
 */
export const classRegions = (source) => {
  const match = FRONTMATTER.exec(source);
  if (match === null) return [source];

  const literals = [...match[1].matchAll(/"([^"\\\n]*)"|'([^'\\\n]*)'/g)].map(
    (literal) => literal[1] ?? literal[2],
  );
  return [source.slice(match[0].length), ...literals];
};

/** Every anonymous value in one file's class regions. Pure and total. */
export const anonymousValues = (source) =>
  classRegions(source).flatMap((region) =>
    RULES.flatMap(({ rule, pattern, remedy }) =>
      [...region.matchAll(pattern)].map((found) => ({
        rule,
        text: found[0],
        remedy,
      })),
    ),
  );

// ---------------------------------------------------------------------------
// Effect boundary
// ---------------------------------------------------------------------------

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      return entry.isDirectory() ? walk(path) : [path];
    }),
  );
  return nested.flat();
};

const main = async () => {
  const root = resolve(process.env.SRC_DIR ?? "src");
  const files = (await walk(root)).filter((path) => path.endsWith(".astro"));

  const found = (
    await Promise.all(
      files.map(async (path) => {
        const source = await readFile(path, "utf8");
        return anonymousValues(source).map((violation) => ({
          ...violation,
          path: relative(process.cwd(), path),
        }));
      }),
    )
  ).flat();

  if (found.length === 0) {
    console.log(
      `check-classes: OK — ${files.length} component(s) carry no anonymous values`,
    );
    return;
  }

  console.error(`check-classes: ${found.length} anonymous value(s)\n`);
  found.forEach(({ path, rule, text, remedy }) => {
    console.error(`  ${path}\n    ${rule}: ${text}\n    → ${remedy}\n`);
  });
  process.exitCode = 1;
};

/* Run only as a program, so the tests can import the pure half. */
if (process.argv[1] === new URL(import.meta.url).pathname) {
  await main();
}
