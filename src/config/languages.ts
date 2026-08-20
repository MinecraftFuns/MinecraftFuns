import type { LanguagesConfig } from "../schema.ts";

/**
 * The languages this blog publishes in, most preferred first.
 *
 * Config is a leaf: values only, nothing about how any of it is used. The
 * policy this list drives lives in `lib/lang.ts` and `lib/article.ts`; in
 * one sentence, an article's bare URL serves the earliest language here
 * that the article has, and every later language is served at
 * `.../slug/<code>/`.
 *
 * To add a language, add a row. The checker then demands the wording tables
 * that render it (`TranslationNote.astro`) before the site builds.
 */
export const languages = [
  { code: "en", bcp47: "en", nativeName: "English", dateLocale: "en-CA" },
  { code: "zh", bcp47: "zh-Hans", nativeName: "中文", dateLocale: "zh-CN" },
] as const satisfies LanguagesConfig;
