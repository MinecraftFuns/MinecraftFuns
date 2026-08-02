/**
 * The small algebraic vocabulary shared by the site's domain modules.
 *
 * Deliberately not a library: these are three lines of erased types plus two
 * flat object literals. Pulling in an fp-ts-shaped dependency would add runtime
 * wrappers and allocation for names we can spell ourselves.
 */

/**
 * The result of turning an untrusted representation into a trusted domain
 * value. A sum, not a nullable — the failure carries a reason, so the caller
 * can report *why* rather than only *that* parsing failed.
 */
export type Parsed<T> =
  | { readonly tag: "ok"; readonly value: T }
  | { readonly tag: "invalid"; readonly reason: string };

export const ok = <T>(value: T): Parsed<T> => ({ tag: "ok", value });

export const invalid = <T = never>(reason: string): Parsed<T> => ({
  tag: "invalid",
  reason,
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
 * Eliminates `Parsed` at a boundary where failure is a *defect* rather than an
 * expected outcome — authored site data. Throwing fails the build loudly, which
 * is the correct effect: a malformed date should never reach a reader.
 *
 * Untrusted input (Markdown frontmatter, an API) should eliminate `Parsed`
 * by matching both variants instead of calling this.
 */
export const orThrow = <T>(parsed: Parsed<T>, context: string): T => {
  switch (parsed.tag) {
    case "ok":
      return parsed.value;
    case "invalid":
      throw new TypeError(`${context}: ${parsed.reason}`);
    default:
      return assertNever(parsed);
  }
};
