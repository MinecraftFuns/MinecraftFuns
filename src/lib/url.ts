import type { HttpsUrl, RootedPath } from "../schema.ts";

/** Base-aware links; routes end in `/`, assets do not. */

declare const resolvedBrand: unique symbol;

/** Path produced by a base-aware resolver. */
type ResolvedPath = string & { readonly [resolvedBrand]: true };

/** Base-resolved path or authoritative HTTPS URL. */
export type Href = ResolvedPath | HttpsUrl;

/** Non-resolving origin used for temporary URL mounting. */
const MOUNT_ORIGIN = "https://mount.invalid";

/** Trailing slash run. */
const TRAILING_SLASHES = /\/+$/;

/** Canonical slash-terminated route. */
export const slashTerminated = (path: string): string =>
  path.endsWith("/") ? path : `${path}/`;

/** Classify hrefs that base-prefixing must not touch. */
export type HrefKind = "absolute" | "authority" | "fragment" | "site";

/** Use `URL.canParse`; classify authority and fragment prefixes separately. */
export const classifyHref = (href: string): HrefKind => {
  if (URL.canParse(href)) return "absolute";
  if (href.startsWith("//")) return "authority";
  if (href.startsWith("#")) return "fragment";
  return "site";
};

/** Mount `path` beneath `base` without discarding a rooted base path. */
const mount = (base: string, path: string): URL => {
  const root = new URL(`${base.replace(TRAILING_SLASHES, "")}/`, MOUNT_ORIGIN);
  return new URL(path.startsWith("/") ? path.slice(1) : path, root);
};

/** Route/asset termination policy. */
type Target = "route" | "asset";

const TERMINATE: Readonly<Record<Target, (pathname: string) => string>> = {
  route: slashTerminated,
  asset: (pathname) => pathname,
};

/** Join site path while preserving query and fragment. */
const join = (base: string, path: string, target: Target): string => {
  if (classifyHref(path) !== "site") return path;

  const url = mount(base, path);
  return `${TERMINATE[target](url.pathname)}${url.search}${url.hash}`;
};

/** Join file path to base without a trailing slash. */
export const joinBase = (base: string, path: string): string => join(base, path, "asset");

/** Join page route to base with a trailing slash. */
export const joinRoute = (base: string, path: string): string =>
  join(base, path, "route");

/** Read Astro base; default to `/` in plain Node tests. */
export const currentBase = (): string => {
  /* Astro supplies `BASE_URL` inside optional `import.meta.env`. */
  const env = import.meta.env as { readonly BASE_URL: string } | undefined;
  return env?.BASE_URL ?? "/";
};

/** Resolve page route against deployment base. */
export const routeUrl = (path: RootedPath): Href =>
  joinRoute(currentBase(), path) as ResolvedPath;

/** Resolve asset or host-directive path against deployment base. */
export const assetUrl = (path: string): Href =>
  joinBase(currentBase(), path) as ResolvedPath;

/** Test route containment with separator-aware prefixes. */
export const isWithin = (pathname: string, target: string): boolean =>
  slashTerminated(pathname).startsWith(slashTerminated(target));
