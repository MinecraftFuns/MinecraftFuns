import { deployments } from "../config/deployments.ts";
import type { DeploymentTargetConfig } from "../schema.ts";
import { andThen, invalid, ok, type Parsed } from "../prelude/adt.ts";
import { currentBase, joinBase, joinRoute, slashTerminated } from "./url.ts";

/** Deployment identity and canonical-origin policy; reads `BASE_URL`. */

/** Canonical or mirror; role controls indexability. */
export type DeploymentRole = "canonical" | "mirror";

/** ID derives from config and names the GitHub environment. */
export type DeploymentId =
  (typeof deployments.canonical)["id"] | (typeof deployments.mirrors)[number]["id"];

/** Role derives from config position. */
export type DeploymentTarget = DeploymentTargetConfig & {
  readonly id: DeploymentId;
  readonly role: DeploymentRole;
};

/* ID is limited to configured targets. */
const withRole = (
  target: DeploymentTargetConfig & { readonly id: DeploymentId },
  role: DeploymentRole,
): DeploymentTarget => ({ ...target, role });

export const canonicalTarget: DeploymentTarget = withRole(
  deployments.canonical,
  "canonical",
);

/** Canonical target precedes mirrors. */
export const targets: readonly DeploymentTarget[] = [
  canonicalTarget,
  ...deployments.mirrors.map((target) => withRole(target, "mirror")),
];

/** Development uses a mirror when available, exposing root-only link errors. */
export const developmentTarget: DeploymentTarget =
  targets.find((target) => target.role === "mirror") ?? canonicalTarget;

/* URL normalizes host case and default ports. */
const sameOrigin = (a: string, b: string): boolean => {
  const parsed = URL.parse(a);
  const other = URL.parse(b);
  return parsed !== null && other !== null && parsed.origin === other.origin;
};

/** Match environment origin/base to a declared target; never infer unknown pairs. */
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

/** Resolve active deployment; missing `Astro.site` is a build error. */
export const activeTarget = (site: URL | undefined): Parsed<DeploymentTarget> =>
  site === undefined
    ? invalid("Astro.site is unset; astro.config.ts must assign `site`")
    : findTarget(site.origin, currentBase());

/** Remove deployment base; reject paths outside it. */
export const siteRelative = (base: string, pathname: string): Parsed<string> => {
  const mounted = slashTerminated(base);
  const within = slashTerminated(pathname);

  return within.startsWith(mounted)
    ? ok(`/${pathname.slice(mounted.length)}`)
    : invalid(`${pathname} is not beneath the deployment base ${mounted}`);
};

/** Move an active-base route to the canonical deployment. */
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

/** Canonical sitemap URL. */
export const canonicalSitemapUrl = (): string =>
  new URL(joinBase(canonicalTarget.base, "/sitemap-index.xml"), canonicalTarget.origin)
    .href;

/** Every role has an explicit index policy. */
const INDEXABLE: Readonly<Record<DeploymentRole, boolean>> = {
  canonical: true,
  mirror: false,
};

export const indexable = (role: DeploymentRole): boolean => INDEXABLE[role];
