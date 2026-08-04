import { invalid, nonEmpty, ok, type NonEmpty, type Parsed } from "./adt.ts";
import { COLLATOR } from "./collate.ts";
import type { Sluggable } from "./labels.ts";
import { slugify } from "./slug.ts";

/**
 * Labels, the pages they lead to, and what is filed under each.
 *
 * Generic in the label type, and that is what makes sharing it safe: the blog
 * instantiates it at `PostTag` and the docs at `DocCategory`, so the two can
 * never be listed together by accident. Parametric code is not pooled code,
 * since nothing here can inspect a label.
 *
 * What is shared is the part that is easy to get wrong: deriving a URL segment
 * from a label, and refusing two labels that land on the same one. Rendering
 * stays separate, which is where the two genuinely differ.
 *
 * That a *single* label has a usable segment is `Sluggable`'s to prove, so it
 * is checked once when frontmatter is decoded and not again here. What remains
 * is the property no per-label check can see: two labels colliding is a fact
 * about the collection.
 *
 * Pure and total.
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
 * Two labels on one segment would put two pages at one URL. Carrying the first
 * label seen keeps the counterpart in hand, so a message cannot print
 * "undefined", and the lookup keeps the check linear rather than quadratic.
 *
 * Every collision, not the first: they are independent mistakes in content.
 */
const collisions = <Label extends string, Item>(
  taxa: readonly Taxon<Label, Item>[],
): readonly string[] => {
  const seen = new Map<string, Label>();

  return taxa.flatMap((taxon) => {
    const first = seen.get(taxon.slug);
    seen.set(taxon.slug, first ?? taxon.label);

    return first === undefined
      ? []
      : [
          `${JSON.stringify(first)} and ${JSON.stringify(taxon.label)} both become "${taxon.slug}"; one label, one URL`,
        ];
  });
};

/**
 * The taxonomy of a collection, ordered by label. Items keep the order they
 * arrived in, so each page inherits the order its own collection established;
 * only the taxa are sorted here.
 */
export const taxonomy = <Label extends Sluggable, Item>(
  items: readonly Item[],
  labelsOf: (item: Item) => readonly Label[],
): Parsed<readonly Taxon<Label, Item>[]> => {
  /* `slugify` rather than a parse: `Sluggable` is the proof that it returns a
     usable segment, established where the frontmatter was decoded. */
  const taxa = [...groupByLabel(items, labelsOf)]
    .map(([label, group]) => ({ label, slug: slugify(label), items: group }))
    .toSorted((a, b) => COLLATOR.compare(a.label, b.label));

  const problems = nonEmpty(collisions(taxa));
  return problems === undefined ? ok(taxa) : invalid(...problems);
};
