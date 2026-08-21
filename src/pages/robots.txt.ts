import type { APIRoute } from "astro";

import { orThrow } from "../prelude/adt.ts";
import { activeTarget, canonicalSitemapUrl, indexable } from "../lib/deployment.ts";
import { allowAll, disallowAll, renderRobots } from "../lib/robots.ts";

/** Render robots policy; based deployments also use `BaseLayout`'s `noindex`. */
export const GET: APIRoute = ({ site }) => {
  const target = orThrow(activeTarget(site), "deployment");

  /* Do not advertise a sitemap on a disallowed mirror. */
  const robots = indexable(target.role)
    ? allowAll([canonicalSitemapUrl()])
    : disallowAll();

  return new Response(renderRobots(robots), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
