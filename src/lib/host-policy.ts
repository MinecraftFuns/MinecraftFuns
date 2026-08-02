import {
  exactPath,
  prefixPath,
  type HeaderRule,
  type Redirect,
} from "./hosting.ts";
import { assetUrl } from "./url.ts";

/**
 * This site's host policy, as data.
 *
 * Every path goes through `assetUrl`, so the rules describe wherever the build
 * is actually mounted rather than assuming the origin root. Written literally
 * — as the legacy files were — they are correct on one target and silently
 * wrong on the other, and reading the file tells you nothing either way.
 *
 * `assetUrl` and not `routeUrl`: these name files the host serves, and a
 * trailing slash would turn each into a directory that does not exist.
 */

/** Content types for the extensionless routes a host would otherwise guess. */
export const headerRules: readonly HeaderRule[] = [
  {
    /*
     * A static build is only files. The Content-Type an Astro endpoint sets on
     * its Response applies in dev and is gone by the time the artifact ships,
     * so for a route with no extension the host is the only thing that can
     * still get this right.
     */
    pattern: exactPath(assetUrl("/pgp")),
    ops: [
      { kind: "set", name: "content-type", value: "application/pgp-keys; charset=utf-8" },
      {
        kind: "set",
        name: "content-disposition",
        value: "attachment; filename=joefang.asc",
      },
    ],
  },
  {
    /* The specification requires the binary key and suggests this type. */
    pattern: prefixPath(assetUrl("/.well-known/openpgpkey/hu/")),
    ops: [{ kind: "set", name: "content-type", value: "application/octet-stream" }],
  },
  {
    pattern: exactPath(assetUrl("/.well-known/openpgpkey/policy")),
    ops: [{ kind: "set", name: "content-type", value: "text/plain; charset=utf-8" }],
  },
  {
    /* Delegation documents are fetched cross-origin by Matrix clients. */
    pattern: prefixPath(assetUrl("/.well-known/matrix/")),
    ops: [
      { kind: "set", name: "content-type", value: "application/json" },
      { kind: "set", name: "access-control-allow-origin", value: "*" },
    ],
  },
  {
    pattern: exactPath(assetUrl("/404.html")),
    ops: [{ kind: "set", name: "x-robots-tag", value: "noindex" }],
  },
];

/**
 * Key aliases, and nothing else.
 *
 * The legacy file also redirected `/*.md`, `/*.py` and `/*.pyc`, which existed
 * because the old repository served its own sources; this build emits none of
 * them, so those rules had been describing a site that no longer existed for
 * years. A favicon redirect to an external CDN went the same way now that the
 * icon is served from this origin.
 *
 * Ordering is semantic: first match wins, so the exact paths precede the
 * prefixes they would otherwise be swallowed by.
 */
export const redirects: readonly Redirect[] = [
  { from: exactPath(assetUrl("/gpg")), to: assetUrl("/pgp"), status: 301 },
  { from: prefixPath(assetUrl("/pgp.")), to: assetUrl("/pgp"), status: 301 },
  { from: prefixPath(assetUrl("/gpg.")), to: assetUrl("/pgp"), status: 301 },
];
