import type { HttpsUrl, RootedPath } from "../config/schema.ts";

/**
 * Base-aware link construction, and the only module that knows the base path.
 * A literal `href="/blog"` is correct on the custom domain and 404s on GitHub
 * Pages, where the site is served beneath `/MinecraftFuns`.
 *
 * Two kinds of target with different canonical forms: a *route* resolves to a
 * directory and ends in a slash, an *asset* resolves to a file and must not.
 *
 * URL syntax is not a regular language, so scheme handling, percent-encoding,
 * dot-segment removal, and the query/fragment split are delegated to the
 * platform's WHATWG parser. The one surviving regex decides something that
 * genuinely is regular.
 */

declare const resolvedBrand: unique symbol;

/**
 * A path that has been through this deployment's base. Erased at runtime; its
 * only power is that `routeUrl` and `assetUrl` are the sole way to obtain one.
 */
type ResolvedPath = string & { readonly [resolvedBrand]: true };

/**
 * What may be put in an `href`: a path mounted on this deployment's base, or a
 * URL carrying its own authority, which a base could only corrupt.
 *
 * Every component's `href` prop takes this, so a literal `href="/blog"`, right
 * on the custom domain and a 404 on Pages, is now a type error rather than a
 * convention this module could only document.
 */
export type Href = ResolvedPath | HttpsUrl;

/**
 * A syntactically valid origin that can never resolve. Mounting happens
 * against it and it is then discarded; `.invalid` is reserved by RFC 2606, so
 * one that escapes into an href is a dead link rather than a live request to
 * somebody else's server.
 */
const MOUNT_ORIGIN = "https://mount.invalid";

/** Regular by nature: a suffix of one repeated character. */
const TRAILING_SLASHES = /\/+$/;

/**
 * The canonical form of a route. Exported because comparing routes is only
 * sound once both sides are in it; see `isWithin` and `lib/sitemap.ts`.
 */
export const slashTerminated = (path: string): string =>
  path.endsWith("/") ? path : `${path}/`;

/**
 * How an authored href relates to this deployment. The question is never "is
 * this a URL" but "would prefixing our base corrupt it", and three unrelated
 * shapes answer yes. They are mutually exclusive, since anything carrying a
 * scheme begins with neither `//` nor `#`, so this is a case analysis and no
 * reordering of it can change an answer.
 */
export type HrefKind = "absolute" | "authority" | "fragment" | "site";

/**
 * `URL.canParse` is the standard's own definition of an absolute URL, which is
 * the half a pattern gets wrong; the other two are single-token prefixes,
 * which a pattern gets right and the parser would answer `false` for.
 */
export const classifyHref = (href: string): HrefKind => {
  if (URL.canParse(href)) return "absolute";
  if (href.startsWith("//")) return "authority";
  if (href.startsWith("#")) return "fragment";
  return "site";
};

/**
 * Mount `path` beneath `base`, which is prefixing, not resolution.
 *
 * Deliberately not `new URL(path, base)`: RFC 3986 reference resolution lets a
 * rooted path replace the base's path outright, so `/blog` against
 * `…/MinecraftFuns/` yields `/blog` and the deployment prefix vanishes from
 * every link. The parser is still the right engine for the parts that are not
 * regular, and a relative path against a slash-terminated base is exactly the
 * shape under which resolution and mounting coincide. Both adjustments are
 * load-bearing: an unterminated base loses its final segment.
 */
const mount = (base: string, path: string): URL => {
  const root = new URL(`${base.replace(TRAILING_SLASHES, "")}/`, MOUNT_ORIGIN);
  return new URL(path.startsWith("/") ? path.slice(1) : path, root);
};

/** The single point at which routes and assets differ. */
type Target = "route" | "asset";

const TERMINATE: Readonly<Record<Target, (pathname: string) => string>> = {
  route: slashTerminated,
  asset: (pathname) => pathname,
};

/**
 * Total: every (base, path) pair maps to a string and no input throws. The
 * parser hands back query and fragment already split from the path, so the
 * slash lands where it belongs: `/about#contact` becomes `/about/#contact`
 * rather than `/about#contact/`.
 */
const join = (base: string, path: string, target: Target): string => {
  if (classifyHref(path) !== "site") return path;

  const url = mount(base, path);
  return `${TERMINATE[target](url.pathname)}${url.search}${url.hash}`;
};

/** Join a file path to a base. Never slash-terminated. */
export const joinBase = (base: string, path: string): string => join(base, path, "asset");

/** Join a page route to a base, in the canonical slash-terminated form. */
export const joinRoute = (base: string, path: string): string =>
  join(base, path, "route");

/**
 * Astro injects `BASE_URL`; Node running the tests does not, so the read is
 * defensive and `/` is the correct base for an un-based build. Exported
 * because `lib/deployment.ts` must answer "which deployment is this" from the
 * same value the links are built against.
 */
export const currentBase = (): string => {
  /* The optional is the *environment*, not the field: where `import.meta.env`
     exists at all, Astro has already put a base in it. */
  const env = import.meta.env as { readonly BASE_URL: string } | undefined;
  return env?.BASE_URL ?? "/";
};

/**
 * Resolve a page route against the deployment's base path. `RootedPath`
 * because a bare `blog` is the mistake this module exists to prevent, and one
 * a template literal type can refuse before the build reaches a browser.
 */
export const routeUrl = (path: RootedPath): Href =>
  joinRoute(currentBase(), path) as ResolvedPath;

/**
 * Resolve a file against the deployment's base path.
 *
 * Deliberately wider than `routeUrl`: this doubles as the host directives'
 * resolver, and a path pattern that has already been resolved once is a plain
 * string. Narrowing the parameter would buy a rooted asset link and cost an
 * assertion at that boundary, which is the worse of the two trades.
 */
export const assetUrl = (path: string): Href =>
  joinBase(currentBase(), path) as ResolvedPath;

/**
 * Section containment, used to mark the current nav item. Slash-terminating
 * both sides makes the separator part of the prefix, so `/blog/` matches
 * `/blog/2026/` but not `/blogroll/`. String comparison is deliberate: these
 * are resolved pathnames from one origin, and re-parsing them would establish
 * nothing the mount above has not.
 */
export const isWithin = (pathname: string, target: string): boolean =>
  slashTerminated(pathname).startsWith(slashTerminated(target));
