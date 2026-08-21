import type { APIRoute } from "astro";

import { faviconIco } from "../lib/icons.ts";

/** Derive `/favicon.ico` from the source SVG, including for non-HTML responses. */
export const GET: APIRoute = async () =>
  new Response(await faviconIco(), {
    headers: {
      /* Widely supported ICO MIME type. */
      "content-type": "image/x-icon",
    },
  });
