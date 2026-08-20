/**
 * Validate emitted artifacts, not only source. Findings accumulate, helpers
 * are tested, and targeted HTML regexes are acceptable for generated output.
 */

import { readFile, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { deployments } from "../src/config/deployments.ts";
import { languages } from "../src/config/languages.ts";
import { captures } from "./lib/captures.ts";
import { mapConcurrent } from "./lib/concurrent.ts";
import { filesUnder } from "./lib/files.ts";
import { cannotRun, report } from "./lib/gate.ts";

/** Typed data model for artifact checks. */

/** One thing wrong with the artifact, grouped by `check` when reported. */
export type Violation = {
  readonly check: string;
  readonly detail: string;
};

const violation = (check: string, detail: string): Violation => ({ check, detail });

/** A file read out of `dist/`, with its path relative to it. */
export type Document = { readonly path: string; readonly text: string };

/** A redirect line as it shipped, not as it was authored. */
export type ShippedRedirect = {
  readonly from: string;
  readonly to: string;
  /** Absent where the line omitted it; this parser does not default. */
  readonly status: string | undefined;
};

export type WkdEntry = { readonly name: string; readonly bytes: Uint8Array };

export type WebKeyDirectory = {
  readonly policy: boolean;
  readonly keys: readonly WkdEntry[];
};

/** Plain strings: this module shares facts with `src/config`, never derivations. */
export type Deployment = { readonly origin: string; readonly base: string };

/** Whether a reference is served; `isPrefix` asks the wildcard's question. */
export type Resolves = (reference: string, isPrefix?: boolean) => boolean;

/** Everything the checks read, gathered once. */
export type Artifact = {
  readonly base: string;
  readonly normalisedBase: string;
  readonly canonical: Deployment;
  readonly present: ReadonlySet<string>;
  readonly relativeFiles: readonly string[];
  readonly html: readonly Document[];
  readonly css: readonly Document[];
  readonly js: readonly string[];
  readonly redirects: readonly ShippedRedirect[];
  readonly headerPatterns: readonly string[];
  readonly wkd: WebKeyDirectory;
  readonly palette: ReadonlySet<string>;
};

export type Options = {
  readonly dist: string;
  readonly base: string;
  readonly canonical: Deployment;
  readonly tokensCss: string;
};

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/* Duplicate URL reasoning here so the gate does not share link-construction bugs. */

/** Local copy keeps validation independent from production URL logic. */
const slashTerminated = (path: string): string =>
  path.endsWith("/") ? path : `${path}/`;

/** Open file handles, which a directory listing otherwise bounds. */
const READ_CONCURRENCY = 16;

/** A syntactically valid origin that can never resolve. RFC 2606 reserves it. */
const PROBE_ORIGIN = "https://probe.invalid";

/** Normalise a base path to exactly one leading and one trailing slash. */
export const normaliseBase = (base: string): string => {
  const trimmed = base.replace(/^\/+|\/+$/g, "");
  return trimmed === "" ? "/" : `/${trimmed}/`;
};

/** Total: a malformed escape yields the raw text rather than throwing, so a
    bad href becomes a reported dead link instead of a crashed gate. */
const decodedPath = (pathname: string): string => {
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
export const extractReferences = (html: string): readonly string[] =>
  captures(html.matchAll(REFERENCE));

/** Anything carrying its own authority is out of scope for local resolution. */
export const isInternal = (reference: string): boolean =>
  reference.startsWith("/") && !reference.startsWith("//");

/**
 * Map an internal reference onto the dist-relative paths that could satisfy it.
 *
 * A directory-style route may be served by `work/index.html`; an explicit file
 * is served as itself. Returning candidates rather than one path keeps the
 * caller's existence test a simple disjunction.
 */
export const candidatePaths = (reference: string, base: string): readonly string[] => {
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
export const parseRedirects = (text: string): readonly ShippedRedirect[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map((line) => line.split(/\s+/))
    /* The `length >= 2` filter this replaces said the same thing where the
       type could not follow it, leaving every field possibly-missing
       downstream. Deciding it on the destructured values is what makes a
       redirect that parses one that has both halves. */
    .map(([from, to, status]) =>
      from === undefined || to === undefined ? undefined : { from, to, status },
    )
    .filter((redirect) => redirect !== undefined);

/** Pattern lines are unindented; the operations beneath them are not. */
export const parseHeaderPatterns = (text: string): readonly string[] =>
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
export const hostDirectiveViolations = ({
  redirects,
  headerPatterns,
  resolves,
}: {
  readonly redirects: readonly ShippedRedirect[];
  readonly headerPatterns: readonly string[];
  readonly resolves: Resolves;
}): readonly string[] => {
  // A destination carrying its own authority cannot be checked from here.
  const internal = ({ to }: ShippedRedirect): boolean =>
    to.startsWith("/") && !to.startsWith("//");

  const unmatched = (pattern: string): boolean => {
    const wildcard = pattern.endsWith("*");
    return !resolves(wildcard ? pattern.slice(0, -1) : pattern, wildcard);
  };

  return [
    ...redirects
      .filter((redirect) => internal(redirect) && !resolves(redirect.to))
      .map(
        ({ from, to }) => `_redirects: ${from} points at ${to}, which no file satisfies`,
      ),
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
const namingProblem = ({ name }: WkdEntry): string | undefined =>
  ZBASE32_NAME.test(name) ? undefined : `hu/${name} is not a 32-character Z-Base-32 hash`;

/**
 * What is wrong with an entry's bytes, or nothing. An armored key would start
 * with "-" (0x2d), which is the mistake the specification warns against.
 */
const contentProblem = ({ name, bytes }: WkdEntry): string | undefined => {
  /* One read rather than a length test and then an index: emptiness and "no
     first byte" are the same fact, and asking once leaves the byte a definite
     number in the message below. */
  const [tag] = bytes;
  if (tag === undefined) return `hu/${name} is empty`;
  if (tag === 0x98 || tag === 0x99) return undefined;
  return `hu/${name} does not begin with an OpenPGP public-key packet (0x${tag.toString(16)}); the key must be binary, not armored`;
};

/* Each check is a total function to "a problem, or nothing", so the whole
   thing is that list with the nothings removed. Written as pushes into a
   shared array, the checks read as steps in a procedure rather than as the
   independent facts they are. */
export const wkdViolations = ({ policy, keys }: WebKeyDirectory): readonly string[] =>
  [
    policy
      ? undefined
      : "no .well-known/openpgpkey/policy; the specification requires it",
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
 * Returns the expected href, or `undefined` where the canonical deployment's
 * own configuration is unparseable.
 */
export const expectedCanonical = (
  path: string,
  canonicalOrigin: string,
  canonicalBase: string,
): string | undefined => {
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

export const undefinedCustomProperties = (css: string): readonly string[] => {
  const defined = new Set(captures(css.matchAll(DEFINITION)));
  const readBare = new Set(
    captures([...css.matchAll(BARE_READ)].filter((match) => match[2] === ")")),
  );
  return [...readBare].filter((name) => !defined.has(name)).sort();
};

/** Hex colours outside the sanctioned palette. */
export const offPaletteColours = (
  css: string,
  palette: ReadonlySet<string>,
): readonly string[] =>
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
export const paletteFrom = (tokensCss: string): ReadonlySet<string> =>
  new Set(
    [...tokensCss.matchAll(COLOUR_DEFINITION)]
      .map(([, name, colour]) => ({ name, colour }))
      .filter((found) => found.name?.startsWith("--color-") === true)
      .map((found) => found.colour)
      .filter((colour) => colour !== undefined)
      .map((colour) => colour.toLowerCase()),
  );

// ---------------------------------------------------------------------------
// Filesystem walk
// ---------------------------------------------------------------------------

const exists = async (path: string): Promise<boolean> => {
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
export const gather = async ({
  dist,
  base,
  canonical,
  tokensCss,
}: Options): Promise<Artifact> => {
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
  const withExtension = (extension: string): readonly string[] =>
    relativeFiles.filter((path) => path.endsWith(extension));

  /* Bounded: an artifact has as many files as the site has pages, and
     `Promise.all` over the listing would open every one of them at once. */
  const read = (paths: readonly string[]): Promise<readonly Document[]> =>
    mapConcurrent(paths, READ_CONCURRENCY, async (path) => ({
      path,
      text: await readFile(join(dist, path), "utf8"),
    }));

  const directive = async (name: string): Promise<string> =>
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
      keys: await mapConcurrent(huFiles, READ_CONCURRENCY, async (path) => ({
        name: path.slice(hu.length + 1),
        bytes: await readFile(join(dist, path)),
      })),
    },
    palette: paletteFrom(tokensCss),
  };
};

/**
 * Whether a reference is served. `isPrefix` asks the weaker question a
 * wildcard directive raises: whether anything at all sits beneath it.
 */
const resolvesIn =
  ({ present, relativeFiles, base, normalisedBase }: Artifact): Resolves =>
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
export const noOutput = ({ html }: Artifact): readonly Violation[] =>
  html.length === 0
    ? [violation("output", "no HTML emitted; the build produced nothing")]
    : [];

export const missingRequired = ({ present }: Artifact): readonly Violation[] =>
  ["index.html", "favicon.svg", "favicon.ico", "apple-touch-icon.png"]
    .filter((required) => !present.has(required))
    .map((required) => violation("output", `missing required file: ${required}`));

/** A listing's first page, addressed as a page rather than as the listing. */
const FIRST_PAGE = /(?:^|\/)page\/1(?:\/|$)/;

/**
 * Page one of a listing lives at the listing's own route, never at
 * `/page/1/`. `lib/paging.ts` makes that true by construction, routing every
 * address through one function; this is the assertion that it stayed true,
 * because the failure is silent. Both copies would render, and the archive
 * would divide its inbound links and its indexing between two URLs holding
 * identical posts.
 *
 * Files and links are both checked: a route nobody links to is still a page a
 * crawler can find, and a link to a page that is not generated is a 404.
 */
export const firstPageAliases = ({
  relativeFiles,
  html,
}: Artifact): readonly Violation[] => [
  ...relativeFiles
    .filter((path) => FIRST_PAGE.test(path))
    .map((path) => violation("paging", `${path}: page one is the listing's own route`)),
  ...html.flatMap(({ path, text }) =>
    extractReferences(text)
      .filter((reference) => FIRST_PAGE.test(reference))
      .map((reference) =>
        violation("paging", `${path}: links ${reference} rather than the listing`),
      ),
  ),
];

/**
 * Zero client JavaScript, a deliberate design decision: the theme follows the
 * system preference in CSS, so nothing needs scripting. Guarding it means an
 * accidental island or stray script is caught rather than silently shipped.
 */
export const clientScripts = ({ js, html }: Artifact): readonly Violation[] => [
  ...js.map((path) => violation("zero-js", `unexpected client script: ${path}`)),
  ...html
    .filter(({ text }) => SCRIPT_ELEMENT.test(text))
    .map(({ path }) => violation("zero-js", `inline <script> in ${path}`)),
];

/** A rendered "undefined" is a prop that went missing, visible to a reader. */
export const templateLeakage = ({ html }: Artifact): readonly Violation[] =>
  html.flatMap(({ path, text }) =>
    ["undefined", "NaN", "[object Object]"]
      .filter((leak) => text.includes(`>${leak}<`) || text.includes(`"${leak}"`))
      .map((leak) => violation("leakage", `rendered ${leak} in ${path}`)),
  );

export const linkIntegrity = (artifact: Artifact): readonly Violation[] => {
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
 * A route whose final segment is a declared language code is a
 * language-addressed serving of its parent route: `/blog/x/zh/` holds the
 * Chinese rendition of `/blog/x/`. Its canonical may legitimately be itself
 * (a sibling rendition owns the bare URL) or the parent (it is the article's
 * only rendition, served at both addresses); which of the two depends on the
 * article's other files, which an artifact check cannot see. Both name this
 * page's own content on the canonical origin, and the defect this check
 * exists for, a mirror canonicalising to its own origin, is caught either
 * way. The codes are facts and come from config; the reasoning is
 * deliberately re-derived here, per the note at the top of this module.
 */
const LANG_SUFFIX = new RegExp(`/(?:${languages.map(({ code }) => code).join("|")})/$`);

/** The canonical URLs a built page may advertise, most specific first. */
export const acceptableCanonicals = (
  path: string,
  canonicalOrigin: string,
  canonicalBase: string,
): readonly string[] => {
  const expected = expectedCanonical(path, canonicalOrigin, canonicalBase);
  if (expected === undefined) return [];

  const parent = expected.replace(LANG_SUFFIX, "/");
  return parent === expected ? [expected] : [expected, parent];
};

/**
 * Exact equality against the *canonical* deployment rather than the one being
 * built: both artifacts must advertise the same URL for the same page, and a
 * mirror that canonicalises to itself is the defect this catches. A
 * language-suffixed page has two acceptable answers; see `LANG_SUFFIX`.
 */
export const canonicalLinks = ({ html, canonical }: Artifact): readonly Violation[] =>
  html.flatMap(({ path, text }) => {
    const declared = CANONICAL.exec(text);
    const accepted = acceptableCanonicals(path, canonical.origin, canonical.base);

    if (declared === null) return [violation("canonical", `${path}: no canonical link`)];
    return declared[1] !== undefined && accepted.includes(declared[1])
      ? []
      : [
          violation(
            "canonical",
            `${path}: ${declared[1]} should be ${accepted.join(" or ")}`,
          ),
        ];
  });

export const hostDirectives = (artifact: Artifact): readonly Violation[] =>
  hostDirectiveViolations({
    redirects: artifact.redirects,
    headerPatterns: artifact.headerPatterns,
    resolves: resolvesIn(artifact),
  }).map((detail) => violation("host-directives", detail));

export const webKeyDirectory = ({ wkd }: Artifact): readonly Violation[] =>
  wkdViolations(wkd).map((detail) => violation("wkd", detail));

/** A typo'd custom property fails no build; it renders the wrong colour. */
export const stylesheetIntegrity = ({ css, palette }: Artifact): readonly Violation[] => [
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
export const CHECKS: readonly ((artifact: Artifact) => readonly Violation[])[] = [
  missingRequired,
  firstPageAliases,
  clientScripts,
  templateLeakage,
  linkIntegrity,
  canonicalLinks,
  hostDirectives,
  webKeyDirectory,
  stylesheetIntegrity,
];

/** Every violation found, in check order. */
export const inspect = async (options: Options): Promise<readonly Violation[]> => {
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
   * here. `mirrors[0] ?? canonical` is the same rule `astro.config.ts`
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
  const tokensCss = await readFile(resolve("src/styles/global.css"), "utf8");

  if (!(await exists(dist))) {
    cannotRun("check-dist", `${dist} does not exist; run the build first`);
    return;
  }

  report({
    name: "check-dist",
    problems: await inspect({ dist, base, canonical, tokensCss }),
    passed: `${dist} passes all ${CHECKS.length} checks for ${site}${base}`,
    failed: `for ${site}${base}`,
    /* Its own body rather than `each`: forty dead links are one fact about the
       artifact, and grouping them says so where forty lines do not. */
    body: (violations: readonly Violation[]): string =>
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
