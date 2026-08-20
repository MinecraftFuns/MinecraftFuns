import type { HttpsUrl, RootedPath } from "../schema.ts";

/**
 * Base-aware links. Routes end in `/`; assets do not. WHATWG URL parsing owns
 * non-regular syntax, while one prefix case analysis protects base paths.
 */

declare const resolvedBrand: unique symbol;

/** Branded path obtainable only through base-aware resolvers. */
type ResolvedPath = string & { readonly [resolvedBrand]: true };

/** Base-resolved path or self-authoritative HTTPS URL. */
export type Href = ResolvedPath | HttpsUrl;

/** Reserved non-resolving origin used as a temporary mount base. */
const MOUNT_ORIGIN = "https://mount.invalid";

/** Regular by nature: a suffix of one repeated character. */
const TRAILING_SLASHES = /\/+$/;

/** Canonical slash-terminated route form for comparisons. */
export const slashTerminated = (path: string): string =>
  path.endsWith("/") ? path : `${path}/`;

/** Classify hrefs that base-prefixing would corrupt. */
export type HrefKind = "absolute" | "authority" | "fragment" | "site";

/** Delegate absolute-URL syntax to `URL.canParse`; handle authority and fragment prefixes directly. */
export const classifyHref = (href: string): HrefKind => {
  if (URL.canParse(href)) return "absolute";
  if (href.startsWith("//")) return "authority";
  if (href.startsWith("#")) return "fragment";
  return "site";
};

/** Prefix `path` beneath `base`; URL resolution would discard a rooted base path. */
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

/** Join a site path while preserving query and fragment placement. */
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

/** Read Astro's base, defaulting to `/` for plain Node tests. */
export const currentBase = (): string => {
  /* Only the environment object is optional; Astro supplies `BASE_URL` within it. */
  const env = import.meta.env as { readonly BASE_URL: string } | undefined;
  return env?.BASE_URL ?? "/";
};

/** Resolve a rooted page route against the deployment base. */
export const routeUrl = (path: RootedPath): Href =>
  joinRoute(currentBase(), path) as ResolvedPath;

/** Resolve an asset or host-directive path against the deployment base. */
export const assetUrl = (path: string): Href =>
  joinBase(currentBase(), path) as ResolvedPath;

/** Test route containment with separator-aware resolved path prefixes. */
export const isWithin = (pathname: string, target: string): boolean =>
  slashTerminated(pathname).startsWith(slashTerminated(target));
