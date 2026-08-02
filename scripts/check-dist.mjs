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

/*
 * This module deliberately does not import src/lib/url.ts.
 *
 * A gate that shares code with the thing it validates shares the thing's bugs:
 * a mistake in link construction would be reproduced identically here and the
 * two would agree on a wrong answer. The duplication is the independence, and
 * it is the point. What is shared instead is the platform's URL parser, which
 * neither side wrote.
 */

/** A syntactically valid origin that can never resolve. RFC 2606 reserves it. */
const PROBE_ORIGIN = "https://probe.invalid";

/** Normalise a base path to exactly one leading and one trailing slash. */
export const normaliseBase = (base) => {
  const trimmed = base.replace(/^\/+|\/+$/g, "");
  return trimmed === "" ? "/" : `/${trimmed}/`;
};

/** Total: a malformed escape yields the raw text rather than throwing, so a
    bad href becomes a reported dead link instead of a crashed gate. */
const decodedPath = (pathname) => {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
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
  if (!isInternal(reference) || !reference.startsWith(normalised)) return [];

  /*
   * A reference is a URL path, so its query and fragment address a position
   * within a document rather than naming a file, and percent-encoding has to
   * be undone before it can name one on disk. Parsing against a throwaway
   * origin does both, and correctly: `?` and `#` are stripped by the standard's
   * own rules instead of by a pattern guessing which comes first.
   */
  const { pathname } = new URL(reference, PROBE_ORIGIN);
  const withinSite = decodedPath(pathname.slice(normalised.length));
  if (withinSite === "") return ["index.html"];

  const bare = withinSite.replace(/\/+$/, "");
  return [bare, `${bare}/index.html`, `${bare}.html`];
};

/** Z-Base-32, RFC 6189 section 5.1.6. Deliberately not RFC 4648's alphabet. */
const ZBASE32_NAME = /^[ybndrfg8ejkmcpqxot1uwisza345h769]{32}$/;

/**
 * Web Key Directory integrity, judged from the artifact alone.
 *
 * A key nobody can fetch is indistinguishable from a key nobody published, and
 * both look like a clean build. The properties below are the ones a mail client
 * depends on, checked without importing any of the code that produced them —
 * an OpenPGP public-key packet begins with tag 6, which is 0x98 or 0x99 in the
 * old packet format the export uses.
 */
export const wkdViolations = (entries) => {
  const found = [];
  const { policy, keys } = entries;

  if (!policy) {
    found.push("no .well-known/openpgpkey/policy — the specification requires it");
  }
  if (keys.length === 0) {
    found.push("no keys published under .well-known/openpgpkey/hu/");
  }

  keys.forEach(({ name, bytes }) => {
    if (!ZBASE32_NAME.test(name)) {
      found.push(`hu/${name} is not a 32-character Z-Base-32 hash`);
    }
    if (bytes.length === 0) {
      found.push(`hu/${name} is empty`);
    } else if (bytes[0] !== 0x98 && bytes[0] !== 0x99) {
      // An armored key here would start with "-" (0x2d), which is the mistake
      // the specification explicitly warns against.
      found.push(
        `hu/${name} does not begin with an OpenPGP public-key packet (0x${bytes[0].toString(16)}); the key must be binary, not armored`,
      );
    }
  });

  return found;
};

/**
 * Whether a canonical URL points inside this deployment.
 *
 * Compared as URLs rather than as strings. `${site}${base}` is a hand-built
 * prefix that breaks the moment SITE_URL carries a trailing slash — the
 * doubled slash matches no correct canonical, and the gate would fail a good
 * build. Comparing origins also normalises host case and default ports, which
 * a prefix test silently gets wrong.
 */
export const isCanonicalWithin = (canonical, site, base) => {
  const expected = URL.parse(normaliseBase(base), site);
  const actual = URL.parse(canonical);

  return (
    expected !== null &&
    actual !== null &&
    actual.origin === expected.origin &&
    actual.pathname.startsWith(expected.pathname)
  );
};

/**
 * Custom properties a stylesheet reads without a fallback and never defines.
 *
 * The fallback exemption is not a loophole. `var(--x, blue)` on an undefined
 * `--x` is well-defined CSS that renders blue, and Tailwind builds its
 * override slots exactly that way: `var(--tw-leading, var(--text-body--line-
 * height))` means "the leading unless something overrode it", so the property
 * is *meant* to be unset. What renders nothing — and so is worth failing a
 * build over — is a bare read of a name that does not exist.
 *
 * The character immediately after the name decides it: `,` opens a fallback,
 * `)` closes a bare read. No nesting analysis is needed to tell them apart.
 */
