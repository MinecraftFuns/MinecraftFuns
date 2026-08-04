/**
 * Reading capture groups off a batch of matches.
 *
 * `RegExp` is typed without reference to its pattern, so a group the pattern
 * guarantees reads as optional at every site that touches one. Five places
 * here were each dropping that impossible case, and three had written out the
 * same paragraph explaining why.
 */
export const captures = (
  matches: Iterable<RegExpExecArray>,
  group: number = 1,
): readonly string[] =>
  [...matches].map((match) => match[group]).filter((value) => value !== undefined);
