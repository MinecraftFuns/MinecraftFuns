import type { APIRoute } from "astro";

import { hosting } from "../config/hosting.ts";
import { orThrow } from "../lib/adt.ts";
import { decodeHostConfig, renderHeaders } from "../lib/hosting.ts";
import { assetUrl } from "../lib/url.ts";

/**
 * `_headers`, rendered from `config/hosting.ts`.
 *
 * Injected rather than placed in `src/pages`, because Astro excludes any route
 * file whose name begins with an underscore and this one must be named exactly
 * `_headers`.
 *
 * Decoding fails the build rather than emitting a file known to be unsound.
 * `assetUrl` is passed in rather than reached for inside the library, which is
 * what keeps the decoder pure and testable without a bundler.
 */
export const GET: APIRoute = () => {
  const { headers } = orThrow(decodeHostConfig(hosting, assetUrl), "config/hosting.ts");

  return new Response(renderHeaders(headers), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
