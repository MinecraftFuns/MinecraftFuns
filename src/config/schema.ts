/**
 * The shape of this site's configuration.
 *
 * One module, deliberately: the answer to "what can I configure?" should be a
 * file rather than a search. It is a leaf: it declares types and nothing else,
 * so both the config data and the code that reads it can depend on it without
 * a cycle.
 *
 * Every config export is written `as const satisfies` one of these. That
 * combination is what makes config both checked and useful: `satisfies` reports
 * a missing or misspelled or wrongly-typed field, while `as const` keeps the
 * literal types that let a union like `ProjectKind` be *derived* from the data
 * rather than declared a second time beside it. Annotating with `:` instead
 * would check the shape and throw the literals away.
 */

// ---------------------------------------------------------------------------
// Shared vocabulary
// ---------------------------------------------------------------------------

/**
 * A site-relative path, checked at compile time.
 *
 * A template literal type is the cheapest possible parser: `"projects"` fails
 * to typecheck where `"/projects"` succeeds, with no smart constructor to call
 * and so no function call inside config. The runtime check in
 * `parsePathPattern` remains for callers that are not config, but nothing
 * written here can reach it.
 */
export type RootedPath = `/${string}`;

/** An absolute URL. Same technique; `http://` and bare hosts are rejected. */
export type HttpsUrl = `https://${string}`;

/** Anything that can be linked to, once resolved. */
export type Href = RootedPath | HttpsUrl;

/**
 * A labelled hyperlink. Nav items and profiles are both this, refined;
 * naming the shape once is what stops three near-identical records drifting
 * into three slightly different ones.
 */
export type Link = {
  readonly label: string;
  readonly href: string;
};

// ---------------------------------------------------------------------------
// Site
// ---------------------------------------------------------------------------

export type SiteConfig = {
  /** Shown as the brand, and used as the document title. */
  readonly name: string;
  /** GitHub account. Profile URLs are built from it; never repeat it. */
  readonly handle: string;
  /**
   * The origin this site is *canonically* published at. Distinct from the
   * origin a given build targets, which comes from SITE_URL and may be a
   * mirror; the two are compared to decide whether a build asks to be indexed.
   */
  readonly canonicalOrigin: HttpsUrl;
  readonly description: string;
  /** Document language, for `<html lang>`. */
  readonly locale: string;
  /** IANA zone. Every date the site renders is read in it. */
  readonly timeZone: string;
  /** BCP 47 tag used to format dates. Varies independently of the zone. */
  readonly dateLocale: string;
};

/** A nav entry is a `Link` whose target is known to be on this site. */
export type NavItem = Link & { readonly href: RootedPath };

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------

/**
 * Platforms this site knows how to build a URL for.
 *
 * Derived from the table in `lib/contact.ts` rather than listed here, so
 * teaching the site a new platform is one entry in one place.
 */
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
 * Statuses, mapped to the badge each one shows. `null` is "no badge", a
 * decision rather than a value that went missing.
 *
 * A record rather than a list, because nothing reads these in order and a list
 * forces every reader through a lookup that can miss. Keyed, the key type is
 * the set of keys, so `badgeFor` is total and the absent case it used to
 * coalesce away cannot arise.
 */
export type ProjectStatusConfig = Readonly<Record<string, string | null>>;

// ---------------------------------------------------------------------------
// Hosting
// ---------------------------------------------------------------------------

/**
 * Status codes the host honours, as a closed set rather than a number.
 *
 * The distinctions are load-bearing and easy to get wrong when the field is
 * typed `number`: 301 and 308 are permanent where 302, 303 and 307 are not,
 * 307 and 308 preserve the request method where the older codes historically
 * did not, and 200 is not a redirect at all; it rewrites in place.
 */
export type RedirectStatus = 200 | 301 | 302 | 303 | 307 | 308;

/** A redirect as written in config. `status` defaults to a permanent move. */
export type RedirectConfig = {
  readonly from: RootedPath;
  readonly to: Href;
  readonly status?: RedirectStatus;
};

/**
 * A header rule as written in config.
 *
 * `set` is a record rather than a list of pairs, which makes a repeated header
 * name unrepresentable in the common case: object keys are unique. Names
 * differing only in case remain expressible, so the decoder still checks.
 */
export type HeaderConfig = {
  readonly path: RootedPath;
  readonly set?: Readonly<Record<string, string>>;
  readonly remove?: readonly string[];
};

export type HostConfig = {
  readonly headers: readonly HeaderConfig[];
  readonly redirects: readonly RedirectConfig[];
};
