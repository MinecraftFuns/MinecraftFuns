import type { DeploymentsConfig } from "../schema.ts";

/** Declares canonical origin and mirrors used by builds and indexing. */
export const deployments = {
  /* Host files follow canonical identity. */
  canonical: {
    id: "joefang-org",
    origin: "https://joefang.org",
    base: "/",
  },

  mirrors: [
    /* GitHub Pages mounts this project under `/MinecraftFuns`. */
    {
      id: "github-pages",
      origin: "https://minecraftfuns.github.io",
      base: "/MinecraftFuns/",
    },
  ],
} as const satisfies DeploymentsConfig;
