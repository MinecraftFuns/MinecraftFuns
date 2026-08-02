/**
 * Artifact checks.
 *
 * Everything else in the gate validates *source*: markdownlint reads Markdown,
 * `astro check` reads types, the unit tests read modules. None of them look at
 * what the build actually emitted — which is how a base-path bug once passed a
 * clean typecheck and a full test run while producing a site whose every
 * navigation link 404ed.
 *
 * These checks read `dist/` and assert properties of the deployable itself.
 * With no pull request between a green run and production, this is the last
 * thing standing between a mistake and the live site.
 *
 * Design notes:
 *  - Violations are *accumulated*, not thrown. One run reports every problem,
 *    because fixing them one CI round-trip at a time is how people start
 *    skipping the gate.
 *  - The pure functions below are exported and covered by check-dist.test.mjs,
 *    which feeds them known-bad input. A detector nobody tests is a detector
 *    that silently stops detecting.
 *  - HTML is matched with targeted regexes rather than parsed. Adequate for
 *    output we generate ourselves; it would not be for arbitrary HTML.
 */

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

/** @typedef {{ readonly check: string, readonly detail: string }} Violation */

/** @type {(check: string, detail: string) => Violation} */
const violation = (check, detail) => ({ check, detail });

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/** Normalise a base path to exactly one leading and one trailing slash. */
export const normaliseBase = (base) => {
  const trimmed = base.replace(/^\/+|\/+$/g, "");
  return trimmed === "" ? "/" : `/${trimmed}/`;
};

/**
 * Every `href`/`src` value in a document, in source order.
 *
 * Returns raw values; classification is a separate concern so each step stays
 * independently testable.
 */
export const extractReferences = (html) =>
  [...html.matchAll(/\b(?:href|src)\s*=\s*"([^"]*)"/gi)].map(
    (match) => match[1],
  );

/** Anything carrying its own authority is out of scope for local resolution. */
export const isInternal = (reference) =>
  reference.startsWith("/") && !reference.startsWith("//");

/**
 * Map an internal reference onto the dist-relative paths that could satisfy it.
 *
 * A directory-style route may be served by `work/index.html`; an explicit file
 * is served as itself. Returning candidates rather than one path keeps the
 * caller's existence test a simple disjunction.
 */
