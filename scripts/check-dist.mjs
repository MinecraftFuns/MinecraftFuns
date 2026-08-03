/**
 * Artifact checks.
 *
 * Everything else in the gate validates *source*: markdownlint reads Markdown,
 * `astro check` reads types, the unit tests read modules. None of them look at
 * what the build actually emitted, which is how a base-path bug once passed a
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

import { readFile, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { deployments } from "../src/config/deployments.ts";
import { filesUnder } from "./lib/files.mjs";
import { cannotRun, report } from "./lib/gate.mjs";

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
 *
 * Config is a different matter and *is* imported, at the effect boundary
 * below. `src/config/deployments.ts` is data, not derivation: re-declaring the
 * canonical origin here would not buy independence, it would only create a
 * second place for it to be wrong. The rule is to duplicate the reasoning and
 * share the facts.
 */

/** Local, so the rule above holds: the same one line, not the same module. */
const slashTerminated = (path) => (path.endsWith("/") ? path : `${path}/`);

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

/*
 * Why patterns are enough here, expanding the note at the top of the file.
 *
 * This input is not general HTML: every byte was emitted by one serialiser,
 * minutes earlier, in the build being checked. Astro always double-quotes
 * attribute values, so the quoting below is a property of the producer rather
 * than a hope about the format. The day this gate reads markup it did not
 * generate, that reasoning expires and a parser becomes worth its cost.
 *
 * One definition of a quoted attribute value, since three patterns read one.
 */
const ATTRIBUTE = '\\s*=\\s*"([^"]*)"';

const REFERENCE = new RegExp(`\\b(?:href|src)${ATTRIBUTE}`, "gi");
const CANONICAL = new RegExp(`<link\\s+rel="canonical"\\s+href${ATTRIBUTE}`, "i");
const SCRIPT_ELEMENT = /<script\b/i;

/**
 * Every `href`/`src` value in a document, in source order.
 *
 * Returns raw values; classification is a separate concern so each step stays
 * independently testable.
 */
export const extractReferences = (html) =>
  [...html.matchAll(REFERENCE)].map((match) => match[1]);

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

/**
 * Host directive files, parsed back out of the artifact.
 *
 * Re-parsed rather than imported, for the reason the whole module keeps its
 * distance: a check that shares the renderer shares its bugs. These parsers are
 * deliberately dumb: the formats are line-oriented, and the point is to read
 * what actually shipped.
 */
export const parseRedirects = (text) =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map((line) => line.split(/\s+/))
    .filter((fields) => fields.length >= 2)
    .map(([from, to, status]) => ({ from, to, status }));

/** Pattern lines are unindented; the operations beneath them are not. */
export const parseHeaderPatterns = (text) =>
  text
    .split("\n")
    .filter((line) => line.trim() !== "" && !line.startsWith("#") && !/^\s/.test(line))
    .map((line) => line.trim());

/**
 * Directives that describe a site other than the one that was built.
 *
 * This is the anti-rot check. The legacy files redirected source files that had
 * stopped being published and pointed a favicon at a CDN, and stayed that way
 * for years because nothing ever asked whether the paths were real. A rule is a
 * claim; these are the claims the artifact can settle.
 */
export const hostDirectiveViolations = ({ redirects, headerPatterns, resolves }) => {
  // A destination carrying its own authority cannot be checked from here.
  const internal = ({ to }) => to.startsWith("/") && !to.startsWith("//");

  const unmatched = (pattern) => {
    const wildcard = pattern.endsWith("*");
    return !resolves(wildcard ? pattern.slice(0, -1) : pattern, wildcard);
  };

  return [
    ...redirects
      .filter((redirect) => internal(redirect) && !resolves(redirect.to))
      .map(({ from, to }) => `_redirects: ${from} points at ${to}, which no file satisfies`),
    ...headerPatterns
      .filter(unmatched)
      .map((pattern) => `_headers: ${pattern} matches nothing that was built`),
  ];
};

