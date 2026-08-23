/**
 * Caching by key, for values a build computes once and reads from many pages.
 *
 * Written twice before this: `time.ts` had it for `Intl` formatters and
 * `keys.ts` for parsed OpenPGP keys, differing only in arity. Nothing here
 * evicts, because a build is short and its inputs do not change during one.
 */

/**
 * One cached result per distinct key, $O(1)$ amortized.
 *
 * The entry is boxed so a miss and a cached `undefined` stay distinguishable in
 * one probe. Boxing here rather than at the call site is what lets this hold
 * any `T`: the alternative was an `extends object` constraint that callers
 * satisfied by wrapping their own numbers.
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
 * On a promise this caches the promise and not its value, so callers share one
 * run rather than racing to start several. A rejection is cached too, which is
 * right here: the work is build-time, and a build that failed once fails.
 */
export const once = <T>(build: () => T): (() => T) => memoiseBy(() => "", build);
