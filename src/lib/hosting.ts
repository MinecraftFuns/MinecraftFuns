import type {
  HeaderConfig,
  HostConfig,
  RedirectConfig,
  RedirectStatus,
  RedirectTarget,
  RootedPath,
} from "../schema.ts";
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
 * Pure model for host directives. Base resolution is explicit, wildcards are
 * structural, and dead rules are detectable before emitting host files.
 */

/** Exact or prefix pattern; intentionally narrower than the host language. */
export type PathPattern =
  | { readonly tag: "exact"; readonly path: string }
  | { readonly tag: "prefix"; readonly path: string };

export const exactPath = (path: string): PathPattern => ({ tag: "exact", path });

/** Matches `path` and anything beneath it. Rendered with a trailing splat. */
export const prefixPath = (path: string): PathPattern => ({ tag: "prefix", path });

const SPLAT: Readonly<Record<PathPattern["tag"], string>> = {
  exact: "",
  prefix: "*",
};

export const renderPattern = (pattern: PathPattern): string =>
  `${pattern.path}${SPLAT[pattern.tag]}`;

/** Match exact paths by equality and prefix paths by `startsWith`. */
export const patternMatches = (pattern: PathPattern, path: string): boolean => {
  switch (pattern.tag) {
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
  outer.tag === "prefix"
    ? inner.path.startsWith(outer.path)
    : inner.tag === "exact" && inner.path === outer.path;

// ---------------------------------------------------------------------------
// Redirects
// ---------------------------------------------------------------------------

export type Redirect = {
  readonly from: PathPattern;
  /** A rooted path on this site, or an absolute URL leaving it. */
  readonly to: string;
  readonly status: RedirectStatus;
};

/** Render redirects in order; host semantics use first match. */
export const renderRedirects = (redirects: readonly Redirect[]): string =>
  `${redirects
    .map(({ from, to, status }) => `${renderPattern(from)} ${to} ${status}`)
    .join("\n")}\n`;

// ---------------------------------------------------------------------------
// Headers
// ---------------------------------------------------------------------------

/** Set/remove sum keeps header operator `!` out of names. */
export type HeaderOp =
  | { readonly tag: "set"; readonly name: string; readonly value: string }
  | { readonly tag: "remove"; readonly name: string };

/** Non-empty operations prevent rules that emit no directive. */
export type HeaderRule = {
  readonly pattern: PathPattern;
  readonly ops: NonEmpty<HeaderOp>;
};

const renderOp = (op: HeaderOp): string => {
  switch (op.tag) {
    case "set":
      return `  ${op.name}: ${op.value}`;
    case "remove":
      return `  ! ${op.name}`;
    default:
      return assertNever(op);
  }
};

/** Render all matching header rules; later rules refine earlier ones. */
export const renderHeaders = (rules: readonly HeaderRule[]): string =>
  `${rules
    .map((rule) => [renderPattern(rule.pattern), ...rule.ops.map(renderOp)].join("\n"))
    .join("\n\n")}\n`;

// ---------------------------------------------------------------------------
// Config surface: decode host syntax into the abstract model above.
// ---------------------------------------------------------------------------

/** Apply deployment base to a site-relative host pattern. */
export type Resolve = (path: string) => string;

/** Distinguish rooted local targets from absolute external targets. */
const isRooted = (href: RedirectTarget): href is RootedPath => href.startsWith("/");

/** Parse a rooted exact/prefix pattern; resolution catches `//host` authorities. */
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
  pattern.tag === "exact"
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
        tag: "set",
        name,
        value,
      })),
      ...(config.remove ?? []).map((name): HeaderOp => ({ tag: "remove", name })),
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
