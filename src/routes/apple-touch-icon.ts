import type { APIRoute } from "astro";

import { appleTouchIcon } from "../lib/icons.ts";

/**
 * `/apple-touch-icon.png`, rendered from `public/favicon.svg`.
 *
 * iOS does not read the SVG and does not read the ICO; a home-screen icon is
 * a PNG or it is a screenshot of the page. Like `/favicon.ico`, the name is
 * one iOS will guess at the origin root when no `<link>` names it.
 */
export const GET: APIRoute = async () =>
  new Response(await appleTouchIcon(), {
    headers: { "content-type": "image/png" },
  });
