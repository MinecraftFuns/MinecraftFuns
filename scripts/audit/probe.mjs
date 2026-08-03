/**
 * Browser-side observation. These run inside the page via `page.evaluate`,
 * which serialises the function alone, so each is self-contained and shares
 * nothing with module scope.
 *
 * `pageProbe` merges layout and design measurement into one traversal: both
 * need the same visibility filter and the same computed style, and resolving
 * style twice per element is the dominant cost here.
 */

/** Interactive elements, per WCAG target-size and focus checks. */
export const INTERACTIVE_SELECTOR =
  'a[href], button, input, select, textarea, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])';

/** Caps keep one pathological page from flooding the report. */
const LIMITS = { findings: 10, containers: 60, children: 12, sampled: 150, asymmetric: 5 };

const SPACING_PROPERTIES = [
  "paddingTop",
  "paddingBottom",
  "paddingLeft",
  "paddingRight",
  "rowGap",
  "columnGap",
];

/**
 * Measure the page once, returning raw numbers only. Every verdict is reached
 * in Node, where it can be tested without a browser.
 */
export const pageProbe = ({ interactiveSelector, tokenNames, includeDesign, limits, spacingProperties }) => {
  const round = (value) => Math.round(value * 10) / 10;

  const describe = (element) => {
    const id = element.id ? `#${element.id}` : "";
    const names = typeof element.className === "string" ? element.className.trim() : "";
    const classes = names === "" ? "" : `.${names.split(/\s+/).slice(0, 2).join(".")}`;
    return `${element.tagName.toLowerCase()}${id}${classes}`;
  };

  const signature = (element) => {
    const names = typeof element.className === "string" ? element.className.trim() : "";
    return `${element.tagName.toLowerCase()}${names === "" ? "" : `.${names.split(/\s+/)[0]}`}`;
  };

  const ownText = (element) =>
    [...element.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent ?? "")
      .join("")
      .trim();

  /**
   * Conjunction of predicates, so a chain of filters becomes one pass.
   *
   * Predicates over a value form a monoid under `&&` with identity `true`,
   * and this is its fold: `xs.filter(p).filter(q)` and `xs.filter(allOf(p, q))`
   * accept the same elements in the same order whenever the predicates are
   * pure, which every predicate below is.
   *
   * It is not free the way fusion is in a language that performs it. Both
   * forms evaluate each predicate exactly as many times, since both stop at
   * the first failure; what the fused form removes is one traversal and one
   * intermediate array per stage. That is the cost worth removing here,
   * because these run over every element in the document.
   */
  const allOf =
    (...predicates) =>
    (value) => {
      for (const predicate of predicates) {
        if (!predicate(value)) return false;
      }
      return true;
    };

  /** First occurrence wins, so the reported selector is the first offender. */
  const dedupeBy = (items, keyOf) => {
    const seen = new Map();
    items.forEach((item) => {
      const key = keyOf(item);
      if (!seen.has(key)) seen.set(key, item);
    });
    return [...seen.values()];
  };

  /*
   * One pass, one record per surviving element.
   *
   * `allOf` cannot express this one: the stages alternate between deciding
   * and decorating, and the array API has no combinator for that, so the
   * fusion is written out. The chain it replaces walked the document four
   * times and left three intermediate arrays behind, the last of which copied
   * every record again through a spread. `querySelectorAll("*")` is the
   * largest collection this file touches, which is what makes the stages
   * worth spending clarity on here and nowhere else.
   *
   * Each `continue` is a filter that kept its name: a hidden element has no
   * geometry to measure, and a zero-area box has no edges to compare.
   */
  const visible = [];
  for (const element of document.body.querySelectorAll("*")) {
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) {
      continue;
    }

    const box = element.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) continue;

    visible.push({
      element,
      style,
      box,
      text: ownText(element),
      interactive: element.matches(interactiveSelector),
    });
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
          // Ordered, not merely conjoined: `scrollWidth` below forces layout,
          // so it is read only for the few elements that could possibly clip.
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

  // Inline and contents boxes flow with text, so their edges carry no
  // alignment intent and they are excluded from geometric comparison.
  const laidOut = visible.filter(
    ({ style }) => style.display !== "inline" && style.display !== "contents",
  );
  const byElement = new Map(laidOut.map((entry) => [entry.element, entry]));

  const childrenOf = (element) =>
    [...element.children]
      .map((child) => byElement.get(child))
      .filter((entry) => entry !== undefined)
      .slice(0, limits.children);

  const containers = laidOut
    .filter(({ element }) => element.children.length >= 2)
    .map(({ element }) => ({ element, children: childrenOf(element) }))
    .filter(({ children }) => children.length >= 2)
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
        ({ children }) =>
          children.every(({ element }) => signature(element) === signature(children[0].element)),
        // Vertically stacked only; a horizontal row has no vertical rhythm.
        ({ children }) =>
          children.every(
            ({ box }, index) => index === 0 || box.top >= children[index - 1].box.bottom - 1,
          ),
      ),
    )
    .map(({ element, children }) => ({
      container: describe(element),
      signature: signature(children[0].element),
      gaps: children
        .slice(1)
        .map(({ box }, index) => box.top - children[index].box.bottom)
        .filter((gap) => gap >= 0),
    }))
    .filter(({ gaps }) => gaps.length >= 2)
    .slice(0, 20);

  /*
   * Siblings whose boxes meet with nothing between them.
   *
   * This is the shape of a spacing bug the other rules cannot see: each block
   * is on the grid, each is aligned, and the gap between two of them is simply
   * absent because neither declared it. It happened here when two components
   * placed in one slot brought opposite margins, one leading and one trailing,
   * so a row of tags sat flush on the rule beneath it.
   *
   * Three conditions keep it quiet, each stated at its own predicate below.
   */
  const edge = (value) => Number.parseFloat(value) || 0;

  const flushPairs = containers
    .flatMap(({ element, children }) =>
      children.slice(1).map((after, index) => ({
        container: element,
        before: children[index],
        after,
      })),
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
    // Truncate before describing: a pair beyond the cap is never reported, so
    // building its selectors is work thrown away.
    .slice(0, 20)
    .map(({ container, before, after }) => ({
      container: describe(container),
      before: describe(before.element),
      after: describe(after.element),
    }));

  const sampled = laidOut.slice(0, limits.sampled);
  // Token values come from the live page, so clamp()-based fluid scales
  // resolve to whatever they are at this viewport.
  const rootStyle = getComputedStyle(document.documentElement);

  const measure = (entries, keyOf) =>
    dedupeBy(
      entries.filter(({ value }) => Number.isFinite(value) && value !== 0),
      keyOf,
    );
  const byPropertyValue = ({ property, value }) => `${property}:${Math.round(value * 10)}`;

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
            value: Number.parseFloat(style[property]),
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

/** Arguments for `pageProbe`, assembled here so the driver stays declarative. */
export const probeOptions = (tokenNames, includeDesign) => ({
  interactiveSelector: INTERACTIVE_SELECTOR,
  tokenNames,
  includeDesign,
  limits: LIMITS,
  spacingProperties: SPACING_PROPERTIES,
});

/** Facts that do not vary with viewport size. */
export const documentProbe = () => {
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
export const focusProbe = (selector) => [
  ...new Set(
    [...document.querySelectorAll(selector)]
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
