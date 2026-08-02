import type { HostConfig } from "../lib/hosting.ts";

/**
 * Directives for the host serving this build.
 *
 * Paths are written site-relative and a `*` may end one. The deployment's base
 * path is applied when these are decoded, so nothing here needs to know where
 * the site is mounted — and a rule cannot be correct on one target and silently
 * dead on the other, which is what the hand-written files were.
 *
 * `_redirects` is first-match-wins, so order matters: exact paths precede the
 * prefixes that would otherwise swallow them. The build rejects a rule that
 * loops or that an earlier rule already covers.
 */
export const hosting: HostConfig = {
  headers: [
    {
      /*
       * A static build is only files. The Content-Type an endpoint sets on its
       * Response is gone by the time the artifact ships, so for a route with no
       * extension the host is the only thing that can still get this right.
       */
      path: "/pgp",
      set: {
        "content-type": "application/pgp-keys; charset=utf-8",
        "content-disposition": "attachment; filename=joefang.asc",
      },
    },
    {
      /* The Web Key Directory spec requires the binary key and suggests this. */
      path: "/.well-known/openpgpkey/hu/*",
      set: { "content-type": "application/octet-stream" },
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
  ],
};
