import type { NavItem, RootedPath, SiteConfig } from "../schema.ts";

/**
 * Site identity.
 *
 * Config is a leaf: it imports nothing but types, holds no function calls, and
 * knows nothing about how any of it is rendered. Everything here is a value
 * somebody might reasonably want to change without reading a line of code.
 */
export const site = {
  name: "Joe Fang",
  handle: "MinecraftFuns",
  /* Origins are not here. Where the site is published, and which copy is
     authoritative, is `config/deployments.ts`: one declaration, so a mirror
     cannot be added without the canonical link, the indexing policy, and the
     build matrix all following from it. */
  description:
    "Computer Science and Cognitive Science at the University of Toronto. Projects, writing, and CV.",
  locale: "en",
  timeZone: "America/Toronto",
  dateLocale: "en-CA",
} as const satisfies SiteConfig;

export const nav = [
  { label: "Projects", href: "/projects" },
  { label: "Blog", href: "/blog" },
  { label: "About", href: "/about" },
] as const satisfies readonly NavItem[];

/**
 * Routes kept out of the sitemap. Whole routes, matched exactly, not prefixes
 * and emphatically not substrings, which is what a post slug spelling `/404`
 * inside it once tripped over.
 *
 * Only pages reach the sitemap at all, so endpoints such as `/pgp` and the key
 * directory need no entry here; they were never candidates. What remains is
 * the error page, which exists to be served and not to be indexed.
 */
export const sitemapExclude = ["/404"] as const satisfies readonly RootedPath[];
