import type { APIRoute } from "astro";

import { hostPolicy } from "../lib/host-policy.ts";
import { renderRedirects } from "../lib/hosting.ts";

/** `_redirects`, rendered from `config/hosting.ts`. See headers.ts. */
export const GET: APIRoute = () => {
  const { redirects } = hostPolicy();

  return new Response(renderRedirects(redirects), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
