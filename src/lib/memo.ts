/**
 * Caching by key, for values a build computes once and reads from many pages.
 *
 * Written twice before this: `time.ts` had it for `Intl` formatters and
 * `keys.ts` for parsed OpenPGP keys, differing only in arity. Nothing here
 * evicts, because a build is short and its inputs do not change during one.
 */

/**
 * `T extends object` is what makes the `undefined` test a sound miss check
 * rather than a guess about the value: no object is `undefined`, so a miss and
 * a cached value can never be confused.
 */
export const memoiseBy = <A extends readonly unknown[], T extends object>(
  keyOf: (...args: A) => string,
  build: (...args: A) => T,
): ((...args: A) => T) => {
  const cache = new Map<string, T>();

  return (...args: A): T => {
    const key = keyOf(...args);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    const built = build(...args);
    cache.set(key, built);
    return built;
  };
};

/**
 * A thunk evaluated at most once.
 *
 * On a promise this caches the promise and not its value, so callers share one
 * run rather than racing to start several. A rejection is cached too, which is
 * right here: the work is build-time, and a build that failed once fails.
 */
export const once = <T extends object>(build: () => T): (() => T) =>
  memoiseBy(() => "", build);
