import type { DeploymentsConfig } from "./schema.ts";

/**
 * Where this site is published, and which copy search engines should index.
 * The single source for every origin and base path in the project, CI matrix
 * included.
 *
 * `canonical` is a single field, so the config cannot say that no deployment
 * is authoritative, nor that two are.
 *
 * Adding a deployment is adding an entry to `mirrors`; the build matrix, the
 * canonical links, the indexing policy, and the dev server's defaults all
 * follow from `lib/deployment.ts`.
 */
export const deployments = {
  /* Cloudflare Pages serves it and it is the only deployment on which
     `_headers` and `_redirects` do anything, but the provider could change
     without this becoming a different deployment, so the name is the domain. */
  canonical: {
    id: "joefang-org",
    origin: "https://joefang.org",
    base: "/",
  },

  mirrors: [
    /* A *project* repository rather than a `<user>.github.io` one, so Pages
       serves it beneath `/MinecraftFuns`. A repository whose name matches the
       account is easy to mistake for a user site; only `<user>.github.io` is. */
    {
      id: "github-pages",
      origin: "https://minecraftfuns.github.io",
      base: "/MinecraftFuns/",
    },
  ],
} as const satisfies DeploymentsConfig;
