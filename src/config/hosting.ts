import type { HostConfig } from "../schema.ts";

/** Site-relative host directives; redirects are ordered and validated. */
export const hosting = {
  headers: [
    {
      /*
       * Site-wide declarations come first; preconnect the archive image origin.
       *
       * The edge policy is deliberately not `cache-control`: that header is the
       * browser's, and this one is Cloudflare's. Of the three it recognises,
       * `cloudflare-cdn-cache-control` is the most specific and the only one it
       * consults, and it is not proxied downstream, so a reader still revalidates
       * on every visit while the edge answers from its own copy.
       *
       * Five seconds of freshness keeps a deploy visible almost at once. The day
       * of `stale-while-revalidate` after it is the part that matters: the object
       * stays resident and servable while a background fetch refreshes it, and
       * a page that is merely stale is still a page in cache. Speculative
       * requests are answered from cache or refused, so residency is exactly the
       * condition for a prefetch to be served at all. `must-revalidate` is absent
       * on purpose; Cloudflare reads it as "does not serve stale", which would
       * cancel the directive beside it.
       */
      path: "/*",
      set: {
        "x-declaration": "<https://joefang.org/docs/declaration/>",
        link: '<https://ragnarok.joefang.org>; rel="preconnect"',
        "cloudflare-cdn-cache-control": "public, max-age=5, stale-while-revalidate=86400",
      },
    },
    {
      /* Static output needs the host to supply MIME, download, and cache policy. */
      path: "/pgp",
      set: {
        "content-type": "application/pgp-keys; charset=utf-8",
        "content-disposition": "attachment; filename=joefang.asc",
        "cache-control": "no-store",
      },
      remove: ["link", "cloudflare-cdn-cache-control"],
    },
    {
      /* The Web Key Directory spec requires the binary key and suggests this. */
      path: "/.well-known/openpgpkey/hu/*",
      set: {
        "content-type": "application/octet-stream",
        "cache-control": "no-store",
      },
      remove: ["link", "cloudflare-cdn-cache-control"],
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
    /* Preserve the signed declaration's legacy route. */
    { from: "/declaration", to: "/docs/declaration/" },
    /* Preserve the crawler-facing sitemap route. */
    { from: "/sitemap.xml", to: "/sitemap-index.xml" },
  ],
} as const satisfies HostConfig;
