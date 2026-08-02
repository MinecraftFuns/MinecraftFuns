/**
 * Browser audit driver.
 *
 * Loads every built page in a real browser at several viewport widths, in both
 * colour schemes, and records what a browser can see that static analysis
 * cannot: computed contrast, layout overflow, focus behaviour, runtime errors,
 * and design conformance.
 *
 * Deliberately non-blocking. It always exits 0, and the workflow does not gate
 * deployment on it. An audit that can fail a deploy is one that gets disabled
 * the first time it is inconvenient; one that only reports stays.
 *
 * Cost model, since this is the slowest job in the pipeline:
 *   - Browser contexts are created per (viewport, scheme) and reused across
 *     routes. A context is heavyweight — a fresh profile — while a page is
 *     cheap, so the loop is ordered contexts-outermost: 8 contexts rather than
 *     one per page visit.
 *   - Screenshots reuse the page already loaded for the audit rather than
 *     navigating a second time, halving page loads at those viewports.
 *   - Link probing runs through a bounded worker pool instead of sequential
 *     awaits, turning a sum of round trips into a maximum of them.
 *
 * Everything effectful lives here. Classification lives in checks.mjs and
 * design.mjs, rendering in report.mjs — all pure and unit-tested.
 */

import { spawn } from "node:child_process";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { AxeBuilder } from "@axe-core/playwright";
import { chromium } from "playwright";

import {
  dedupeFindings,
  documentProbe,
  INTERACTIVE_SELECTOR,
  layoutProbe,
  motionProbe,
} from "./checks.mjs";
import { designFindings, designProbe, TOKEN_NAMES } from "./design.mjs";
import { toJson, toMarkdown } from "./report.mjs";

const PORT = Number(process.env.AUDIT_PORT ?? 4321);
/** Defaults describe the eventual primary target: joefang.org, served at root. */
const BASE = process.env.SITE_BASE ?? "/";
const SITE = process.env.SITE_URL ?? "https://joefang.org";
const DIST = resolve(process.env.DIST_DIR ?? "dist");
const OUT = resolve(process.env.AUDIT_OUT ?? "audit");
const ORIGIN = `http://localhost:${PORT}`;

/** Base without its trailing slash, so joining a rooted route cannot double up. */
const BASE_PREFIX = BASE.replace(/\/+$/, "");
const urlFor = (route) => `${ORIGIN}${BASE_PREFIX}${route}`;

/** Filesystem-safe label for a route, so "/" does not become an empty name. */
const slug = (route) => route.replace(/^\/|\/$/g, "").replaceAll("/", "_") || "home";

/**
 * 320 is the narrowest width WCAG 1.4.10 (reflow) expects to work; 1440 is a
 * common desktop. Axe runs only at the extremes — the middle widths exist to
 * catch layout overflow, which is where they actually differ. `capture` marks
 * the widths worth a screenshot.
 */
const VIEWPORTS = [
  { name: "narrow", width: 320, height: 640, axe: true, capture: false },
  { name: "mobile", width: 390, height: 844, axe: false, capture: true },
  { name: "tablet", width: 768, height: 1024, axe: false, capture: false },
  { name: "desktop", width: 1440, height: 900, axe: true, capture: true },
];

const SCHEMES = ["light", "dark"];

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

/** Concurrent link probes: enough to hide latency, few enough to stay polite. */
const LINK_CONCURRENCY = 8;

const findings = [];
const record = (finding) => findings.push(finding);

/**
 * Bounded worker pool. `limit` tasks stay in flight and each worker pulls the
 * next index as it frees up, so total time is bounded by the slowest worker
 * rather than by the sum of all tasks.
 */
const mapConcurrent = async (items, limit, task) => {
  const results = new Array(items.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await task(items[index], index);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
};

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

const startPreview = async () => {
  const server = spawn(
    process.execPath,
    ["node_modules/astro/bin/astro.mjs", "preview", "--port", String(PORT)],
    { stdio: "ignore" },
  );

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(urlFor("/"));
      if (response.ok) return server;
    } catch {
      // Not listening yet.
    }
    await new Promise((continueAfter) => setTimeout(continueAfter, 250));
  }

  server.kill();
  throw new Error(`preview server did not become ready on ${urlFor("/")}`);
};

