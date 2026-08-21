/** Key-based distinctness and collision reporting, both one pass. */

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

/** Return each later item with the earlier item claiming its key. */
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
