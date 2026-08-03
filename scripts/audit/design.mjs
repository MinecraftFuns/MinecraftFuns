/**
 * Design conformance, judged from raw measurements taken by `pageProbe`.
 *
 * A design system is a finitely generated algebra: the spacing, type, and
 * radius scales are its generators, and rendered geometry should be closed
 * under them. A 13px gap in a system offering 12 and 16 is a type error CSS
 * has no type system to catch.
 *
 * Alignment is judged as a *near* miss rather than a miss. The design intends
 * a binary (edges line up, or one is deliberately offset), but rendering
 * admits a continuum, and a 2px delta lands between the two: neither equal nor
 * meaningfully different. Rhythm is the matching homogeneity law, since
 * mapping one component over a list should give uniform gaps.
 */

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
export const TOKEN_NAMES = {
  /* The interactive heights live in the spacing namespace because Tailwind's
     `--spacing-*` is its length namespace, and a 40px control height is a
     legitimate generator for rendered geometry to land on. */
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

const near = (a, b, epsilon = EPSILON) => Math.abs(a - b) <= epsilon;
const round = (value) => Math.round(value * 10) / 10;

/**
 * `token` is a generator; `on-grid` is a multiple of the base that is not a
 * token, so plausible but worth a look; `off-grid` is neither. The linear scan
 * is right for eight entries, and tolerance matching rules out a hashed lookup.
 */
export const classifyMeasurement = (value, tokens, base = GRID_BASE) => {
  if (near(value, 0) || tokens.some((token) => near(token, value))) return "token";

  const remainder = Math.abs(value) % base;
  return remainder <= EPSILON || base - remainder <= EPSILON ? "on-grid" : "off-grid";
};

/** Different enough to see, too close to read as intent. */
export const isNearMiss = (a, b, tolerance = ALIGNMENT_TOLERANCE) =>
  Math.abs(a - b) > EPSILON && Math.abs(a - b) <= tolerance;

/**
 * Near-miss pairs among edge positions. Sorting and deduplicating first means
 * each pair is considered once and in a canonical order; the quadratic scan is
 * bounded by the probe's twelve-children cap.
 */
export const nearMissPairs = (values, tolerance = ALIGNMENT_TOLERANCE) => {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  return sorted.flatMap((value, index) =>
    sorted
      .slice(index + 1)
      .filter((other) => isNearMiss(value, other, tolerance))
      .map((other) => [value, other]),
  );
};

/**
 * Distinct gaps in a sequence that should be constant, or nothing when it is.
 * Clustering rather than equality keeps sub-pixel rounding from reading as a
 * rhythm break.
 */
export const rhythmBreaks = (gaps) => {
  if (gaps.length < 2) return [];

  /* Distinct under approximate equality, which `new Set` cannot express: it
     compares exactly, and two gaps a rounding error apart are one rhythm. The
     fold returns a new list rather than pushing into its own accumulator, so
     nothing here is both the input and the output. */
  const clusters = gaps.reduce(
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

/* The probe's group key to the edge it names. A record rather than a list of
   pairs: `Object.entries` yields the pair type a bare array of arrays loses. */
const EDGES = { lefts: "left", rights: "right" };

/** Raw observations to findings. Pure and total on a partial probe. */
export const designFindings = (probe, context) => {
  const at = (extra) => ({
    category: "design",
    page: context.page,
    viewport: context.viewport,
    ...extra,
  });

  const alignment = (probe.alignmentGroups ?? []).flatMap((group) =>
    Object.entries(EDGES).flatMap(([key, edge]) =>
      nearMissPairs(group[key] ?? []).map(([a, b]) =>
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

  /*
   * A gap that nobody declared. Every other rule here checks that a value is
   * on the scale; this one checks that a value exists at all, which is the
   * failure mode when two components each assume the other owns the space
   * between them.
   */
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
