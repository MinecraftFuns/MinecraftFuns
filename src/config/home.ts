import type { HomeConfig } from "../schema.ts";

/**
 * The home page's authored copy: the hero, and the epigraph under it.
 *
 * `hero.lede` carries only the sentences after the identity phrase, which
 * `lib/identity.ts` derives from `StandingConfig`; changing a major there
 * changes the hero without an edit here.
 */
export const home = {
  hero: {
    title: "Research, projects, and essays from shower thoughts.",
    lede: "I build private networks, self-hosted services, and privacy tooling. The blog is for findings, know-how, and the occasional rant.",
  },
  epigraph: {
    quote:
      "Freedom is the freedom to say that two plus two make four. If that is granted, all else follows.",
    author: "George Orwell",
    source: {
      href: "https://en.wikipedia.org/wiki/Nineteen_Eighty-Four",
      label: "Nineteen Eighty-Four",
    },
  },
} as const satisfies HomeConfig;
