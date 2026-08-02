import type { APIRoute } from "astro";

import { site } from "../config/site.ts";
import { allowAll, disallowAll, renderRobots } from "../lib/robots.ts";
import { assetUrl } from "../lib/url.ts";

/**
 * robots.txt, rendered from the structure in `lib/robots.ts`.
 *
 * Two legacy bugs are fixed by construction rather than by care:
 *
 *  1. The sitemap URL was the literal string `https://joefang.org/sitemap.xml`,
 *     which is wrong on every origin but one. It is now resolved against the
 *     deployment's own origin and base path, through the same tested join the
 *     rest of the site's links use.
 *  2. Only one origin should be indexed. The GitHub Pages build is a mirror of
 *     joefang.org, and letting a search engine index both makes them compete as
 *     duplicates of each other. A non-primary deployment asks not to be
 *     crawled and advertises no sitemap.
 *
 * Note the limit of this file on the project-pages target: a crawler fetches
 * robots.txt from the origin root only, so a copy served beneath /MinecraftFuns
 * is never read. The `noindex` meta tag in BaseLayout is what actually carries
 * the request there; this file states the same policy for the case where the
 * base is the root.
 */
export const GET: APIRoute = ({ site: deployedTo }) => {
  const primary = new URL(site.canonicalOrigin);
  const isPrimary = deployedTo === undefined || deployedTo.origin === primary.origin;

  const sitemapUrl = new URL(assetUrl("/sitemap-index.xml"), deployedTo ?? primary);
  const robots = isPrimary ? allowAll([sitemapUrl.href]) : disallowAll();

  return new Response(renderRobots(robots), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
