import {
  byRecency,
  isoDate,
  SITE_LOCALE,
  SITE_TIME_ZONE,
  type IsoDate,
} from "./lib/time.ts";

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
  { label: "Work", href: "/work" },
  { label: "Writing", href: "/writing" },
  { label: "CV", href: "/cv" },
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
};

/**
 * Placeholder content — replace with real projects, or migrate to an Astro
 * content collection once the shape settles. `parseIsoDate` and these types are
 * already the decoder that collection would reuse.
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
  },
  {
    title: "Project Two",
    description:
      "Cards hold a short abstract only. Detail belongs on the project page, where there is room to explain the interesting part.",
    href: "https://github.com/MinecraftFuns",
    year: "2025",
    tags: ["TypeScript", "Tooling"],
    status: "active",
  },
  {
    title: "Project Three",
    description:
      "A third card, so the grid demonstrates its three-up, two-up, and one-up states across breakpoints.",
    year: "2025",
    tags: ["Research"],
    status: "archived",
  },
];

export type Post = {
  readonly title: string;
  readonly description: string;
  readonly href: string;
  /** A calendar date, parsed at module load — a bad date fails the build. */
  readonly date: IsoDate;
  /**
   * Data, not presentation. The unit lives in the type name and the "min"
   * suffix is applied at the render edge, so a future locale change is one
   * formatter away rather than a rewrite of every content entry.
   */
  readonly readingMinutes: number;
};

/**
 * Authored in whatever order is convenient. Display order is *derived* below
 * rather than trusted, so a post added in the wrong place cannot silently
 * appear out of sequence.
 */
const authoredPosts: readonly Post[] = [
  {
    title: "A representative post title, long enough to wrap on narrow screens",
    description:
      "The one-line standfirst that tells a reader whether this is for them.",
    href: "#",
    date: isoDate("2026-07-14"),
    readingMinutes: 8,
  },
  {
    title: "Another post",
    description: "Rows stay dense and scannable; the list is not a card grid.",
    href: "#",
    date: isoDate("2026-06-02"),
    readingMinutes: 5,
  },
];

/**
 * `toSorted` rather than `sort`: the input is `readonly` and shared, and an
 * in-place sort would mutate it for every other consumer. The immutable array
 * methods have been Baseline widely available since 2023.
 */
export const recentPosts: readonly Post[] = byRecency(authoredPosts);
