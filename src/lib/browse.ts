import { invalid, nonEmpty, ok, type NonEmpty, type Parsed } from "../prelude/adt.ts";
import type { Taxon } from "./taxonomy.ts";

/**
 * Choosing the few entries a browse strip shows out of the many it could.
 *
 * Thirty-eight tags rendered as chips is four rows of them above the posts,
 * which is a wall rather than a way in. The strip shows the handful that
 * cover the most writing and hands the rest to a page built for the purpose.
 */

/** How many entries a strip keeps: a whole number, at least one. */
declare const previewSizeBrand: unique symbol;
export type PreviewSize = number & { readonly [previewSizeBrand]: true };

export const parsePreviewSize = (keep: number): Parsed<PreviewSize> =>
  Number.isInteger(keep) && keep >= 1
    ? ok(keep as PreviewSize)
    : invalid(`${keep} is not a whole number of entries to show, at least one`);

/**
 * A strip: what it shows, and how many it did not.
 *
 * `rest` is a count and not a flag beside a count. "There is more" and "how
 * much more" are one fact, so the button's label cannot disagree with whether
 * the button is there: it appears exactly when `rest` is positive.
 */
export type Browse<T> = {
  readonly shown: NonEmpty<T>;
  readonly rest: number;
};

/**
 * Most items first, ties broken by label.
 *
 * A total order, which matters more than it looks: the archive's tail is
 * thirty-odd tags holding one to three posts each, so without the tiebreak
 * the six on show would depend on grouping order and could change from build
 * to build with no edit behind it.
 */
export const byCoverage = <Label extends string, Item>(
  a: Taxon<Label, Item>,
  b: Taxon<Label, Item>,
): number => b.items.length - a.items.length || a.label.localeCompare(b.label);

/**
 * The strip for a taxonomy, or nothing when there is no taxonomy to show.
 *
 * `undefined` rather than an empty strip: a blog with no tags yet renders no
 * strip at all, and that is the absence of a thing rather than an empty one.
 *
 * O(t log t) for t taxa, the sort. A bounded heap would find the top k in
 * O(t log k) and would be the wrong structure here: the same sorted order is
 * what the full tag directory lists, so the sort is paid either way.
 */
export const browse = <Label extends string, Item>(
  taxa: readonly Taxon<Label, Item>[],
  keep: PreviewSize,
): Browse<Taxon<Label, Item>> | undefined => {
  const ranked = [...taxa].sort(byCoverage);
  const shown = nonEmpty(ranked.slice(0, keep));
  return shown === undefined
    ? undefined
    : { shown, rest: Math.max(0, ranked.length - shown.length) };
};
