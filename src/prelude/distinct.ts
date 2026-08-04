/**
 * Distinctness by a key: keeping the distinct ones, and reporting the failures
 * of distinctness.
 *
 * Four checks here are the second question and had each written their own
 * `Map` and their own loop: two labels on one URL segment, two keys on one
 * directory entry, one header set twice, two pages sharing a title. Each also
 * had to remember to carry the first claimant, because a message that cannot
 * name the counterpart prints "undefined".
 *
 * Both are one pass and one lookup per item. The scan they replace at three of
 * those sites compared every item against every earlier one.
 */

/** The first item claiming each key, in encounter order. */
export const distinctBy = <T, K>(
  items: readonly T[],
  keyOf: (item: T) => K,
): readonly T[] => {
  const claimed = new Map<K, T>();

  items.forEach((item) => {
    const key = keyOf(item);
    if (!claimed.has(key)) claimed.set(key, item);
  });

  return [...claimed.values()];
};

/**
 * Each item whose key an earlier item already claimed, paired with the earlier
 * one. Empty exactly when `keyOf` is injective over `items`.
 *
 * Both halves are returned because every caller reports both: "X and Y both
 * become Z" needs the first as much as the second.
 */
export const clashesBy = <T, K>(
  items: readonly T[],
  keyOf: (item: T) => K,
): readonly (readonly [T, T])[] => {
  const claimed = new Map<K, T>();

  return items.flatMap((item) => {
    const key = keyOf(item);
    const first = claimed.get(key);
    if (first !== undefined) return [[first, item] as const];

    claimed.set(key, item);
    return [];
  });
};
