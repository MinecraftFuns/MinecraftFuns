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
 * Statuses and the badge each one shows. `null` means "no badge": a decision,
 * not a value that went missing. Derived the same way, so the union and the
 * labels cannot disagree.
 */
export const projectStatuses = [
  { status: "active", badge: null },
  { status: "archived", badge: "Archived" },
] as const satisfies readonly ProjectStatusConfig[];

export type ProjectStatus = (typeof projectStatuses)[number]["status"];

export type Project = {
  readonly title: string;
  readonly description: string;
  /** Absent when a project has no public link. */
  readonly href?: string;
  readonly year: string;
  /** Rendered as tags on the card. Keep to three or fewer. */
  readonly tags: readonly string[];
  readonly status: ProjectStatus;
  readonly kind: ProjectKind;
};

/** Placeholder content; replace with real projects. */
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
