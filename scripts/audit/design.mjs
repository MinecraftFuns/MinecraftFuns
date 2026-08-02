/**
 * Design-conformance checks: the "does this look like a person made it" layer.
 *
 * The governing idea is that a design system is a *finitely generated algebra*.
 * The spacing, type, and radius scales are its generators, and rendered
 * geometry ought to be closed under them — every measurement an element of the
 * lattice those tokens generate. A 13px gap in a system offering 12 and 16 is a
 * type error that CSS has no type system to catch.
 *
 * Alignment gets a sharper treatment. The defect is not "misaligned"; it is
 * "almost aligned". A design intends a binary — either two edges line up, or
 * one is deliberately offset — but rendering admits a continuum, so the
 * intended two-state property becomes a real number. A 2px delta is that
 * failure: neither equal nor meaningfully different. Exact alignment is fine
 * and a 40px offset is fine; the uncanny interval between them is what makes
 * work look accidental.
 *
 * Rhythm is a homogeneity law. Mapping one component over a list should give
 * uniform spacing between the results; a gap sequence that is not a constant
 * function means the mapping was not uniform.
 *
 * Everything here is pure except `designProbe`, which observes and returns raw
 * numbers. Classification happens on the Node side, so the judgement is
 * unit-testable without a browser — which matters, because the browser half
 * cannot run outside CI.
 */

/** The 4px base the token scale is built on. */
export const GRID_BASE = 4;

/**
 * Sub-pixel noise. Browsers produce fractional geometry from rem, percentage,
 * and clamp() values, so anything under this is "the same number".
 */
export const EPSILON = 0.5;

/**
 * Above this, a difference reads as intentional. Between EPSILON and this is
 * the uncanny interval where the eye registers an error without naming it.
 */
export const ALIGNMENT_TOLERANCE = 4;

/**
 * Token custom properties, by name. Values are read from the live page so that
 * clamp()-based fluid tokens resolve to whatever they are at this viewport,
 * rather than being duplicated here and drifting against the stylesheet.
 */
export const TOKEN_NAMES = {
  spacing: [
    "--space-3xs",
    "--space-2xs",
    "--space-xs",
    "--space-sm",
    "--space-md",
    "--space-lg",
    "--space-xl",
    "--space-section",
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
    "--text-subhead",
    "--text-body-lg",
    "--text-body",
    "--text-body-sm",
    "--text-caption",
    "--text-eyebrow",
  ],
};

// ---------------------------------------------------------------------------
// Pure classification
// ---------------------------------------------------------------------------

const near = (a, b, epsilon = EPSILON) => Math.abs(a - b) <= epsilon;

const round = (value) => Math.round(value * 10) / 10;

/**
 * Where a measurement sits relative to the design lattice.
 *
 * `token`   — a generator, exactly as designed.
 * `on-grid` — not a token but a multiple of the base; plausible, worth a look.
 * `off-grid`— neither; almost always an accident.
 *
 * The scan over `tokens` is linear, which is right: the scale has eight
 * entries, and tolerance matching rules out the hashed lookup that would beat
 * it. A binary search over eight sorted floats would cost more in complexity
 * than it saves in comparisons.
 */
export const classifyMeasurement = (value, tokens, base = GRID_BASE) => {
  if (near(value, 0)) return "token";

  for (const token of tokens) {
    if (near(token, value)) return "token";
  }

  const remainder = Math.abs(value) % base;
  return remainder <= EPSILON || base - remainder <= EPSILON ? "on-grid" : "off-grid";
};

/** The uncanny interval: different enough to see, too close to read as intent. */
export const isNearMiss = (a, b, tolerance = ALIGNMENT_TOLERANCE) => {
  const delta = Math.abs(a - b);
  return delta > EPSILON && delta <= tolerance;
};

/**
 * Near-miss pairs among a set of edge positions.
 *
 * Sorting first makes this output-sensitive: O(n log n) to sort, then each
 * scan stops as soon as the gap exceeds the tolerance, so the inner loop only
 * visits pairs that could possibly qualify. Comparing all pairs would be O(n²)
 * regardless of how few near misses exist — and near misses are, by design,
 * rare. Deduplicating the input also means each pair is visited exactly once,
 * so no bookkeeping set is needed to suppress repeats.
 */
export const nearMissPairs = (values, tolerance = ALIGNMENT_TOLERANCE) => {
  const sorted = [...new Set(values)].sort((a, b) => a - b);
  const pairs = [];

  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      const delta = sorted[j] - sorted[i];
      if (delta > tolerance) break;
      if (delta > EPSILON) pairs.push([sorted[i], sorted[j]]);
    }
  }

  return pairs;
};

/**
 * Distinct values in a gap sequence that should be constant.
 *
 * Returns the distinct gaps when the sequence is not uniform, and an empty
 * array when it is. Clustering rather than exact comparison keeps sub-pixel
 * rounding from being reported as a rhythm break.
 */