/** Z-Base-32, RFC 6189 section 5.1.6. Deliberately not RFC 4648's alphabet. */
const ZBASE32_NAME = /^[ybndrfg8ejkmcpqxot1uwisza345h769]{32}$/;

/**
 * Web Key Directory integrity, judged from the artifact alone.
 *
 * A key nobody can fetch is indistinguishable from a key nobody published, and
 * both look like a clean build. The properties below are the ones a mail client
 * depends on, checked without importing any of the code that produced them:
 * an OpenPGP public-key packet begins with tag 6, which is 0x98 or 0x99 in the
 * old packet format the export uses.
 */
/** What is wrong with an entry's name, or nothing. */
const namingProblem = ({ name }) =>
  ZBASE32_NAME.test(name)
    ? undefined
    : `hu/${name} is not a 32-character Z-Base-32 hash`;

/**
 * What is wrong with an entry's bytes, or nothing. An armored key would start
 * with "-" (0x2d), which is the mistake the specification warns against.
 */
const contentProblem = ({ name, bytes }) => {
  if (bytes.length === 0) return `hu/${name} is empty`;
  if (bytes[0] === 0x98 || bytes[0] === 0x99) return undefined;
  return `hu/${name} does not begin with an OpenPGP public-key packet (0x${bytes[0].toString(16)}); the key must be binary, not armored`;
};

/* Each check is a total function to "a problem, or nothing", so the whole
   thing is that list with the nothings removed. Written as pushes into a
   shared array, the checks read as steps in a procedure rather than as the
   independent facts they are. */
export const wkdViolations = ({ policy, keys }) =>
  [
    policy ? undefined : "no .well-known/openpgpkey/policy; the specification requires it",
    keys.length === 0 ? "no keys published under .well-known/openpgpkey/hu/" : undefined,
    ...keys.flatMap((entry) => [namingProblem(entry), contentProblem(entry)]),
  ].filter((problem) => problem !== undefined);

/**
 * The canonical URL a given built page must advertise.
 *
 * Note what this does *not* take: the origin and base the artifact was built
 * for. A page's canonical URL names the canonical deployment whichever target
 * emitted it, so the mirror's own parameters are irrelevant here by design.
 * The previous check asked only whether the canonical pointed somewhere inside
 * *this* build, which every build satisfied by canonicalising to itself: the
 * check passed on precisely the arrangement it should have caught.
 *
 * Derived from the file's position in the artifact, so it is computed the way
 * a reader would: `blog/index.html` is served at `/blog/`, `404.html` at
 * `/404/`. Resolution goes through the URL parser, which normalises host case
 * and a default port that string comparison gets wrong.
 *
 * @returns {string | undefined} the expected href, or undefined if the
 *   canonical deployment's own configuration is unparseable.
 */
export const expectedCanonical = (path, canonicalOrigin, canonicalBase) => {
  const route = path
    .replaceAll("\\", "/")
    .replace(/\.html$/, "")
    .replace(/(^|\/)index$/, "$1");

  const mounted = slashTerminated(`${normaliseBase(canonicalBase)}${route}`);
  return URL.parse(mounted, canonicalOrigin)?.href;
};

/**
 * Custom properties a stylesheet reads without a fallback and never defines.
 *
 * The fallback exemption is not a loophole. `var(--x, blue)` on an undefined
 * `--x` is well-defined CSS that renders blue, and Tailwind builds its
 * override slots exactly that way: `var(--tw-leading, var(--text-body--line-
 * height))` means "the leading unless something overrode it", so the property
 * is *meant* to be unset. What renders nothing (and so is worth failing a
 * build over) is a bare read of a name that does not exist.
 *
 * The character immediately after the name decides it: `,` opens a fallback,
 * `)` closes a bare read. No nesting analysis is needed to tell them apart.
 */
