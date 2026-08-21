#!/usr/bin/env node
/** Gate anonymous Tailwind values and page-level type styling. */

import { readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { captures } from "./lib/captures.ts";
import { filesUnder } from "./lib/files.ts";
import { frontmatter } from "./lib/frontmatter.ts";
import { each, report } from "./lib/gate.ts";

/** One thing a class list must not contain, and what to write instead. */
type Rule = {
  readonly rule: string;
  readonly pattern: RegExp;
  readonly remedy: string;
};

/** A rule that fired, before the file it fired in is attached. */
export type Violation = {
  readonly rule: string;
  readonly text: string;
  readonly remedy: string;
};

const RULES: readonly Rule[] = [
  {
    rule: "arbitrary-value",
    pattern: /\b[a-z][a-z0-9]*(?:-[a-z0-9]+)*-\[[^\]]*\]/g,
    remedy: "name the value in @theme and use the generated utility",
  },
  {
    rule: "arbitrary-property",
    pattern: /(?<=["'\s])\[[a-z-]+:[^\s\]]*\]/g,
    remedy: "use a utility, or add a rule to the components layer",
  },
  {
    rule: "arbitrary-variant",
    pattern: /\[&[^\]]*\]:/g,
    remedy: "declare a @custom-variant so the state has a name",
  },
  {
    rule: "inline-link-style",
    pattern: /hover:text-accent-hover/g,
    remedy: "use .link, or .link-in-text for a link inside a sentence",
  },
  {
    rule: "inline-meta-style",
    pattern:
      /"[^"]*\btext-ink-tertiary\b[^"]*\bfont-mono\b[^"]*"|"[^"]*\bfont-mono\b[^"]*\btext-ink-tertiary\b[^"]*"/g,
    remedy: "use .meta; keep only the layout classes at the call site",
  },
  {
    rule: "inline-note-style",
    pattern:
      /"[^"]*\btext-body-sm\b[^"]*\btext-ink-subtle\b[^"]*"|"[^"]*\btext-ink-subtle\b[^"]*\btext-body-sm\b[^"]*"/g,
    remedy: "use .note; keep only the layout classes at the call site",
  },
];

/** Extract template and frontmatter string regions that can carry classes. */
export const classRegions = (source: string): readonly string[] => {
  const parsed = frontmatter(source);
  if (parsed === undefined) return [source];

  /* Unmatched capture alternatives become empty regions. */
  const literals = [...parsed.body.matchAll(/"([^"\\\n]*)"|'([^'\\\n]*)'/g)].map(
    (literal) => literal[1] ?? literal[2] ?? "",
  );
  return [source.slice(parsed.after), ...literals];
};

/** Find anonymous values in class regions. */
export const anonymousValues = (source: string): readonly Violation[] =>
  classRegions(source).flatMap((region) =>
    RULES.flatMap(({ rule, pattern, remedy }) =>
      [...region.matchAll(pattern)].map((found) => ({
        rule,
        text: found[0],
        remedy,
      })),
    ),
  );

/** Read utility role names from theme declarations. */
export const typeRoles = (css: string): readonly string[] =>
  captures(css.matchAll(/^\s*--text-([a-z0-9-]+):/gm)).filter(
    (role) => !role.includes("--") && !role.includes("*"),
  );

/** Find type roles used in one file without matching longer role names. */
export const typeRolesSet = (
  source: string,
  roles: readonly string[],
): readonly Violation[] =>
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

const main = async () => {
  const root = resolve(process.env.SRC_DIR ?? "src");

  /* Component `.ts` files can carry markup class lists. */
  const files = (await filesUnder(root)).filter(
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

  report({
    name: "check-classes",
    problems: found,
    passed:
      `${files.length} file(s) carry no anonymous values` +
      `, and no page among them sets type (${roles.length} role(s))`,
    failed: "",
    body: each(
      ({ path, rule, text, remedy }) =>
        `  ${path}\n    ${rule}: ${text}\n    → ${remedy}`,
    ),
  });
};

/* Run only as a program, so the tests can import the pure half. */
if (process.argv[1] === new URL(import.meta.url).pathname) {
  await main();
}
