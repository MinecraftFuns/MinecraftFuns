import { deployments } from "../config/deployments.ts";
import type { DeploymentTargetConfig } from "../config/schema.ts";
import { assertNever, invalid, ok, type Parsed } from "./adt.ts";
import { currentBase, joinBase, joinRoute, slashTerminated } from "./url.ts";

/**
 * The deployment read model: which copy of the site this build is, and where
 * the authoritative copy lives.
 *
 * The rule this module exists to enforce is that **a page's canonical URL is a
 * property of the site, not of the build that emitted it**. Every build points
 * `rel="canonical"` at the canonical origin, so a crawler that reaches a
 * mirror is told, on that page, exactly which URL to index instead. Previously
 * each build canonicalised to *itself*, which is the one answer guaranteed to
 * be wrong on every target but one, and it meant the mirror advertised itself
 * as authoritative while separately asking not to be indexed: two signals,
 * derived independently, disagreeing.
 *
 * Pure and total. Nothing here reads the clock, the network, or the disk; the
 * one environment read is `BASE_URL`, which Astro fixes at build time.
 */

/**
 * Which copy this is.
 *
 * A closed sum rather than an `isCanonical` boolean. The boolean reads the
 * same at every call site whichever way it is set, and it was already spelled
 * three different ways (`isPrimary` in two modules and an origin comparison in
 * a third). A tag can be eliminated exhaustively, which is what the `switch`
 * statements downstream rely on.
 */
export type DeploymentRole = "canonical" | "mirror";

/**
 * The set of deployment names, derived from the config rather than declared
 * beside it.
 *
 * `"joefang-org" | "github-pages"` today, and it changes when
 * `config/deployments.ts` changes, so a name cannot exist in one place and not
 * the other. Each is also the name of the GitHub environment that deploys it,
 * which is what lets the workflow write `environment: ${{ matrix.id }}`.
 */
export type DeploymentId =
  | (typeof deployments.canonical)["id"]
  | (typeof deployments.mirrors)[number]["id"];

/**
 * A target with its role attached.
 *
 * The role is *derived* from the target's position in the config, never
 * authored, so it cannot disagree with the config. This is the payoff of
 * making `canonical` a field: the tag is a function of the structure.
 */
export type DeploymentTarget = DeploymentTargetConfig & {
  readonly id: DeploymentId;
  readonly role: DeploymentRole;
};

/* The parameter is narrowed to a *declared* id rather than any string, so this
   cannot mint a target naming a deployment the config does not contain. */
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
 * What `astro dev` and an unparameterised build assume.
 *
 * A mirror when one exists, because a based deployment is the *harder* URL
 * shape: a link written `href="/blog"` without going through `routeUrl` works
 * at the root and 404s beneath a base path, so defaulting to the root would
 * let that class of bug pass locally and fail only in production. Falling back
 * to the canonical target keeps this total when there are no mirrors.
 */
export const developmentTarget: DeploymentTarget =
  targets.find((target) => target.role === "mirror") ?? canonicalTarget;

/* Origins are compared through the URL parser rather than as strings, so host
   case and a default port normalise; bases are compared slash-terminated, so
   `/MinecraftFuns` and `/MinecraftFuns/` are the one value they denote. */
const sameOrigin = (a: string, b: string): boolean => {
  const parsed = URL.parse(a);
  const other = URL.parse(b);
  return parsed !== null && other !== null && parsed.origin === other.origin;
};

/**
 * Identify the deployment from the parameters a build was given.
 *
 * This is the parse-don't-validate boundary for `SITE_URL`/`SITE_BASE`: two
 * environment strings, which nothing has checked, become a `DeploymentTarget`
 * that downstream code may trust. An unrecognised pair is a build that no
 * declaration describes, so the error names the ones that exist rather than
 * guessing which was meant.
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
 * The active deployment, from Astro's own view of the build.
 *
 * `site` is threaded in rather than read here because `Astro.site` is only
 * available inside a component or endpoint; the base comes from `BASE_URL`,
 * which Astro injects everywhere. Returning `Parsed` keeps the absent case a
 * value rather than a thrown surprise; callers at a build boundary eliminate
 * it with `orThrow`, since a build that cannot say where it is deploying to
 * should not produce an artifact.
 */
export const activeTarget = (site: URL | undefined): Parsed<DeploymentTarget> =>
  site === undefined
    ? invalid("Astro.site is unset; astro.config.mjs must assign `site`")
    : findTarget(site.origin, currentBase());

/**
 * Strip a deployment's base from a pathname, yielding the site-relative route.
 *
 * The inverse of mounting, and the step the canonical URL cannot be computed
 * without: `/MinecraftFuns/blog/` on the mirror and `/blog/` on the canonical
 * origin are the same page, and only the site-relative form says so. A
 * pathname outside its own base is a contradiction rather than a route, so it
 * is rejected instead of being silently truncated.
 */
export const siteRelative = (base: string, pathname: string): Parsed<string> => {
  const mounted = slashTerminated(base);
  const within = slashTerminated(pathname);

  return within.startsWith(mounted)
    ? ok(`/${pathname.slice(mounted.length)}`)
    : invalid(`${pathname} is not beneath the deployment base ${mounted}`);
};

/**
 * The canonical URL of a page, wherever it was built.
 *
 * Composed rather than concatenated: the pathname is brought back to
 * site-relative form against the *active* base, then mounted on the canonical
 * base and resolved against the canonical origin. String surgery on the two
 * bases would be shorter and would be wrong whenever exactly one of them is
 * the root.
 */
export const canonicalHref = (
  target: DeploymentTarget,
  pathname: string,
): Parsed<string> => {
  const route = siteRelative(target.base, pathname);
  if (route.tag !== "ok") return route;

  const mounted = joinRoute(canonicalTarget.base, route.value);
  const url = URL.parse(mounted, canonicalTarget.origin);

  return url === null
    ? invalid(`cannot resolve ${mounted} against ${canonicalTarget.origin}`)
    : ok(url.href);
};

/** Where the canonical deployment publishes its sitemap. */
export const canonicalSitemapUrl = (): string =>
  new URL(joinBase(canonicalTarget.base, "/sitemap-index.xml"), canonicalTarget.origin)
    .href;

/**
 * Whether this deployment asks to be indexed.
 *
 * Total over the role, so adding a third kind of deployment is a compile error
 * here rather than a mirror that quietly starts competing with the canonical
 * copy in search results.
 */
export const indexable = (role: DeploymentRole): boolean => {
  switch (role) {
    case "canonical":
      return true;
    case "mirror":
      return false;
    default:
      return assertNever(role);
  }
};
