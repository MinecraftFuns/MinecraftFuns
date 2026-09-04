/** English counted nouns. */

/**
 * A count and its noun, agreeing in number: `3 posts`, `1 post`.
 *
 * Regular nouns take the default plural; an irregular one supplies its own.
 * Only English is spelled this way, so this belongs to the site chrome rather
 * than to any rendition's prose.
 */
export const countedNoun = (
  count: number,
  singular: string,
  plural: string = `${singular}s`,
): string => `${count} ${count === 1 ? singular : plural}`;