export const rhythmBreaks = (gaps) => {
  if (gaps.length < 2) return [];

  const clusters = [];
  for (const gap of gaps) {
    let matched = false;
    for (const cluster of clusters) {
      if (near(cluster, gap, EPSILON * 2)) {
        matched = true;
        break;
      }
    }
    if (!matched) {
      clusters.push(gap);
      // A sequence with three distinct gaps is already non-uniform; further
      // clustering adds nothing the report will use.
      if (clusters.length > 3) break;
    }
  }

  return clusters.length > 1 ? clusters.map(round) : [];
};

/** Scale metadata, declared once rather than rebuilt per call. */
const SCALES = [
  { key: "spacing", tokenKey: "spacing", label: "spacing" },
  { key: "radii", tokenKey: "radius", label: "radius" },
  { key: "fontSizes", tokenKey: "text", label: "font size" },
];

const EDGES = [
  ["lefts", "left"],
  ["rights", "right"],
];

/**
 * Turn raw observations into findings. Pure, total, and the whole reason the
 * probe returns numbers instead of verdicts.
 */
export const designFindings = (probe, context) => {
  const findings = [];
  const at = (extra) => ({
    category: "design",
    page: context.page,
    viewport: context.viewport,
    ...extra,
  });

  // -- Alignment: near-miss edges -----------------------------------------
  for (const group of probe.alignmentGroups ?? []) {
    for (const [key, edgeName] of EDGES) {
      for (const [a, b] of nearMissPairs(group[key] ?? [])) {
        findings.push(
          at({
            rule: "near-miss-alignment",
            impact: "moderate",
            selector: group.container,
            message: `children are ${round(b - a)}px apart on their ${edgeName} edge (${round(a)} vs ${round(b)}) — close enough to read as a failed alignment rather than an intentional offset`,
          }),
        );
      }
    }
  }

  // -- Rhythm: non-uniform gaps in a repeated structure -------------------
  for (const group of probe.rhythmGroups ?? []) {
    const breaks = rhythmBreaks(group.gaps ?? []);
    if (breaks.length === 0) continue;

    findings.push(
      at({
        rule: "uneven-rhythm",
        impact: "moderate",
        selector: `${group.container} > ${group.signature}`,
        message: `gaps between repeated siblings are not constant: ${breaks.join("px, ")}px — the same component should sit the same distance from its neighbours`,
      }),
    );
  }

  // -- Lattice membership -------------------------------------------------
  for (const scale of SCALES) {
    const tokens = probe.tokens?.[scale.tokenKey] ?? [];

    for (const measurement of probe.measurements?.[scale.key] ?? []) {
      const verdict = classifyMeasurement(measurement.value, tokens);
      if (verdict === "token") continue;

      const where = measurement.property ? ` (${measurement.property})` : "";
      const offGrid = verdict === "off-grid";

      findings.push(
        at({
          rule: `${offGrid ? "off-scale" : "off-token"}-${scale.key}`,
          impact: offGrid ? "moderate" : "minor",
          selector: measurement.selector,
          message: offGrid
            ? `${scale.label} of ${round(measurement.value)}px is neither a token nor a multiple of the ${GRID_BASE}px base${where}`
            : `${scale.label} of ${round(measurement.value)}px sits on the base grid but is not a token${where} — intentional, or a value that drifted?`,
        }),
      );
    }
  }

  // -- Symmetry ------------------------------------------------------------
  for (const box of probe.asymmetricPadding ?? []) {
    findings.push(
      at({
        rule: "asymmetric-padding",
        impact: "minor",
        selector: box.selector,
        message: `horizontal padding differs: ${round(box.left)}px left, ${round(box.right)}px right`,
      }),
    );
  }

  return findings;
};

// ---------------------------------------------------------------------------
// Browser-side observation
// ---------------------------------------------------------------------------

/**
 * Measure the page once and return raw numbers.
 *
 * A single traversal resolves style and geometry for every visible element and
 * memoises them, so `getComputedStyle` — which forces style resolution and is
 * the dominant cost here — runs exactly once per element instead of once per
 * predicate that asks about it.
 */
