import { COLLATOR } from "./collate.ts";
import { orThrow } from "./adt.ts";
import { parseSlug, slugify } from "./slug.ts";

/**
 * Labels, the pages they lead to, and what is filed under each.
 *
 * Generic in the label type, and that is what makes sharing it safe. The blog
 * instantiates it at `PostTag` and the docs at `DocCategory`, so a `Taxon` from
 * one is not a `Taxon` from the other and the two can never be listed together
 * by accident. Parametric code is not pooled code: nothing here can inspect a
 * label, so nothing here can confuse two kinds of them.
 *
 * What is shared is the part worth sharing, which is the part that is easy to
 * get wrong: deriving a URL segment from a label, refusing a label that has no
 * usable segment, and refusing two labels that would land on the same one. The
 * rendering stays separate, because that is where the two genuinely differ.
 *
 * Pure and total apart from the two failures above, which throw: an ambiguous
 * URL is a defect in authored content, and this project fails those builds.
 */
export type Taxon<Label extends string, Item> = {
  readonly label: Label;
  /** The URL segment. Unique across the taxonomy, which is checked. */
  readonly slug: string;
  /**
   * Non-empty by construction: labels are read off the items, so a taxon with
   * nothing under it cannot arise. Saying so in the type removes the empty
   * case from every consumer rather than leaving each to wonder.
   */
  readonly items: readonly [Item, ...Item[]];
};

/**
 * Group items by their labels, in one pass.
 *
 * A local `Map` rather than a filter per label, which would walk the whole
 * list once for every distinct label. The mutation does not escape: the map is
 * built and consumed here, so the function is observationally pure.
 */
const groupByLabel = <Label extends string, Item>(
  items: readonly Item[],
  labelsOf: (item: Item) => readonly Label[],
): ReadonlyMap<Label, readonly [Item, ...Item[]]> => {
  const grouped = new Map<Label, [Item, ...Item[]]>();

  for (const item of items) {
    for (const label of labelsOf(item)) {
      const found = grouped.get(label);
      if (found === undefined) grouped.set(label, [item]);
      else found.push(item);
    }
  }

  return grouped;
};

/**
 * The taxonomy of a collection, ordered by label.
 *
 * Items keep the order they arrived in, so a tag page lists posts newest first
 * and a category page lists docs by title, each inheriting the order its own
 * collection already established. Only the taxa themselves are sorted here.
 *
 * `context` names the caller in any failure, since the mistake is in content
 * rather than in code and the message has to say which file to go and fix.
 */
export const taxonomy = <Label extends string, Item>(
  items: readonly Item[],
  labelsOf: (item: Item) => readonly Label[],
  context: string,
): readonly Taxon<Label, Item>[] => {
  const taxa = [...groupByLabel(items, labelsOf)]
    .map(([label, group]) => ({
      label,
      slug: orThrow(
        parseSlug(slugify(label)),
        `${context}: ${JSON.stringify(label)} has no usable URL segment`,
      ),
      items: group,
    }))
    .toSorted((a, b) => COLLATOR.compare(a.label, b.label));

  /*
   * Two labels on one segment would put two different pages at one URL, and
   * the build would resolve it arbitrarily.
   *
   * One pass carrying the first label seen for each segment. Finding the
   * clash and then searching again for its counterpart meant the second
   * search was typed as possibly failing, when it provably could not: the
   * clash was found *because* an earlier taxon shares its slug. That produced
   * a `?.` and the chance of printing "undefined" in the message. Keeping the
   * earlier label in hand removes the impossible branch, and the check drops
   * from quadratic to linear.
   */
  const seen = new Map<string, Label>();

  for (const taxon of taxa) {
    const first = seen.get(taxon.slug);
    if (first !== undefined) {
      throw new TypeError(
        `${context}: ${JSON.stringify(first)} and ${JSON.stringify(taxon.label)} both become "${taxon.slug}"; one label, one URL`,
      );
    }
    seen.set(taxon.slug, taxon.label);
  }

  return taxa;
};
