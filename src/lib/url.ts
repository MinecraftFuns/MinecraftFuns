/**
 * Base-aware link construction.
 *
 * The site is served from different base paths depending on the target —
 * `/MinecraftFuns` on GitHub Pages, `/` on the custom domain — so a literal
 * `href="/blog"` is only correct on one of them. Every internal link goes
 * through this module, which is the single place that knows the base path.
 *
 * Two kinds of thing get linked, and they have different canonical forms. A
 * *route* resolves to a directory in the built output and ends in a slash; an
 * *asset* resolves to a file and must not.
 *
 * On parsers. URL syntax is not a regular language: scheme handling is
 * context-sensitive, and percent-encoding, dot-segment removal, and the
 * query/fragment split all have spec-defined behaviour that a hand-written
 * pattern can only approximate. Those are delegated to the platform's WHATWG
 * parser below. The one regex that survives decides a property that genuinely
 * *is* regular — trailing slashes on a path — which is what regular
 * expressions are for.
 */

/**
 * A syntactically valid origin that can never resolve. Mounting happens
 * against it and the origin is then discarded; `.invalid` is reserved by
 * RFC 2606, so a bug that lets one escape into an href is an obvious dead link
 * rather than a live request to somebody else's server.
 */
const MOUNT_ORIGIN = "https://mount.invalid";

/** Regular by nature: a suffix of one repeated character. */
const TRAILING_SLASHES = /\/+$/;

/**
 * The canonical form of a route. Exported because comparing routes is only
 * sound once both sides are in it — see `isWithin` below and `lib/sitemap.ts`.
 */
export const slashTerminated = (path: string): string =>
  path.endsWith("/") ? path : `${path}/`;

/**
 * How an authored href relates to this deployment.
 *
 * The question is never "is this a URL" but "would prefixing this with our
 * base path corrupt it", and three unrelated shapes answer yes. Collapsing
 * them into one boolean is what forced the previous version to hand-write a
 * scheme grammar: the predicate was standing in for a sum it could not name.
 *
 * The three are mutually exclusive — anything carrying a scheme begins with
 * neither `//` nor `#` — so this is a case analysis rather than a priority
 * list, and no reordering of it can change an answer.
 */
export type HrefKind = "absolute" | "authority" | "fragment" | "site";

/**
 * Total. `URL.canParse` is the standard's own definition of an absolute URL,
 * which is the half of this that a pattern gets wrong; the other two shapes
 * are single-token prefixes that a pattern gets right, so they stay exact
 * string tests rather than becoming parser calls that would answer `false`.
 */
export const classifyHref = (href: string): HrefKind => {
  if (URL.canParse(href)) return "absolute";
  if (href.startsWith("//")) return "authority";
  if (href.startsWith("#")) return "fragment";
  return "site";
};

/**
 * Mount `path` beneath `base`.
 *
 * Deliberately *not* `new URL(path, base)`. That performs RFC 3986 reference
 * resolution, under which a rooted path replaces the base's path outright:
 * resolving `/blog` against `…/MinecraftFuns/` yields `/blog`, and the
 * deployment prefix silently vanishes from every link. Mounting is prefixing.
 * They are different operations and this site needs the second one.
 *
 * The parser is still the right engine, because it owns the parts that are not
 * regular. Making the path relative and the base slash-terminated is precisely
 * the shape under which resolution and mounting coincide — so the spec
 * algorithm is borrowed rather than reimplemented. Both adjustments are
 * load-bearing: an unterminated base loses its final segment.
 */
const mount = (base: string, path: string): URL => {
  const root = new URL(
    `${base.replace(TRAILING_SLASHES, "")}/`,
    MOUNT_ORIGIN,
  );
  return new URL(path.startsWith("/") ? path.slice(1) : path, root);
};

/**
 * What each kind of target does to a mounted pathname. A total map over the
 * closed sum, and the single point at which routes and assets differ.
 */
type Target = "route" | "asset";

const TERMINATE: Readonly<Record<Target, (pathname: string) => string>> = {
  route: slashTerminated,
  asset: (pathname) => pathname,
};

/**
 * Total: every (base, path) pair maps to a string, and no input throws.
 *
 * The parser hands back the query and fragment already separated from the
 * path, so the slash lands where it belongs without any splitting of our own —
 * `/about#contact` becomes `/about/#contact` rather than `/about#contact/`.
 */
const join = (base: string, path: string, target: Target): string => {
  if (classifyHref(path) !== "site") return path;

  const url = mount(base, path);
  return `${TERMINATE[target](url.pathname)}${url.search}${url.hash}`;
};

/** Join a file path to a base. Never slash-terminated. */
export const joinBase = (base: string, path: string): string =>
  join(base, path, "asset");

/** Join a page route to a base, in the canonical slash-terminated form. */
export const joinRoute = (base: string, path: string): string =>
  join(base, path, "route");

/**
 * Astro injects `BASE_URL`; Node running the tests does not. Reading it
 * defensively keeps this module importable in both, and the `/` fallback is
 * the correct base for an un-based build rather than a silent failure.
 */
const currentBase = (): string => {
  const env = import.meta.env as { readonly BASE_URL?: string } | undefined;
  return env?.BASE_URL ?? "/";
};

/** Resolve a page route against the deployment's base path. */
export const routeUrl = (path: string): string => joinRoute(currentBase(), path);

/** Resolve a file against the deployment's base path. */
export const assetUrl = (path: string): string => joinBase(currentBase(), path);

/**
 * Section containment, used to mark the current nav item.
 *
 * Both sides are slash-terminated first, which makes a plain `startsWith`
 * correct: the separator becomes part of the prefix, so `/blog/` matches
 * `/blog/2026/` but not `/blogroll/`. Left as string comparison deliberately —
 * these are already-resolved pathnames from one origin, so re-parsing them
 * would buy nothing that the mount above has not already established.
 */
export const isWithin = (pathname: string, target: string): boolean =>
  slashTerminated(pathname).startsWith(slashTerminated(target));
