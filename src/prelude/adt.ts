/**
 * The small algebraic vocabulary shared by the site's domain modules.
 *
 * Erased types and a handful of total functions. An fp-ts-shaped dependency
 * would add runtime wrappers and allocation for names we can spell ourselves.
 */

/**
 * A list with at least one element.
 *
 * Destructuring gives a head typed `T`, never `T | undefined`, so consumers
 * lose the empty case outright, and `nonEmpty` below is the one place the
 * emptiness question gets asked.
 */
export type NonEmpty<T> = readonly [T, ...T[]];

/**
 * The sole narrowing from an array. `undefined` for the empty case, not a
 * `Parsed`: emptiness has no reason to report, and every caller has a better
 * sentence of its own.
 */
export const nonEmpty = <T>(items: readonly T[]): NonEmpty<T> | undefined =>
  items.length === 0 ? undefined : (items as NonEmpty<T>);

/**
 * Functor. `map` preserves length by specification, so the cast is proven.
 * The arrow keeps `map`'s index out of `f`'s arguments.
 */
export const mapNonEmpty = <A, B>(items: NonEmpty<A>, f: (item: A) => B): NonEmpty<B> => {
  const mapped: readonly B[] = items.map((item) => f(item));
  return mapped as NonEmpty<B>;
};

/**
 * Reordering. `toSorted` returns a permutation, so this cannot empty a list.
 */
export const sortNonEmpty = <T>(
  items: NonEmpty<T>,
  compare: (a: T, b: T) => number,
): NonEmpty<T> => {
  const ordered: readonly T[] = items.toSorted(compare);
  return ordered as NonEmpty<T>;
};

/**
 * The same, effectfully. `map` starts every task before `Promise.all` awaits
 * any, and `Promise.all` preserves length, so the same law discharges the cast.
 */
export const traverseNonEmpty = async <A, B>(
  items: NonEmpty<A>,
  f: (item: A) => Promise<B>,
): Promise<NonEmpty<B>> => {
  const settled: readonly B[] = await Promise.all(items.map((item) => f(item)));
  return settled as NonEmpty<B>;
};

/**
 * The result of turning an untrusted representation into a trusted domain
 * value. A sum, not a nullable: the failure carries its reasons, so a caller
 * can report *why* parsing failed and not only *that* it did.
 *
 * Reasons are non-empty because a failure with nothing to say is not a state
 * worth having. `collect` and `both` produce more than one; `orThrow` renders
 * them.
 */
export type Parsed<T> =
  | { readonly tag: "ok"; readonly value: T }
  | { readonly tag: "invalid"; readonly reasons: NonEmpty<string> };

export const ok = <T>(value: T): Parsed<T> => ({ tag: "ok", value });

export const invalid = <T = never>(...reasons: NonEmpty<string>): Parsed<T> => ({
  tag: "invalid",
  reasons,
});

/**
 * Totality proof. Reaching this function means a variant was added to a union
 * without extending its eliminator; TypeScript rejects the call at compile
 * time, and the throw only fires if untyped data crossed the boundary.
 */
export const assertNever = (value: never): never => {
  throw new TypeError(`unexpected variant: ${String(value)}`);
};

/**
 * Read a key the domain proves present: a table indexed by a closed union, or
 * one built from the rows being looked up. It throws instead of defaulting,
 * since the only plausible default is a neighbouring key's value. `table`
 * names where the missing entry should have been written.
 */
export const demand = <K, V>(map: ReadonlyMap<K, V>, key: K, table: string): V => {
  const value = map.get(key);
  if (value === undefined) {
    throw new TypeError(`${table} has no entry for ${String(key)}`);
  }
  return value;
};

/** Functor: the value changes, a failure passes through untouched. */
export const mapParsed = <A, B>(parsed: Parsed<A>, f: (value: A) => B): Parsed<B> =>
  parsed.tag === "ok" ? ok(f(parsed.value)) : parsed;

/**
 * Monad. Fail-fast of necessity: `f` needs a value a failure never produced,
 * so there is nothing to run it on. Use it only when the second step depends
 * on the first; for independent steps `both` reports both.
 */
export const andThen = <A, B>(
  parsed: Parsed<A>,
  f: (value: A) => Parsed<B>,
): Parsed<B> => (parsed.tag === "ok" ? f(parsed.value) : parsed);

/**
 * `ok`, unless there were reasons not to be. Every accumulating check in this
 * project ends here: a list of problems, empty meaning success.
 */
export const okUnless = <T>(reasons: readonly string[], value: T): Parsed<T> => {
  const failures = nonEmpty(reasons);
  return failures === undefined ? ok(value) : invalid(...failures);
};

/**
 * Applicative traverse: every element parsed, every failure kept.
 *
 * This cannot be built from `andThen`, whose continuation runs only after a
 * success: once the first element fails there is no second error in existence
 * to accumulate. Lawful accumulation is Applicative, and Applicative is not
 * Monad. One pass, building both outcomes.
 */
export const collect = <A>(items: readonly Parsed<A>[]): Parsed<readonly A[]> => {
  const values: A[] = [];
  const reasons: string[] = [];

  for (const item of items) {
    if (item.tag === "ok") values.push(item.value);
    else reasons.push(...item.reasons);
  }

  return okUnless(reasons, values);
};

/**
 * The applicative product of two independent parses, accumulating.
 *
 * `andThen` would typecheck here and would be wrong: it would report the
 * first's failures and never run the second, so a config with a bad header
 * *and* a bad redirect would confess to one of them per build.
 */
export const both = <A, B>(a: Parsed<A>, b: Parsed<B>): Parsed<readonly [A, B]> => {
  if (a.tag === "ok") return mapParsed(b, (value) => [a.value, value] as const);
  if (b.tag === "ok") return a;
  return invalid(...a.reasons, ...b.reasons);
};

/**
 * Label every reason with where it came from. Applied while the failure is
 * still a value, so each reason names its own file.
 */
export const inContext = <T>(parsed: Parsed<T>, context: string): Parsed<T> => {
  if (parsed.tag === "ok") return parsed;
  return invalid(...mapNonEmpty(parsed.reasons, (reason) => `${context}: ${reason}`));
};

/** Every reason, one per line. A success has nothing to explain. */
export const explain = (parsed: Parsed<unknown>): string =>
  parsed.tag === "invalid" ? parsed.reasons.join("\n  ") : "";

/**
 * Eliminates `Parsed` where failure is a *defect*, not an expected outcome:
 * authored site data. Throwing fails the build, and a malformed date never
 * reaches a reader.
 *
 * Untrusted input (Markdown frontmatter, an API) should eliminate `Parsed` by
 * matching both variants instead of calling this.
 */
export const orThrow = <T>(parsed: Parsed<T>, context: string): T => {
  const labelled = inContext(parsed, context);
  switch (labelled.tag) {
    case "ok":
      return labelled.value;
    case "invalid":
      throw new TypeError(explain(labelled));
    default:
      return assertNever(labelled);
  }
};