export const designProbe = (tokenNames) => {
  const MAX_CONTAINERS = 60;
  const MAX_CHILDREN = 12;
  const MAX_SAMPLED = 150;
  const MAX_ASYMMETRIC = 5;

  const root = getComputedStyle(document.documentElement);
  const readTokens = (names) => {
    const values = [];
    for (const name of names) {
      const value = Number.parseFloat(root.getPropertyValue(name));
      if (Number.isFinite(value)) values.push(value);
    }
    return values;
  };

  // Module-scope helpers are not serialised with the function, so the probe
  // carries its own.
  const round = (value) => Math.round(value * 10) / 10;

  const describe = (element) => {
    const id = element.id ? `#${element.id}` : "";
    const className =
      typeof element.className === "string" ? element.className.trim() : "";
    const classes =
      className === "" ? "" : `.${className.split(/\s+/).slice(0, 2).join(".")}`;
    return `${element.tagName.toLowerCase()}${id}${classes}`;
  };

  const signature = (element) => {
    const className =
      typeof element.className === "string" ? element.className.trim() : "";
    const first = className === "" ? "" : `.${className.split(/\s+/)[0]}`;
    return `${element.tagName.toLowerCase()}${first}`;
  };

  // -- One traversal: style, geometry, and layout participation ------------
  /** @type {Map<Element, {style: CSSStyleDeclaration, box: DOMRect}>} */
  const observed = new Map();
  const laidOut = [];

  for (const element of document.body.querySelectorAll("*")) {
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") continue;
    if (Number(style.opacity) === 0) continue;

    const box = element.getBoundingClientRect();
    if (box.width <= 1 || box.height <= 1) continue;

    observed.set(element, { style, box });

    // Inline and contents boxes flow with text; their edges carry no
    // alignment intent, so they are excluded from geometric comparison.
    if (style.display !== "inline" && style.display !== "contents") {
      laidOut.push(element);
    }
  }

  const visibleChildren = (element) => {
    const children = [];
    for (const child of element.children) {
      const record = observed.get(child);
      if (record === undefined) continue;
      if (record.style.display === "inline" || record.style.display === "contents") {
        continue;
      }
      children.push({ element: child, box: record.box });
      if (children.length >= MAX_CHILDREN) break;
    }
    return children;
  };

  // -- Alignment and rhythm ------------------------------------------------
  const alignmentGroups = [];
  const rhythmGroups = [];

  for (const element of laidOut) {
    if (alignmentGroups.length >= MAX_CONTAINERS) break;
    if (element.children.length < 2) continue;

    const children = visibleChildren(element);
    if (children.length < 2) continue;

    const container = describe(element);
    const lefts = new Set();
    const rights = new Set();
    for (const { box } of children) {
      lefts.add(round(box.left));
      rights.add(round(box.right));
    }
    alignmentGroups.push({ container, lefts: [...lefts], rights: [...rights] });

    // Rhythm needs at least three siblings of the same shape, stacked.
    if (children.length < 3 || rhythmGroups.length >= 20) continue;

    const first = signature(children[0].element);
    let uniform = true;
    for (const child of children) {
      if (signature(child.element) !== first) {
        uniform = false;
        break;
      }
    }
    if (!uniform) continue;

    const gaps = [];
    let stacked = true;
    for (let i = 1; i < children.length; i += 1) {
      const gap = children[i].box.top - children[i - 1].box.bottom;
      if (children[i].box.top < children[i - 1].box.bottom - 1) {
        stacked = false;
        break;
      }
      if (gap >= 0) gaps.push(gap);
    }
    if (stacked && gaps.length >= 2) {
      rhythmGroups.push({ container, signature: first, gaps });
    }
  }

  // -- Lattice measurements ------------------------------------------------
  const spacing = [];
  const radii = [];
  const fontSizes = [];
  const asymmetricPadding = [];
  const seen = new Set();

  const push = (bucket, value, selector, property) => {
    if (!Number.isFinite(value) || value === 0) return;
    // Deduplicated by property and value: one report per distinct measurement
    // is enough to find the rule that produced it.
    const key = `${property}:${Math.round(value * 10)}`;
    if (seen.has(key)) return;
    seen.add(key);
    bucket.push({ value, selector, property });
  };

  const SPACING_PROPERTIES = [
    "paddingTop",
    "paddingBottom",
    "paddingLeft",
    "paddingRight",
    "rowGap",
    "columnGap",
  ];

  let sampled = 0;
  for (const element of laidOut) {
    if (sampled >= MAX_SAMPLED) break;
    sampled += 1;

    const { style } = observed.get(element);
    const selector = describe(element);

    for (const property of SPACING_PROPERTIES) {
      push(spacing, Number.parseFloat(style[property]), selector, property);
    }

    // Only uniform radii; a deliberately shaped corner is not a scale error.
    if (style.borderTopLeftRadius === style.borderBottomRightRadius) {
      push(radii, Number.parseFloat(style.borderTopLeftRadius), selector, "borderRadius");
    }

    let hasOwnText = false;
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() !== "") {
        hasOwnText = true;
        break;
      }
    }
    if (hasOwnText) {
      push(fontSizes, Number.parseFloat(style.fontSize), selector, "fontSize");
    }

    if (asymmetricPadding.length < MAX_ASYMMETRIC) {
      const left = Number.parseFloat(style.paddingLeft);
      const right = Number.parseFloat(style.paddingRight);
      const delta = Math.abs(left - right);
      if (Number.isFinite(delta) && delta > 0.5 && delta <= 8) {
        asymmetricPadding.push({ selector, left, right });
      }
    }
  }

  return {
    tokens: {
      spacing: readTokens(tokenNames.spacing),
      radius: readTokens(tokenNames.radius),
      text: readTokens(tokenNames.text),
    },
    alignmentGroups,
    rhythmGroups,
    measurements: { spacing, radii, fontSizes },
    asymmetricPadding,
  };
};
