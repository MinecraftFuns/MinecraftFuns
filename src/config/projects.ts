import type { ProjectConfig, ProjectKindConfig } from "../schema.ts";

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
    blurb: "Code and artifacts from work in the labs.",
  },
  {
    kind: "open-source",
    heading: "Open source",
    blurb: "Contributions to projects maintained by other people.",
  },
] as const satisfies readonly ProjectKindConfig[];

export type ProjectKind = (typeof projectKinds)[number]["kind"];

/* Schema owns shape; kinds derive from the data above. */
export type Project = ProjectConfig<ProjectKind>;

/**
 * Order within a section is the order written here; sections come from
 * `projectKinds`. A non-null `until` is the year the repository was archived.
 *
 * `lib/projects.ts` re-exports this list having checked that no project ends
 * before it starts, which is the one thing about a span a type cannot say.
 */
export const authoredProjects: readonly Project[] = [
  {
    title: "Serval",
    description:
      "Configuration and scripts served from a URL that never moves, filled in per caller. Every revision is kept and any of them can be restored, and unlike a Gist, an edit evicts the cache instead of serving stale content.",
    href: "https://github.com/BTreeMap/Serval",
    since: 2026,
    until: null,
    tags: ["Rust", "PostgreSQL", "Content-addressed"],
    kind: "side-project",
    featured: true,
  },
  {
    title: "Letterbox",
    description:
      "An Android mail client that does not tell the sender you opened their email. Remote images are blocked by default, and the ones you allow are fetched through a WARP tunnel the app builds itself in Rust, so no proxy operator is doing the logging either.",
    href: "https://github.com/BTreeMap/Letterbox",
    since: 2025,
    until: null,
    tags: ["Kotlin", "Rust", "Android"],
    kind: "side-project",
    featured: true,
  },
  {
    title: "Lynx",
    description:
      "A self-hosted short-link service whose links outlive what they point at. Destinations are edited in place and every earlier one stays restorable; deletion is refused by a database trigger rather than by code that has to remember.",
    href: "https://github.com/BTreeMap/Lynx",
    since: 2025,
    until: null,
    tags: ["Rust", "OAuth", "Self-hosted"],
    kind: "side-project",
  },
  {
    title: "h4ckath0n",
    description:
      "A hackathon starter kit that begins past the login screen, so a weekend team does not spend its first hours on authentication. Passkeys by default, and roles the server decides rather than the token.",
    href: "https://github.com/BTreeMap/h4ckath0n",
    since: 2025,
    until: null,
    tags: ["Python", "FastAPI", "WebAuthn"],
    kind: "side-project",
  },
  {
    title: "Dockerfiles",
    description:
      "Container images for the software I self-host, rebuilt twice a day so nothing runs for months on whatever its dependencies were the day it was built. Workers steal jobs from their peers once they run dry, so nothing waits behind the slowest shard.",
    href: "https://github.com/BTreeMap/Dockerfiles",
    since: 2024,
    until: null,
    tags: ["Docker", "GitHub Actions", "Self-hosted"],
    kind: "side-project",
  },
  {
    title: "SKILLs",
    description:
      "Reusable procedures for coding agents, written as Markdown that names no particular project, so the same file works in any repository. This site is one of the repositories that reads them.",
    href: "https://github.com/BTreeMap/SKILLs",
    since: 2026,
    until: null,
    tags: ["Agents", "Markdown", "Tooling"],
    kind: "side-project",
  },
  {
    title: "safeTO",
    description:
      "A safety lookup for Toronto addresses, built for CSC207. A Poisson fit over Toronto Police data reports the chance of an incident rather than a raw count, which mostly measures how many people live nearby.",
    href: "https://github.com/CSC207-2024/safeTO",
    since: 2024,
    until: 2025,
    tags: ["Java", "React", "CSC207"],
    kind: "side-project",
  },
  {
    title: "PromptPipe",
    description:
      "Messaging infrastructure for behavioral studies, reaching participants on WhatsApp rather than in an app they would have to install. Delivery is recorded separately from responses, so a prompt that never arrived is distinguishable from one nobody answered.",
    href: "https://github.com/BTreeMap/PromptPipe",
    since: 2025,
    until: null,
    tags: ["Go", "WhatsApp", "Study infrastructure"],
    kind: "research",
    featured: true,
  },
  {
    title: "ABScribeX",
    description:
      "A Chrome extension that carries the CHI 2024 ABScribe writing interface into Gmail, LinkedIn, and Reddit. Those editors strip any markup they did not author, so each variant carries its identity inside the text itself, as zero-width characters.",
    href: "https://github.com/BTreeMap/ABScribeX",
    since: 2024,
    until: null,
    tags: ["TypeScript", "Chrome extension", "Human-AI writing"],
    kind: "research",
  },
  {
    title: "Focus Flow",
    description:
      "An Android wellbeing app that keeps choosing which nudge to show rather than settling on one. Prompts are weighted by how well they have worked, under a cooldown that stops an early winner from crowding out the ones not yet tried.",
    href: "https://github.com/Jai0212/Focus-Flow",
    since: 2024,
    until: 2025,
    tags: ["Kotlin", "Firebase", "HCI"],
    kind: "research",
  },
  {
    title: "ebpf-docs",
    description:
      "A documentation fix. The reference example had tgid and pid the wrong way round, as did the uid/gid page beside it: the kernel puts tgid in the high 32 bits, and the reversed shift still compiles and prints plausible numbers.",
    href: "https://github.com/isovalent/ebpf-docs/commit/7546bcb3f713f3b091869178942a7c51395b8760",
    since: 2025,
    until: 2025,
    tags: ["eBPF", "Linux", "Documentation"],
    kind: "open-source",
  },
  {
    title: "Tailscale",
    description:
      "A bug report. Android probes its DNS resolver on port 853, the Tailscale netstack answered only on 53, and the rest fell through to the exit node's default route, sending queries somewhere they were never meant to go. Fixed upstream.",
    href: "https://github.com/tailscale/tailscale/issues/19421",
    since: 2026,
    until: 2026,
    tags: ["Networking", "DNS", "Bug report"],
    kind: "open-source",
  },
];
