// @ts-check
import { defineConfig } from "astro/config";

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
const base = process.env.SITE_BASE ?? "/MinecraftFuns";

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
