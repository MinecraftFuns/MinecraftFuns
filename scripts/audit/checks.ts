import { byCodepoint } from "../../src/lib/collate.ts";

/**
 * Finding bookkeeping: ordering, deduplication, and counting. Pure and total.
 *
 * `Finding` is the record the whole audit pipeline passes around, and until
 * these files became TypeScript its shape was written down nowhere.
 */

/** Severity, as axe reports it and as the design probes borrow it. */
export type Impact = "critical" | "serious" | "moderate" | "minor" | "info";

/** One thing a browser saw on one page in one context. */
export type Finding = {
  readonly category: string;
  readonly rule: string;
  readonly page: string;
  readonly message: string;
  readonly impact?: Impact | undefined;
  readonly selector?: string | undefined;
  /** Documentation for the rule, where the source provides it. */
  readonly help?: string | undefined;
  readonly viewport?: string | undefined;
  readonly colorScheme?: string | undefined;
};

/** A finding merged across every context it appeared in. */
export type MergedFinding = Finding & { readonly contexts: readonly string[] };

export type Summary = {
  readonly total: number;
  readonly byCategory: Readonly<Record<string, number>>;
  readonly byImpact: Readonly<Record<string, number>>;
};

/** Severity ordering, most severe first. */
export const IMPACT_ORDER: readonly Impact[] = [
  "critical",
  "serious",
  "moderate",
  "minor",
  "info",
];

/**
 * Rank lookup built once. A comparator runs O(n log n) times, so scanning the
 * array inside it would multiply the sort by the number of severity levels.
 */
const IMPACT_RANK = new Map(IMPACT_ORDER.map((impact, index) => [impact, index]));
/* Past the last known severity, so an impact this table has never heard of
   sorts below every one it has. Read out of the map instead, the rank was
   `number | undefined` and the comparator subtracted it regardless. */
const DEFAULT_RANK = IMPACT_ORDER.length;

const rankOf = (impact: Impact | undefined): number =>
  impact === undefined ? DEFAULT_RANK : (IMPACT_RANK.get(impact) ?? DEFAULT_RANK);

/** Severity first, then page and rule, so the report reads stably. */
export const compareFindings = (a: Finding, b: Finding): number => {
  const byImpact = rankOf(a.impact) - rankOf(b.impact);
  if (byImpact !== 0) return byImpact;

  // Fields compared directly: concatenating keys would allocate a string per
  // comparison, and the sort makes many. By code point, since a page path and
  // a rule name are identifiers, and a report must not sort differently on a
  // different machine.
  const byPage = byCodepoint(a.page, b.page);
  return byPage !== 0 ? byPage : byCodepoint(a.rule, b.rule);
};

const contextOf = ({ viewport, colorScheme }: Finding): string =>
  viewport && colorScheme ? `${viewport}/${colorScheme}` : (viewport ?? colorScheme ?? "");

const identityOf = ({ category, rule, page, selector }: Finding): string =>
  `${category}|${rule}|${page}|${selector ?? ""}`;

/**
 * Collapse findings repeated across viewports and schemes into one entry
 * carrying every context it appeared in. The same contrast failure at four
 * combinations is one problem to fix, not four.
 */
export const dedupeFindings = (findings: readonly Finding[]): readonly MergedFinding[] => {
  const merged = new Map<string, { finding: Finding; contexts: Set<string> }>();

  findings.forEach((finding) => {
    const key = identityOf(finding);
    const context = contextOf(finding);
    const existing = merged.get(key);

    if (existing === undefined) {
      merged.set(key, { finding, contexts: new Set(context === "" ? [] : [context]) });
    } else if (context !== "") {
      existing.contexts.add(context);
    }
  });

  return Array.from(merged.values(), ({ finding, contexts }) => ({
    ...finding,
    contexts: [...contexts],
  })).sort(compareFindings);
};

/** Both tallies in one pass. */
export const summarise = (findings: readonly Finding[]): Summary => {
  const byCategory: Record<string, number> = {};
  const byImpact: Record<string, number> = {};

  findings.forEach((finding) => {
    byCategory[finding.category] = (byCategory[finding.category] ?? 0) + 1;
    const impact = finding.impact ?? "info";
    byImpact[impact] = (byImpact[impact] ?? 0) + 1;
  });

  return { total: findings.length, byCategory, byImpact };
};
