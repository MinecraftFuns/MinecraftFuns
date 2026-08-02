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
 * Everything here is pure: `designProbe` runs in the browser and only
 * *observes*, returning raw numbers. Classification happens on this side, so
 * the judgement is unit-testable without a browser — which matters, because
 * the browser is the part CI cannot run locally.
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
 * the uncanny interval where the eye registers an error without being able to
 * name it.
 */
export const ALIGNMENT_TOLERANCE = 4;

/** Token custom properties, by name. Values are read from the live page so
 *  that clamp()-based fluid tokens resolve to whatever they are at this
 *  viewport, rather than being duplicated here and drifting. */
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

/**
 * Where a measurement sits relative to the design lattice.
 *
 * `token`   — a generator, exactly as designed.
 * `on-grid` — not a token but a multiple of the base; plausible, worth a look.
 * `off-grid`— neither; almost always an accident.
 */
export const classifyMeasurement = (value, tokens, base = GRID_BASE) => {
  if (near(value, 0)) return "token";
  if (tokens.some((token) => near(token, value))) return "token";

  const remainder = Math.abs(value) % base;
  if (remainder <= EPSILON || base - remainder <= EPSILON) return "on-grid";

  return "off-grid";
};

/**
 * The uncanny interval: different enough to see, too close to read as intent.
 */
export const isNearMiss = (a, b, tolerance = ALIGNMENT_TOLERANCE) => {
  const delta = Math.abs(a - b);
  return delta > EPSILON && delta <= tolerance;
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
    const existing = clusters.find((cluster) => near(cluster, gap, EPSILON * 2));
    if (existing === undefined) clusters.push(gap);
  }

  return clusters.length > 1 ? clusters.map((gap) => Math.round(gap * 10) / 10) : [];
};

