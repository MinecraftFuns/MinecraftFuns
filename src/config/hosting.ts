import type { HostConfig } from "../schema.ts";

/** Site-relative host directives; redirects are ordered and validated. */
export const hosting = {
  headers: [
    {
      /* Site-wide declarations come first; preconnect the archive image origin. */
      path: "/*",
      set: {
        "x-declaration": "<https://joefang.org/docs/declaration/>",
        link: '<https://ragnarok.joefang.org>; rel="preconnect"',
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
    /* Preserve the signed declaration's legacy route. */
    { from: "/declaration", to: "/docs/declaration/" },
    /* Preserve the crawler-facing sitemap route. */
    { from: "/sitemap.xml", to: "/sitemap-index.xml" },
  ],
} as const satisfies HostConfig;
