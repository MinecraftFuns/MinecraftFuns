import { sitemapExclude } from "../config/site.ts";
import { joinRoute, slashTerminated } from "./url.ts";

/**
 * Which built pages the sitemap lists.
 *
 * Exclusion is a set of routes, so it is a `Set` of routes. The previous test
 * asked whether a page's path *contained* an excluded one, which is a different
 * relation and a strictly wrong one: `/blog/2026/08/404-is-a-http-code/`
 * contains `/404`, and so silently vanished from the sitemap.
 *
 * Containment was reached for because the two sides were in different
 * coordinate systems — the page carries the deployment's base, config is
 * written site-relative — so no anchored test could have matched either.
 * Resolving config through `joinRoute` puts both in the same space, where
 * equality is the correct relation and membership is its implementation. That
 * also makes the check O(1) per page rather than O(excluded).
 *
 * The base is a parameter rather than read from `BASE_URL`, which does not
 * exist yet where this is called: `astro.config.mjs` runs before the build it
 * configures.
 */
export const sitemapFilter = (base: string): ((page: string) => boolean) => {
  const excluded = new Set(sitemapExclude.map((route) => joinRoute(base, route)));
  return (page) => !excluded.has(slashTerminated(new URL(page).pathname));
};
