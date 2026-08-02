import { SITE_LOCALE, SITE_TIME_ZONE } from "./lib/time.ts";

/**
 * Single source of truth for site identity, navigation, and authored content.
 *
 * Kept deliberately separate from page markup: the GitHub profile README is a
 * second rendering target that cannot share this site's CSS, but it can and
 * should share these strings and URLs.
 */

export const site = {
  name: "Joe Fang",
  handle: "MinecraftFuns",
  url: "https://joefang.org",
  title: "Joe Fang",
  description:
    "Computer Science and Cognitive Science at the University of Toronto. Projects, writing, and CV.",
  locale: "en",
  /**
   * Re-exported so page code has one place to look for site settings. The
   * definition lives in lib/time.ts because the date primitives depend on it,
   * and this module depends on them.
   */
  timeZone: SITE_TIME_ZONE,
  dateLocale: SITE_LOCALE,
} as const;

export const nav = [
  { label: "Projects", href: "/projects" },
  { label: "Blog", href: "/blog" },
  { label: "About", href: "/about" },
] as const;

/**
 * Contact routes. Note the deliberate absence of a plaintext email address —
 * correspondence goes through the PGP Primary User ID, matching the existing
 * profile README.
 */
export const contact = {
  pgp: "https://joefang.org/pgp",
  pgpFingerprint: "1CA3 EB47 A7FC BCF9 F28D 4346 B522 8030 A919 B27A",
  matrix: "https://matrix.to/#/@multiset:matrix.org",
  github: "https://github.com/MinecraftFuns",
  twitter: "https://x.com/SerendipityArk",
} as const;

/**
 * `rel="me"` asserts "this profile is the same person as this site" and is what
 * Mastodon-style verification consumes. It belongs on identity profiles only —
 * a keyserver link is a document, not an identity, so the flag is per-link data
 * rather than a blanket attribute in the footer template.
 */
export type ElsewhereLink = {
  readonly label: string;
  readonly href: string;
  readonly isIdentity: boolean;
};

export const elsewhere: readonly ElsewhereLink[] = [
  { label: "GitHub", href: contact.github, isIdentity: true },
  { label: "Matrix", href: contact.matrix, isIdentity: true },
  { label: "Twitter", href: contact.twitter, isIdentity: true },
  { label: "PGP", href: contact.pgp, isIdentity: false },
];

/**
 * A closed sum. Previously `status?: "active" | "archived"`, which admitted
 * three representations for two states — `undefined` and `"active"` rendered
 * identically, so the model could not say which one an author meant. Making the
 * field required collapses that ambiguity.
 */
export type ProjectStatus = "active" | "archived";

/**
 * The three genuinely different things this section holds. They are not
 * interchangeable — an open-source contribution is someone else's project, a
 * research artifact supports a paper rather than standing alone, and a side
 * project is wholly owned. Grouping by this reads better than one flat list,
 * and a closed sum means a new kind cannot be added without deciding where it
 * belongs and what it is called.
 */
export type ProjectKind = "side-project" | "research" | "open-source";

export type Project = {
  readonly title: string;
  readonly description: string;
  /**
   * Absent when a project has no public link. This is incidental absence in a
   * single field, so `undefined` is the honest representation; promoting it to
   * a tagged union would add ceremony without forbidding any invalid state.
   */
  readonly href?: string;
  readonly year: string;
  /** Rendered as tags on the card. Keep to three or fewer. */
  readonly tags: readonly string[];
  readonly status: ProjectStatus;
  readonly kind: ProjectKind;
};

/**
 * Placeholder content — replace with real projects, or migrate to an Astro
 * content collection once the shape settles, in the way the blog already has.
 */
export const projects: readonly Project[] = [
  {
    title: "Project One",
    description:
      "A one- or two-sentence description of what this is and why it exists. Lead with the problem, not the stack.",
    href: "https://github.com/MinecraftFuns",
    year: "2026",
    tags: ["Rust", "Systems"],
    status: "active",
    kind: "side-project",
  },
  {
    title: "Project Two",
    description:
      "Cards hold a short abstract only. Detail belongs on the project page, where there is room to explain the interesting part.",
    href: "https://github.com/MinecraftFuns",
    year: "2025",
    tags: ["TypeScript", "Tooling"],
    status: "active",
    kind: "open-source",
  },
  {
    title: "Project Three",
    description:
      "A third card, so the grid demonstrates its three-up, two-up, and one-up states across breakpoints.",
    year: "2025",
    tags: ["Research"],
    status: "archived",
    kind: "research",
  },
];