/*
 * The two shapes every pattern below is built from.
 *
 * Written once because four patterns have to agree about them: a definition, a
 * bare read, a loose colour and a palette entry. Spelled out at each site, the
 * day one learns that a custom property may contain an underscore is the day
 * the others quietly stop matching what the first one finds.
 */
const CUSTOM_PROPERTY = "--[a-z0-9-]+";
const HEX_COLOUR = "#[0-9a-f]{6}";

const DEFINITION = new RegExp(`(${CUSTOM_PROPERTY})\\s*:`, "gi");
const BARE_READ = new RegExp(`var\\(\\s*(${CUSTOM_PROPERTY})\\s*([,)])`, "gi");
const ANY_COLOUR = new RegExp(`${HEX_COLOUR}\\b`, "gi");
const COLOUR_DEFINITION = new RegExp(
  `(${CUSTOM_PROPERTY})\\s*:\\s*(${HEX_COLOUR})`,
  "gi",
);

export const undefinedCustomProperties = (css) => {
  const defined = new Set([...css.matchAll(DEFINITION)].map((match) => match[1]));
  const readBare = new Set(
    [...css.matchAll(BARE_READ)]
      .filter((match) => match[2] === ")")
      .map((match) => match[1]),
  );
  return [...readBare].filter((name) => !defined.has(name)).sort();
};

/** Hex colours outside the sanctioned palette. */
export const offPaletteColours = (css, palette) =>
  [...new Set([...css.matchAll(ANY_COLOUR)].map((m) => m[0].toLowerCase()))]
    .filter((colour) => !palette.has(colour))
    .sort();

/**
 * The palette as declared by the token layer, the single source of truth.
 *
 * A colour definition is a custom property assigned a hex value; the ramp is
 * the subset of those under the `--color-` namespace. Filtering by prefix
 * rather than baking it into the pattern lets both colour rules share one
 * definition of what a colour literal looks like.
 */
export const paletteFrom = (tokensCss) =>
  new Set(
    [...tokensCss.matchAll(COLOUR_DEFINITION)]
      .filter(([, name]) => name.startsWith("--color-"))
      .map(([, , colour]) => colour.toLowerCase()),
  );

// ---------------------------------------------------------------------------
// Filesystem walk
// ---------------------------------------------------------------------------

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
 * Everything the checks read, gathered once.
 *
 * Reading is the only effect in this file. Each check below is a pure function
 * of this record, which is what lets it be tested against a literal rather
 * than against a directory somebody had to build first.
 *
 */
export const gather = async ({ dist, base, canonical, tokensCss }) => {
  const relativeFiles = (await filesUnder(dist)).map((path) => relative(dist, path));

  /*
   * The walk already enumerated every file, so link resolution is a set
   * membership test rather than a filesystem probe. Statting each candidate
   * instead would issue O(links x candidates) syscalls and re-probe the same
   * paths for every page that links to them.
   */
  const present = new Set(relativeFiles);

  /* Three filters rather than one loop dealing three ways. The extensions are
     disjoint, so nothing was gained by visiting each path once except hiding
     what each list is behind a branch. */
  const withExtension = (extension) =>
    relativeFiles.filter((path) => path.endsWith(extension));

  const read = async (paths) =>
    Promise.all(
      paths.map(async (path) => ({ path, text: await readFile(join(dist, path), "utf8") })),
    );

  const directive = async (name) =>
    present.has(name) ? readFile(join(dist, name), "utf8") : "";

  const hu = join("\.well-known", "openpgpkey", "hu");
  const huFiles = relativeFiles.filter((path) => path.startsWith(`${hu}/`));

  return {
    base,
    normalisedBase: normaliseBase(base),
    canonical,
    present,
    relativeFiles,
    html: await read(withExtension(".html")),
    css: await read(withExtension(".css")),
    js: withExtension(".js"),
    redirects: parseRedirects(await directive("_redirects")),
    headerPatterns: parseHeaderPatterns(await directive("_headers")),
    wkd: {
      policy: present.has(join("\.well-known", "openpgpkey", "policy")),
      keys: await Promise.all(
        huFiles.map(async (path) => ({
          name: path.slice(hu.length + 1),
          bytes: await readFile(join(dist, path)),
        })),
      ),
    },
    palette: paletteFrom(tokensCss),
  };
};

