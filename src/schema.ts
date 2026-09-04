import type { NonEmpty } from "./prelude/adt.ts";

/**
 * What may be written in `src/config`, and nothing else.
 *
 * `config/` is the surface somebody edits, so it holds values and no
 * declarations. This file is the contract those values are checked against:
 * read it to learn what is allowed, and `config/` to learn what is set.
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
 * accepts `"/MinecraftFuns"`, which mounts every link one segment too high.
 */
export type BasePath = "/" | `/${string}/`;

/**
 * One place the site is published. No separate "provider" field: a second
 * identifier for one deployment is how a pipeline and a config come to
 * disagree about which deployment they mean.
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
 * "exactly one deployment is authoritative" is a property of the type. A list
 * of `{ canonical: boolean }` would admit both zero and two, and could only
 * report a mistake already made.
 */
export type DeploymentsConfig = {
  readonly canonical: DeploymentTargetConfig;
  readonly mirrors: readonly DeploymentTargetConfig[];
};

// ---------------------------------------------------------------------------
// Languages
// ---------------------------------------------------------------------------

/** Wording around a number. A pair, so there is exactly one insertion point. */
export type Affixed = { readonly before: string; readonly after: string };

/** "4 min read" in a header; "4 min" where a row must not wrap. */
export type ReadingTimeWording = {
  readonly full: Affixed;
  readonly compact: Affixed;
};

/**
 * One language the blog publishes in.
 *
 * `code` is the language's whole identity inside the site: the rendition
 * filename (`zh.md`), the URL segment (`/blog/YYYY/MM/slug/zh/`), and the
 * key everything else is looked up by. `Lowercase` because the code is a
 * path on a case-sensitive host and a filename on whatever the author runs:
 * one canonical casing, checked at compile time.
 *
 * `bcp47` is what the platform is told: `<html lang>` and `hreflang`. It
 * varies independently of the code, which is how the content can be
 * announced as "zh-Hans" while living at `/zh/`.
 */
export type LanguageConfig = {
  readonly code: Lowercase<string>;
  readonly bcp47: string;
  /** How the language names itself: the label a reader scans for. */
  readonly nativeName: string;
  /**
   * BCP 47 tag dates are formatted under on pages *in this language*: a
   * Chinese article renders 2020年1月25日 where an English one renders
   * "Jan 25, 2020". Varies independently of `bcp47`: "en" content can
   * follow "en-CA" date conventions.
   */
  readonly dateLocale: string;
  /** Phrased under this language, as `dateLocale` formats dates under it. */
  readonly readingTime: ReadingTimeWording;
};

/**
 * The order *is* the configuration: earlier is more preferred, and an
 * article's bare URL serves its best-preferred rendition. The head is the
 * site's own language, the one the chrome is written in. `NonEmpty`, so "a
 * site with no language" is unrepresentable, and no separate "default
 * language" field exists to disagree with the order.
 */
export type LanguagesConfig = NonEmpty<LanguageConfig>;

// ---------------------------------------------------------------------------
// Site
// ---------------------------------------------------------------------------

export type SiteConfig = {
  /** Shown as the brand, and used as the document title. */
  readonly name: string;
  /**
   * The editorial tail of the site description. Its first half, what is
   * studied and where, is derived from `StandingConfig` in `lib/identity.ts`,
   * so this holds only the words no other config states.
   *
   * No `handle` and no `dateLocale` here: the GitHub account lives once, in
   * `ContactConfig.profiles`, and date locales are per-language in
   * `LanguageConfig`.
   */
  readonly tagline: string;
  /**
   * Where the author writes from, as place parts, narrowest first; the hero
   * eyebrow shows them beside a globe. The author picks the granularity:
   * ["Hong Kong"] is complete on its own, and no part is ever a forced
   * political statement. Non-empty by type; the separator is rendering.
   *
   * Independent of `timeZone`: one is a fact about the author, the other
   * about how dates render, and they can legitimately diverge.
   */
  readonly location: NonEmpty<string>;
  /** IANA zone. Every date the site renders is read in it. */
  readonly timeZone: string;
};

