/** Check measured geometry against spacing, type, radius, alignment, and rhythm rules. */

import type { Finding } from "./checks.ts";
import type { DesignProbe, TokenNames } from "./probe.ts";

/** The 4px base the token scale is built on. */
export const GRID_BASE = 4;

/** Sub-pixel noise from rem, percentage, and clamp() values. */
export const EPSILON = 0.5;

/** Above this a difference reads as intentional; below it, as an accident. */
export const ALIGNMENT_TOLERANCE = 4;

/**
 * Token custom properties by name. Values are read from the live page rather
 * than duplicated here, so fluid scales cannot drift against the stylesheet.
 */
export const TOKEN_NAMES: TokenNames = {
  /* Interactive heights belong to Tailwind's length namespace. */
  spacing: [
    "--spacing-3xs",
    "--spacing-2xs",
    "--spacing-xs",
    "--spacing-sm",
    "--spacing-md",
    "--spacing-lg",
    "--spacing-xl",
    "--spacing-section",
    "--spacing-target",
    "--spacing-control",
    "--spacing-nav",
  ],
  radius: [
    "--radius-xs",
    "--radius-sm",
    "--radius-md",
    "--radius-lg",
    "--radius-xl",
    "--radius-pill",
  ],
  text: [
    "--text-display-lg",
    "--text-display-md",
    "--text-headline",
    "--text-card-title",
    "--text-row-title",
    "--text-prose",
    "--text-body-lg",
    "--text-body",
    "--text-control",
    "--text-body-sm",
    "--text-caption",
    "--text-eyebrow",
  ],
};

const near = (a: number, b: number, epsilon: number = EPSILON): boolean =>
  Math.abs(a - b) <= epsilon;
const round = (value: number): number => Math.round(value * 10) / 10;

/** Token, on-grid non-token, or off-grid measurement verdict. */
export type Verdict = "token" | "on-grid" | "off-grid";

export const classifyMeasurement = (
  value: number,
  tokens: readonly number[],
  base: number = GRID_BASE,
): Verdict => {
  if (near(value, 0) || tokens.some((token) => near(token, value))) return "token";

  const remainder = Math.abs(value) % base;
  return remainder <= EPSILON || base - remainder <= EPSILON ? "on-grid" : "off-grid";
};

/** Different enough to see, too close to read as intent. */
export const isNearMiss = (
  a: number,
  b: number,
  tolerance: number = ALIGNMENT_TOLERANCE,
): boolean =>
  Math.abs(a - b) > EPSILON && Math.abs(a - b) <= tolerance;

/** Find canonical near-miss edge pairs after sorting and deduplication. */
export const nearMissPairs = (
  values: readonly number[],
  tolerance: number = ALIGNMENT_TOLERANCE,
): readonly (readonly [number, number])[] => {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  return sorted.flatMap((value, index) =>
    sorted
      .slice(index + 1)
      .filter((other) => isNearMiss(value, other, tolerance))
      .map((other): readonly [number, number] => [value, other]),
  );
};

/**
 * Distinct gaps in a sequence that should be constant, or nothing when it is.
 * Clustering rather than equality keeps sub-pixel rounding from reading as a
 * rhythm break.
 */
export const rhythmBreaks = (gaps: readonly number[]): readonly number[] => {
  if (gaps.length < 2) return [];

  /* Cluster approximately equal gaps; exact `Set` equality is too strict. */
  const clusters = gaps.reduce<readonly number[]>(
    (found, gap) =>
      found.some((cluster) => near(cluster, gap, EPSILON * 2)) ? found : [...found, gap],
    [],
  );

  return clusters.length > 1 ? clusters.map(round) : [];
};

const SCALES = [
  { key: "spacing", tokenKey: "spacing", label: "spacing" },
  { key: "radii", tokenKey: "radius", label: "radius" },
  { key: "fontSizes", tokenKey: "text", label: "font size" },
];

/* Map probe group keys to measured edges; preserve literal keys with `as const`. */
const EDGES = [
  { key: "lefts", edge: "left" },
  { key: "rights", edge: "right" },
] as const satisfies readonly {
  readonly key: "lefts" | "rights";
  readonly edge: string;
}[];

/** Raw observations to findings. Pure and total on a partial probe. */
export const designFindings = (
  probe: Partial<DesignProbe>,
  context: { readonly page: string; readonly viewport: string },
): readonly Finding[] => {
  const at = (extra: Omit<Finding, "category" | "page" | "viewport">): Finding => ({
    category: "design",
    page: context.page,
    viewport: context.viewport,
    ...extra,
  });

  const alignment = (probe.alignmentGroups ?? []).flatMap((group) =>
    EDGES.flatMap(({ key, edge }) =>
      nearMissPairs(group[key]).map(([a, b]) =>
        at({
          rule: "near-miss-alignment",
          impact: "moderate",
          selector: group.container,
          message: `children sit ${round(b - a)}px apart on their ${edge} edge (${round(a)} vs ${round(b)}), too close to read as an intentional offset`,
        }),
      ),
    ),
  );

  const rhythm = (probe.rhythmGroups ?? [])
    .map((group) => ({ group, breaks: rhythmBreaks(group.gaps ?? []) }))
    .filter(({ breaks }) => breaks.length > 0)
    .map(({ group, breaks }) =>
      at({
        rule: "uneven-rhythm",
        impact: "moderate",
        selector: `${group.container} > ${group.signature}`,
        message: `gaps between repeated siblings are not constant: ${breaks.join("px, ")}px`,
      }),
    );

  const lattice = SCALES.flatMap((scale) => {
    const tokens = probe.tokens?.[scale.tokenKey] ?? [];
    return (probe.measurements?.[scale.key] ?? [])
      .map((measurement) => ({
        measurement,
        verdict: classifyMeasurement(measurement.value, tokens),
      }))
      .filter(({ verdict }) => verdict !== "token")
      .map(({ measurement, verdict }) => {
        const offGrid = verdict === "off-grid";
        const where = measurement.property ? ` (${measurement.property})` : "";
        return at({
          rule: `${offGrid ? "off-scale" : "off-token"}-${scale.key}`,
          impact: offGrid ? "moderate" : "minor",
          selector: measurement.selector,
          message: offGrid
            ? `${scale.label} of ${round(measurement.value)}px is neither a token nor a multiple of the ${GRID_BASE}px base${where}`
            : `${scale.label} of ${round(measurement.value)}px is on the base grid but is not a token${where}`,
        });
      });
  });

  /* Detect missing spacing when neither sibling owns the gap. */
  const flush = (probe.flushPairs ?? []).map((pair) =>
    at({
      rule: "siblings-flush",
      impact: "moderate",
      selector: `${pair.container} > ${pair.after}`,
      message: `${pair.before} and ${pair.after} meet with no space between them and no padding inside either; the gap between two siblings is the container's to declare`,
    }),
  );

  const symmetry = (probe.asymmetricPadding ?? []).map((box) =>
    at({
      rule: "asymmetric-padding",
      impact: "minor",
      selector: box.selector,
      message: `horizontal padding differs: ${round(box.left)}px left, ${round(box.right)}px right`,
    }),
  );

  return [...alignment, ...rhythm, ...flush, ...lattice, ...symmetry];
};