const round = (value) => Math.round(value * 10) / 10;

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

  // -- Alignment: near-miss edges ----------------------------------------
  for (const group of probe.alignmentGroups ?? []) {
    for (const edge of ["lefts", "rights"]) {
      const values = group[edge] ?? [];
      const reported = new Set();

      for (let i = 0; i < values.length; i += 1) {
        for (let j = i + 1; j < values.length; j += 1) {
          if (!isNearMiss(values[i], values[j])) continue;
          // Canonical, so (a, b) and (b, a) are one pair rather than two.
          const key = [round(values[i]), round(values[j])]
            .sort((left, right) => left - right)
            .join("-");
          if (reported.has(key)) continue;
          reported.add(key);

          findings.push(
            at({
              rule: "near-miss-alignment",
              impact: "moderate",
              selector: group.container,
              message: `children are ${round(Math.abs(values[i] - values[j]))}px apart on their ${edge.slice(0, -1)} edge (${round(values[i])} vs ${round(values[j])}) — close enough to read as a failed alignment rather than an intentional offset`,
            }),
          );
        }
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
  const scales = [
    { key: "spacing", tokens: probe.tokens?.spacing ?? [], label: "spacing" },
    { key: "radii", tokens: probe.tokens?.radius ?? [], label: "radius" },
    { key: "fontSizes", tokens: probe.tokens?.text ?? [], label: "font size" },
  ];

  for (const scale of scales) {
    for (const measurement of probe.measurements?.[scale.key] ?? []) {
      const verdict = classifyMeasurement(measurement.value, scale.tokens);
      if (verdict === "token") continue;

      findings.push(
        at({
          rule:
            verdict === "off-grid"
              ? `off-scale-${scale.key}`
              : `off-token-${scale.key}`,
          impact: verdict === "off-grid" ? "moderate" : "minor",
          selector: measurement.selector,
          message:
            verdict === "off-grid"
              ? `${scale.label} of ${round(measurement.value)}px is neither a token nor a multiple of the ${GRID_BASE}px base${measurement.property ? ` (${measurement.property})` : ""}`
              : `${scale.label} of ${round(measurement.value)}px sits on the base grid but is not a token${measurement.property ? ` (${measurement.property})` : ""} — intentional, or a value that drifted?`,
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
//
// Runs via page.evaluate. Returns raw numbers only — every judgement above is
// made in Node, where it can be tested.
// ---------------------------------------------------------------------------

export const designProbe = (tokenNames) => {
  const root = getComputedStyle(document.documentElement);

  const readTokens = (names) =>
    names
      .map((name) => Number.parseFloat(root.getPropertyValue(name)))
      .filter((value) => Number.isFinite(value));

  const describe = (element) => {
    const id = element.id ? `#${element.id}` : "";
    const cls =
      typeof element.className === "string" && element.className.trim() !== ""
        ? `.${element.className.trim().split(/\s+/).slice(0, 2).join(".")}`
        : "";
    return `${element.tagName.toLowerCase()}${id}${cls}`;
  };

  const signature = (element) => {
    const cls =
      typeof element.className === "string" && element.className.trim() !== ""
        ? `.${element.className.trim().split(/\s+/)[0]}`
        : "";
    return `${element.tagName.toLowerCase()}${cls}`;
  };

  const isVisible = (element) => {
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (Number(style.opacity) === 0) return false;
    const box = element.getBoundingClientRect();
    return box.width > 1 && box.height > 1;
  };

  /** Inline elements flow with text; their edges carry no alignment intent. */
  const participatesInLayout = (element) => {
    const display = getComputedStyle(element).display;
    return display !== "inline" && display !== "contents";
  };

  const containers = [...document.body.querySelectorAll("*")]
    .filter(isVisible)
    .filter((element) => element.children.length >= 2)
    .slice(0, 60);

  // -- Alignment groups ---------------------------------------------------
  const alignmentGroups = containers
    .map((container) => {
      const children = [...container.children]
        .filter(isVisible)
        .filter(participatesInLayout)
        .slice(0, 12);
      if (children.length < 2) return null;

      const boxes = children.map((child) => child.getBoundingClientRect());
      return {
        container: describe(container),
        lefts: [...new Set(boxes.map((box) => Math.round(box.left * 10) / 10))],
        rights: [...new Set(boxes.map((box) => Math.round(box.right * 10) / 10))],
      };
    })
    .filter((group) => group !== null);

  // -- Rhythm groups: three or more siblings of the same shape ------------
  const rhythmGroups = containers
    .map((container) => {
      const children = [...container.children]
        .filter(isVisible)
        .filter(participatesInLayout);
      if (children.length < 3) return null;

      // Only compare like with like; a heading followed by paragraphs is not
      // a repeated structure and is not expected to have uniform gaps.
      const first = signature(children[0]);
      if (!children.every((child) => signature(child) === first)) return null;

      const boxes = children.map((child) => child.getBoundingClientRect());

      // Vertically stacked only: a horizontal row has no vertical rhythm.
      const stacked = boxes.every(
        (box, index) => index === 0 || box.top >= boxes[index - 1].bottom - 1,
      );
      if (!stacked) return null;

      const gaps = boxes
        .slice(1)
        .map((box, index) => box.top - boxes[index].bottom)
        .filter((gap) => gap >= 0);

      return { container: describe(container), signature: first, gaps };
    })
    .filter((group) => group !== null)
    .slice(0, 20);

  // -- Lattice measurements ------------------------------------------------
  const sampled = [...document.body.querySelectorAll("*")]
    .filter(isVisible)
    .filter(participatesInLayout)
    .slice(0, 150);

  const spacing = [];
  const radii = [];
  const fontSizes = [];
  const asymmetricPadding = [];
  const seen = new Set();

  const push = (bucket, value, selector, property) => {
    if (!Number.isFinite(value) || value === 0) return;
    const key = `${property}:${Math.round(value * 10)}`;
    if (seen.has(key)) return;
    seen.add(key);
    bucket.push({ value, selector, property });
  };

  for (const element of sampled) {
    const style = getComputedStyle(element);
    const selector = describe(element);

    for (const property of ["paddingTop", "paddingBottom", "paddingLeft", "paddingRight", "rowGap", "columnGap"]) {
      push(spacing, Number.parseFloat(style[property]), selector, property);
    }

    // Only uniform radii; a deliberately shaped corner is not a scale error.
    const radius = Number.parseFloat(style.borderTopLeftRadius);
    if (
      Number.isFinite(radius) &&
      style.borderTopLeftRadius === style.borderBottomRightRadius
    ) {
      push(radii, radius, selector, "borderRadius");
    }

    const hasOwnText = [...element.childNodes].some(
      (node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim() !== "",
    );
    if (hasOwnText) {
      push(fontSizes, Number.parseFloat(style.fontSize), selector, "fontSize");
    }

    const left = Number.parseFloat(style.paddingLeft);
    const right = Number.parseFloat(style.paddingRight);
    if (
      Number.isFinite(left) &&
      Number.isFinite(right) &&
      Math.abs(left - right) > 0.5 &&
      Math.abs(left - right) <= 8 &&
      asymmetricPadding.length < 5
    ) {
      asymmetricPadding.push({ selector, left, right });
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
