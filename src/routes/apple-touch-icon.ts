import type { APIRoute } from "astro";

import { appleTouchIcon } from "../lib/icons.ts";

/** Serve PNG home-screen icon; iOS does not use SVG or ICO for this request. */
export const GET: APIRoute = async () =>
  new Response(await appleTouchIcon(), {
    headers: { "content-type": "image/png" },
  });
