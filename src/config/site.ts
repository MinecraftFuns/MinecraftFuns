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
  /* Other identity facts live in their owning config modules. */
  tagline: "Notes on software, networks, and cognitive science, and the things I build.",
  timeZone: "America/Toronto",
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
