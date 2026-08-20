import { bcp47Of, SITE_LANG } from "./lang.ts";

/**
 * The two orderings this project has, both named so neither can be reached for
 * by accident.
 *
 * `COLLATOR` is for text a reader sees: titles, tags, category labels. One
 * instance, built once, because `localeCompare` negotiates a collator on every
 * call while a comparator runs O(n log n) times, and two collators would be
 * two answers to where "Île" sorts.
 */
export const COLLATOR = new Intl.Collator(bcp47Of(SITE_LANG));

/**
 * `byCodepoint` is for identifiers: file stems, route paths, rule names. These
 * are not text and must not be collated. Collation is language-relative, and
 * `localeCompare` without an explicit locale reads the *build machine's*
 * default, so a report sorted with it is a property of who ran the build.
 * Comparing code points is the same answer everywhere.
 */
export const byCodepoint = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
