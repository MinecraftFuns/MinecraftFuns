import type { APIRoute } from "astro";

import { faviconSvg } from "../lib/icons.ts";

/**
 * `/favicon.svg`, the mark itself and the source the other two are rendered
 * from. Served from a route rather than copied out of `public`, so that one
 * file in `src/assets` is the only place the shape exists.
 *
 * The only form that follows the reader's colour scheme: the `<style>` inside
 * it carries the `prefers-color-scheme` rule a raster cannot.
 */
export const GET: APIRoute = () =>
  new Response(faviconSvg(), {
    headers: { "content-type": "image/svg+xml; charset=utf-8" },
  });
