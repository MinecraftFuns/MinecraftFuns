// @ts-check
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://joefang.org",
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
