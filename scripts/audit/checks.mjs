/**
 * Finding bookkeeping: ordering, deduplication, and counting. Pure and total.
 */

/** Severity ordering, most severe first. */
export const IMPACT_ORDER = ["critical", "serious", "moderate", "minor", "info"];

/**
 * Rank lookup built once. A comparator runs O(n log n) times, so scanning the
 * array inside it would multiply the sort by the number of severity levels.
 */
const IMPACT_RANK = new Map(IMPACT_ORDER.map((impact, index) => [impact, index]));
/* Past the last known severity, so an impact this table has never heard of
   sorts below every one it has. Read out of the map instead, the rank was
   `number | undefined` and the comparator subtracted it regardless. */
const DEFAULT_RANK = IMPACT_ORDER.length;

const rankOf = (impact) => IMPACT_RANK.get(impact) ?? DEFAULT_RANK;

/** Severity first, then page and rule, so the report reads stably. */
export const compareFindings = (a, b) => {
  const byImpact = rankOf(a.impact) - rankOf(b.impact);
  if (byImpact !== 0) return byImpact;

  // Fields compared directly: concatenating keys would allocate a string per
  // comparison, and the sort makes many.
  const byPage = a.page.localeCompare(b.page);
  return byPage !== 0 ? byPage : a.rule.localeCompare(b.rule);
};

const contextOf = ({ viewport, colorScheme }) =>
  viewport && colorScheme ? `${viewport}/${colorScheme}` : (viewport ?? colorScheme ?? "");

const identityOf = ({ category, rule, page, selector }) =>
  `${category}|${rule}|${page}|${selector ?? ""}`;

/**
 * Collapse findings repeated across viewports and schemes into one entry
 * carrying every context it appeared in. The same contrast failure at four
 * combinations is one problem to fix, not four.
 */
export const dedupeFindings = (findings) => {
  const merged = new Map();

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
export const summarise = (findings) => {
  const byCategory = {};
  const byImpact = {};

  findings.forEach((finding) => {
    byCategory[finding.category] = (byCategory[finding.category] ?? 0) + 1;
    const impact = finding.impact ?? "info";
    byImpact[impact] = (byImpact[impact] ?? 0) + 1;
  });

  return { total: findings.length, byCategory, byImpact };
};
