import { deployments } from "../config/deployments.ts";
import type { DeploymentTargetConfig } from "../config/schema.ts";
import { andThen, invalid, ok, type Parsed } from "./adt.ts";
import { currentBase, joinBase, joinRoute, slashTerminated } from "./url.ts";

/**
 * Which copy of the site this build is, and where the authoritative copy lives.
 *
 * The rule the module exists for: **a page's canonical URL is a property of
 * the site, not of the build that emitted it**. Every build points
 * `rel="canonical"` at the canonical origin, so a crawler reaching a mirror is
 * told on that page which URL to index instead.
 *
 * Pure and total; the one environment read is `BASE_URL`, fixed at build time.
 */

/** A tag rather than an `isCanonical` boolean, which reads the same however set. */
export type DeploymentRole = "canonical" | "mirror";

/**
 * The declared deployment names, derived from the config so a name cannot
 * exist in one place and not the other. Each is also the GitHub environment
 * that deploys it, which is what lets the workflow write
 * `environment: ${{ matrix.id }}`.
 */
export type DeploymentId =
  (typeof deployments.canonical)["id"] | (typeof deployments.mirrors)[number]["id"];

/** The role is derived from position in the config, never authored. */
export type DeploymentTarget = DeploymentTargetConfig & {
  readonly id: DeploymentId;
  readonly role: DeploymentRole;
};

/* Narrowed to a declared id, so this cannot mint a target naming a deployment
   the config does not contain. */
const withRole = (
  target: DeploymentTargetConfig & { readonly id: DeploymentId },
  role: DeploymentRole,
): DeploymentTarget => ({ ...target, role });

export const canonicalTarget: DeploymentTarget = withRole(
  deployments.canonical,
  "canonical",
);

/** Canonical first, then the mirrors in the order they are declared. */
export const targets: readonly DeploymentTarget[] = [
  canonicalTarget,
  ...deployments.mirrors.map((target) => withRole(target, "mirror")),
];

/**
 * What `astro dev` and an unparameterised build assume: a mirror when one
 * exists, because a based deployment is the harder URL shape. A link written
 * `href="/blog"` without going through `routeUrl` works at the root and 404s
 * beneath a base path, so defaulting to the root would hide that class of bug
 * until production.
 */
export const developmentTarget: DeploymentTarget =
  targets.find((target) => target.role === "mirror") ?? canonicalTarget;

/* Through the parser, so host case and a default port normalise. */
const sameOrigin = (a: string, b: string): boolean => {
  const parsed = URL.parse(a);
  const other = URL.parse(b);
  return parsed !== null && other !== null && parsed.origin === other.origin;
};

/**
 * The parse-don't-validate boundary for `SITE_URL`/`SITE_BASE`: two unchecked
 * environment strings become a target downstream code may trust. An
 * unrecognised pair names the declarations that exist rather than guessing
 * which was meant.
 */
export const findTarget = (origin: string, base: string): Parsed<DeploymentTarget> => {
  const wanted = slashTerminated(base);
  const found = targets.find(
    (target) =>
      sameOrigin(target.origin, origin) && slashTerminated(target.base) === wanted,
  );

  return found === undefined
    ? invalid(
        `no deployment declares ${origin} at ${wanted}; ` +
          `src/config/deployments.ts declares ${targets
            .map((target) => `${target.origin}${target.base}`)
            .join(", ")}`,
      )
    : ok(found);
};

/**
 * The active deployment. `site` is threaded in because `Astro.site` is only
 * available inside a component or endpoint. Callers at a build boundary
 * eliminate the `Parsed` with `orThrow`: a build that cannot say where it is
 * deploying to should not produce an artifact.
 */
export const activeTarget = (site: URL | undefined): Parsed<DeploymentTarget> =>
  site === undefined
    ? invalid("Astro.site is unset; astro.config.mjs must assign `site`")
    : findTarget(site.origin, currentBase());

/**
 * The inverse of mounting, and the step the canonical URL cannot be computed
 * without: `/MinecraftFuns/blog/` and `/blog/` are the same page, and only the
 * site-relative form says so. A pathname outside its own base is a
 * contradiction rather than a route, so it is rejected, not truncated.
 */
export const siteRelative = (base: string, pathname: string): Parsed<string> => {
  const mounted = slashTerminated(base);
  const within = slashTerminated(pathname);

  return within.startsWith(mounted)
    ? ok(`/${pathname.slice(mounted.length)}`)
    : invalid(`${pathname} is not beneath the deployment base ${mounted}`);
};

/**
 * The canonical URL of a page, wherever it was built: unmount from the active
 * base, mount on the canonical one, resolve. String surgery on the two bases
 * would be shorter and wrong whenever exactly one of them is the root.
 */
export const canonicalHref = (
  target: DeploymentTarget,
  pathname: string,
): Parsed<string> =>
  andThen(siteRelative(target.base, pathname), (route) => {
    const mounted = joinRoute(canonicalTarget.base, route);
    const url = URL.parse(mounted, canonicalTarget.origin);

    return url === null
      ? invalid(`cannot resolve ${mounted} against ${canonicalTarget.origin}`)
      : ok(url.href);
  });

/** Where the canonical deployment publishes its sitemap. */
export const canonicalSitemapUrl = (): string =>
  new URL(joinBase(canonicalTarget.base, "/sitemap-index.xml"), canonicalTarget.origin)
    .href;

/**
 * Whether this deployment asks to be indexed. A third kind of deployment is a
 * missing key here rather than a mirror that quietly competes with the
 * canonical copy in search results.
 */
const INDEXABLE: Readonly<Record<DeploymentRole, boolean>> = {
  canonical: true,
  mirror: false,
};

export const indexable = (role: DeploymentRole): boolean => INDEXABLE[role];