/**
 * Whether a reference is served. `isPrefix` asks the weaker question a
 * wildcard directive raises: whether anything at all sits beneath it.
 */
const resolvesIn = ({ present, relativeFiles, base, normalisedBase }) =>
  (reference, isPrefix = false) => {
    if (!isPrefix) {
      return candidatePaths(reference, base).some((path) => present.has(path));
    }
    if (!reference.startsWith(normalisedBase)) return false;
    const within = reference.slice(normalisedBase.length);
    return relativeFiles.some((path) => path.startsWith(within));
  };

/**
 * A build that emitted nothing. Separate from the list below because it is the
 * one check the others depend on: every one of them would report an artifact
 * with no pages as broken in its own way, which is noise rather than news.
 */
export const noOutput = ({ html }) =>
  html.length === 0
    ? [violation("output", "no HTML emitted; the build produced nothing")]
    : [];

export const missingRequired = ({ present }) =>
  ["index.html", "favicon.svg"]
    .filter((required) => !present.has(required))
    .map((required) => violation("output", `missing required file: ${required}`));

/**
 * Zero client JavaScript, a deliberate design decision: the theme follows the
 * system preference in CSS, so nothing needs scripting. Guarding it means an
 * accidental island or stray script is caught rather than silently shipped.
 */
export const clientScripts = ({ js, html }) => [
  ...js.map((path) => violation("zero-js", `unexpected client script: ${path}`)),
  ...html
    .filter(({ text }) => SCRIPT_ELEMENT.test(text))
    .map(({ path }) => violation("zero-js", `inline <script> in ${path}`)),
];

/** A rendered "undefined" is a prop that went missing, visible to a reader. */
export const templateLeakage = ({ html }) =>
  html.flatMap(({ path, text }) =>
    ["undefined", "NaN", "[object Object]"]
      .filter((leak) => text.includes(`>${leak}<`) || text.includes(`"${leak}"`))
      .map((leak) => violation("leakage", `rendered ${leak} in ${path}`)),
  );

export const linkIntegrity = (artifact) => {
  const resolves = resolvesIn(artifact);

  return artifact.html.flatMap(({ path, text }) =>
    extractReferences(text)
      .filter(isInternal)
      .flatMap((reference) => {
        if (!reference.startsWith(artifact.normalisedBase)) {
          return [
            violation(
              "base-path",
              `${path}: ${reference} does not start with ${artifact.normalisedBase}`,
            ),
          ];
        }
        return resolves(reference)
          ? []
          : [violation("dead-link", `${path}: ${reference} resolves to no file`)];
      }),
  );
};

/**
 * Exact equality, against the *canonical* deployment rather than the one being
 * built: both artifacts must advertise the same URL for the same page, and a
 * mirror that canonicalises to itself is the defect this catches.
 */
export const canonicalLinks = ({ html, canonical }) =>
  html.flatMap(({ path, text }) => {
    const declared = CANONICAL.exec(text);
    const expected = expectedCanonical(path, canonical.origin, canonical.base);

    if (declared === null) return [violation("canonical", `${path}: no canonical link`)];
    return declared[1] === expected
      ? []
      : [violation("canonical", `${path}: ${declared[1]} should be ${expected}`)];
  });

export const hostDirectives = (artifact) =>
  hostDirectiveViolations({
    redirects: artifact.redirects,
    headerPatterns: artifact.headerPatterns,
    resolves: resolvesIn(artifact),
  }).map((detail) => violation("host-directives", detail));

