import type { APIRoute } from "astro";

import { orThrow } from "../lib/adt.ts";
import { activeTarget, canonicalSitemapUrl, indexable } from "../lib/deployment.ts";
import { allowAll, disallowAll, renderRobots } from "../lib/robots.ts";

/**
 * robots.txt, rendered from the structure in `lib/robots.ts`.
 *
 * Two legacy bugs are fixed by construction rather than by care:
 *
 *  1. The sitemap URL was the literal string `https://joefang.org/sitemap.xml`,
 *     which is wrong on every origin but one. It is now derived from the
 *     canonical deployment, through the same tested join the rest of the
 *     site's links use.
 *  2. Only one origin should be indexed. A mirror is a copy of the canonical
 *     site, and letting a search engine index both makes them compete as
 *     duplicates of each other. A mirror asks not to be crawled and
 *     advertises no sitemap.
 *
 * This file and the canonical link in `BaseLayout` now read the same `role`
 * from `lib/deployment.ts`. Each previously recomputed "am I the primary
 * origin" from `site.canonicalOrigin`, which is one decision derived twice and
 * therefore one decision that could be answered two ways.
 *
 * Note the limit of this file on a based target: a crawler fetches robots.txt
 * from the origin root only, so a copy served beneath /MinecraftFuns is never
 * read. The `noindex` meta tag in BaseLayout is what actually carries the
 * request there; this file states the same policy for the case where the base
 * is the root.
 */
export const GET: APIRoute = ({ site }) => {
  const target = orThrow(activeTarget(site), "deployment");

  /* A sitemap is offered only to a crawler that has just been invited in.
     Handing one to a crawler told `Disallow: /` is a contradiction, so both
     come from the single role rather than being assembled independently. */
  const robots = indexable(target.role)
    ? allowAll([canonicalSitemapUrl()])
    : disallowAll();

  return new Response(renderRobots(robots), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
