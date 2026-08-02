/**
 * Base-aware link construction.
 *
 * The site is served from different base paths depending on the target —
 * `/MinecraftFuns` on GitHub Pages, `/` on the custom domain — so a literal
 * `href="/work"` is only correct on one of them. Every internal link goes
 * through `withBase`, which is the single place that knows the deployment's
 * base path.
 *
 * The functions below are split so the interesting one is pure: `joinBase`
 * takes the base as an argument and is directly testable outside a bundler,
 * while `withBase` is the thin wrapper that reads it from the environment.
 */

/**
 * Anything already carrying its own authority: a scheme (`https:`, `mailto:`),
 * a protocol-relative `//host`, or a bare fragment. These must pass through
 * untouched — prefixing them would corrupt them.
 */
const SELF_ANCHORED = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

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
 * Astro injects `BASE_URL`; Node running the tests does not. Reading it
 * defensively keeps this module importable in both, and the `/` fallback is
 * the correct base for an un-based build rather than a silent failure.
 */
const currentBase = (): string => {
  const env = import.meta.env as { readonly BASE_URL?: string } | undefined;
  return env?.BASE_URL ?? "/";
};

/** Resolve an internal path against the deployment's base path. */
export const withBase = (path: string): string => joinBase(currentBase(), path);

/**
 * Section containment, used to mark the current nav item.
 *
 * `/work/some-project` is within `/work`, but `/workshop` is not — hence the
 * explicit separator rather than a bare `startsWith`. Both arguments are
 * expected to be already base-resolved.
 */
export const isWithin = (pathname: string, target: string): boolean =>
  pathname === target || pathname.startsWith(`${target}/`);
