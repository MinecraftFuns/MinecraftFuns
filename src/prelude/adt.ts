/**
 * The small algebraic vocabulary shared by the site's domain modules.
 *
 * Deliberately not a library: erased types and a handful of total functions.
 * An fp-ts-shaped dependency would add runtime wrappers and allocation for
 * names we can spell ourselves.
 */

/**
 * A list with at least one element.
 *
 * `readonly [T, ...T[]]` is the whole of the definition, but spelled out at
 * every use it reads as a tuple trick, and each reader has to re-derive what
 * the head is doing there. The name says the concept once.
 *
 * Two things follow from having it. Destructuring gives a head typed `T`
 * rather than `T | undefined`, so consumers lose the empty case outright; and
 * `nonEmpty` below becomes the one place the emptiness question is asked, at
 * the boundary where an ordinary array is admitted.
 */
export type NonEmpty<T> = readonly [T, ...T[]];

/**
 * The sole narrowing from an array. `undefined` for the empty case rather than
 * a `Parsed`: emptiness has no reason to report, and every caller here already
 * has a better sentence of its own to supply.
 */
export const nonEmpty = <T>(items: readonly T[]): NonEmpty<T> | undefined =>
  items.length === 0 ? undefined : (items as NonEmpty<T>);

/**
 * Functor. Head and tail rather than `map`, which hands back a plain array and
 * loses the very property this type carries; recovering it would take an
 * assertion, and an assertion is what having this function avoids.
 */
export const mapNonEmpty = <A, B>(items: NonEmpty<A>, f: (item: A) => B): NonEmpty<B> => {
  const [head, ...rest] = items;
  return [f(head), ...rest.map(f)];
};

/**
 * The same, effectfully. Every task is started before the first is awaited, so
 * this is `Promise.all`'s concurrency and failure behaviour exactly; the tuple
 * form is what carries the non-emptiness through.
 */
export const traverseNonEmpty = <A, B>(
  items: NonEmpty<A>,
  f: (item: A) => Promise<B>,
): Promise<NonEmpty<B>> => {
  const [head, ...rest] = items;
  return Promise.all([f(head), ...rest.map(f)]);
};

/**
 * The result of turning an untrusted representation into a trusted domain
 * value. A sum, not a nullable: the failure carries its reasons, so a caller
 * can report *why* rather than only *that* parsing failed.
 *
 * Reasons are a non-empty list because a failure with nothing to say is not a
 * state worth having; `collect` and `both` below are what produce more than
 * one, and rendering them is `orThrow`'s job rather than each producer's.
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
 * one built from the very rows being looked up. Throwing rather than defaulting
 * is the point, since the only plausible default is a neighbouring key's value,
 * which is the silent wrong answer a lookup table exists to prevent. `table`
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
 * Monad. Fail-fast of necessity rather than by choice: `f` needs a value that
 * a failure never produced, so there is nothing to run it on and nothing
 * further to learn. Reach for it only when the second step genuinely depends
 * on the first; when the steps are independent, `both` reports both.
 */
export const andThen = <A, B>(
  parsed: Parsed<A>,
  f: (value: A) => Parsed<B>,
): Parsed<B> => (parsed.tag === "ok" ? f(parsed.value) : parsed);

/**
 * `ok`, unless there were reasons not to be.
 *
 * The shape every accumulating check in this project ends in: a list of
 * problems, empty meaning success. Written out at four sites before this, each
 * repeating the same `undefined` dance around `nonEmpty`.
 */
export const okUnless = <T>(reasons: readonly string[], value: T): Parsed<T> => {
  const failures = nonEmpty(reasons);
  return failures === undefined ? ok(value) : invalid(...failures);
};

/**
 * Applicative traverse: every element parsed, every failure kept.
 *
 * Emphatically not `andThen` in a loop, and it cannot be built from one.
 * `andThen`'s continuation runs only after a success, so once the first
 * element fails there is no second error in existence to accumulate. A type
 * whose accumulation is lawful is an Applicative and *not* a Monad, which is
 * why this is a separate function rather than a fold over the one above.
 *
 * One pass, building both outcomes and returning whichever the input decided.
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
 * still a value, so an accumulated one says which file each reason belongs to
 * rather than naming the batch once.
 */
export const inContext = <T>(parsed: Parsed<T>, context: string): Parsed<T> => {
  if (parsed.tag === "ok") return parsed;
  return invalid(...mapNonEmpty(parsed.reasons, (reason) => `${context}: ${reason}`));
};

/** Every reason, one per line. A success has nothing to explain. */
export const explain = (parsed: Parsed<unknown>): string =>
  parsed.tag === "invalid" ? parsed.reasons.join("\n  ") : "";

/**
 * Eliminates `Parsed` at a boundary where failure is a *defect* rather than an
 * expected outcome, authored site data. Throwing fails the build loudly: a
 * malformed date should never reach a reader.
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