/** Every built page, discovered rather than hardcoded so new routes are covered. */
const discoverRoutes = async (dir) => {
  const walk = async (current) => {
    const entries = await readdir(current, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map(async (entry) => {
        const path = join(current, entry.name);
        return entry.isDirectory() ? walk(path) : [path];
      }),
    );
    return nested.flat();
  };

  const files = await walk(dir);
  return files
    .filter((path) => path.endsWith("index.html"))
    .map((path) => `/${relative(dir, path).replace(/index\.html$/, "")}`.replace(/\/+/g, "/"))
    .sort();
};

// ---------------------------------------------------------------------------
// Per-page audit
// ---------------------------------------------------------------------------

const attachRuntimeListeners = (page, where) => {
  page.on("pageerror", (error) =>
    record({
      ...where,
      category: "runtime",
      rule: "uncaught-exception",
      impact: "critical",
      message: String(error?.message ?? error),
    }),
  );

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    record({
      ...where,
      category: "runtime",
      rule: "console-error",
      impact: "serious",
      message: message.text().slice(0, 300),
    });
  });

  page.on("requestfailed", (request) =>
    record({
      ...where,
      category: "runtime",
      rule: "request-failed",
      impact: "serious",
      message: `${request.method()} ${request.url()} — ${request.failure()?.errorText ?? "failed"}`,
    }),
  );

  page.on("response", (response) => {
    if (response.status() < 400) return;
    record({
      ...where,
      category: "runtime",
      rule: "http-error",
      impact: "serious",
      message: `${response.status()} ${response.url()}`,
    });
  });
};

const auditPage = async (context, route, viewport, scheme) => {
  const page = await context.newPage();
  const where = { page: route, viewport: viewport.name, colorScheme: scheme };

  attachRuntimeListeners(page, where);
  await page.goto(urlFor(route), { waitUntil: "load" });

  // -- Layout and readability ---------------------------------------------
  const layout = await page.evaluate(layoutProbe, INTERACTIVE_SELECTOR);

  if (layout.documentScrollWidth > layout.viewportWidth + 1) {
    record({
      ...where,
      category: "readability",
      rule: "horizontal-overflow",
      impact: "serious",
      message: `page scrolls horizontally: content is ${layout.documentScrollWidth}px wide in a ${layout.viewportWidth}px viewport`,
    });
  }

  for (const element of layout.overflowing) {
    record({
      ...where,
      category: "readability",
      rule: "element-overflows-viewport",
      impact: "moderate",
      selector: element.selector,
      message: `extends to ${element.right}px, past the ${layout.viewportWidth}px viewport`,
    });
  }

  for (const element of layout.tinyText) {
    record({
      ...where,
      category: "readability",
      rule: "text-below-12px",
      impact: "moderate",
      selector: element.selector,
      message: `${element.fontSize} text: "${element.sample}"`,
    });
  }

  for (const element of layout.clipped) {
    record({
      ...where,
      category: "readability",
      rule: "text-clipped",
      impact: "moderate",
      selector: element.selector,
      message: `content is ${element.scrollWidth}px inside a ${element.clientWidth}px box with hidden overflow`,
    });
  }

  // Target size matters where fingers are used; reported on touch-sized
  // viewports only, to avoid noise about a desktop pointer.
  if (viewport.width <= 768) {
    for (const element of layout.smallTargets) {
      record({
        ...where,
        category: "accessibility",
        rule: "target-size-under-24px",
        impact: "moderate",
        selector: element.selector,
        message: `${element.width}x${element.height}px, below the 24x24 minimum (WCAG 2.5.8)`,
      });
    }
  }

  // -- Design conformance --------------------------------------------------
  // Geometry does not depend on the colour scheme, so this runs once per
  // viewport; measuring in both would only duplicate every finding.
  if (scheme === "light") {
    const probe = await page.evaluate(designProbe, TOKEN_NAMES);
    for (const found of designFindings(probe, { page: route, viewport: viewport.name })) {
      record(found);
    }
  }

  // -- Accessibility -------------------------------------------------------
  if (viewport.axe) {
    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    for (const violation of results.violations) {
      for (const node of violation.nodes.slice(0, 5)) {
        record({
          ...where,
          category: "accessibility",
          rule: violation.id,
          impact: violation.impact ?? "moderate",
          selector: node.target.join(" "),
          message: violation.help,
          help: violation.helpUrl,
        });
      }
    }
  }

  // -- Document-level facts, once per scheme ------------------------------
  let documentFacts = null;
  if (viewport.name === "desktop") {
    documentFacts = await page.evaluate(documentProbe);

    if (documentFacts.scriptCount > 0) {
      record({
        ...where,
        category: "runtime",
        rule: "unexpected-script",
        impact: "moderate",
        message: `${documentFacts.scriptCount} script element(s) — this site is intended to ship no client JavaScript`,
      });
    }

    if (documentFacts.title.trim() === "") {
      record({
        ...where,
        category: "meta",
        rule: "missing-title",
        impact: "serious",
        message: "document has no title",
      });
    }

    if (documentFacts.description.trim() === "") {
      record({
        ...where,
        category: "meta",
        rule: "missing-description",
        impact: "minor",
        message: "no meta description",
      });
    }

    if (documentFacts.h1Count !== 1) {
      record({
        ...where,
        category: "meta",
        rule: "h1-count",
        impact: "moderate",
        message: `${documentFacts.h1Count} <h1> elements; exactly one is expected`,
      });
    }

    if (!/Inter/i.test(documentFacts.bodyFontFamily)) {
      record({
        ...where,
        category: "readability",
        rule: "webfont-not-applied",
        impact: "minor",
        message: `body renders in ${documentFacts.bodyFontFamily} — the intended webfont did not apply`,
      });
    }

    // Keyboard focus must be visible; this is the check most often missed,
    // because a mouse user never sees it fail.
    if (layout.interactiveCount > 0) {
      const invisibleFocus = await page.evaluate((selector) => {
        const unmarked = new Set();
        for (const element of [...document.querySelectorAll(selector)].slice(0, 20)) {
          element.focus();
          const style = getComputedStyle(element);
          const outlined =
            style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0;
          if (!outlined && style.boxShadow === "none") {
            unmarked.add(element.tagName.toLowerCase());
          }
        }
        return [...unmarked];
      }, INTERACTIVE_SELECTOR);

      // Programmatic focus does not always match :focus-visible heuristics, so
      // this is information to verify by hand rather than a defect.
      if (invisibleFocus.length > 0) {
        record({
          ...where,
          category: "accessibility",
          rule: "focus-indicator-unclear",
          impact: "info",
          message: `focusable elements showed no outline or shadow when focused programmatically: ${invisibleFocus.join(", ")} — verify by tabbing manually`,
        });
      }
    }
  }

  // Reuse the loaded page rather than navigating again for a screenshot.
  if (viewport.capture) {
    await page.screenshot({
      path: join(OUT, "screenshots", `${slug(route)}-${viewport.name}-${scheme}.png`),
      fullPage: true,
    });
  }

  await page.close();
  return documentFacts;
};

