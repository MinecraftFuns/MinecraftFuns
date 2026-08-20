import type { APIRoute } from "astro";

import { faviconIco } from "../lib/icons.ts";

/**
 * `/favicon.ico`, rendered from `public/favicon.svg`.
 *
 * An endpoint rather than a committed binary, for the reason `_headers` is
 * one: the file is derived, and deriving it here means it cannot fall behind
 * the mark it is drawn from. Injected because a name beginning with a dot or
 * carrying an extension is awkward in `src/pages`, and because the route is
 * a fact about the site rather than about the directory layout.
 *
 * This is the route that fixes icons on non-HTML responses. A browser reads
 * `<link rel="icon">` from a *document*; served a key file, a robots.txt or
 * an XML sitemap, it has no document to read and falls back to asking the
 * origin for `/favicon.ico`.
 */
export const GET: APIRoute = async () =>
  new Response(await faviconIco(), {
    headers: {
      /* The de-facto type every browser sends and accepts. The registered
         name, image/vnd.microsoft.icon, is correct and less widely handled. */
      "content-type": "image/x-icon",
    },
  });
