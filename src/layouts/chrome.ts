/**
 * How much of the site a page wears.
 *
 * A closed sum rather than a `header?: boolean`, because the question is what
 * kind of page this is and not which parts to switch off. `site` is the
 * personal site: brand, nav, footer. `document` is a page that stands on its
 * own, which the docs do; they are reference material rather than part of the
 * first-person voice the nav frames everything else in, so they keep the
 * footer's attribution and drop the bar above.
 *
 * In a module rather than in `BaseLayout.astro` for the reason `intro.ts` is:
 * three layouts need the type, and a `.astro` file's frontmatter exports are
 * not importable.
 */
export type Chrome = "site" | "document";
