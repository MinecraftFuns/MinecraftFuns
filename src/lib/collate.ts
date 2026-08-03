import { site } from "../config/site.ts";

/**
 * How this site compares text. One instance, built once: `localeCompare`
 * negotiates a collator on every call and a comparator runs O(n log n) times,
 * and two collators would be two answers to where "Île" sorts. The locale is
 * the site's, not the build machine's.
 */
export const COLLATOR = new Intl.Collator(site.locale);
