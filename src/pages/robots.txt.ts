import type { APIRoute } from "astro";

import { orThrow } from "../lib/adt.ts";
import { activeTarget, canonicalSitemapUrl, indexable } from "../lib/deployment.ts";
import { allowAll, disallowAll, renderRobots } from "../lib/robots.ts";

/**
 * robots.txt, rendered from the structure in `lib/robots.ts`.
 *
 * Only one origin should be indexed: a mirror is a copy, and indexing both
 * makes them compete as duplicates of each other.
 *
 * Note the limit of this file on a based target. A crawler fetches robots.txt
 * from the origin root only, so the copy beneath /MinecraftFuns is never read;
 * the `noindex` meta tag in `BaseLayout` is what carries the request there.
 */
export const GET: APIRoute = ({ site }) => {
  const target = orThrow(activeTarget(site), "deployment");

  /* Both come from the one role: handing a sitemap to a crawler just told
     `Disallow: /` is a contradiction. */
  const robots = indexable(target.role)
    ? allowAll([canonicalSitemapUrl()])
    : disallowAll();

  return new Response(renderRobots(robots), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
