import { site } from "../config/site.ts";

/**
 * The copy a listing's pages share.
 *
 * Page one and the pages after it are separate route files, so any sentence
 * written in both is a sentence that can be edited in one. These are written
 * once and spread into both, which is also why `heading` does not mention a
 * page number: `PagedListPage` puts that in the title, where it belongs.
 */

/**
 * What every listing page carries above its rows. Named because four places
 * spell it: the copy below, a tag's listing, and both listing layouts.
 */
export type ListIntro = {
  readonly eyebrow: string;
  readonly heading: string;
  readonly lede: string;
  /** Accessible name for the list. */
  readonly label: string;
  /** Shown in place of rows when there are none. */
  readonly empty: string;
};

/** The blog index, on every one of its pages. */
export const BLOG_INTRO = {
  eyebrow: "Blog",
  heading: "Findings, know-how, essays, and the occasional rant.",
  lede: "Software and systems, cognitive science and AI, and older posts in Chinese from my competitive programming years.",
  label: "All posts",
  empty: "No posts published yet.",
} as const satisfies ListIntro;

/** Interpolated rather than written out, so the name has one source. */
export const BLOG_DESCRIPTION = `Notes and essays on software, systems, cognitive science, and AI by ${site.name}, in English and Chinese.`;
