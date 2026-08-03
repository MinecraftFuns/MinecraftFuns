import type { APIRoute } from "astro";

/**
 * The Web Key Directory policy file.
 *
 * "A site supporting the Web Key Directory MUST serve this file; it is
 * sufficient if that file has a zero length." Its optional keywords describe
 * provider capabilities (submission addresses, mail-based protocols), none of
 * which apply to a directory published from a static build, so it is empty.
 *
 * Empty but present is the specification's own recommended shape, and its
 * presence is what tells a client the directory exists at all.
 */
export const GET: APIRoute = () => new Response("", {
  headers: { "content-type": "text/plain; charset=utf-8" },
});
