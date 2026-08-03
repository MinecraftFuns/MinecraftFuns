import type { ProjectKindConfig, ProjectStatusConfig } from "./schema.ts";

/**
 * Projects, and the sections they group into.
 *
 * `projectKinds` is the single source for the order sections appear in *and*
 * their headings and blurbs. Those used to be three parallel declarations: an
 * order array that had to list exactly the keys of two separate records, which
 * is three knobs describing one thing. `ProjectKind` is derived from this
 * array, so adding a kind here is the entire change, and a project naming a
 * kind that does not exist is a type error rather than an unlabelled group.
 */
export const projectKinds = [
  {
    kind: "side-project",
    heading: "Side projects",
    blurb: "Things I built because I wanted them to exist.",
  },
  {
    kind: "research",
    heading: "Research",
    blurb: "Artifacts and code supporting research work.",
  },
  {
    kind: "open-source",
    heading: "Open source",
    blurb: "Contributions to projects maintained by other people.",
  },
] as const satisfies readonly ProjectKindConfig[];

export type ProjectKind = (typeof projectKinds)[number]["kind"];

/**
 * The badge each status shows. `null` means "no badge": a decision, not a
 * value that went missing. Add a status by adding a key.
 */
export const projectStatuses = {
  active: null,
  archived: "Archived",
} as const satisfies ProjectStatusConfig;

export type ProjectStatus = keyof typeof projectStatuses;

export type Project = {
  readonly title: string;
  readonly description: string;
  /** Absent when a project has no public link. */
  readonly href?: string;
  /** A year, or a range when the work spans one. */
  readonly year: string;
  /** Rendered as tags on the card. Keep to three or fewer. */
  readonly tags: readonly string[];
  readonly status: ProjectStatus;
  readonly kind: ProjectKind;
  /**
   * Shown on the home page. `true` rather than `boolean`: absence is the
   * negative, so there is no `featured: false` to read as a considered decision.
   */
  readonly featured?: true;
};

/**
 * Order within a section is the order written here; sections come from
 * `projectKinds`. `status` tracks GitHub's archive flag, not dormancy.
 */
export const projects: readonly Project[] = [
  {
    title: "Serval",
    description:
      "Stores a templated config once, keyed by content hash, and serves it at the edge with query-parameter substitution. Route ids carry a keyed MAC, so a forged one is rejected before any cache or database lookup.",
    href: "https://github.com/BTreeMap/Serval",
    year: "2026",
    tags: ["Rust", "PostgreSQL", "Content-addressed"],
    status: "active",
    kind: "side-project",
    featured: true,
  },
  {
    title: "Letterbox",
    description:
      "An Android reader for .eml files that parses them in a Rust core over UniFFI. Remote images are blocked by default and otherwise fetched through a WARP proxy, so opening a message does not report back to its sender.",
    href: "https://github.com/BTreeMap/Letterbox",
    year: "2025–2026",
    tags: ["Kotlin", "Rust", "Android"],
    status: "active",
    kind: "side-project",
    featured: true,
  },
  {
    title: "Lynx",
    description:
      "A URL shortener split into two servers so the public redirector holds read-only database access. Destinations are versioned in place rather than deleted, and every prior one stays restorable.",
    href: "https://github.com/BTreeMap/Lynx",
    year: "2025–2026",
    tags: ["Rust", "OAuth", "Self-hosted"],
    status: "active",
    kind: "side-project",
  },
  {
    title: "h4ckath0n",
    description:
      "A FastAPI scaffold whose authentication is already right: passkeys by default, device-signed ES256 tokens, and server-side RBAC, so a weekend build never grows a password table.",
    href: "https://github.com/BTreeMap/h4ckath0n",
    year: "2025–2026",
    tags: ["Python", "FastAPI", "WebAuthn"],
    status: "active",
    kind: "side-project",
  },
  {
    title: "Dockerfiles",
    description:
      "Container images for the things I self-host, from remote desktops to Tailscale variants, rebuilt twice a day so a running deployment tracks upstream rather than the day it was first built.",
    href: "https://github.com/BTreeMap/Dockerfiles",
    year: "2024–2026",
    tags: ["Docker", "GitHub Actions", "Self-hosted"],
    status: "active",
    kind: "side-project",
  },
  {
    title: "SKILLs",
    description:
      "A library of Markdown procedures for coding agents, kept free of any one project's identity so the same skill works in unrelated repositories. This site consumes it as a submodule.",
    href: "https://github.com/BTreeMap/SKILLs",
    year: "2026",
    tags: ["Agents", "Markdown", "Tooling"],
    status: "active",
    kind: "side-project",
  },
  {
    title: "safeTO",
    description:
      "A CSC207 team project. Aggregates Toronto Police major-crime data and fits a Poisson model per location, so asking whether an address is safe returns a probability over a radius rather than a raw incident count.",
    href: "https://github.com/CSC207-2024/safeTO",
    year: "2024–2025",
    tags: ["Java", "React", "CSC207"],
    status: "archived",
    kind: "side-project",
  },
  {
    title: "PromptPipe",
    description:
      "Delivers adaptive-intervention prompts over WhatsApp for behavioural research: scheduling, receipt and response tracking, and a stateful intake and feedback conversation behind one REST API.",
    href: "https://github.com/BTreeMap/PromptPipe",
    year: "2025–2026",
    tags: ["Go", "WhatsApp", "Study infrastructure"],
    status: "active",
    kind: "research",
    featured: true,
  },
  {
    title: "ABScribeX",
    description:
      "Carries the CHI 2024 ABScribe interface, in-place variation fields and reusable AI modifiers, into editors never built for it: Gmail, LinkedIn, Reddit.",
    href: "https://github.com/BTreeMap/ABScribeX",
    year: "2024–2026",
    tags: ["TypeScript", "Chrome extension", "Human-AI writing"],
    status: "active",
    kind: "research",
  },
  {
    title: "Focus Flow",
    description:
      "An Android app that interrupts an impulsive app launch with a prompt, and treats which prompt to show as a selection problem: success rates weighted by a decay term, so one early winner cannot crowd out the rest.",
    href: "https://github.com/Jai0212/Focus-Flow",
    year: "2024–2025",
    tags: ["Kotlin", "Firebase", "HCI"],
    status: "archived",
    kind: "research",
  },
];