// ---------------------------------------------------------------------------
// Cross-cutting checks
// ---------------------------------------------------------------------------

/** Light and dark must actually differ, or the theme is silently not applying. */
const checkSchemesDiffer = (route, byScheme) => {
  const light = byScheme.get("light");
  const dark = byScheme.get("dark");
  if (light === undefined || dark === undefined) return;

  if (light.backgroundColor === dark.backgroundColor) {
    record({
      category: "readability",
      rule: "schemes-identical",
      impact: "serious",
      page: route,
      message: `light and dark render the same background (${light.backgroundColor}) — the colour scheme is not being applied`,
    });
  }
};

const checkTitlesUnique = (titles) => {
  const seen = new Map();
  for (const [route, title] of titles) {
    const existing = seen.get(title);
    if (existing !== undefined) {
      record({
        category: "meta",
        rule: "duplicate-title",
        impact: "minor",
        page: route,
        message: `shares its title with ${existing}: "${title}"`,
      });
    } else {
      seen.set(title, route);
    }
  }
};

/** Motion must actually stop when the user asks it to. */
const checkReducedMotion = async (browser, routes) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  for (const route of routes) {
    await page.goto(urlFor(route), { waitUntil: "load" });
    const { animated } = await page.evaluate(motionProbe);
    if (animated.length > 0) {
      record({
        category: "accessibility",
        rule: "reduced-motion-ignored",
        impact: "moderate",
        page: route,
        message: `elements still animate under prefers-reduced-motion: ${animated.join(", ")}`,
      });
    }
  }

  await context.close();
};

