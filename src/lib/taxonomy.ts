import { COLLATOR } from "./collate.ts";
import { orThrow, type NonEmpty } from "./adt.ts";
import { parseSlug, slugify } from "./slug.ts";

/**
 * Labels, the pages they lead to, and what is filed under each.
 *
 * Generic in the label type, and that is what makes sharing it safe: the blog
 * instantiates it at `PostTag` and the docs at `DocCategory`, so the two can
 * never be listed together by accident. Parametric code is not pooled code,
 * since nothing here can inspect a label.
 *
 * What is shared is the part that is easy to get wrong: deriving a URL segment
 * from a label, refusing a label with no usable segment, and refusing two
 * labels that land on the same one. Rendering stays separate, which is where
 * the two genuinely differ.
 *
 * Pure and total apart from those two failures, which throw: an ambiguous URL
 * is a defect in authored content, and this project fails those builds.
 */
export type Taxon<Label extends string, Item> = {
  readonly label: Label;
  /** The URL segment. Unique across the taxonomy, which is checked. */
  readonly slug: string;
  /**
   * Non-empty by construction, since labels are read off the items. Saying so
   * in the type removes the empty case from every consumer.
   */
  readonly items: NonEmpty<Item>;
};

/**
 * Group items by their labels in one pass. A local `Map` rather than a filter
 * per label, which would walk the list once for every distinct label; the
 * mutation does not escape, so the function is observationally pure.
 */
const groupByLabel = <Label extends string, Item>(
  items: readonly Item[],
  labelsOf: (item: Item) => readonly Label[],
): ReadonlyMap<Label, NonEmpty<Item>> => {
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
 * The taxonomy of a collection, ordered by label. Items keep the order they
 * arrived in, so each page inherits the order its own collection established;
 * only the taxa are sorted here.
 *
 * `context` names the caller in any failure, since the mistake is in content
 * and the message has to say which file to go and fix.
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

  /* Two labels on one segment would put two pages at one URL. Carrying the
     first label seen keeps the counterpart in hand, so the message cannot
     print "undefined" and the check stays linear. */
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