/** A page's authored opening: the title, and the line under it. */
export type PageCopy = {
  readonly title: string;
  readonly lede: string;
};

/** A quotation with a verifiable source; `Epigraph.astro` renders it as given. */
export type EpigraphConfig = {
  readonly quote: string;
  readonly author: string;
  readonly source: { readonly href: HttpsUrl; readonly label: string };
};

/**
 * The home page's authored copy. `hero.lede` holds only the sentences that
 * follow the identity phrase; `lib/identity.ts` derives that phrase from
 * `StandingConfig`, so neither states a fact the other owns.
 */
export type HomeConfig = {
  readonly hero: PageCopy;
  readonly epigraph: EpigraphConfig;
};

/**
 * What every listing page carries above its rows. One value serves a
 * listing's page one and its numbered pages, which are separate route files:
 * any sentence written in both would be a sentence editable in one.
 */
export type ListIntroConfig = {
  readonly eyebrow: string;
  readonly heading: string;
  readonly lede: string;
  /** Accessible name for the list. */
  readonly label: string;
  /** Shown in place of rows when there are none. */
  readonly empty: string;
};

/** A listing's copy plus its meta description, worded around the site name. */
export type ListingPageConfig = {
  readonly intro: ListIntroConfig;
  readonly description: Affixed;
};

/** The projects page's copy; the description is worded around the site name. */
export type ProjectsPageConfig = {
  readonly copy: PageCopy;
  readonly description: Affixed;
};

/**
 * How eagerly the engine may load a page nobody has asked for yet. The four
 * values are the standard's own; naming them here keeps the config a leaf.
 */
export type Eagerness = "immediate" | "eager" | "moderate" | "conservative";

export type SpeculationConfig = { readonly eagerness: Eagerness };

/**
 * How the blog's listings are cut up.
 *
 * Both are whole numbers greater than zero, which a type cannot say and
 * `lib/paging.ts` and `lib/browse.ts` parse at import instead. They are here
 * rather than in a component because each is a value somebody might want to
 * change without reading code, which is what this directory is for.
 */
export type BlogConfig = {
  /** Posts per page. Page one keeps the listing's own URL. */
  readonly pageSize: number;
  /** Tags on the browse strip; the rest live on the tag directory page. */
  readonly tagPreview: number;
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

/**
 * Academic standing, as atoms, so no sentence about it is authored twice.
 *
 * Three surfaces phrase these facts three ways: the About page prose, the
 * education table, and the GitHub profile README. The first two derive their
 * copy from this record through `lib/identity.ts`. GitHub renders the README
 * from the repo with no build step, so `scripts/check-readme.ts` reconciles
 * it against this record instead.
 */
export type StandingConfig = {
  /** "fourth", as in "fourth-year". The value that actually drifts. */
  readonly ordinal: string;
  readonly institution: string;
  readonly majors: NonEmpty<string>;
  /** Absent when there is none; never an empty string. */
  readonly minor?: string;
};

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
 * A project, generic in the kind, so the shape lives here while the set of
 * kinds stays derived from the data. Naming the union here would add a second
 * place to declare a section, the drift `projectKinds` exists to prevent.
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
   * One field for two facts that could disagree: a range ending in the past
   * said the work had stopped while a status field said it had not. It also
   * removes the annual edit, since a live project's span runs to whatever
   * year it is read in.
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
 * common case; names differing only in case stay expressible, so the decoder
 * still checks. The union requires a rule to *do* something: as two
 * independent optionals, `{ path }` alone typechecked and did nothing.
 * `remove` is non-empty for the same reason.
 *
 * A type cannot say a `set` record has any keys, so `{ path, set: {} }` stays
 * expressible and the decoder keeps its check for that case.
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
