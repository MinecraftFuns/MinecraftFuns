import type { HostConfig } from "./schema.ts";

/**
 * Directives for the host serving this build.
 *
 * Paths are written site-relative and a `*` may end one. The deployment's base
 * path is applied when these are decoded, so nothing here needs to know where
 * the site is mounted, and a rule cannot be correct on one target and silently
 * dead on the other, which is what the hand-written files were.
 *
 * `_redirects` is first-match-wins, so order matters: exact paths precede the
 * prefixes that would otherwise swallow them. The build rejects a rule that
 * loops or that an earlier rule already covers.
 */
export const hosting = {
  headers: [
    {
      /*
       * Site-wide, and therefore first: header rules accumulate rather than the
       * first match winning, so a later rule refines this one.
       *
       * `x-declaration` points at the signed statement of ownership. The URL is
       * deliberately absolute and deliberately the canonical origin rather than
       * the deployment's own: the declaration is a claim about joefang.org
       * specifically, so on the Pages mirror the honest answer is still to name
       * joefang.org. This is the one place an origin is written literally, and
       * that is what makes it correct rather than what makes it rot.
       *
       * The `link` header restores the legacy connection hints. Only the
       * favicon survives from the original set: the jsdelivr and ragnarok
       * preconnects and the hero-image preload all named resources this build
       * no longer loads, and a preconnect to an origin nothing fetches buys a
       * DNS lookup and a TLS handshake for nothing.
       */
      path: "/*",
      set: {
        "x-declaration": "<https://joefang.org/docs/declaration/>",
        link: '</favicon.svg>; rel="prefetch"; as="image"',
      },
    },
    {
      /*
       * A static build is only files. The Content-Type an endpoint sets on its
       * Response is gone by the time the artifact ships, so for a route with no
       * extension the host is the only thing that can still get this right.
       *
       * `no-store` because a stale key is a security property, not a
       * performance one: a revoked or rotated key must not be served from an
       * intermediary's cache. `! link` drops the site-wide hint above, which is
       * about rendering a page and means nothing on a key download.
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
      /* Delegation documents are fetched cross-origin by Matrix clients. */
      path: "/.well-known/matrix/*",
      set: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
      },
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
    /*
     * The legacy site served the declaration at the origin root. It is a doc
     * under the current content model, so the old URL has to keep working:
     * it is the one this site advertised site-wide for years, in a header that
     * still exists, and the page it names carries a signature.
     */
    { from: "/declaration", to: "/docs/declaration/" },
    /*
     * The sitemap moved when Astro's integration took over generating it.
     * Crawlers hold the old location and there is no way to tell them
     * otherwise except by answering it.
     */
    { from: "/sitemap.xml", to: "/sitemap-index.xml" },
  ],
} as const satisfies HostConfig;
