import type { DeploymentsConfig } from "../schema.ts";

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
  /* Host-specific files apply here; identity remains the canonical domain. */
  canonical: {
    id: "joefang-org",
    origin: "https://joefang.org",
    base: "/",
  },

  mirrors: [
    /* Project repository means GitHub Pages serves beneath `/MinecraftFuns`. */
    {
      id: "github-pages",
      origin: "https://minecraftfuns.github.io",
      base: "/MinecraftFuns/",
    },
  ],
} as const satisfies DeploymentsConfig;
