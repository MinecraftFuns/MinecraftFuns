/** Browser-side observations; probes are serialized by `page.evaluate`. */

/** Interactive elements, per WCAG target-size and focus checks. */
export const INTERACTIVE_SELECTOR =
  'a[href], button, input, select, textarea, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])';

export type Limits = {
  readonly findings: number;
  readonly containers: number;
  readonly children: number;
  readonly sampled: number;
  readonly asymmetric: number;
};

/** A token scale, mapped to the custom properties it is made of. */
export type TokenNames = Readonly<Record<string, readonly string[]>>;

export type ProbeOptions = {
  readonly interactiveSelector: string;
  readonly tokenNames: TokenNames;
  readonly includeDesign: boolean;
  readonly limits: Limits;
  readonly spacingProperties: readonly string[];
};

/** Design measurements returned by `pageProbe`. */
export type Measurement = {
  readonly value: number;
  readonly selector: string;
  readonly property: string;
};

export type AlignmentGroup = {
  readonly container: string;
  readonly lefts: readonly number[];
  readonly rights: readonly number[];
};

export type RhythmGroup = {
  readonly container: string;
  readonly signature: string;
  readonly gaps: readonly number[];
};

export type FlushPair = {
  readonly container: string;
  readonly before: string;
  readonly after: string;
};

export type PaddingBox = {
  readonly selector: string;
  readonly left: number;
  readonly right: number;
};

export type DesignProbe = {
  readonly tokens: Readonly<Record<string, readonly number[]>>;
  readonly alignmentGroups: readonly AlignmentGroup[];
  readonly rhythmGroups: readonly RhythmGroup[];
  readonly flushPairs: readonly FlushPair[];
  readonly measurements: Readonly<Record<string, readonly Measurement[]>>;
  readonly asymmetricPadding: readonly PaddingBox[];
};

/** The layout half of `pageProbe`'s result. */
export type LayoutProbe = {
  readonly documentScrollWidth: number;
  readonly viewportWidth: number;
  readonly interactiveCount: number;
  readonly overflowing: readonly { readonly selector: string; readonly right: number }[];
  readonly tinyText: readonly {
    readonly selector: string;
    readonly fontSize: string;
    readonly sample: string;
  }[];
  readonly clipped: readonly {
    readonly selector: string;
    readonly scrollWidth: number;
    readonly clientWidth: number;
  }[];
  readonly smallTargets: readonly {
    readonly selector: string;
    readonly width: number;
    readonly height: number;
  }[];
};

/** What `documentProbe` reports: facts that do not vary with viewport. */
export type DocumentFacts = {
  readonly title: string;
  readonly description: string;
  readonly lang: string;
  readonly h1Count: number;
  readonly scriptCount: number;
  readonly bodyFontFamily: string;
  readonly backgroundColor: string;
  readonly internalLinks: readonly string[];
};

/** Caps keep one pathological page from flooding the report. */
const LIMITS: Limits = { findings: 10, containers: 60, children: 12, sampled: 150, asymmetric: 5 };

/* CSS spelling, because these are read with `getPropertyValue`, which is the
   only accessor that takes a name computed at runtime. Indexing the style
   declaration with a variable reaches its numeric index signature instead, and
   answers a typo with `undefined` rather than with an error. */
const SPACING_PROPERTIES = [
  "padding-top",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "row-gap",
  "column-gap",
];

