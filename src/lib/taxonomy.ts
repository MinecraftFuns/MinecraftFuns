import { okUnless, type NonEmpty, type Parsed } from "../prelude/adt.ts";
import { clashesBy, groupByEach } from "../prelude/distinct.ts";
import { COLLATOR } from "./collate.ts";
import type { Sluggable } from "./labels.ts";
import { slugify } from "./slug.ts";

/** Group typed labels into URL-backed taxa; reject slug collisions and sort labels. */
export type Taxon<Label extends string, Item> = {
  readonly label: Label;
  /** URL segment, unique across the taxonomy. */
  readonly slug: string;
  /** Non-empty because labels come from items. */
  readonly items: NonEmpty<Item>;
};

/** Reject labels that would share a URL. */
const collisions = <Label extends string, Item>(
  taxa: readonly Taxon<Label, Item>[],
): readonly string[] =>
  clashesBy(taxa, (taxon) => taxon.slug).map(
    ([first, later]) =>
      `${JSON.stringify(first.label)} and ${JSON.stringify(later.label)} both become "${later.slug}"; one label, one URL`,
  );

/** Sort taxa by label while preserving item order. */
export const taxonomy = <Label extends Sluggable, Item>(
  items: readonly Item[],
  labelsOf: (item: Item) => readonly Label[],
): Parsed<readonly Taxon<Label, Item>[]> => {
  /* `Sluggable` already proves each label has a usable segment. */
  const taxa = [...groupByEach(items, labelsOf)]
    .map(([label, group]) => ({ label, slug: slugify(label), items: group }))
    .toSorted((a, b) => COLLATOR.compare(a.label, b.label));

  return okUnless(collisions(taxa), taxa);
};
