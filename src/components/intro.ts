/**
 * How a page opens. Spacing and title role travel together, so a page cannot
 * be a hero in one and not the other. In a module because `PageIntro` and
 * `ArticleHeader` both need it and `.astro` frontmatter exports are not
 * importable; `check-classes` scans it, since a class list moved to a `const`
 * is still markup.
 */
export type IntroKind = "hero" | "page";

export const INTRO: Readonly<
  Record<IntroKind, { readonly spacing: string; readonly title: string }>
> = {
  hero: { spacing: "pt-section pb-lg", title: "text-display-lg" },
  page: { spacing: "pt-xl pb-lg", title: "text-display-md" },
};
