#!/usr/bin/env node
/**
 * Source gate: no anonymous values in markup, and no type set in a page.
 *
 * The theme deletes Tailwind's default namespaces, so `p-4` and `text-red-500`
 * genuinely do not exist. One hole remains: bracket syntax compiles whatever
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
 *
 * The second rule is about layering. Naming every size in `@theme` stops a
 * value being anonymous but not a *decision* being made twice: the About page
 * built two lists of the same shape and set the value column's role separately
 * on each row, so one list rendered at 14px and 16px alternately. Nothing
 * above catches that, because every class involved was a legitimate named
 * role. What catches it is refusing to let a page set type at all. Pages
 * compose components; components decide what things look like, once, where a
 * second opinion has nowhere to live.
 *
 * The roles are read out of the theme rather than listed here, so the rule
 * cannot fall behind the type scale it polices.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { frontmatter } from "./lib/frontmatter.mjs";

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
  {
    /* The tell of a hand-rolled accent link. Five components had spelled the
       recipe out, three of them differently. */
    rule: "inline-link-style",
    pattern: /hover:text-accent-hover/g,
    remedy: "use .link, or .link-in-text for a link inside a sentence",
  },
];

/**
 * The regions of an `.astro` file that can carry class names: the whole
 * template, and any string literal in the frontmatter; a class list extracted
 * to a `const` is still markup, and is exactly where a literal would hide.
 */
export const classRegions = (source) => {
  const parsed = frontmatter(source);
  if (parsed === undefined) return [source];

  const literals = [...parsed.body.matchAll(/"([^"\\\n]*)"|'([^'\\\n]*)'/g)].map(
    (literal) => literal[1] ?? literal[2],
  );
  return [source.slice(parsed.after), ...literals];
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

/**
 * The type-scale role names, read from the theme.
 *
 * `--text-body: …` declares a role; `--text-body--line-height: …` tunes one,
 * and `--text-*: initial` is the namespace reset. Only the first names a
 * utility, so the two double-hyphen forms are dropped.
 */
export const typeRoles = (css) =>
  [...css.matchAll(/^\s*--text-([a-z0-9-]+):/gm)]
    .map((declaration) => declaration[1])
    .filter((role) => !role.includes("--") && !role.includes("*"));

/**
 * Type roles set in one file. Pure and total.
 *
 * The lookahead is what keeps `text-body` from also matching inside
 * `text-body-sm`: a word boundary sits between `y` and `-`, so `\b` alone
 * would report every longer role twice.
 */
export const typeRolesSet = (source, roles) =>
  classRegions(source).flatMap((region) =>
    roles.flatMap((role) =>
      [...region.matchAll(new RegExp(`\\btext-${role}(?![-a-z0-9])`, "g"))].map(
        (found) => ({
          rule: "type-in-page",
          text: found[0],
          remedy: "move the markup into a component; pages compose, components set type",
        }),
      ),
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

  /* Component `.ts` is scanned for the same reason frontmatter literals are:
     a class list moved to a `const` is still markup. */
  const files = (await walk(root)).filter(
    (path) =>
      path.endsWith(".astro") ||
      (path.endsWith(".ts") && path.includes(`${join(root, "components")}/`)),
  );

  const roles = typeRoles(await readFile(join(root, "styles", "global.css"), "utf8"));
  const pages = `${join(root, "pages")}/`;

  const found = (
    await Promise.all(
      files.map(async (path) => {
        const source = await readFile(path, "utf8");
        const violations = [
          ...anonymousValues(source),
          ...(path.startsWith(pages) ? typeRolesSet(source, roles) : []),
        ];
        return violations.map((violation) => ({
          ...violation,
          path: relative(process.cwd(), path),
        }));
      }),
    )
  ).flat();

  if (found.length === 0) {
    console.log(
      `check-classes: OK, ${files.length} file(s) carry no anonymous values` +
        `, and no page among them sets type (${roles.length} role(s))`,
    );
    return;
  }

  console.error(`check-classes: ${found.length} problem(s)\n`);
  found.forEach(({ path, rule, text, remedy }) => {
    console.error(`  ${path}\n    ${rule}: ${text}\n    → ${remedy}\n`);
  });
  process.exitCode = 1;
};

/* Run only as a program, so the tests can import the pure half. */
if (process.argv[1] === new URL(import.meta.url).pathname) {
  await main();
}
