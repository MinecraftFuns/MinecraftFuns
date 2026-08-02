import { site } from "../config/site.ts";

/**
 * How this site compares text.
 *
 * Built once and shared. `localeCompare` negotiates a collator on every call
 * and a comparator runs O(n log n) times, so the construction belongs outside
 * the sort; and the locale is the site's rather than the machine's, so an
 * ordering is a property of the site instead of of whoever ran the build.
 *
 * One instance rather than one per module: two collators would be two answers
 * to the same question, and the day they are configured differently the docs
 * list and the tag list would disagree about where "Ãle" goes.
 */
export const COLLATOR = new Intl.Collator(site.locale);
