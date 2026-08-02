import { assertNever } from "./adt.ts";

/**
 * The Robots Exclusion Protocol, as data.
 *
 * RFC 9309 gives robots.txt a grammar: a file is a sequence of *groups*, each
 * one or more user-agent lines followed by the rules that apply to them, plus
 * records outside any group. Writing that file as a string literal leaves the
 * grammar implicit, and every bug in the legacy file was a consequence — a
 * hardcoded absolute sitemap URL that was wrong on any other origin, and an
 * empty `Disallow:` whose meaning ("nothing is disallowed") is the opposite of
 * what it looks like at a glance.
 *
 * Modelling the grammar instead makes those unsayable. A rule is a sum, so
 * `allow` and `disallow` cannot be confused for a boolean flag; a group's
 * user-agent list is non-empty by type, because a group with none matches
 * nothing and RFC 9309 requires at least one; and the sitemap is a separate
 * field rather than a rule, which is what it is — the RFC places it outside the
 * group grammar entirely, as a record crawlers MAY interpret.
 *
 * Pure and total: no clock, no environment, no I/O.
 */

/**
 * A sum, not `{ allow: boolean; path: string }`. The boolean form reads
 * identically at every call site whichever way it is set, which is the
 * definition of boolean blindness.
 */
export type Rule =
  | { readonly kind: "allow"; readonly path: string }
  | { readonly kind: "disallow"; readonly path: string };

/**
 * `readonly [string, ...string[]]` is a non-empty list in the type system. A
 * group with no user-agent line applies to nobody, so the empty case is not a
 * value to validate at runtime — it is a value that cannot be constructed.
 */
export type Group = {
  readonly userAgents: readonly [string, ...string[]];
  readonly rules: readonly Rule[];
};

export type Robots = {
  readonly groups: readonly Group[];
  /** Absolute URLs. Relative ones are meaningless to a crawler. */
  readonly sitemaps: readonly string[];
};

/** Total elimination over the rule sum. */
const renderRule = (rule: Rule): string => {
  switch (rule.kind) {
    case "allow":
      return `Allow: ${rule.path}`;
    case "disallow":
      return `Disallow: ${rule.path}`;
    default:
      return assertNever(rule);
  }
};

const renderGroup = (group: Group): readonly string[] => [
  ...group.userAgents.map((agent) => `User-agent: ${agent}`),
  ...group.rules.map(renderRule),
];

/**
 * Groups first, then the sitemap records, separated by blank lines.
 *
 * Ordering matters to readers rather than to parsers: RFC 9309 requires a
 * crawler to merge groups by user-agent regardless of position, and to ignore
 * records it does not recognise wherever they appear.
 */
export const renderRobots = (robots: Robots): string => {
  const blocks = [
    ...robots.groups.map((group) => renderGroup(group).join("\n")),
    ...(robots.sitemaps.length === 0
      ? []
      : [robots.sitemaps.map((url) => `Sitemap: ${url}`).join("\n")]),
  ];

  return `${blocks.join("\n\n")}\n`;
};

/**
 * Everything is crawlable. `Allow: /` rather than the legacy's bare
 * `Disallow:`; both mean the same thing to a conformant parser, but one of
 * them says so.
 */
export const allowAll = (sitemaps: readonly string[]): Robots => ({
  groups: [{ userAgents: ["*"], rules: [{ kind: "allow", path: "/" }] }],
  sitemaps,
});

/**
 * Nothing is crawlable, and no sitemap is advertised — offering a crawler a
 * map of pages it has just been told not to fetch is a contradiction.
 */
export const disallowAll = (): Robots => ({
  groups: [{ userAgents: ["*"], rules: [{ kind: "disallow", path: "/" }] }],
  sitemaps: [],
});
