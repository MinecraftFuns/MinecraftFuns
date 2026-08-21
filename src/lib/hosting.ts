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

/** Pure host-directive model; bases and wildcards stay explicit. */

/** Exact or prefix pattern. */
export type PathPattern =
  | { readonly tag: "exact"; readonly path: string }
  | { readonly tag: "prefix"; readonly path: string };

export const exactPath = (path: string): PathPattern => ({ tag: "exact", path });

/** Match `path` and descendants; render with a trailing splat. */
export const prefixPath = (path: string): PathPattern => ({ tag: "prefix", path });

const SPLAT: Readonly<Record<PathPattern["tag"], string>> = {
  exact: "",
  prefix: "*",
};

export const renderPattern = (pattern: PathPattern): string =>
  `${pattern.path}${SPLAT[pattern.tag]}`;

/** Match exact paths or descendants. */
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

/** Whether `outer` covers every path matched by `inner`. */
export const covers = (outer: PathPattern, inner: PathPattern): boolean =>
  outer.tag === "prefix"
    ? inner.path.startsWith(outer.path)
    : inner.tag === "exact" && inner.path === outer.path;

export type Redirect = {
  readonly from: PathPattern;
  /** A rooted path on this site, or an absolute URL leaving it. */
  readonly to: string;
  readonly status: RedirectStatus;
};

/** Render redirects in declaration order; first match wins. */
export const renderRedirects = (redirects: readonly Redirect[]): string =>
  `${redirects
    .map(({ from, to, status }) => `${renderPattern(from)} ${to} ${status}`)
    .join("\n")}\n`;

/** Header set/remove operation; `!` stays out of names. */
export type HeaderOp =
  | { readonly tag: "set"; readonly name: string; readonly value: string }
  | { readonly tag: "remove"; readonly name: string };

/** Header rule with at least one operation. */
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

/** Render header rules in declaration order. */
export const renderHeaders = (rules: readonly HeaderRule[]): string =>
  `${rules
    .map((rule) => [renderPattern(rule.pattern), ...rule.ops.map(renderOp)].join("\n"))
    .join("\n\n")}\n`;

/** Resolve a site-relative host pattern against deployment base. */
export type Resolve = (path: string) => string;

/** Distinguish rooted local from absolute external targets. */
const isRooted = (href: RedirectTarget): href is RootedPath => href.startsWith("/");

/** Parse rooted exact/prefix pattern; resolution rejects `//host` authorities. */
export const parsePathPattern = (raw: RootedPath): Parsed<PathPattern> => {
  const star = raw.indexOf("*");
  if (star === -1) return ok(exactPath(raw));
  if (star !== raw.length - 1) {
    return invalid(`"*" may only end a pattern: ${JSON.stringify(raw)}`);
  }

  return ok(prefixPath(raw.slice(0, -1)));
};

/* Resolve literal half only; wildcard never reaches URL parser. */
const resolvePattern = (pattern: PathPattern, resolve: Resolve): PathPattern =>
  pattern.tag === "exact"
    ? exactPath(resolve(pattern.path))
    : prefixPath(resolve(pattern.path));

/* Parsed pattern makes remaining redirect fields total. */
const decodeRedirect = (config: RedirectConfig, resolve: Resolve): Parsed<Redirect> =>
  mapParsed(parsePathPattern(config.from), (from) => ({
    from: resolvePattern(from, resolve),
    /* External destinations keep their authority. */
    to: isRooted(config.to) ? resolve(config.to) : config.to,
    status: config.status ?? 301,
  }));

/* Parsed header rules can still have no operations. */
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

/** Decode host policy and report independent errors together. */
export const decodeHostConfig = (
  config: HostConfig,
  resolve: Resolve,
): Parsed<{
  readonly headers: readonly HeaderRule[];
  readonly redirects: readonly Redirect[];
}> =>
  /* Header and redirect errors are independent. */
  andThen(
    both(
      collect(config.headers.map((rule) => decodeHeaderRule(rule, resolve))),
      collect(config.redirects.map((rule) => decodeRedirect(rule, resolve))),
    ),
    /* Structural checks run only after both lists decode. */
    ([headers, redirects]) => {
      const problems = [...redirectProblems(redirects), ...headerProblems(headers)].map(
        ({ rule, reason }) => `${rule}: ${reason}`,
      );

      return okUnless(problems, { headers, redirects });
    },
  );

export type RuleProblem = {
  readonly rule: string;
  readonly reason: string;
};

/** Find declaration-level rule defects; artifact existence is checked elsewhere. */
export const redirectProblems = (
  redirects: readonly Redirect[],
): readonly RuleProblem[] =>
  redirects.flatMap((redirect, index) => {
    /* First-match semantics make an earlier covering rule dead. */
    const shadow = redirects.find(
      (earlier, before) => before < index && covers(earlier.from, redirect.from),
    );

    /* Check loop, destination, and shadowing independently. */
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

/** Header names compare case-insensitively. */
const headerName = (op: HeaderOp): string => op.name.toLowerCase();

/** Find duplicate declarations within a header rule. */
export const headerProblems = (rules: readonly HeaderRule[]): readonly RuleProblem[] =>
  rules.flatMap((rule) =>
    clashesBy(rule.ops, headerName).map(([, later]) => ({
      rule: renderPattern(rule.pattern),
      reason: `sets ${later.name} more than once; only the last would apply`,
    })),
  );