/** Measure layout once; Node-side code turns raw values into findings. */
export const pageProbe = ({
  interactiveSelector,
  tokenNames,
  includeDesign,
  limits,
  spacingProperties,
}: ProbeOptions): {
  readonly layout: LayoutProbe;
  readonly design: DesignProbe | null;
} => {
  /** One element with its computed style and box resolved once. */
  type Measured = {
    readonly element: Element;
    readonly style: CSSStyleDeclaration;
    readonly box: DOMRect;
    readonly text: string;
    readonly interactive: boolean;
  };

  const round = (value: number): number => Math.round(value * 10) / 10;

  const describe = (element: Element): string => {
    const id = element.id ? `#${element.id}` : "";
    const names = typeof element.className === "string" ? element.className.trim() : "";
    const classes = names === "" ? "" : `.${names.split(/\s+/).slice(0, 2).join(".")}`;
    return `${element.tagName.toLowerCase()}${id}${classes}`;
  };

  const signature = (element: Element): string => {
    const names = typeof element.className === "string" ? element.className.trim() : "";
    return `${element.tagName.toLowerCase()}${names === "" ? "" : `.${names.split(/\s+/)[0]}`}`;
  };

  const ownText = (element: Element): string =>
    [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? "")
      .join("")
      .trim();

  /** Fuse predicates to avoid intermediate arrays over every element. */
  const allOf =
    <T,>(...predicates: readonly ((value: T) => boolean)[]) =>
    (value: T): boolean => {
      for (const predicate of predicates) {
        if (!predicate(value)) return false;
      }
      return true;
    };

  /** Return adjacent pairs: `[a, b, c]` becomes `[[a, b], [b, c]]`. */
  const consecutive = <T,>(items: readonly T[]): readonly (readonly [T, T])[] => {
    const pairs: (readonly [T, T])[] = [];
    let previous: T | undefined;

    for (const item of items) {
      if (previous !== undefined) pairs.push([previous, item]);
      previous = item;
    }
    return pairs;
  };

  /** First occurrence wins, so the reported selector is the first offender. */
  const dedupeBy = <T,>(items: readonly T[], keyOf: (item: T) => string): readonly T[] => {
    const seen = new Map<string, T>();
    items.forEach((item) => {
      const key = keyOf(item);
      if (!seen.has(key)) seen.set(key, item);
    });
    return [...seen.values()];
  };

  /** Return a visible element with geometry, or `undefined`. */
  const measured = (element: Element): Measured | undefined => {
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
      return undefined;
    }

    const box = element.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return undefined;

    return {
      element,
      style,
      box,
      text: ownText(element),
      interactive: element.matches(interactiveSelector),
    };
  };

  /* Avoid allocating an option-like cell for every element. */
  const visible: Measured[] = [];
  for (const element of document.body.querySelectorAll("*")) {
    const entry = measured(element);
    if (entry !== undefined) visible.push(entry);
  }

  const viewportWidth = window.innerWidth;

  const layout = {
    documentScrollWidth: document.documentElement.scrollWidth,
    viewportWidth,
    interactiveCount: visible.filter(({ interactive }) => interactive).length,

    overflowing: visible
      .filter(({ box }) => box.right > viewportWidth + 1 && box.width <= viewportWidth * 2)
      .slice(0, limits.findings)
      .map(({ element, box }) => ({ selector: describe(element), right: Math.round(box.right) })),

    tinyText: visible
      .filter(({ text, style }) => text !== "" && Number.parseFloat(style.fontSize) < 12)
      .slice(0, limits.findings)
      .map(({ element, style, text }) => ({
        selector: describe(element),
        fontSize: style.fontSize,
        sample: text.slice(0, 40),
      })),

    clipped: visible
      .filter(
        allOf(
          // Read layout-forcing widths only after the cheap style filter.
          ({ style }) => style.overflowX === "hidden" || style.overflow === "hidden",
          ({ element }) =>
            element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 1,
        ),
      )
      .slice(0, limits.findings)
      .map(({ element }) => ({
        selector: describe(element),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      })),

    // WCAG 2.5.8 exempts links flowing inline within a block of text.
    smallTargets: visible
      .filter(
        ({ interactive, style, box }) =>
          interactive && style.display !== "inline" && (box.width < 24 || box.height < 24),
      )
      .slice(0, limits.findings)
      .map(({ element, box }) => ({
        selector: describe(element),
        width: Math.round(box.width),
        height: Math.round(box.height),
      })),
  };

  if (!includeDesign) return { layout, design: null };

  // Inline and contents boxes have no block-edge alignment intent.
  const laidOut = visible.filter(
    ({ style }) => style.display !== "inline" && style.display !== "contents",
  );
  const byElement = new Map(laidOut.map((entry) => [entry.element, entry]));

  const childrenOf = (element: Element): readonly Measured[] =>
    [...element.children]
      .map((child) => byElement.get(child))
      .filter((entry) => entry !== undefined)
      .slice(0, limits.children);

  /* Name the first child once; every group below requires at least two. */
  const containers = laidOut
    .filter(({ element }) => element.children.length >= 2)
    .flatMap(({ element }) => {
      const children = childrenOf(element);
      const [first] = children;

      return first === undefined || children.length < 2
        ? []
        : [{ element, children, first }];
    })
    .slice(0, limits.containers);

  const alignmentGroups = containers.map(({ element, children }) => ({
    container: describe(element),
    lefts: [...new Set(children.map(({ box }) => round(box.left)))],
    rights: [...new Set(children.map(({ box }) => round(box.right)))],
  }));

  const rhythmGroups = containers
    .filter(
      allOf(
        ({ children }) => children.length >= 3,
        // Like compared with like: a heading followed by paragraphs is not a
        // repeated structure and owes no uniform rhythm.
        ({ children, first }) =>
          children.every(({ element }) => signature(element) === signature(first.element)),
        // Vertically stacked only; a horizontal row has no vertical rhythm.
        ({ children }) =>
          consecutive(children).every(
            ([before, after]) => after.box.top >= before.box.bottom - 1,
          ),
      ),
    )
    .map(({ element, children, first }) => ({
      container: describe(element),
      signature: signature(first.element),
      gaps: consecutive(children)
        .map(([before, after]) => after.box.top - before.box.bottom)
        .filter((gap) => gap >= 0),
    }))
    .filter(({ gaps }) => gaps.length >= 2)
    .slice(0, 20);

  /* Find stacked siblings with no declared gap. */
  const edge = (value: string): number => Number.parseFloat(value) || 0;

  const flushPairs = containers
    .flatMap(({ element, children }) =>
      consecutive(children).map(([before, after]) => ({ container: element, before, after })),
    )
    .filter(
      allOf(
        // Stacked, since side-by-side boxes share no vertical edge.
        ({ before, after }) => after.box.top >= before.box.bottom - 1,
        // A list's rows are meant to touch, separated by their own borders.
        ({ before, after }) => signature(before.element) !== signature(after.element),
        // Nothing between them, and no padding standing in for the gap.
        ({ before, after }) =>
          after.box.top - before.box.bottom <= 1 &&
          edge(before.style.paddingBottom) <= 1 &&
          edge(after.style.paddingTop) <= 1,
      ),
    )
    // Truncate before building selectors for unreported pairs.
    .slice(0, 20)
    .map(({ container, before, after }) => ({
      container: describe(container),
      before: describe(before.element),
      after: describe(after.element),
    }));

  const sampled = laidOut.slice(0, limits.sampled);
  // Read live values so fluid tokens resolve at this viewport.
  const rootStyle = getComputedStyle(document.documentElement);

  const measure = <T extends { readonly value: number }>(
    entries: readonly T[],
    keyOf: (entry: T) => string,
  ): readonly T[] =>
    dedupeBy(
      entries.filter(({ value }) => Number.isFinite(value) && value !== 0),
      keyOf,
    );
  const byPropertyValue = ({
    property,
    value,
  }: {
    readonly property: string;
    readonly value: number;
  }): string => `${property}:${Math.round(value * 10)}`;

  const design = {
    tokens: Object.fromEntries(
      Object.entries(tokenNames).map(([scale, names]) => [
        scale,
        names
          .map((name) => Number.parseFloat(rootStyle.getPropertyValue(name)))
          .filter((value) => Number.isFinite(value)),
      ]),
    ),
    alignmentGroups,
    rhythmGroups,
    flushPairs,
    measurements: {
      spacing: measure(
        sampled.flatMap(({ element, style }) =>
          spacingProperties.map((property) => ({
            value: Number.parseFloat(style.getPropertyValue(property)),
            selector: describe(element),
            property,
          })),
        ),
        byPropertyValue,
      ),
      // Uniform corners only; a deliberately shaped corner is not a scale error.
      radii: measure(
        sampled
          .filter(({ style }) => style.borderTopLeftRadius === style.borderBottomRightRadius)
          .map(({ element, style }) => ({
            value: Number.parseFloat(style.borderTopLeftRadius),
            selector: describe(element),
            property: "borderRadius",
          })),
        byPropertyValue,
      ),
      fontSizes: measure(
        sampled
          .filter(({ text }) => text !== "")
          .map(({ element, style }) => ({
            value: Number.parseFloat(style.fontSize),
            selector: describe(element),
            property: "fontSize",
          })),
        byPropertyValue,
      ),
    },
    asymmetricPadding: sampled
      .map(({ element, style }) => ({
        selector: describe(element),
        left: Number.parseFloat(style.paddingLeft),
        right: Number.parseFloat(style.paddingRight),
      }))
      .filter(({ left, right }) => {
        const delta = Math.abs(left - right);
        return Number.isFinite(delta) && delta > 0.5 && delta <= 8;
      })
      .slice(0, limits.asymmetric),
  };

  return { layout, design };
};