export const webKeyDirectory = ({ wkd }) =>
  wkdViolations(wkd).map((detail) => violation("wkd", detail));

/** A typo'd custom property fails no build; it renders the wrong colour. */
export const stylesheetIntegrity = ({ css, palette }) => [
  ...(palette.size === 0
    ? [violation("palette", "no palette found in the token layer")]
    : []),
  ...css.flatMap(({ path, text }) => [
    ...undefinedCustomProperties(text).map((name) =>
      violation("css-var", `${path}: var(${name}) is never defined`),
    ),
    ...offPaletteColours(text, palette).map((colour) =>
      violation("palette", `${path}: ${colour} is outside the palette`),
    ),
  ]),
];

/**
 * The checks, as data.
 *
 * A list rather than a run of pushes inside one long function: a check gets a
 * name, a test that needs no `dist/`, and a place in a count. Order is the
 * order violations are reported in, and nothing else, because each is a
 * function of the artifact alone and none can see another's findings.
 */
export const CHECKS = [
  missingRequired,
  clientScripts,
  templateLeakage,
  linkIntegrity,
  canonicalLinks,
  hostDirectives,
  webKeyDirectory,
  stylesheetIntegrity,
];

/**
 * @returns {Promise<readonly Violation[]>} every violation found, in check order
 */
export const inspect = async (options) => {
  const artifact = await gather(options);

  /* Fail fast where the checks depend on the artifact existing, accumulate
     where they do not: the same distinction `decodeHostConfig` draws between
     `andThen` and `both`. */
  const fatal = noOutput(artifact);
  return fatal.length > 0 ? fatal : CHECKS.flatMap((check) => check(artifact));
};

// ---------------------------------------------------------------------------
// Effect boundary
// ---------------------------------------------------------------------------

const main = async () => {
  const dist = resolve(process.env.DIST_DIR ?? "dist");

  /*
   * Defaults come from the deployments config, not from literals repeated
   * here. `mirrors[0] ?? canonical` is the same rule `astro.config.mjs`
   * applies, and for the same reason: an unparameterised run should reproduce
   * the harder, based URL shape. Derived locally in two lines rather than
   * imported from `src/lib/deployment.ts`, keeping the gate's reasoning its
   * own while the facts stay shared.
   */
  const fallback = deployments.mirrors[0] ?? deployments.canonical;
  const base = process.env.SITE_BASE ?? fallback.base;
  const site = process.env.SITE_URL ?? fallback.origin;
  const canonical = {
    origin: deployments.canonical.origin,
    base: deployments.canonical.base,
  };
  /* The palette lives in global.css, outside `@theme`; a ramp step must not
     become a utility. That `:root` block is still the single source this
     check reads to decide which hex values are sanctioned. */
  const tokensCss = await readFile(
    resolve("src/styles/global.css"),
    "utf8",
  );

  if (!(await exists(dist))) {
    cannotRun("check-dist", `${dist} does not exist; run the build first`);
    return;
  }

  report({
    name: "check-dist",
    problems: await inspect({ dist, base, site, canonical, tokensCss }),
    passed: `${dist} passes all ${CHECKS.length} checks for ${site}${base}`,
    failed: `for ${site}${base}`,
    /* Its own body rather than `each`: forty dead links are one fact about the
       artifact, and grouping them says so where forty lines do not. */
    body: (violations) =>
      Object.entries(Object.groupBy(violations, (entry) => entry.check))
        .map(
          ([check, entries = []]) =>
            `  ${check} (${entries.length})\n` +
            entries.map((entry) => `    - ${entry.detail}`).join("\n"),
        )
        .join("\n"),
  });
};

// Only run when invoked directly, so the test file can import the helpers.
// Compared as whole paths, the same way `check-classes` does it: matching on a
// basename would also fire for any other file that happened to share one.
if (process.argv[1] === new URL(import.meta.url).pathname) {
  await main();
}
