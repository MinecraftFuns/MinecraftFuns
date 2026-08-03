import { sitemapExclude } from "../config/site.ts";
import { joinRoute, slashTerminated } from "./url.ts";

/**
 * Which built pages the sitemap lists.
 *
 * A page carries the deployment's base and config is written site-relative, so
 * both sides are resolved into one coordinate system first. There equality is
 * the right relation and a `Set` is its implementation; a containment test
 * would drop `/blog/2026/08/404-is-a-http-code/` for containing `/404`.
 *
 * The base is a parameter because `BASE_URL` does not exist yet where this is
 * called: `astro.config.mjs` runs before the build it configures.
 */
export const sitemapFilter = (base: string): ((page: string) => boolean) => {
  const excluded = new Set(sitemapExclude.map((route) => joinRoute(base, route)));
  return (page) => !excluded.has(slashTerminated(new URL(page).pathname));
};