/** Assemble probe arguments for the declarative audit driver. */
export const probeOptions = (
  tokenNames: TokenNames,
  includeDesign: boolean,
): ProbeOptions => ({
  interactiveSelector: INTERACTIVE_SELECTOR,
  tokenNames,
  includeDesign,
  limits: LIMITS,
  spacingProperties: SPACING_PROPERTIES,
});

/** Facts that do not vary with viewport size. */
export const documentProbe = (): DocumentFacts => {
  const anchors = [...document.querySelectorAll("a[href]")].map(
    (anchor) => anchor.getAttribute("href") ?? "",
  );
  const bodyStyle = getComputedStyle(document.body);

  return {
    title: document.title,
    description:
      document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
    lang: document.documentElement.lang,
    h1Count: document.querySelectorAll("h1").length,
    scriptCount: document.scripts.length,
    bodyFontFamily: bodyStyle.fontFamily,
    backgroundColor: bodyStyle.backgroundColor,
    internalLinks: anchors.filter((href) => href.startsWith("/") && !href.startsWith("//")),
  };
};

/** Whether motion actually stops when the user asks for it. */
export const motionProbe = () => {
  const moving = /\b(?!0s)\d+(\.\d+)?s\b/;
  return {
    animated: [...document.querySelectorAll("*")]
      .filter((element) => {
        const style = getComputedStyle(element);
        return moving.test(style.transitionDuration) || moving.test(style.animationDuration);
      })
      .slice(0, 5)
      .map((element) => element.tagName.toLowerCase()),
  };
};

/**
 * Tag names whose focus draws no visible ring. Programmatic focus does not
 * always satisfy `:focus-visible`, so this informs rather than accuses.
 */
export const focusProbe = (selector: string): readonly string[] => [
  ...new Set(
    /* Typed as `HTMLElement`, since `focus` below is not on `Element`. */
    [...document.querySelectorAll<HTMLElement>(selector)]
      .slice(0, 20)
      .filter((element) => {
        element.focus();
        const style = getComputedStyle(element);
        const outlined =
          style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0;
        return !outlined && style.boxShadow === "none";
      })
      .map((element) => element.tagName.toLowerCase()),
  ),
];

/** Whether the page overflows its width; used under print emulation. */
export const overflowProbe = () =>
  document.documentElement.scrollWidth > window.innerWidth + 1;
