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
 * *asset* resolves to a file and must not. One function served both, so it
 * could only be right about one of them — which is why internal links emitted
 * `/blog/2026/08/slug` while the canonical tag on the very same page emitted
 * `/blog/2026/08/slug/`. Splitting the two makes the distinction visible at
 * every call site.
 *
 * The functions are layered so the interesting ones are pure: `joinBase` and
 * `joinRoute` take the base as an argument and are directly testable outside a
 * bundler, while `assetUrl`/`routeUrl` are thin wrappers that read it from the
 * environment.
 */

/**
 * Anything already carrying its own authority: a scheme (`https:`, `mailto:`),
 * a protocol-relative `//host`, or a bare fragment. These must pass through
 * untouched — prefixing them would corrupt them.
 */
const SELF_ANCHORED = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

/** A path, and any query or fragment trailing it. The slash belongs after the
    path and before the suffix, so the two are separated before joining. */
const ROUTE_AND_SUFFIX = /^([^?#]*)([?#].*)?$/;

const slashTerminated = (path: string): string =>
  path.endsWith("/") ? path : `${path}/`;

/**
 * Total: every (base, path) pair maps to a string, and no input throws.
 *
 * Normalising both sides before joining is what keeps the result free of the
 * doubled slash that appears when a base ending in `/` meets a rooted path.
 */
export const joinBase = (base: string, path: string): string => {
  if (SELF_ANCHORED.test(path)) return path;

  const trimmedBase = base.replace(/\/+$/, "");
  const rootedPath = path.startsWith("/") ? path : `/${path}`;

  return `${trimmedBase}${rootedPath}`;
};

/**
 * As `joinBase`, but producing the canonical form of a route.
 *
 * A query or fragment is held aside while the slash is applied, so
 * `/about#contact` becomes `/about/#contact` rather than `/about#contact/`.
 * The About page already has addressable sections, so this is a shape the site
 * will link to rather than a hypothetical one.
 */
export const joinRoute = (base: string, path: string): string => {
  if (SELF_ANCHORED.test(path)) return path;

  const [, route = "", suffix = ""] = ROUTE_AND_SUFFIX.exec(path) ?? [];
  return `${slashTerminated(joinBase(base, route))}${suffix}`;
};

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
export const routeUrl = (path: string): string =>
  joinRoute(currentBase(), path);

/** Resolve a file against the deployment's base path. Never slash-terminated. */
export const assetUrl = (path: string): string => joinBase(currentBase(), path);

/**
 * Section containment, used to mark the current nav item.
 *
 * Both sides are slash-terminated first, which makes a plain `startsWith`
 * correct: the separator is part of the prefix, so `/blog/` matches
 * `/blog/2026/` but not `/blogroll/`. The previous version appended that
 * separator by hand precisely because targets did not carry one.
 */
export const isWithin = (pathname: string, target: string): boolean =>
  slashTerminated(pathname).startsWith(slashTerminated(target));
