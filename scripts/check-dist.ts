/** Validate emitted artifacts independently of source derivations. */

import { readFile, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { assertNever } from "../src/prelude/adt.ts";
import { groupBy } from "../src/prelude/distinct.ts";
import { deployments } from "../src/config/deployments.ts";
import { languages } from "../src/config/languages.ts";
import { captures } from "./lib/captures.ts";
import { mapConcurrent, READ_CONCURRENCY } from "./lib/concurrent.ts";
import { filesUnder } from "./lib/files.ts";
import { cannotRun, isMain, report } from "./lib/gate.ts";

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

/** Deployment facts shared with `src/config`, never derived from its helpers. */
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

/* Keep URL validation independent from link construction. */

/** Local copy keeps validation independent from production URL logic. */
const slashTerminated = (path: string): string =>
  path.endsWith("/") ? path : `${path}/`;

/** A syntactically valid origin that can never resolve. RFC 2606 reserves it. */
const PROBE_ORIGIN = "https://probe.invalid";

/** Normalise a base path to exactly one leading and one trailing slash. */
export const normaliseBase = (base: string): string => {
  const trimmed = base.replace(/^\/+|\/+$/g, "");
  return trimmed === "" ? "/" : `/${trimmed}/`;
};

/** Decode a path without letting malformed escapes crash the gate. */
const decodedPath = (pathname: string): string => {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
};

/* Generated Astro markup uses double-quoted attributes; a parser is unnecessary
  until this gate reads external HTML. */
const ATTRIBUTE = '\\s*=\\s*"([^"]*)"';

const REFERENCE = new RegExp(`\\b(?:href|src)${ATTRIBUTE}`, "gi");
const CANONICAL = new RegExp(`<link\\s+rel="canonical"\\s+href${ATTRIBUTE}`, "i");

/** Extract raw `href`/`src` values in source order. */
export const extractReferences = (html: string): readonly string[] =>
  captures(html.matchAll(REFERENCE));

/** Anything carrying its own authority is out of scope for local resolution. */
export const isInternal = (reference: string): boolean =>
  reference.startsWith("/") && !reference.startsWith("//");

/** Map an internal reference to its possible dist-relative file paths. */
export const candidatePaths = (reference: string, base: string): readonly string[] => {
  const normalised = normaliseBase(base);
  if (!isInternal(reference) || !reference.startsWith(normalised)) return [];

  /* URL parsing strips query/fragment components and decodes the path. */
  const { pathname } = new URL(reference, PROBE_ORIGIN);
  const withinSite = decodedPath(pathname.slice(normalised.length));
  if (withinSite === "") return ["index.html"];

  const bare = withinSite.replace(/\/+$/, "");
  return [bare, `${bare}/index.html`, `${bare}.html`];
};

/** Parse shipped host directives independently of their source generators. */
export const parseRedirects = (text: string): readonly ShippedRedirect[] =>
  text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("#"))
    .map((line) => line.split(/\s+/))
    /* Destructuring narrows both required redirect fields for the result. */
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

