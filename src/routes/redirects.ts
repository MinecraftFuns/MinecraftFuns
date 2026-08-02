import type { APIRoute } from "astro";

import { hosting } from "../config/hosting.ts";
import { orThrow } from "../lib/adt.ts";
import { decodeHostConfig, renderRedirects } from "../lib/hosting.ts";
import { assetUrl } from "../lib/url.ts";

/** `_redirects`, rendered from `config/hosting.ts`. See headers.ts. */
export const GET: APIRoute = () => {
  const { redirects } = orThrow(decodeHostConfig(hosting, assetUrl), "config/hosting.ts");

  return new Response(renderRedirects(redirects), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
