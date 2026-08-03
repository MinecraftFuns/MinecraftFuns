import { COLLATOR } from "./collate.ts";

/** Everything the order depends on, and nothing else. */
export type DocOrder = {
  readonly title: string;
  readonly slug: string;
};

/**
 * A *total* order, so the list is a function of the docs and not of the order
 * the loader walked the directory in. Sorting is stable, so title alone would
 * leave two docs sharing one in whatever order the filesystem gave them; slugs
 * are file names, so they break every tie.
 */
export const compareDocs = (a: DocOrder, b: DocOrder): number => {
  const byTitle = COLLATOR.compare(a.title, b.title);
  return byTitle !== 0 ? byTitle : COLLATOR.compare(a.slug, b.slug);
};
