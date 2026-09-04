/**
 * Report rendering. Pure: findings in, strings out.
 *
 * Two consumers with different needs (a person skimming the Actions summary,
 * and a machine diffing runs), so the Markdown is written for reading and the
 * JSON for parsing. Neither is derived from the other's formatting.
 */

import { groupBy } from "../../src/prelude/distinct.ts";
import {
  IMPACT_ORDER,
  summarise,
  type Impact,
  type MergedFinding,
} from "./checks.ts";

/** What a run was, for the header and for the JSON envelope. */
export type Meta = {
  readonly generatedAt: string;
  readonly target: string;
  readonly pages: readonly string[];
  readonly viewports: number;
};

const IMPACT_BADGE: Readonly<Record<Impact, string>> = {
  critical: "🔴 critical",
  serious: "🟠 serious",
  moderate: "🟡 moderate",
  minor: "⚪ minor",
  info: "ℹ️ info",
};

const escapePipes = (text: string): string => text.replaceAll("|", "\\|");

const truncate = (text: string, limit: number): string =>
  text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;

export const toJson = (findings: readonly MergedFinding[], meta: Meta): string =>
  JSON.stringify(
    {
      generatedAt: meta.generatedAt,
      target: meta.target,
      pagesAudited: meta.pages,
      summary: summarise(findings),
      findings,
    },
    null,
    2,
  );

export const toMarkdown = (findings: readonly MergedFinding[], meta: Meta): string => {
  const summary = summarise(findings);
  const lines: string[] = [];

  lines.push("## Page audit");
  lines.push("");
  lines.push(
    `Audited **${meta.pages.length}** page(s) at \`${meta.target}\` across ${meta.viewports} viewport(s) and both colour schemes.`,
  );
  lines.push("");
  lines.push(
    "> These are findings, not failures. This job never blocks a deploy; it reports what a browser saw so the list stays short by being acted on, not by being disabled.",
  );
  lines.push("");

  if (findings.length === 0) {
    lines.push("**No findings.** ✅");
    lines.push("");
    lines.push(
      "_Automated checks cover a minority of WCAG success criteria. A clean run means nothing detectable was detected, not that the site is accessible._",
    );
    return lines.join("\n");
  }

  // -- Counts -------------------------------------------------------------
  lines.push("### Summary");
  lines.push("");
  lines.push("| Impact | Count |");
  lines.push("| --- | ---: |");
  for (const impact of IMPACT_ORDER) {
    const count = summary.byImpact[impact];
    if (count) lines.push(`| ${IMPACT_BADGE[impact]} | ${count} |`);
  }
  lines.push(`| **Total** | **${summary.total}** |`);
  lines.push("");

  lines.push("| Category | Count |");
  lines.push("| --- | ---: |");
  for (const [category, count] of Object.entries(summary.byCategory).sort(
    (a, b) => b[1] - a[1],
  )) {
    lines.push(`| ${category} | ${count} |`);
  }
  lines.push("");

  // -- Detail, grouped by page -------------------------------------------
  const byPage = groupBy(findings, (finding) => finding.page);

  for (const [page, entries] of byPage) {
    lines.push(`### \`${page}\`: ${entries.length} finding(s)`);
    lines.push("");
    lines.push("| Impact | Category | Rule | Where | Detail |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const finding of entries) {
      const where = finding.contexts.length > 0 ? finding.contexts.join(", ") : "all";
      const selector = finding.selector
        ? ` \`${escapePipes(truncate(finding.selector, 60))}\``
        : "";
      const help = finding.help ? ` [docs](${finding.help})` : "";
      lines.push(
        `| ${IMPACT_BADGE[finding.impact ?? "info"]} | ${finding.category} | ${escapePipes(
          finding.rule,
        )} | ${escapePipes(where)} | ${escapePipes(truncate(finding.message, 160))}${selector}${help} |`,
      );
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push(
    "_Automated checks cover a minority of WCAG success criteria, roughly a third by most estimates. Keyboard, screen-reader, and cognitive-load review remain manual._",
  );

  return lines.join("\n");
};
