import { deployments } from "../config/deployments.ts";
import type { DeploymentTargetConfig } from "../schema.ts";
import { andThen, invalid, ok, type Parsed } from "../prelude/adt.ts";
import { currentBase, joinBase, joinRoute, slashTerminated } from "./url.ts";

/** Deployment identity and canonical-origin policy; pure except for `BASE_URL`. */

/** Closed canonical/mirror sum, rather than a mutable boolean. */
export type DeploymentRole = "canonical" | "mirror";

/** Deployment IDs derived from config and used as GitHub environments. */
export type DeploymentId =
  (typeof deployments.canonical)["id"] | (typeof deployments.mirrors)[number]["id"];

/** Role derives from config position, never authored separately. */
export type DeploymentTarget = DeploymentTargetConfig & {
  readonly id: DeploymentId;
  readonly role: DeploymentRole;
};

/* Declared ID prevents constructing a target absent from config. */
const withRole = (
  target: DeploymentTargetConfig & { readonly id: DeploymentId },
  role: DeploymentRole,
): DeploymentTarget => ({ ...target, role });

export const canonicalTarget: DeploymentTarget = withRole(
  deployments.canonical,
  "canonical",
);

/** Canonical target first, then configured mirrors. */
export const targets: readonly DeploymentTarget[] = [
  canonicalTarget,
  ...deployments.mirrors.map((target) => withRole(target, "mirror")),
];

/** Development defaults to a based mirror so root-only links fail early. */
export const developmentTarget: DeploymentTarget =
  targets.find((target) => target.role === "mirror") ?? canonicalTarget;

/* URL parser normalizes host case and default ports. */
const sameOrigin = (a: string, b: string): boolean => {
  const parsed = URL.parse(a);
  const other = URL.parse(b);
  return parsed !== null && other !== null && parsed.origin === other.origin;
};

/** Parse environment values into a declared target; never guess unknown pairs. */
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

/** Unmount a pathname; reject paths outside the deployment base. */
export const siteRelative = (base: string, pathname: string): Parsed<string> => {
  const mounted = slashTerminated(base);
  const within = slashTerminated(pathname);

  return within.startsWith(mounted)
    ? ok(`/${pathname.slice(mounted.length)}`)
    : invalid(`${pathname} is not beneath the deployment base ${mounted}`);
};

/** Move an active-base path onto the canonical deployment without string surgery. */
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

/** Index policy is total over deployment roles; new roles require a decision. */
const INDEXABLE: Readonly<Record<DeploymentRole, boolean>> = {
  canonical: true,
  mirror: false,
};

export const indexable = (role: DeploymentRole): boolean => INDEXABLE[role];
