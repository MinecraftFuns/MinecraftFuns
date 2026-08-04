import type {
  HeaderConfig,
  HostConfig,
  RedirectConfig,
  RedirectStatus,
  RedirectTarget,
  RootedPath,
} from "../config/schema.ts";
import {
  andThen,
  assertNever,
  both,
  collect,
  invalid,
  mapParsed,
  nonEmpty,
  ok,
  okUnless,
  type NonEmpty,
  type Parsed,
} from "../prelude/adt.ts";
import { clashesBy } from "../prelude/distinct.ts";

export type { HeaderConfig, HostConfig, RedirectConfig, RedirectStatus };

/**
 * Host directives: the two path-keyed declaration files a static host reads.
 *
 * A rule is a claim about a path, that something is served there or used to
 * be, and nothing checks those claims. Modelling them buys three things:
 *
 *  1. Paths are resolved against the deployment's base. Written literally they
 *     are correct on exactly one build target, and reading the file cannot
 *     tell you which.
 *  2. The wildcard is structural rather than a character inside a string, so
 *     matching is a comparison and no pattern language needs escaping.
 *  3. Rules that cannot fire are detectable. A redirect shadowed by an earlier
 *     one, or pointing at itself, is dead config, and dead config is rot.
 *
 * Pure and total. Nothing here reads the clock, the environment, or the disk.
 */

/**
 * A path pattern, deliberately smaller than the language the host accepts.
 * Cloudflare permits a splat anywhere plus named placeholders; this models an
 * exact path and a prefix, which is all this site uses. Widening it later is a
 * change to this sum rather than to every place a pattern is written.
 */
export type PathPattern =
  | { readonly kind: "exact"; readonly path: string }
  | { readonly kind: "prefix"; readonly path: string };

export const exactPath = (path: string): PathPattern => ({ kind: "exact", path });

/** Matches `path` and anything beneath it. Rendered with a trailing splat. */
export const prefixPath = (path: string): PathPattern => ({ kind: "prefix", path });

const SPLAT: Readonly<Record<PathPattern["kind"], string>> = {
  exact: "",
  prefix: "*",
};

export const renderPattern = (pattern: PathPattern): string =>
  `${pattern.path}${SPLAT[pattern.kind]}`;

/**
 * Whether a concrete path is matched. Because the wildcard is a variant rather
 * than a character, the two cases are string equality and `startsWith`: no
 * regular expression, and so nothing to escape.
 */
export const patternMatches = (pattern: PathPattern, path: string): boolean => {
  switch (pattern.kind) {
    case "exact":
      return path === pattern.path;
    case "prefix":
      return path.startsWith(pattern.path);
    default:
      return assertNever(pattern);
  }
};

/** Whether every path `inner` matches is also matched by `outer`. */
export const covers = (outer: PathPattern, inner: PathPattern): boolean =>
  outer.kind === "prefix"
    ? inner.path.startsWith(outer.path)
    : inner.kind === "exact" && inner.path === outer.path;

// ---------------------------------------------------------------------------
// Redirects
// ---------------------------------------------------------------------------

export type Redirect = {
  readonly from: PathPattern;
  /** A rooted path on this site, or an absolute URL leaving it. */
  readonly to: string;
  readonly status: RedirectStatus;
};

/**
 * First match wins, so order is significant here in a way it is not in
 * `_headers`. Static rules precede wildcards, which the host documents as the
 * faster arrangement.
 */
export const renderRedirects = (redirects: readonly Redirect[]): string =>
  `${redirects
    .map(({ from, to, status }) => `${renderPattern(from)} ${to} ${status}`)
    .join("\n")}\n`;

// ---------------------------------------------------------------------------
// Headers
// ---------------------------------------------------------------------------

/**
 * A sum, because `!` is not part of a header's name but an operator the format
 * spells by prefixing one. In the name string, `"! link"` would be a possible
 * value of a field whose type says "header name".
 */
export type HeaderOp =
  | { readonly kind: "set"; readonly name: string; readonly value: string }
  | { readonly kind: "remove"; readonly name: string };

/**
 * The non-empty list is the type saying what a runtime check otherwise would:
 * a rule with no operations names a path and does nothing to it.
 */
export type HeaderRule = {
  readonly pattern: PathPattern;
  readonly ops: NonEmpty<HeaderOp>;
};

const renderOp = (op: HeaderOp): string => {
  switch (op.kind) {
    case "set":
      return `  ${op.name}: ${op.value}`;
    case "remove":
      return `  ! ${op.name}`;
    default:
      return assertNever(op);
  }
};

/**
 * Every matching rule contributes: headers accumulate rather than the first
 * match winning, so a later rule refines an earlier one instead of replacing it.
 */
export const renderHeaders = (rules: readonly HeaderRule[]): string =>
  `${rules
    .map((rule) => [renderPattern(rule.pattern), ...rule.ops.map(renderOp)].join("\n"))
    .join("\n\n")}\n`;

// ---------------------------------------------------------------------------
// Config surface
// ---------------------------------------------------------------------------
//
// Above is the abstract syntax, what code manipulates; below is the concrete
// syntax, what a person writes in `src/config`, and the decoder between them.
//
// They differ deliberately. A pattern is a plain string ending in `*` because
// that is how the host's documentation spells it; it becomes a variant here,
// where being structural is what makes matching a comparison. Config is
// written site-relative, so nobody editing a rule needs to know the deployment
// has a base path at all.

/**
 * Applies the deployment's base to a site-relative path. The parameter is a
 * plain string rather than a `RootedPath` because a pattern's path is one, for
 * the reason given below.
 */
export type Resolve = (path: string) => string;

