/**
 * In-page checks, kept separate from the driver so they can be reasoned about
 * (and unit-tested) without a browser.
 *
 * Each exported function is a *string-serialisable* body run inside the page by
 * `page.evaluate`, or a pure function over collected data. Nothing here touches
 * Playwright; the driver in run.mjs owns every effect.
 */

/** Severity ordering used for sorting and summarising. */
export const IMPACT_ORDER = ["critical", "serious", "moderate", "minor", "info"];

export const compareFindings = (a, b) => {
  const byImpact =
    IMPACT_ORDER.indexOf(a.impact ?? "info") -
    IMPACT_ORDER.indexOf(b.impact ?? "info");
  if (byImpact !== 0) return byImpact;
  return `${a.page}${a.rule}`.localeCompare(`${b.page}${b.rule}`);
};

/**
 * Collapse findings that repeat across viewports and colour schemes.
 *
 * The same contrast failure reported at four viewport/scheme combinations is
 * one problem to fix, not four. Contexts are folded into a list so nothing is
 * lost — a fault that appears only in dark mode still says so.
 */
export const dedupeFindings = (findings) => {
  const merged = new Map();

  for (const finding of findings) {
    const key = [finding.category, finding.rule, finding.page, finding.selector ?? ""].join("|");
    const seen = merged.get(key);
    const context = [finding.viewport, finding.colorScheme]
      .filter(Boolean)
      .join("/");

    if (seen === undefined) {
      merged.set(key, { ...finding, contexts: context === "" ? [] : [context] });
      continue;
    }
    if (context !== "" && !seen.contexts.includes(context)) {
      seen.contexts.push(context);
    }
  }

  return [...merged.values()].sort(compareFindings);
};

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
// Page-evaluated probes
//
// These run in the browser. They return plain data; classification into
// findings happens on the Node side so the rules live in one place.
// ---------------------------------------------------------------------------

/** Layout facts that only exist once the page is laid out at a given width. */
export const layoutProbe = () => {
  const viewportWidth = window.innerWidth;
  const describe = (element) => {
    const id = element.id ? `#${element.id}` : "";
    const cls =
      typeof element.className === "string" && element.className.trim() !== ""
        ? `.${element.className.trim().split(/\s+/).slice(0, 2).join(".")}`
        : "";
    return `${element.tagName.toLowerCase()}${id}${cls}`;
  };

  const visible = (element) => {
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return false;
    if (Number(style.opacity) === 0) return false;
    const box = element.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  };

  const all = [...document.body.querySelectorAll("*")].filter(visible);

  // Elements extending past the viewport's right edge. The document-level
  // scrollWidth check says *that* the page overflows; this says what did it.
  const overflowing = all
    .filter((element) => {
      const box = element.getBoundingClientRect();
      return box.right > viewportWidth + 1 && box.width <= viewportWidth * 2;
    })
    .slice(0, 10)
    .map((element) => ({
      selector: describe(element),
      right: Math.round(element.getBoundingClientRect().right),
    }));

  // Text smaller than 12px is hard to read on any device.
  const tinyText = all
    .filter((element) => {
      const text = [...element.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent?.trim() ?? "")
        .join("");
      if (text.length === 0) return false;
      return Number.parseFloat(getComputedStyle(element).fontSize) < 12;
    })
    .slice(0, 10)
    .map((element) => ({
      selector: describe(element),
      fontSize: getComputedStyle(element).fontSize,
      sample: (element.textContent ?? "").trim().slice(0, 40),
    }));

  // Text clipped by its own container rather than wrapping.
  const clipped = all
    .filter((element) => {
      const style = getComputedStyle(element);
      if (style.overflowX !== "hidden" && style.overflow !== "hidden") return false;
      return element.scrollWidth > element.clientWidth + 1 && element.clientWidth > 0;
    })
    .slice(0, 10)
    .map((element) => ({
      selector: describe(element),
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));

  // WCAG 2.2 target size (2.5.8) is 24x24 CSS pixels.
  const interactive = [
    ...document.querySelectorAll(
      'a[href], button, input, select, textarea, [role="button"], [role="link"], [tabindex]:not([tabindex="-1"])',
    ),
  ].filter(visible);

  const smallTargets = interactive
    .filter((element) => {
      const box = element.getBoundingClientRect();
      // Inline links inside a paragraph are explicitly exempt from 2.5.8.
      const inlineInProse = getComputedStyle(element).display === "inline";
      return !inlineInProse && (box.width < 24 || box.height < 24);
    })
    .slice(0, 10)
    .map((element) => {
      const box = element.getBoundingClientRect();
      return {
        selector: describe(element),
        width: Math.round(box.width),
        height: Math.round(box.height),
      };
    });

  return {
    documentScrollWidth: document.documentElement.scrollWidth,
    viewportWidth,
    overflowing,
    tinyText,
    clipped,
    smallTargets,
    interactiveCount: interactive.length,
  };
};

/** Facts that do not depend on viewport size. */
export const documentProbe = () => {
  const meta = (name) =>
    document.querySelector(`meta[name="${name}"]`)?.getAttribute("content") ?? "";

  const bodyStyle = getComputedStyle(document.body);

  return {
    title: document.title,
    description: meta("description"),
    lang: document.documentElement.lang,
    h1Count: document.querySelectorAll("h1").length,
    scriptCount: document.scripts.length,
    // Whether the intended webfont actually took effect, or a fallback did.
    bodyFontFamily: bodyStyle.fontFamily,
    fontsStatus: document.fonts?.status ?? "unknown",
    backgroundColor: bodyStyle.backgroundColor,
    textColor: bodyStyle.color,
    internalLinks: [...document.querySelectorAll("a[href]")]
      .map((anchor) => anchor.getAttribute("href") ?? "")
      .filter((href) => href.startsWith("/")),
    externalLinks: [...document.querySelectorAll("a[href]")]
      .map((anchor) => anchor.getAttribute("href") ?? "")
      .filter((href) => /^https?:\/\//i.test(href)),
  };
};

/** Whether motion is actually suppressed when the user asks for it. */
export const motionProbe = () => {
  const animated = [...document.querySelectorAll("*")]
    .filter((element) => {
      const style = getComputedStyle(element);
      const durations = `${style.transitionDuration} ${style.animationDuration}`;
      return /\b(?!0)(\d+(\.\d+)?)s\b/.test(durations);
    })
    .slice(0, 5)
    .map((element) => element.tagName.toLowerCase());
  return { animated };
};
