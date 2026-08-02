/**
 * How a page opens.
 *
 * Top spacing and title role travel together: a hero is larger type *and* more
 * room above it, so binding them in one entry removes the state where a page is
 * one but not the other.
 *
 * This sits in a module rather than inside `PageIntro.astro` because two
 * components need it. The article header is a page opening with publication
 * metadata where an eyebrow would go, and it was previously spelling out
 * `pt-xl pb-lg` and `text-display-md` itself: a second copy of a decision, with
 * nothing forcing the two to agree. `check-classes` reads this file for the
 * same reason it reads frontmatter string literals, since a class list moved to
 * a `const` is still markup.
 */
export type IntroKind = "hero" | "page";

export const INTRO: Readonly<
  Record<IntroKind, { readonly spacing: string; readonly title: string }>
> = {
  hero: { spacing: "pt-section pb-lg", title: "text-display-lg" },
  page: { spacing: "pt-xl pb-lg", title: "text-display-md" },
};
