import type { APIRoute } from "astro";

import { hostPolicy } from "../lib/host-policy.ts";
import { renderHeaders } from "../lib/hosting.ts";

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
  const { headers } = hostPolicy();

  return new Response(renderHeaders(headers), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
