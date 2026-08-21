import type { APIRoute } from "astro";

import { faviconSvg } from "../lib/icons.ts";

/** Serve source SVG; it is the only theme-aware icon form. */
export const GET: APIRoute = () =>
  new Response(faviconSvg(), {
    headers: { "content-type": "image/svg+xml; charset=utf-8" },
  });
