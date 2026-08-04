import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

import sitemap from "@astrojs/sitemap";

import { explain } from "./src/lib/adt.ts";
import { developmentTarget, findTarget } from "./src/lib/deployment.ts";
import { sitemapFilter } from "./src/lib/sitemap.ts";

/**
 * The deployment target is a parameter, not a constant.
 *
 * The same source builds for more than one origin, and those origins do not
 * agree on a base path. A base path is baked into every generated link, so one
 * artifact cannot satisfy both; the build is parameterised and run once per
 * target instead.
 *
 * The origins themselves are *not* here. They live in
 * `src/config/deployments.ts`, which is the single declaration the canonical
 * links, the indexing policy, the artifact checks, and the CI matrix are all
 * derived from. Defaults were previously written out again in this file, where
 * nothing forced them to match the deployments they were meant to describe.
 *
 * The default is a mirror rather than the canonical target, so `astro dev`
 * reproduces the *harder* URL shape: a link that only works at the root would
 * otherwise pass locally and 404 in production. See `developmentTarget`.
 */
const site = process.env.SITE_URL ?? developmentTarget.origin;
const base = process.env.SITE_BASE ?? developmentTarget.base;

/*
 * Fail the build on parameters no deployment declares, rather than emitting
 * canonical URLs and a sitemap for an origin that does not exist. This is
 * strictly stronger than the URL parse it replaces: `https://typo.example` is
 * a perfectly well-formed origin and was accepted silently. The error names
 * the declared targets, so a typo is one line to fix.
 */
const target = findTarget(site, base);
if (target.tag !== "ok") throw new Error(explain(target));

export default defineConfig({
  site,
  base,
  /*
   * Every page is emitted as `slug/index.html`, so the canonical form of a
   * route ends in a slash, which is what the canonical tag has always said.
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
   * sitemap was hand-maintained, a second encoding of the route set that
   * nothing forced to agree with the first, and by the end it advertised
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
     * The filter lives in `lib/sitemap.ts` so it is typed and tested. It was
     * the one path comparison written inline here, and it was the one that was
     * wrong.
     */
    sitemap({ filter: sitemapFilter(base) }),
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
