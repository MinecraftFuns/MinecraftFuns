/**
 * Single source of truth for site identity and navigation.
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

export type Project = {
  title: string;
  description: string;
  href?: string;
  year: string;
  /** Rendered as tags on the card. Keep to three or fewer. */
  tags: readonly string[];
  status?: "active" | "archived";
};

/**
 * Placeholder content — replace with real projects, or migrate to an Astro
 * content collection once the shape settles.
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
  title: string;
  description: string;
  href: string;
  date: string;
  readingTime: string;
};

export const recentPosts: readonly Post[] = [
  {
    title: "A representative post title, long enough to wrap on narrow screens",
    description:
      "The one-line standfirst that tells a reader whether this is for them.",
    href: "#",
    date: "2026-07-14",
    readingTime: "8 min",
  },
  {
    title: "Another post",
    description: "Rows stay dense and scannable; the list is not a card grid.",
    href: "#",
    date: "2026-06-02",
    readingTime: "5 min",
  },
];