/** A CV that cannot be printed is a CV with a missing feature. */
const checkPrint = async (browser, routes) => {
  const context = await browser.newContext({ viewport: { width: 1200, height: 1600 } });
  const page = await context.newPage();
  await page.emulateMedia({ media: "print" });

  for (const route of routes) {
    await page.goto(urlFor(route), { waitUntil: "load" });
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    if (overflows) {
      record({
        category: "readability",
        rule: "print-overflow",
        impact: "minor",
        page: route,
        message: "content overflows horizontally when printed",
      });
    }
    await page.screenshot({
      path: join(OUT, "screenshots", `print-${slug(route)}.png`),
      fullPage: true,
    });
  }

  await context.close();
};

/**
 * Static checks already prove internal links resolve to files; this proves the
 * server serves them at the URL the page links to. Probed concurrently.
 */
const checkLinks = async (browser, links) => {
  if (links.length === 0) return;

  const context = await browser.newContext();
  await mapConcurrent(links, LINK_CONCURRENCY, async (href) => {
    const response = await context.request.get(`${ORIGIN}${href}`);
    if (!response.ok()) {
      record({
        category: "links",
        rule: "dead-internal-link",
        impact: "critical",
        page: href,
        message: `${href} returned ${response.status()}`,
      });
    }
  });
  await context.close();
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Latest stable Chrome where available, falling back to the Chromium the
 * pinned Playwright ships. The driver stays reproducible through the lockfile
 * while the rendering engine tracks what readers actually run.
 */
const launchBrowser = async () => {
  try {
    return await chromium.launch({ channel: "chrome" });
  } catch (error) {
    console.warn(
      `audit: stable Chrome unavailable (${error?.message ?? error}); falling back to bundled Chromium`,
    );
    return chromium.launch();
  }
};

const main = async () => {
  await mkdir(join(OUT, "screenshots"), { recursive: true });

  const routes = await discoverRoutes(DIST);
  if (routes.length === 0) {
    console.error("audit: no built pages found — run the build first");
    return [];
  }
  console.log(`audit: ${routes.length} route(s) at ${urlFor("/")}`);

  const server = await startPreview();
  const browser = await launchBrowser();

  try {
    /** route -> scheme -> document facts */
    const documentsByRoute = new Map(routes.map((route) => [route, new Map()]));
    const titles = [];
    const links = new Set();

    // Contexts outermost: a context is a fresh browser profile and costs far
    // more to create than the page inside it.
    for (const scheme of SCHEMES) {
      for (const viewport of VIEWPORTS) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          colorScheme: scheme,
          deviceScaleFactor: 1,
        });

        for (const route of routes) {
          const documentFacts = await auditPage(context, route, viewport, scheme);
          if (documentFacts === null) continue;

          documentsByRoute.get(route).set(scheme, documentFacts);
          if (scheme === "light") {
            titles.push([route, documentFacts.title]);
            for (const href of documentFacts.internalLinks) links.add(href);
          }
        }

        await context.close();
      }
    }

    for (const [route, byScheme] of documentsByRoute) checkSchemesDiffer(route, byScheme);
    checkTitlesUnique(titles);

    await checkReducedMotion(browser, routes);
    await checkPrint(browser, routes);
    await checkLinks(browser, [...links]);

    return routes;
  } finally {
    await browser.close();
    server.kill();
  }
};

const write = async (collected, routes) => {
  const meta = {
    generatedAt: new Date().toISOString(),
    target: `${SITE}${BASE}`,
    pages: routes,
    viewports: VIEWPORTS.length,
  };
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, "findings.json"), toJson(collected, meta));
  await writeFile(join(OUT, "report.md"), toMarkdown(collected, meta));
};

// Findings are reported, never fatal. The workflow does not gate on this job,
// and a crash in the audit itself must not read as a broken site — it is
// recorded as a finding so the failure stays visible without being fatal.
try {
  const routes = await main();
  const deduped = dedupeFindings(findings);
  await write(deduped, routes);

  console.log(`audit: ${deduped.length} finding(s) written to ${OUT}`);
  for (const finding of deduped.slice(0, 20)) {
    console.log(`  [${finding.impact}] ${finding.page} ${finding.rule}: ${finding.message}`);
  }
} catch (error) {
  console.error("audit: driver failed —", error);
  try {
    await write(
      [
        {
          category: "runtime",
          rule: "audit-driver-failed",
          impact: "info",
          page: "-",
          message: `the audit could not complete: ${String(error?.message ?? error)}`,
        },
      ],
      [],
    );
  } catch {
    // Nothing further to do; the log above is the record.
  }
}

process.exitCode = 0;
