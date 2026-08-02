/**
 * In-page probes and pure classification, kept apart from the driver.
 *
 * The probes are serialised into the browser by `page.evaluate`, so they close
 * over nothing and return raw numbers only. Every judgement is made on the Node
 * side, where it can be tested without a browser.
 *
 * Both probes make exactly one `getComputedStyle` call per element. That is the
 * expensive operation in the DOM — it forces style resolution — and calling it
 * once per predicate instead would multiply the cost of the whole audit by the
 * number of predicates.
 */

/** Severity ordering, most severe first. */
export const IMPACT_ORDER = ["critical", "serious", "moderate", "minor", "info"];

/**
 * Rank lookup, built once. A comparator runs O(n log n) times, so a linear
 * `indexOf` inside it would make sorting O(n log n · |IMPACT_ORDER|).
 */
const IMPACT_RANK = new Map(IMPACT_ORDER.map((impact, index) => [impact, index]));
const DEFAULT_RANK = IMPACT_RANK.get("info");

const rankOf = (impact) => IMPACT_RANK.get(impact) ?? DEFAULT_RANK;

/** Ordered by severity, then by page and rule for a stable, readable report. */
export const compareFindings = (a, b) => {
  const byImpact = rankOf(a.impact) - rankOf(b.impact);
  if (byImpact !== 0) return byImpact;

  // Compared field by field rather than by concatenating keys: a template
  // literal per comparison allocates a string for every step of the sort.
  const byPage = a.page.localeCompare(b.page);
  return byPage !== 0 ? byPage : a.rule.localeCompare(b.rule);
};

/**
 * Collapse findings that repeat across viewports and colour schemes.
 *
 * The same contrast failure at four viewport/scheme combinations is one problem
 * to fix, not four. Contexts accumulate in a Set so membership is O(1) and
 * order is preserved for the report.
 */
export const dedupeFindings = (findings) => {
  const merged = new Map();

  for (const finding of findings) {
    const key = `${finding.category}|${finding.rule}|${finding.page}|${finding.selector ?? ""}`;
    const context =
      finding.viewport && finding.colorScheme
        ? `${finding.viewport}/${finding.colorScheme}`
        : (finding.viewport ?? finding.colorScheme ?? "");

    const existing = merged.get(key);
    if (existing === undefined) {
      merged.set(key, {
        finding,
        contexts: context === "" ? new Set() : new Set([context]),
      });
    } else if (context !== "") {
      existing.contexts.add(context);
    }
  }

  return Array.from(merged.values(), ({ finding, contexts }) => ({
    ...finding,
    contexts: [...contexts],
  })).sort(compareFindings);
};

/** Single pass; both tallies are built together rather than in two traversals. */
export const summarise = (findings) => {
  const byCategory = {};
  const byImpact = {};

  for (const finding of findings) {
    byCategory[finding.category] = (byCategory[finding.category] ?? 0) + 1;
    const impact = finding.impact ?? "info";
    byImpact[impact] = (byImpact[impact] ?? 0) + 1;
  }

  return { total: findings.length, byCategory, byImpact };
};

// ---------------------------------------------------------------------------
// Browser-side probes
// ---------------------------------------------------------------------------

/** Shared by both probes; kept as a string so it survives serialisation. */
const INTERACTIVE_SELECTOR =
  'a[href], button, input, select, textarea, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])';

/**
 * Layout facts that only exist once the page is laid out at a given width.
 *
 * One traversal, one `getComputedStyle` per element, and each result list is
 * capped as it fills rather than by building a full list and slicing it.
 */
export const layoutProbe = (interactiveSelector) => {
  const LIMIT = 10;
  const viewportWidth = window.innerWidth;

  const describe = (element) => {
    const id = element.id ? `#${element.id}` : "";
    const className =
      typeof element.className === "string" ? element.className.trim() : "";
    const classes =
      className === ""
        ? ""
        : `.${className.split(/\s+/).slice(0, 2).join(".")}`;
    return `${element.tagName.toLowerCase()}${id}${classes}`;
  };

  const overflowing = [];
  const tinyText = [];
  const clipped = [];
  const smallTargets = [];
  let interactiveCount = 0;

  for (const element of document.body.querySelectorAll("*")) {
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") continue;
    if (Number(style.opacity) === 0) continue;

    const box = element.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) continue;

    // Own text, resolved once and reused by the font-size check below.
    let ownText = "";
    for (const node of element.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) ownText += node.textContent ?? "";
    }
    ownText = ownText.trim();

    if (
      overflowing.length < LIMIT &&
      box.right > viewportWidth + 1 &&
      box.width <= viewportWidth * 2
    ) {
      overflowing.push({ selector: describe(element), right: Math.round(box.right) });
    }

    if (tinyText.length < LIMIT && ownText !== "") {
      const fontSize = Number.parseFloat(style.fontSize);
      if (fontSize < 12) {
        tinyText.push({
          selector: describe(element),
          fontSize: style.fontSize,
          sample: ownText.slice(0, 40),
        });
      }
    }

    if (
      clipped.length < LIMIT &&
      (style.overflowX === "hidden" || style.overflow === "hidden") &&
      element.clientWidth > 0 &&
      element.scrollWidth > element.clientWidth + 1
    ) {
      clipped.push({
        selector: describe(element),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
      });
    }

    if (element.matches(interactiveSelector)) {
      interactiveCount += 1;
      // WCAG 2.5.8 exempts links flowing inline within a block of text.
      if (
        smallTargets.length < LIMIT &&
        style.display !== "inline" &&
        (box.width < 24 || box.height < 24)
      ) {
        smallTargets.push({
          selector: describe(element),
          width: Math.round(box.width),
          height: Math.round(box.height),
        });
      }
    }
  }

  return {
    documentScrollWidth: document.documentElement.scrollWidth,
    viewportWidth,
    overflowing,
    tinyText,
    clipped,
    smallTargets,
    interactiveCount,
  };
};

/** Facts that do not vary with viewport size. */
export const documentProbe = () => {
  const description =
    document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "";
  const bodyStyle = getComputedStyle(document.body);

  // One traversal of the anchors, partitioned as it goes.
  const internalLinks = [];
  const externalLinks = [];
  for (const anchor of document.querySelectorAll("a[href]")) {
    const href = anchor.getAttribute("href") ?? "";
    if (href.startsWith("/") && !href.startsWith("//")) internalLinks.push(href);
    else if (/^https?:\/\//i.test(href)) externalLinks.push(href);
  }

  return {
    title: document.title,
    description,
    lang: document.documentElement.lang,
    h1Count: document.querySelectorAll("h1").length,
    scriptCount: document.scripts.length,
    bodyFontFamily: bodyStyle.fontFamily,
    fontsStatus: document.fonts?.status ?? "unknown",
    backgroundColor: bodyStyle.backgroundColor,
    textColor: bodyStyle.color,
    internalLinks,
    externalLinks,
  };
};

/** Whether motion actually stops when the user asks for it. */
export const motionProbe = () => {
  const animated = [];
  const MOVING = /\b(?!0s)\d+(\.\d+)?s\b/;

  for (const element of document.querySelectorAll("*")) {
    if (animated.length >= 5) break;
    const style = getComputedStyle(element);
    if (MOVING.test(style.transitionDuration) || MOVING.test(style.animationDuration)) {
      animated.push(element.tagName.toLowerCase());
    }
  }

  return { animated };
};

export { INTERACTIVE_SELECTOR };