export const candidatePaths = (reference, base) => {
  const normalised = normaliseBase(base);
  if (!reference.startsWith(normalised)) return [];

  const withinSite = reference.slice(normalised.length).replace(/[?#].*$/, "");
  if (withinSite === "") return ["index.html"];

  const bare = withinSite.replace(/\/+$/, "");
  return [bare, `${bare}/index.html`, `${bare}.html`];
};

/** Custom properties a stylesheet reads but never defines. */
export const undefinedCustomProperties = (css) => {
  const defined = new Set(
    [...css.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((match) => match[1]),
  );
  const used = new Set(
    [...css.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map((match) => match[1]),
  );
  return [...used].filter((name) => !defined.has(name)).sort();
};

/** Hex colours outside the sanctioned palette. */
export const offPaletteColours = (css, palette) =>
  [...new Set([...css.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0].toLowerCase()))]
    .filter((colour) => !palette.has(colour))
    .sort();

/** The palette as declared by the token layer — the single source of truth. */
export const paletteFrom = (tokensCss) =>
  new Set(
    [...tokensCss.matchAll(/--color-[a-z0-9-]+:\s*(#[0-9a-f]{6})/gi)].map((m) =>
      m[1].toLowerCase(),
    ),
  );

// ---------------------------------------------------------------------------
// Filesystem walk
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

const exists = async (path) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

/**
 * @returns {Promise<readonly Violation[]>} every violation found, in check order
 */
export const inspect = async ({ dist, base, site, tokensCss }) => {
  /** @type {Violation[]} */
  const found = [];
  const normalisedBase = normaliseBase(base);

  const files = await walk(dist);
  const relativeFiles = files.map((path) => relative(dist, path));
  const htmlFiles = relativeFiles.filter((path) => path.endsWith(".html"));
  const cssFiles = relativeFiles.filter((path) => path.endsWith(".css"));

  // -- The build produced something at all --------------------------------
  if (htmlFiles.length === 0) {
    found.push(violation("output", "no HTML emitted — the build produced nothing"));
    return found;
  }
  for (const required of ["index.html", "favicon.svg"]) {
    if (!relativeFiles.includes(required)) {
      found.push(violation("output", `missing required file: ${required}`));
    }
  }

  // -- Zero client JavaScript ---------------------------------------------
  // A deliberate design decision: the theme follows the system preference in
  // CSS, so nothing needs scripting. Guarding it means an accidental island or
  // stray <script> is caught rather than silently shipped. Relax this check
  // consciously if the site ever genuinely needs client behaviour.
  const jsFiles = relativeFiles.filter((path) => path.endsWith(".js"));
  for (const path of jsFiles) {
    found.push(violation("zero-js", `unexpected client script: ${path}`));
  }

  for (const path of htmlFiles) {
    const html = await readFile(join(dist, path), "utf8");

    if (/<script\b/i.test(html)) {
      found.push(violation("zero-js", `inline <script> in ${path}`));
    }

    // -- Template leakage -------------------------------------------------
    // A rendered "undefined" is the visible symptom of a prop that silently
    // went missing; it must never reach a reader.
    for (const leak of ["undefined", "NaN", "[object Object]"]) {
      if (html.includes(`>${leak}<`) || html.includes(`"${leak}"`)) {
        found.push(violation("leakage", `rendered ${leak} in ${path}`));
      }
    }

    // -- Link integrity ---------------------------------------------------
    for (const reference of extractReferences(html)) {
      if (!isInternal(reference)) continue;

      if (!reference.startsWith(normalisedBase)) {
        found.push(
          violation(
            "base-path",
            `${path}: ${reference} does not start with ${normalisedBase}`,
          ),
        );
        continue;
      }

      const candidates = candidatePaths(reference, base);
      const resolved = await Promise.all(
        candidates.map((candidate) => exists(join(dist, candidate))),
      );
      if (!resolved.includes(true)) {
        found.push(
          violation("dead-link", `${path}: ${reference} resolves to no file`),
        );
      }
    }

    // -- Canonical --------------------------------------------------------
    const canonical = /<link\s+rel="canonical"\s+href="([^"]*)"/i.exec(html);
    if (canonical === null) {
      found.push(violation("canonical", `${path}: no canonical link`));
    } else if (!canonical[1].startsWith(`${site}${normalisedBase}`)) {
      found.push(
        violation(
          "canonical",
          `${path}: ${canonical[1]} is not under ${site}${normalisedBase}`,
        ),
      );
    }
  }

  // -- Stylesheet integrity ------------------------------------------------
  const palette = paletteFrom(tokensCss);
  if (palette.size === 0) {
    found.push(violation("palette", "no palette found in the token layer"));
  }

  for (const path of cssFiles) {
    const css = await readFile(join(dist, path), "utf8");

    // A typo'd custom property does not fail any build; it silently renders
    // the wrong colour or spacing.
    for (const name of undefinedCustomProperties(css)) {
      found.push(violation("css-var", `${path}: var(${name}) is never defined`));
    }

    for (const colour of offPaletteColours(css, palette)) {
      found.push(violation("palette", `${path}: ${colour} is outside the palette`));
    }
  }

  return found;
};

// ---------------------------------------------------------------------------
// Effect boundary
// ---------------------------------------------------------------------------

const main = async () => {
  const dist = resolve(process.env.DIST_DIR ?? "dist");
  const base = process.env.SITE_BASE ?? "/MinecraftFuns/";
  const site = process.env.SITE_URL ?? "https://minecraftfuns.github.io";
  const tokensCss = await readFile(
    resolve("src/styles/tokens.css"),
    "utf8",
  );

  if (!(await exists(dist))) {
    console.error(`check-dist: ${dist} does not exist — run the build first`);
    process.exitCode = 1;
    return;
  }

  const violations = await inspect({ dist, base, site, tokensCss });

  if (violations.length === 0) {
    console.log(`check-dist: OK — ${dist} passes all checks for ${site}${base}`);
    return;
  }

  console.error(
    `check-dist: ${violations.length} violation(s) for ${site}${base}\n`,
  );
  const byCheck = Object.groupBy(violations, (entry) => entry.check);
  for (const [check, entries] of Object.entries(byCheck)) {
    console.error(`  ${check} (${entries?.length ?? 0})`);
    for (const entry of entries ?? []) console.error(`    - ${entry.detail}`);
  }
  process.exitCode = 1;
};

// Only run when invoked directly, so the test file can import the helpers.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  await main();
}