/** Find shipped directives whose internal paths match nothing in the artifact. */
export const hostDirectiveViolations = ({
  redirects,
  headerPatterns,
  resolves,
}: {
  readonly redirects: readonly ShippedRedirect[];
  readonly headerPatterns: readonly string[];
  readonly resolves: Resolves;
}): readonly string[] => {
  const unmatched = (pattern: string): boolean => {
    const wildcard = pattern.endsWith("*");
    return !resolves(wildcard ? pattern.slice(0, -1) : pattern, wildcard);
  };

  return [
    ...redirects
      .filter((redirect) => isInternal(redirect.to) && !resolves(redirect.to))
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

/** What is wrong with an entry's name, or nothing. */
const namingProblem = ({ name }: WkdEntry): string | undefined =>
  ZBASE32_NAME.test(name) ? undefined : `hu/${name} is not a 32-character Z-Base-32 hash`;

/** Check that an entry begins with a binary OpenPGP public-key packet. */
const contentProblem = ({ name, bytes }: WkdEntry): string | undefined => {
  /* Empty input and a missing first byte are the same case. */
  const [tag] = bytes;
  if (tag === undefined) return `hu/${name} is empty`;
  if (tag === 0x98 || tag === 0x99) return undefined;
  return `hu/${name} does not begin with an OpenPGP public-key packet (0x${tag.toString(16)}); the key must be binary, not armored`;
};

/** Check WKD names and binary OpenPGP packet framing from shipped files. */
export const wkdViolations = ({ policy, keys }: WebKeyDirectory): readonly string[] =>
  [
    policy
      ? undefined
      : "no .well-known/openpgpkey/policy; the specification requires it",
    keys.length === 0 ? "no keys published under .well-known/openpgpkey/hu/" : undefined,
    ...keys.flatMap((entry) => [namingProblem(entry), contentProblem(entry)]),
  ].filter((problem) => problem !== undefined);

/** Derive the canonical deployment URL for a dist-relative HTML path. */
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

/** Find bare reads of custom properties that are never defined. */
/* Shared patterns keep property and colour extraction in sync. */
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

/** Read the `--color-*` hex palette from the token layer. */
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

/** Node marks a missing path with `ENOENT`; anything else is a real failure. */
const isMissing = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "ENOENT";

/**
 * Absence, distinguished from inaccessibility.
 *
 * A bare `catch` would tell the reader to "run the build first" when the
 * artifact is there but unreadable, which is the one instruction that cannot
 * help. Permission and I/O errors propagate instead.
 */
const exists = async (path: string): Promise<boolean> => {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
};

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------
/** Gather the artifact once; checks below are pure functions of this record. */
export const gather = async ({
  dist,
  base,
  canonical,
  tokensCss,
}: Options): Promise<Artifact> => {
  const relativeFiles = (await filesUnder(dist)).map((path) => relative(dist, path));

  /* The walk makes link resolution a set lookup instead of repeated syscalls. */
  const present = new Set(relativeFiles);

  /* Extensions are disjoint; separate filters keep each artifact list explicit. */
  const withExtension = (extension: string): readonly string[] =>
    relativeFiles.filter((path) => path.endsWith(extension));

  /* Bound file reads so a large artifact does not open every file at once. */
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

/** Whether a reference is served; prefixes only need one descendant. */
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

/** Report an empty build before dependent checks produce misleading noise. */
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

/** Reject duplicate page-one routes in both emitted files and links. */
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

/*
 * What HTML does with a `<script>`, decided the way the standard decides it.
 *
 * "No client JavaScript" is a claim about what the engine will execute, and a
 * `<script>` tag is not that claim's subject: the `type` attribute is. HTML's
 * "prepare the script element" sorts an element into exactly four outcomes,
 * and only two of them run author code. The rest are data blocks, which the
 * standard says are "not processed by the user agent, but instead by author
 * script or other tools" - inert markup carrying JSON, no different in kind
 * from a `<meta>` tag.
 *
 * Reading every `<script>` as JavaScript would therefore reject a speculation
 * rules block, which is the shape this site uses to hint at the next page and
 * which no engine executes.
 */

/** The MIME essences the standard counts as JavaScript. */
const JAVASCRIPT: ReadonlySet<string> = new Set([
  "application/ecmascript",
  "application/javascript",
  "application/x-ecmascript",
  "application/x-javascript",
  "text/ecmascript",
  "text/javascript",
  "text/javascript1.0",
  "text/javascript1.1",
  "text/javascript1.2",
  "text/javascript1.3",
  "text/javascript1.4",
  "text/javascript1.5",
  "text/jscript",
  "text/livescript",
  "text/x-ecmascript",
  "text/x-javascript",
]);

/** The four outcomes, closed, so the policy below can be total. */
export type ScriptKind =
  | { readonly tag: "classic" }
  | { readonly tag: "module" }
  | { readonly tag: "importmap" }
  | { readonly tag: "data"; readonly type: string };

/** HTML's ASCII whitespace, which the type attribute is stripped of. */
const SURROUNDING_SPACE = /^[\t\n\f\r ]+|[\t\n\f\r ]+$/g;

/**
 * Classify one element by its `type`, per "prepare the script element".
 *
 * Absent, empty, or a JavaScript MIME *essence* match is a classic script.
 * Essence is the bare `type/subtype`, so a parameter makes it no longer a
 * match and the standard calls the result a data block; this follows the
 * standard rather than second-guessing it. Total on every string.
 */
export const scriptKind = (type: string | undefined): ScriptKind => {
  if (type === undefined) return { tag: "classic" };
  const essence = type.replace(SURROUNDING_SPACE, "").toLowerCase();
  if (essence === "" || JAVASCRIPT.has(essence)) return { tag: "classic" };
  if (essence === "module") return { tag: "module" };
  if (essence === "importmap") return { tag: "importmap" };
  return { tag: "data", type: essence };
};

/**
 * Whether the engine runs author JavaScript for this element.
 *
 * An import map runs nothing itself; it only redirects the specifiers of
 * module scripts, and a module script is rejected above, so one arriving alone
 * is inert. It is reported all the same, because the only reason to ship one
 * is to serve a module that should not be here either.
 */
export const executes = (kind: ScriptKind): boolean => {
  switch (kind.tag) {
    case "classic":
    case "module":
    case "importmap":
      return true;
    case "data":
      return false;
    default:
      return assertNever(kind);
  }
};

/* One start tag; generated markup quotes its attributes, per the note above. */
const SCRIPT_START = /<script\b([^>]*)>/gi;
const TYPE_ATTRIBUTE = /\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;

/** Every script element in a document, classified. O(n) in the markup. */
export const scriptKinds = (html: string): readonly ScriptKind[] =>
  [...html.matchAll(SCRIPT_START)].map(([, attributes]) => {
    const found = TYPE_ATTRIBUTE.exec(attributes ?? "");
    return scriptKind(found?.[1] ?? found?.[2] ?? found?.[3]);
  });

/** Enforce the site's zero-client-JavaScript contract. */
export const clientScripts = ({ js, html }: Artifact): readonly Violation[] => [
  ...js.map((path) => violation("zero-js", `unexpected client script: ${path}`)),
  ...html.flatMap(({ path, text }) =>
    scriptKinds(text)
      .filter(executes)
      .map((kind) =>
        violation("zero-js", `${path}: <script> runs as a ${kind.tag} script`),
      ),
  ),
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

/** Language-suffixed pages may canonicalize to themselves or their parent. */
const LANG_SUFFIX = new RegExp(`/(?:${languages.map(({ code }) => code).join("|")})/$`);

/** Allowed canonical URLs for a built page, most specific first. */
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

/** Require canonicals to name the canonical deployment, not the mirror. */
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

/** Checks run in this order and report independently. */
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

  /* Empty output invalidates dependent checks; otherwise accumulate findings. */
  const fatal = noOutput(artifact);
  return fatal.length > 0 ? fatal : CHECKS.flatMap((check) => check(artifact));
};

// ---------------------------------------------------------------------------
// Effect boundary
// ---------------------------------------------------------------------------

const main = async () => {
  const dist = resolve(process.env.DIST_DIR ?? "dist");

  /* Match the deployment fallback used by `astro.config.ts`. */
  const fallback = deployments.mirrors[0] ?? deployments.canonical;
  const base = process.env.SITE_BASE ?? fallback.base;
  const site = process.env.SITE_URL ?? fallback.origin;
  const canonical = {
    origin: deployments.canonical.origin,
    base: deployments.canonical.base,
  };
  /* Read the palette from the global token layer, including non-utility ramps. */
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
    /* Group repeated violations by check. */
    body: (violations: readonly Violation[]): string =>
      [...groupBy(violations, (entry) => entry.check)]
        .map(
          ([check, entries]) =>
            `  ${check} (${entries.length})\n` +
            entries.map((entry) => `    - ${entry.detail}`).join("\n"),
        )
        .join("\n"),
  });
};

if (isMain(import.meta.url)) await main();