/**
 * The decision procedure for `RedirectTarget`. An `HttpsUrl` cannot begin with
 * a slash and a `RootedPath` must, so the leading slash is not a heuristic
 * about the string but the discriminant of the union, and this eliminates it.
 */
const isRooted = (href: RedirectTarget): href is RootedPath => href.startsWith("/");

/**
 * Total, and now smaller than it was: the leading slash is `RootedPath`'s to
 * prove, so this parses the one property a type cannot state. TypeScript has
 * no negation, and "contains no `*` except at the end" is the complement of a
 * pattern; a conditional type could decide it for a literal, at a cost in
 * diagnostics that a build-time reason paid in plain English does not.
 *
 * `RootedPath` proves less than it looks: `//host` is one, and is an authority
 * rather than a path. Resolution is where that is caught, and is why a pattern
 * holds a plain string once resolved.
 */
export const parsePathPattern = (raw: RootedPath): Parsed<PathPattern> => {
  const star = raw.indexOf("*");
  if (star === -1) return ok(exactPath(raw));
  if (star !== raw.length - 1) {
    return invalid(`"*" may only end a pattern: ${JSON.stringify(raw)}`);
  }

  return ok(prefixPath(raw.slice(0, -1)));
};

/* Only the literal half is resolved; the wildcard never reaches the URL parser. */
const resolvePattern = (pattern: PathPattern, resolve: Resolve): PathPattern =>
  pattern.kind === "exact"
    ? exactPath(resolve(pattern.path))
    : prefixPath(resolve(pattern.path));

/* `mapParsed`: once the pattern parses, the rest of a redirect cannot fail. */
const decodeRedirect = (config: RedirectConfig, resolve: Resolve): Parsed<Redirect> =>
  mapParsed(parsePathPattern(config.from), (from) => ({
    from: resolvePattern(from, resolve),
    /* A destination leaving the site keeps its own authority. */
    to: isRooted(config.to) ? resolve(config.to) : config.to,
    status: config.status ?? 301,
  }));

/* `andThen`: a rule that parses may still turn out to do nothing. */
const decodeHeaderRule = (config: HeaderConfig, resolve: Resolve): Parsed<HeaderRule> =>
  andThen(parsePathPattern(config.path), (pattern) => {
    const ops: HeaderOp[] = [
      ...Object.entries(config.set ?? {}).map(([name, value]): HeaderOp => ({
        kind: "set",
        name,
        value,
      })),
      ...(config.remove ?? []).map((name): HeaderOp => ({ kind: "remove", name })),
    ];

    const declared = nonEmpty(ops);
    return declared === undefined
      ? invalid(`${config.path} sets and removes nothing`)
      : ok({ pattern: resolvePattern(pattern, resolve), ops: declared });
  });

/**
 * Decode the whole host policy, reporting every problem rather than the first:
 * config is edited by hand, and naming one mistake at a time turns a typo into
 * a sequence of builds.
 */
export const decodeHostConfig = (
  config: HostConfig,
  resolve: Resolve,
): Parsed<{
  readonly headers: readonly HeaderRule[];
  readonly redirects: readonly Redirect[];
}> =>
  /* Independent, so `both`: a config with a bad header *and* a bad redirect
     names both in one build. */
  andThen(
    both(
      collect(config.headers.map((rule) => decodeHeaderRule(rule, resolve))),
      collect(config.redirects.map((rule) => decodeRedirect(rule, resolve))),
    ),
    /* Dependent, so `andThen`: shadowing and duplication are questions about
       rules that decoded, and there are none to ask of a config that did not. */
    ([headers, redirects]) => {
      const problems = [...redirectProblems(redirects), ...headerProblems(headers)].map(
        ({ rule, reason }) => `${rule}: ${reason}`,
      );

      return okUnless(problems, { headers, redirects });
    },
  );

// ---------------------------------------------------------------------------
// Structural checks
// ---------------------------------------------------------------------------

export type RuleProblem = {
  readonly rule: string;
  readonly reason: string;
};

/**
 * Rules that cannot do what they say: the defects visible in the declaration
 * alone. Whether a destination exists is a property of the artifact, and is
 * checked there.
 */
export const redirectProblems = (
  redirects: readonly Redirect[],
): readonly RuleProblem[] =>
  redirects.flatMap((redirect, index) => {
    /* First match wins, so anything an earlier rule already covers is dead.
       Bounded by the index rather than sliced to it: the slice allocated a
       fresh array per rule to answer a question `find` can answer in place. */
    const shadow = redirects.find(
      (earlier, before) => before < index && covers(earlier.from, redirect.from),
    );

    /* Three independent facts about one rule, each a reason or nothing. */
    return [
      patternMatches(redirect.from, redirect.to)
        ? "redirects to a path it matches, a loop"
        : undefined,
      redirect.to.startsWith("/") || URL.canParse(redirect.to)
        ? undefined
        : "destination is neither a rooted path nor an absolute URL",
      shadow === undefined
        ? undefined
        : `unreachable: ${renderPattern(shadow.from)} above it already matches`,
    ]
      .filter((reason) => reason !== undefined)
      .map((reason) => ({
        rule: `${renderPattern(redirect.from)} -> ${redirect.to}`,
        reason,
      }));
  });

/** Header names are case-insensitive, so `Link` and `link` are one header. */
const headerName = (op: HeaderOp): string => op.name.toLowerCase();

/** Header rules that quietly lose one of their own declarations. */
export const headerProblems = (rules: readonly HeaderRule[]): readonly RuleProblem[] =>
  rules.flatMap((rule) =>
    clashesBy(rule.ops, headerName).map(([, later]) => ({
      rule: renderPattern(rule.pattern),
      reason: `sets ${later.name} more than once; only the last would apply`,
    })),
  );
