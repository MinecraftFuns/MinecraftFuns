import type { DeploymentsConfig } from "./schema.ts";

/**
 * Where this site is published, and which copy search engines should index.
 *
 * This is the single source for every origin and base path in the project.
 * Before it existed the same two origins were written in four places — the
 * Astro config's defaults, `site.canonicalOrigin`, the CI matrix, and the
 * artifact checks — and nothing forced any pair of them to agree. Each was
 * correct in isolation and any one of them could be edited alone.
 *
 * `canonical` is a single field, so the config cannot say that no deployment
 * is authoritative, nor that two are. See `DeploymentsConfig` for why that
 * shape was chosen over a list with a flag.
 *
 * Adding a deployment is adding an entry to `mirrors`. Nothing else needs to
 * change: the build matrix, the canonical links, the indexing policy, and the
 * dev server's defaults are all derived in `lib/deployment.ts`.
 */
export const deployments = {
  /*
   * The custom domain, served at the root. Cloudflare Pages is what serves it,
   * and it is the only deployment on which `_headers` and `_redirects` do
   * anything, but the deployment's name is `joefang-org`: the provider is an
   * implementation detail that could change without this becoming a different
   * deployment.
   */
  canonical: {
    id: "joefang-org",
    origin: "https://joefang.org",
    base: "/",
  },

  mirrors: [
    /*
     * `MinecraftFuns/MinecraftFuns` is a *project* repository rather than a
     * `<user>.github.io` one, so Pages serves it beneath `/MinecraftFuns`
     * rather than at the root. It is easy to assume a repository whose name
     * matches the account is a user site; only `<user>.github.io` is.
     */
    {
      id: "github-pages",
      origin: "https://minecraftfuns.github.io",
      base: "/MinecraftFuns/",
    },
  ],
} as const satisfies DeploymentsConfig;