export const undefinedCustomProperties = (css) => {
  const defined = new Set(
    [...css.matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((match) => match[1]),
  );
  const readBare = new Set(
    [...css.matchAll(/var\(\s*(--[a-z0-9-]+)\s*([,)])/gi)]
      .filter((match) => match[2] === ")")
      .map((match) => match[1]),
  );
  return [...readBare].filter((name) => !defined.has(name)).sort();
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

  /*
   * The walk already enumerated every file, so link resolution is a set
   * membership test rather than a filesystem probe. Statting each candidate
   * instead would issue O(links x candidates) syscalls and re-probe the same
   * paths for every page that links to them.
   */
  const present = new Set(relativeFiles);

  const htmlFiles = [];
  const cssFiles = [];
  const jsFiles = [];
  for (const path of relativeFiles) {
    if (path.endsWith(".html")) htmlFiles.push(path);
    else if (path.endsWith(".css")) cssFiles.push(path);
    else if (path.endsWith(".js")) jsFiles.push(path);
  }

  // -- The build produced something at all --------------------------------
  if (htmlFiles.length === 0) {
    found.push(violation("output", "no HTML emitted — the build produced nothing"));
    return found;
  }
  for (const required of ["index.html", "favicon.svg"]) {
    if (!present.has(required)) {
      found.push(violation("output", `missing required file: ${required}`));
    }
  }

  // -- Zero client JavaScript ---------------------------------------------
  // A deliberate design decision: the theme follows the system preference in
  // CSS, so nothing needs scripting. Guarding it means an accidental island or
  // stray <script> is caught rather than silently shipped. Relax this check
  // consciously if the site ever genuinely needs client behaviour.
  for (const path of jsFiles) {
    found.push(violation("zero-js", `unexpected client script: ${path}`));
  }

  const htmlContents = await Promise.all(
    htmlFiles.map((path) => readFile(join(dist, path), "utf8")),
  );

  for (const [index, path] of htmlFiles.entries()) {
    const html = htmlContents[index];

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
    extractReferences(html)
      .filter(isInternal)
      .forEach((reference) => {
        if (!reference.startsWith(normalisedBase)) {
          found.push(
            violation("base-path", `${path}: ${reference} does not start with ${normalisedBase}`),
          );
        } else if (!candidatePaths(reference, base).some((candidate) => present.has(candidate))) {
          found.push(violation("dead-link", `${path}: ${reference} resolves to no file`));
        }
      });

    // -- Canonical --------------------------------------------------------
    const canonical = /<link\s+rel="canonical"\s+href="([^"]*)"/i.exec(html);
    if (canonical === null) {
      found.push(violation("canonical", `${path}: no canonical link`));
    } else if (!isCanonicalWithin(canonical[1], site, base)) {
      found.push(
        violation(
          "canonical",
          `${path}: ${canonical[1]} is not under ${site}${normalisedBase}`,
        ),
      );
    }
  }

  // -- Web Key Directory ---------------------------------------------------
  const HU = join("\.well-known", "openpgpkey", "hu");
  const huFiles = relativeFiles.filter((path) => path.startsWith(`${HU}/`));

  wkdViolations({
    policy: present.has(join("\.well-known", "openpgpkey", "policy")),
    keys: await Promise.all(
      huFiles.map(async (path) => ({
        name: path.slice(HU.length + 1),
        bytes: await readFile(join(dist, path)),
      })),
    ),
  }).forEach((detail) => found.push(violation("wkd", detail)));

  // -- Stylesheet integrity ------------------------------------------------
  const palette = paletteFrom(tokensCss);
  if (palette.size === 0) {
    found.push(violation("palette", "no palette found in the token layer"));
  }

  const cssContents = await Promise.all(
    cssFiles.map((path) => readFile(join(dist, path), "utf8")),
  );

  for (const [index, path] of cssFiles.entries()) {
    const css = cssContents[index];

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
  /* The palette lives in global.css, outside `@theme` — a ramp step must not
     become a utility. That `:root` block is still the single source this
     check reads to decide which hex values are sanctioned. */
  const tokensCss = await readFile(
    resolve("src/styles/global.css"),
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
