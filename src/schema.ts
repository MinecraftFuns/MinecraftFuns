import type { NonEmpty } from "./prelude/adt.ts";

/**
 * What may be written in `src/config`, and nothing else.
 *
 * Outside that directory on purpose. `config/` is the surface somebody edits,
 * so it holds values and no declarations; this file is the contract those
 * values are checked against, which is read when you want to know what is
 * allowed rather than what is set.
 *
 * Every config export is written `as const satisfies` one of these: `satisfies`
 * reports a missing or misspelled field, while `as const` keeps the literal
 * types that let a union like `ProjectKind` be *derived* from the data. A `:`
 * annotation would check the shape and throw the literals away.
 */

// ---------------------------------------------------------------------------
// Shared vocabulary
// ---------------------------------------------------------------------------

/**
 * A site-relative path, checked at compile time. A template literal type is
 * the cheapest possible parser: `"projects"` fails to typecheck where
 * `"/projects"` succeeds, with no smart constructor to call from config.
 */
export type RootedPath = `/${string}`;

/** An absolute URL. Same technique; `http://` and bare hosts are rejected. */
export type HttpsUrl = `https://${string}`;

/**
 * A redirect destination as written in config: a path on this site, or a URL
 * leaving it. Distinct from `lib/url.ts`'s `Href`, which is the *resolved*
 * form; this one is still site-relative and has not met a base path yet.
 */
export type RedirectTarget = RootedPath | HttpsUrl;

// ---------------------------------------------------------------------------
// Deployments
// ---------------------------------------------------------------------------

/**
 * A base path: rooted and slash-terminated.
 *
 * Two alternatives, because the root is the case a single pattern gets wrong.
 * `` `/${string}/` `` needs two characters and rejects `"/"`; `` `/${string}` ``
 * accepts `"/MinecraftFuns"` without its trailing slash, which is exactly the
 * value that mounts every link one segment too high.
 */
export type BasePath = "/" | `/${string}/`;

/**
 * One place the site is published. No separate "provider" field: a deployment
 * has one name, and a second identifier for the same thing is how a pipeline
 * and a config come to disagree about which deployment they mean.
 */
export type DeploymentTargetConfig = {
  /** Must match the GitHub environment of the same name, which is what makes
   *  `environment: ${{ matrix.id }}` correct rather than a coincidence. */
  readonly id: string;
  readonly origin: HttpsUrl;
  readonly base: BasePath;
};

/**
 * Every place this site is published, and which one is authoritative.
 *
 * The canonical target is a *field*, not a flagged member of a list, so
 * "exactly one deployment is authoritative" is a property of the type rather
 * than an invariant a validator defends. A list of `{ canonical: boolean }`
 * would admit both zero and two, and could only report a mistake already made.
 */
export type DeploymentsConfig = {
  readonly canonical: DeploymentTargetConfig;
  readonly mirrors: readonly DeploymentTargetConfig[];
};

// ---------------------------------------------------------------------------
// Site
// ---------------------------------------------------------------------------

export type SiteConfig = {
  /** Shown as the brand, and used as the document title. */
  readonly name: string;
  /** GitHub account. Profile URLs are built from it; never repeat it. */
  readonly handle: string;
  readonly description: string;
  /** Document language, for `<html lang>`. */
  readonly locale: string;
  /** IANA zone. Every date the site renders is read in it. */
  readonly timeZone: string;
  /** BCP 47 tag used to format dates. Varies independently of the zone. */
  readonly dateLocale: string;
};

/**
 * A nav entry. The target is written site-relative and *unresolved*: the
 * header mounts it on the deployment's base, which is why this is a
 * `RootedPath` and not a `lib/url.ts` `Href`.
 */
export type NavItem = {
  readonly label: string;
  readonly href: RootedPath;
};

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------

/** Derived from the table in `lib/contact.ts`, so a new platform is one entry. */
export type PlatformName = "github" | "matrix" | "twitter";

/** A handle on a platform. The label and URL shape belong to the platform. */
export type ProfileConfig = {
  readonly platform: PlatformName;
  readonly handle: string;
};

export type ContactConfig = {
  /** The domain whose addresses this site publishes keys for. */
  readonly mailDomain: string;
  readonly profiles: readonly ProfileConfig[];
};

// ---------------------------------------------------------------------------
// About
// ---------------------------------------------------------------------------

export type EducationEntry = {
  readonly institution: string;
  readonly credential: string;
  /** A second line, where there is one to add. */
  readonly detail?: string;
  /** Shown in the left column: a year, a range, or a stage. */
  readonly period: string;
};

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

/** A section of the projects page. Order is the order these are written in. */
export type ProjectKindConfig = {
  readonly kind: string;
  readonly heading: string;
  readonly blurb: string;
};

/**
 * A project, generic in the kind so that the shape can live here while the set
 * of kinds stays derived from the data. Naming the union here instead would be
 * a second place to add a section, which is the drift `projectKinds` exists to
 * prevent; instantiating it beside the data costs one line.
 */
export type ProjectConfig<Kind extends string> = {
  readonly title: string;
  readonly description: string;
  /** A project nobody can look at is a claim; every card is a link. */
  readonly href: HttpsUrl;
  /** The year work started. */
  readonly since: number;
  /**
   * The year work stopped, or `null` while it continues.
   *
   * One field for two facts that were separately authored and could disagree:
   * a range ending in the past said the work had stopped while a status field
   * said it had not. It also removes the annual edit, since a live project's
   * span runs to whatever year it is read in.
   */
  readonly until: number | null;
  /** Non-empty, because an empty list renders an empty element. No ceiling:
   *  the card wraps, so a fourth tag is an editorial call, not a defect. */
  readonly tags: NonEmpty<string>;
  readonly kind: Kind;
  /**
   * Shown on the home page. `true` rather than `boolean`: absence is the
   * negative, so there is no `featured: false` to read as a considered decision.
   */
  readonly featured?: true;
};

// ---------------------------------------------------------------------------
// Hosting
// ---------------------------------------------------------------------------

/**
 * Status codes the host honours, as a closed set rather than a number. The
 * distinctions are load-bearing: 301 and 308 are permanent where 302, 303 and
 * 307 are not, 307 and 308 preserve the request method where the older codes
 * historically did not, and 200 is not a redirect at all but a rewrite.
 */
export type RedirectStatus = 200 | 301 | 302 | 303 | 307 | 308;

/** A redirect as written in config. `status` defaults to a permanent move. */
export type RedirectConfig = {
  readonly from: RootedPath;
  readonly to: RedirectTarget;
  readonly status?: RedirectStatus;
};

/**
 * A header rule as written in config.
 *
 * `set` is a record, so a repeated header name is unrepresentable in the
 * common case; names differing only in case remain expressible, so the decoder
 * still checks. The union is what requires a rule to *do* something: as two
 * independent optionals, `{ path }` alone typechecked and did nothing.
 * `remove` is non-empty for the same reason.
 *
 * A type cannot say that a `set` record has any keys, so `{ path, set: {} }`
 * stays expressible and the decoder keeps its check for exactly that case.
 */
export type HeaderConfig = { readonly path: RootedPath } & (
  | {
      readonly set: Readonly<Record<string, string>>;
      readonly remove?: NonEmpty<string>;
    }
  | {
      readonly set?: Readonly<Record<string, string>>;
      readonly remove: NonEmpty<string>;
    }
);

export type HostConfig = {
  readonly headers: readonly HeaderConfig[];
  readonly redirects: readonly RedirectConfig[];
};
