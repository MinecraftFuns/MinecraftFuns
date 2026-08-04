import type { NonEmpty } from "../prelude/adt.ts";

/**
 * The Robots Exclusion Protocol, as data.
 *
 * RFC 9309 gives robots.txt a grammar: a sequence of *groups*, each one or
 * more user-agent lines followed by the rules applying to them, plus records
 * outside any group. Modelling the grammar rather than writing the file as a
 * string literal is what makes its failure modes unsayable, and the sitemap a
 * separate field, which the RFC places outside the group grammar entirely.
 *
 * Pure and total: no clock, no environment, no I/O.
 */

/** A sum, not `{ allow: boolean }`, which reads the same however it is set. */
export type Rule =
  | { readonly kind: "allow"; readonly path: string }
  | { readonly kind: "disallow"; readonly path: string };

/**
 * A non-empty list in the type system. A group with no user-agent line applies
 * to nobody, so the empty case is not validated at runtime; it cannot be built.
 */
export type Group = {
  readonly userAgents: NonEmpty<string>;
  readonly rules: readonly Rule[];
};

export type Robots = {
  readonly groups: readonly Group[];
  /** Absolute URLs. Relative ones are meaningless to a crawler. */
  readonly sitemaps: readonly string[];
};

/** Total by construction: a new kind of rule is a missing key, not a lost case. */
const FIELD: Readonly<Record<Rule["kind"], string>> = {
  allow: "Allow",
  disallow: "Disallow",
};

const renderRule = (rule: Rule): string => `${FIELD[rule.kind]}: ${rule.path}`;

const renderGroup = (group: Group): readonly string[] => [
  ...group.userAgents.map((agent) => `User-agent: ${agent}`),
  ...group.rules.map(renderRule),
];

/**
 * Groups first, then the sitemap records. The order is for readers: RFC 9309
 * has crawlers merge groups by user-agent regardless of position.
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

/** Everything is crawlable. `Allow: /`, since a bare `Disallow:` means this
 *  but does not say it. */
export const allowAll = (sitemaps: readonly string[]): Robots => ({
  groups: [{ userAgents: ["*"], rules: [{ kind: "allow", path: "/" }] }],
  sitemaps,
});

/** Nothing is crawlable, and no sitemap: offering a map of pages a crawler was
 *  just told not to fetch is a contradiction. */
export const disallowAll = (): Robots => ({
  groups: [{ userAgents: ["*"], rules: [{ kind: "disallow", path: "/" }] }],
  sitemaps: [],
});
