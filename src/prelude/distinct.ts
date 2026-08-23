import type { NonEmpty } from "./adt.ts";

/** Key-based grouping, distinctness, and collision reporting, each one pass. */

/**
 * Items by key, in first-encounter order, every group non-empty.
 *
 * `Map.groupBy` does the work; the type is what this adds. A group exists
 * because something was put in it, so the platform never produces an empty
 * one, but `Map<K, T[]>` cannot say that and every caller then re-asks the
 * question the grouping already answered.
 */
export const groupBy = <T, K>(
  items: Iterable<T>,
  keyOf: (item: T) => K,
): ReadonlyMap<K, NonEmpty<T>> => {
  const grouped: ReadonlyMap<K, readonly T[]> = Map.groupBy(items, keyOf);
  return grouped as ReadonlyMap<K, NonEmpty<T>>;
};

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
