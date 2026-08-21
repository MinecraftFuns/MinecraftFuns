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

/**
 * The lede under any page title, and the block after it. One ladder for
 * every opening: `xs` binds the small line to the title, `md` sets the lede
 * apart, `lg` marks the trailing block (buttons, tags) as a new group.
 * `ArticleHeader` and `DocHeader` had drifted to `mt-sm`, so the same lede
 * sat closer to the title on an article than on the index that linked to it.
 */
export const INTRO_LEDE = "mt-md max-w-measure text-body-lg text-ink-muted";
export const INTRO_EXTRA = "mt-lg";
