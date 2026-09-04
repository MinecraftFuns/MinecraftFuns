/**
 * Caching by key, for values a build computes once and reads from many pages.
 * Nothing evicts: a build is short, and its inputs do not change during one.
 */

/**
 * One cached result per distinct key, $O(1)$ amortized.
 *
 * The entry is boxed, so one probe separates a miss from a cached `undefined`
 * and `T` stays unconstrained.
 */
export const memoiseBy = <A extends readonly unknown[], T>(
  keyOf: (...args: A) => string,
  build: (...args: A) => T,
): ((...args: A) => T) => {
  const cache = new Map<string, { readonly value: T }>();

  return (...args: A): T => {
    const key = keyOf(...args);
    const cached = cache.get(key);
    if (cached !== undefined) return cached.value;

    const value = build(...args);
    cache.set(key, { value });
    return value;
  };
};

/**
 * A thunk evaluated at most once.
 *
 * On a promise this caches the promise, not its value, so callers share one
 * run. A rejection is cached too: the work is build-time, and a build that
 * failed once fails.
 */
export const once = <T>(build: () => T): (() => T) => memoiseBy(() => "", build);
