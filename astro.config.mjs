// @ts-check
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

import sitemap from "@astrojs/sitemap";

import { sitemapExclude } from "./src/config/site.ts";

/**
 * The deployment target is a parameter, not a constant.
 *
 * The same source builds for more than one origin, and those origins do not
 * agree on a base path: `MinecraftFuns/MinecraftFuns` is a *project* repository
 * rather than a `<user>.github.io` one, so GitHub Pages serves it beneath
 * `/MinecraftFuns`, while the custom domain serves it at the root. A base path
 * is baked into every generated link, so one artifact cannot satisfy both —
 * the build is parameterised and run once per target instead.
 *
 * Defaults describe the GitHub Pages target so that `astro dev` reproduces the
 * deployed URL shape locally; a link that only works at the root would
 * otherwise pass in development and 404 in production.
 */
const site = process.env.SITE_URL ?? "https://minecraftfuns.github.io";
const base = process.env.SITE_BASE ?? "/MinecraftFuns/";

// Fail the build on a malformed origin rather than emitting broken canonical
// URLs and sitemaps. Cheap, and the error names the offending value.
try {
  new URL(site);
} catch {
  throw new Error(
    `SITE_URL must be an absolute origin, received ${JSON.stringify(site)}`,
  );
}

export default defineConfig({
  site,
  base,
  /*
   * Every page is emitted as `slug/index.html`, so the canonical form of a
   * route ends in a slash — which is what the canonical tag has always said.
   * The default, `"ignore"`, lets the dev server answer both forms, so a link
   * missing its slash works locally and costs a redirect in production. Being
   * explicit makes development fail the same way production would.
   */
  trailingSlash: "always",
  /*
   * Tailwind v4 registers as a Vite plugin, not an Astro integration. The
   * `@astrojs/tailwind` integration is the v3 path and is deprecated; putting
   * this under `integrations` is the usual migration mistake.
   */
  vite: {
    plugins: [tailwindcss()],
  },
  /*
   * The sitemap is derived from the routes the build actually emitted, which
   * is the only description of the site guaranteed to be true. The legacy
   * sitemap was hand-maintained — a second encoding of the route set that
   * nothing forced to agree with the first — and by the end it advertised
   * three URLs that no longer existed and omitted every page added after it
   * was last edited.
   *
   * `filter` drops the non-document routes. A sitemap lists pages for a
   * crawler to index; a key file and a policy file are neither, and listing
   * them invites a crawler to index a binary blob.
   */
  integrations: [
    /*
     * `_headers` and `_redirects` are generated, not static, so their paths
     * follow the deployment's base instead of assuming the origin root. They
     * cannot live in `src/pages`: Astro excludes any route file whose name
     * starts with an underscore, and these two must carry exactly those names.
     * `injectRoute` maps a URL onto an entrypoint wherever the file happens to
     * sit, which is the documented way past that.
     */
    {
      name: "host-directives",
      hooks: {
        "astro:config:setup": ({ injectRoute }) => {
          injectRoute({ pattern: "/_headers", entrypoint: "./src/routes/headers.ts" });
          injectRoute({
            pattern: "/_redirects",
            entrypoint: "./src/routes/redirects.ts",
          });
        },
      },
    },
    /*
     * The sitemap. `sitemap-index.xml` plus `sitemap-0.xml` is what this
     * integration emits and what its own discovery guidance points at, so the
     * location is the documented one rather than a guess. Discovery is covered
     * twice: the robots.txt Sitemap directive, and a <link rel="sitemap"> in
     * every document for crawlers that never read robots.txt.
     *
     * The filter drops pages that exist to be served but not indexed. Only
     * pages reach it — endpoints such as /pgp and the key directory are never
     * candidates — so this list stays short by construction.
     */
    sitemap({
      filter: (page) => {
        const { pathname } = new URL(page);
        return !sitemapExclude.some((route) => pathname.includes(route));
      },
    }),
  ],
  markdown: {
    shikiConfig: {
      // Shiki themes are keyed to their own palettes; these two are the
      // closest neutral fits for the eggshell/navy system. Revisit if code
      // blocks ever need to match the token colors exactly.
      themes: { light: "github-light", dark: "github-dark-dimmed" },
      wrap: false,
    },
  },
});
