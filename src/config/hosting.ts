import type { HostConfig } from "../schema.ts";

/**
 * Directives for the host serving this build.
 *
 * Paths are written site-relative and a `*` may end one; the deployment's base
 * is applied when these are decoded, so a rule cannot be correct on one target
 * and silently dead on the other.
 *
 * `_redirects` is first-match-wins, so order matters: exact paths precede the
 * prefixes that would swallow them. The build rejects a rule that loops or
 * that an earlier rule already covers.
 */
export const hosting = {
  headers: [
    {
      /*
       * Site-wide, and therefore first: header rules accumulate, so a later
       * rule refines this one.
       *
       * `x-declaration` names the signed statement of ownership. The absolute
       * canonical origin is deliberate even on the mirror, since the claim is
       * about joefang.org specifically, and being a claim is what keeps it
       * from rotting.
       *
       * `link` carries the resource hints. Written as one header even when it
       * holds one hint, since the decoder refuses a rule that sets the same
       * header twice: a second hint joins this value, comma-separated.
       *
       * The preconnect is to the origin serving the archive's images. A hint
       * in the document `<head>` cannot arrive before the document does; this
       * one is read while the HTML is still in flight, so the handshake
       * overlaps the download rather than following it. The origin is written
       * literally because this file is a leaf that imports nothing, and it is
       * the only place in the source that names it: the image URLs themselves
       * live in the Markdown, which is where a specific file is named.
       *
       * One origin, and no more. The images not yet mirrored are addressed
       * through a subdomain gateway, `<cid>.ipfs.dweb.link`, a separate
       * origin per image, so a connection warmed for one is useless to the
       * next and preconnecting them would open a connection to save nothing.
       *
       * No `crossorigin`: these load as ordinary images, which is a no-CORS
       * fetch, and the attribute would warm a CORS connection the images
       * never use while leaving the one they do use cold. No `as` either;
       * it says what a resource *is*, and a preconnect fetches none.
       *
       * A `</favicon.svg>; rel="prefetch"; as="image"` hint sat here and has
       * been removed rather than corrected. `prefetch` is specified for a
       * resource "likely to be required for a followup navigation", so it
       * was the wrong relation for a subresource of the current page; `as`
       * is specified for `preload` and `modulepreload` and does nothing on a
       * prefetch; the icon is already declared by `<link rel="icon">` in
       * `BaseLayout`; and, unlike the origin above, that path needed the
       * deployment's base, which header *values* never receive.
       */
      path: "/*",
      set: {
        "x-declaration": "<https://joefang.org/docs/declaration/>",
        link: '<https://ragnarok.joefang.org>; rel="preconnect"',
      },
    },
    {
      /*
       * A static build is only files: the Content-Type an endpoint sets on its
       * Response is gone by the time the artifact ships, so for a route with no
       * extension the host is the only thing left that can get this right.
       *
       * `no-store` because a stale key is a security property, not a
       * performance one. `! link` drops the site-wide hint, which is about
       * rendering a page and means nothing on a key download.
       */
      path: "/pgp",
      set: {
        "content-type": "application/pgp-keys; charset=utf-8",
        "content-disposition": "attachment; filename=joefang.asc",
        "cache-control": "no-store",
      },
      remove: ["link"],
    },
    {
      /* The Web Key Directory spec requires the binary key and suggests this. */
      path: "/.well-known/openpgpkey/hu/*",
      set: {
        "content-type": "application/octet-stream",
        "cache-control": "no-store",
      },
      remove: ["link"],
    },
    {
      path: "/.well-known/openpgpkey/policy",
      set: { "content-type": "text/plain; charset=utf-8" },
    },
    {
      path: "/404.html",
      set: { "x-robots-tag": "noindex" },
    },
  ],

  redirects: [
    { from: "/gpg", to: "/pgp" },
    { from: "/pgp.*", to: "/pgp" },
    { from: "/gpg.*", to: "/pgp" },
    /* Advertised site-wide for years, in a header that still exists, and the
       page it names carries a signature. */
    { from: "/declaration", to: "/docs/declaration/" },
    /* Crawlers hold the old location, and answering it is the only way to tell
       them otherwise. */
    { from: "/sitemap.xml", to: "/sitemap-index.xml" },
  ],
} as const satisfies HostConfig;
