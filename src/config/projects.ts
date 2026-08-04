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
    blurb: "Artifacts and code supporting research work.",
  },
  {
    kind: "open-source",
    heading: "Open source",
    blurb: "Contributions to projects maintained by other people.",
  },
] as const satisfies readonly ProjectKindConfig[];

export type ProjectKind = (typeof projectKinds)[number]["kind"];

/* The shape is in `schema.ts`; only the set of kinds is derived from the data
   above, and that derivation is what keeps this file to one place per fact. */
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
      "Configuration and scripts served from a URL that never moves, filled in per caller and versioned so any revision is restorable. A Gist serves stale content after an edit; here a write evicts the cache, and a route id nobody minted never reaches the database.",
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
      "Opening an email should not tell the sender you opened it. Remote images are blocked by default, and the ones you allow go through a WARP tunnel the app builds itself in Rust, rather than a proxy that would do the logging instead.",
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
      "Short links that outlive what they point at: destinations are edited in place, and every earlier one stays restorable. Deletion is refused by a database trigger rather than by code that has to remember.",
    href: "https://github.com/BTreeMap/Lynx",
    since: 2025,
    until: null,
    tags: ["Rust", "OAuth", "Self-hosted"],
    kind: "side-project",
  },
  {
    title: "h4ckath0n",
    description:
      "A weekend team spends its first hours on login and ships a password table nobody would defend on Monday. This starts past both: passkeys by default, and roles the server decides rather than the token.",
    href: "https://github.com/BTreeMap/h4ckath0n",
    since: 2025,
    until: null,
    tags: ["Python", "FastAPI", "WebAuthn"],
    kind: "side-project",
  },
  {
    title: "Dockerfiles",
    description:
      "Self-hosted software rots quietly: the container running today is whatever its dependencies were the day it was built. These rebuild twice daily on a pipeline where workers steal from their peers once they run dry, so nothing waits behind the slowest shard.",
    href: "https://github.com/BTreeMap/Dockerfiles",
    since: 2024,
    until: null,
    tags: ["Docker", "GitHub Actions", "Self-hosted"],
    kind: "side-project",
  },
  {
    title: "SKILLs",
    description:
      "An agent is only as consistent as the procedure it is handed, and one pasted into a single repository does not travel. These are Markdown that names no project, written once and read everywhere, this site included.",
    href: "https://github.com/BTreeMap/SKILLs",
    since: 2026,
    until: null,
    tags: ["Agents", "Markdown", "Tooling"],
    kind: "side-project",
  },
  {
    title: "safeTO",
    description:
      "People ask whether an address is safe before signing a lease, and an incident count answers badly: it punishes density and says nothing about what comes next. A Poisson fit over Toronto Police data answers with a probability instead.",
    href: "https://github.com/CSC207-2024/safeTO",
    since: 2024,
    until: 2025,
    tags: ["Java", "React", "CSC207"],
    kind: "side-project",
  },
  {
    title: "PromptPipe",
    description:
      "Behavioural studies fail on delivery more often than on design: missed prompts, silent dropout, answers that never arrive. PromptPipe reaches participants on WhatsApp, where they already are, and counts what was delivered apart from what was answered.",
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
      "An interaction shown to work in a study's own editor has not been shown to work anywhere. This carries the CHI 2024 ABScribe interface into Gmail, LinkedIn, and Reddit, which strip any markup they did not author, so a variant's identity rides inside the text as zero-width characters.",
    href: "https://github.com/BTreeMap/ABScribeX",
    since: 2024,
    until: null,
    tags: ["TypeScript", "Chrome extension", "Human-AI writing"],
    kind: "research",
  },
  {
    title: "Focus Flow",
    description:
      "Every nudge stops working once you have seen it enough times, which is why most screen-time apps fade in a week. Focus Flow keeps choosing: prompts are weighted by measured success under a cooldown, so an early winner cannot crowd out the untried.",
    href: "https://github.com/Jai0212/Focus-Flow",
    since: 2024,
    until: 2025,
    tags: ["Kotlin", "Firebase", "HCI"],
    kind: "research",
  },
  {
    title: "ebpf-docs",
    description:
      "Reference examples get copied verbatim, and a reversed bit shift compiles, runs, and prints plausible numbers. The kernel puts tgid in the high 32 bits and pid in the low ones; the documented example had them the other way round, as did the uid/gid page beside it.",
    href: "https://github.com/isovalent/ebpf-docs/commit/7546bcb3f713f3b091869178942a7c51395b8760",
    since: 2025,
    until: 2025,
    tags: ["eBPF", "Linux", "Documentation"],
    kind: "open-source",
  },
  {
    title: "Tailscale",
    description:
      "An address meant never to leave the device was leaving it: Android probes its resolver on port 853, netstack answered only on 53, and the rest fell through to the exit node's default route. The client logged it out, the exit node logged it refused; fixed upstream eight days later.",
    href: "https://github.com/tailscale/tailscale/issues/19421",
    since: 2026,
    until: 2026,
    tags: ["Networking", "DNS", "Bug report"],
    kind: "open-source",
  },
];
