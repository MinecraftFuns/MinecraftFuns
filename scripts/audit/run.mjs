/**
 * Browser audit driver.
 *
 * Loads every built page in a real browser at several viewport widths, in both
 * colour schemes, and records what a browser can see that static analysis
 * cannot: computed contrast, layout overflow, focus behaviour, runtime errors.
 *
 * Deliberately non-blocking. It always exits 0, and the workflow does not gate
 * deployment on it. A slow audit that can fail a deploy is an audit that gets
 * disabled the first time it is inconvenient; one that only reports stays.
 *
 * Everything effectful lives here. The classification rules are in checks.mjs
 * and the rendering in report.mjs, both pure and unit-tested.
 */

import { spawn } from "node:child_process";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { AxeBuilder } from "@axe-core/playwright";
import { chromium } from "playwright";

import { dedupeFindings, documentProbe, layoutProbe, motionProbe } from "./checks.mjs";
import { designFindings, designProbe, TOKEN_NAMES } from "./design.mjs";
import { toJson, toMarkdown } from "./report.mjs";

const PORT = Number(process.env.AUDIT_PORT ?? 4321);
const BASE = process.env.SITE_BASE ?? "/MinecraftFuns/";
const DIST = resolve(process.env.DIST_DIR ?? "dist");
const OUT = resolve(process.env.AUDIT_OUT ?? "audit");
const ORIGIN = `http://localhost:${PORT}`;

/** Filesystem-safe label for a route, so "/" does not become an empty name. */
const slug = (route) => route.replace(/^\/|\/$/g, "").replaceAll("/", "_") || "home";

/**
 * 320 is the narrowest width WCAG 1.4.10 (reflow) expects to work; 1440 is a
 * common desktop. Axe runs only at the extremes — the middle widths exist to
 * catch layout overflow, which is where they actually differ.
 */
const VIEWPORTS = [
  { name: "narrow", width: 320, height: 640, axe: true },
  { name: "mobile", width: 390, height: 844, axe: false },
  { name: "tablet", width: 768, height: 1024, axe: false },
  { name: "desktop", width: 1440, height: 900, axe: true },
];

const SCHEMES = ["light", "dark"];

const WCAG_TAGS = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
  "best-practice",
];

/** @type {Array<Record<string, unknown>>} */
const findings = [];

const record = (finding) => {
  findings.push(finding);
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
      const response = await fetch(`${ORIGIN}${BASE}`);
      if (response.ok) return server;
    } catch {
      // Not listening yet.
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  server.kill();
  throw new Error(`preview server did not become ready on ${ORIGIN}${BASE}`);
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
    .map((path) => relative(dir, path).replace(/index\.html$/, ""))
    .map((route) => `/${route}`.replace(/\/+/g, "/"))
    .sort();
};

// ---------------------------------------------------------------------------
// Per-page audit
// ---------------------------------------------------------------------------

const auditPage = async (context, route, viewport, scheme) => {
  const page = await context.newPage();
  const url = `${ORIGIN}${BASE.replace(/\/$/, "")}${route}`;

  // Runtime faults. The site ships no JavaScript today, so anything here is
  // either a regression or a resource that failed to load.
  page.on("pageerror", (error) => {
    record({
      category: "runtime",
      rule: "uncaught-exception",
      impact: "critical",
      page: route,
      viewport: viewport.name,
      colorScheme: scheme,
      message: String(error?.message ?? error),
    });
  });

  page.on("console", (message) => {
    if (message.type() !== "error") return;
    record({
      category: "runtime",
      rule: "console-error",
      impact: "serious",
      page: route,
      viewport: viewport.name,
      colorScheme: scheme,
      message: message.text().slice(0, 300),
    });
  });

  page.on("requestfailed", (request) => {
    record({
      category: "runtime",
      rule: "request-failed",
      impact: "serious",
      page: route,
      viewport: viewport.name,
      colorScheme: scheme,
      message: `${request.method()} ${request.url()} — ${request.failure()?.errorText ?? "failed"}`,
    });
  });

  page.on("response", (response) => {
    if (response.status() < 400) return;
    record({
      category: "runtime",
      rule: "http-error",
      impact: "serious",
      page: route,
      viewport: viewport.name,
      colorScheme: scheme,
      message: `${response.status()} ${response.url()}`,
    });
  });

  await page.goto(url, { waitUntil: "load" });

  // -- Layout and readability ---------------------------------------------
  const layout = await page.evaluate(layoutProbe);

  if (layout.documentScrollWidth > layout.viewportWidth + 1) {
    record({
      category: "readability",
      rule: "horizontal-overflow",
      impact: "serious",
      page: route,
      viewport: viewport.name,
      colorScheme: scheme,
      message: `page scrolls horizontally: content is ${layout.documentScrollWidth}px wide in a ${layout.viewportWidth}px viewport`,
    });
  }

  for (const element of layout.overflowing) {
    record({
      category: "readability",
      rule: "element-overflows-viewport",
      impact: "moderate",
      page: route,
      viewport: viewport.name,
      colorScheme: scheme,
      selector: element.selector,
      message: `extends to ${element.right}px, past the ${layout.viewportWidth}px viewport`,
    });
  }

  for (const element of layout.tinyText) {
    record({
      category: "readability",
      rule: "text-below-12px",
      impact: "moderate",
      page: route,
      viewport: viewport.name,
      colorScheme: scheme,
      selector: element.selector,
      message: `${element.fontSize} text: "${element.sample}"`,
    });
  }

  for (const element of layout.clipped) {
    record({
      category: "readability",
      rule: "text-clipped",
      impact: "moderate",
      page: route,
      viewport: viewport.name,
      colorScheme: scheme,
      selector: element.selector,
      message: `content is ${element.scrollWidth}px inside a ${element.clientWidth}px box with hidden overflow`,
    });
  }

  // Target size matters where fingers are used; report it on touch-sized
  // viewports only, to avoid noise about a desktop pointer.
  if (viewport.width <= 768) {
    for (const element of layout.smallTargets) {
      record({
        category: "accessibility",
        rule: "target-size-under-24px",
        impact: "moderate",
        page: route,
        viewport: viewport.name,
        colorScheme: scheme,
        selector: element.selector,
        message: `${element.width}x${element.height}px, below the 24x24 minimum (WCAG 2.5.8)`,
      });
    }
  }

  // -- Design conformance --------------------------------------------------
  // Geometry does not depend on the colour scheme, so this runs once per
  // viewport rather than once per scheme; measuring twice would only double
  // identical findings.
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
          category: "accessibility",
          rule: violation.id,
          impact: violation.impact ?? "moderate",
          page: route,
          viewport: viewport.name,
          colorScheme: scheme,
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
        category: "runtime",
        rule: "unexpected-script",
        impact: "moderate",
        page: route,
        colorScheme: scheme,
        message: `${documentFacts.scriptCount} script element(s) — this site is intended to ship no client JavaScript`,
      });
    }

    if (documentFacts.title.trim() === "") {
      record({
        category: "meta",
        rule: "missing-title",
        impact: "serious",
        page: route,
        message: "document has no title",
      });
    }

    if (documentFacts.description.trim() === "") {
      record({
        category: "meta",
        rule: "missing-description",
        impact: "minor",
        page: route,
        message: "no meta description",
      });
    }

    if (documentFacts.h1Count !== 1) {
      record({
        category: "meta",
        rule: "h1-count",
        impact: "moderate",
        page: route,
        message: `${documentFacts.h1Count} <h1> elements; exactly one is expected`,
      });
    }

    if (!/Inter/i.test(documentFacts.bodyFontFamily)) {
      record({
        category: "readability",
        rule: "webfont-not-applied",
        impact: "minor",
        page: route,
        colorScheme: scheme,
        message: `body renders in ${documentFacts.bodyFontFamily} — the intended webfont did not apply`,
      });
    }
  }

  // -- Focus visibility ----------------------------------------------------
  // Keyboard focus must be visible; this is the check most often missed
  // because a mouse user never sees it fail.
  if (viewport.name === "desktop" && layout.interactiveCount > 0) {
    const invisibleFocus = await page.evaluate(async () => {
      const results = [];
      const focusable = [
        ...document.querySelectorAll(
          'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      ].slice(0, 20);

      for (const element of focusable) {
        element.focus();
        const style = getComputedStyle(element);
        const hasOutline =
          style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0;
        const hasShadow = style.boxShadow !== "none";
        if (!hasOutline && !hasShadow) {
          results.push(element.tagName.toLowerCase());
        }
      }
      return results;
    });

    // Programmatic focus does not always match :focus-visible heuristics, so
    // this is reported as information rather than a defect.
    if (invisibleFocus.length > 0) {
      record({
        category: "accessibility",
        rule: "focus-indicator-unclear",
        impact: "info",
        page: route,
        colorScheme: scheme,
        message: `${invisibleFocus.length} focusable element(s) showed no outline or shadow when focused programmatically: ${[...new Set(invisibleFocus)].join(", ")} — verify by tabbing manually`,
      });
    }
  }

  await page.close();
  return { layout, documentFacts };
};

// ---------------------------------------------------------------------------
// Cross-cutting checks
// ---------------------------------------------------------------------------

/** Light and dark must actually differ, or the theme silently is not applying. */
const checkSchemesDiffer = (byScheme, route) => {
  const light = byScheme.light;
  const dark = byScheme.dark;
  if (!light || !dark) return;

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
    }
    seen.set(title, route);
  }
};

/** Motion must actually stop when the user asks it to. */
const checkReducedMotion = async (browser, route) => {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto(`${ORIGIN}${BASE.replace(/\/$/, "")}${route}`, {
    waitUntil: "load",
  });
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
  await context.close();
};

/** A CV that cannot be printed is a CV with a missing feature. */
const checkPrint = async (browser, route) => {
  const context = await browser.newContext({ viewport: { width: 1200, height: 1600 } });
  const page = await context.newPage();
  await page.goto(`${ORIGIN}${BASE.replace(/\/$/, "")}${route}`, {
    waitUntil: "load",
  });
  await page.emulateMedia({ media: "print" });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  if (overflow) {
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
  await context.close();
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const main = async () => {
  await mkdir(join(OUT, "screenshots"), { recursive: true });

  const routes = await discoverRoutes(DIST);
  if (routes.length === 0) {
    console.error("audit: no built pages found — run the build first");
    return;
  }
  console.log(`audit: ${routes.length} route(s): ${routes.join(", ")}`);

  const server = await startPreview();
  const browser = await chromium.launch();

  try {
    /** @type {Array<[string, string]>} */
    const titles = [];

    for (const route of routes) {
      const documentByScheme = {};

      for (const scheme of SCHEMES) {
        for (const viewport of VIEWPORTS) {
          const context = await browser.newContext({
            viewport: { width: viewport.width, height: viewport.height },
            colorScheme: scheme,
            deviceScaleFactor: 1,
          });

          const { documentFacts } = await auditPage(context, route, viewport, scheme);
          if (documentFacts !== null) {
            documentByScheme[scheme] = documentFacts;
            if (scheme === "light") titles.push([route, documentFacts.title]);
          }

          // Visual evidence for the widths and schemes a person would check.
          if (viewport.name === "mobile" || viewport.name === "desktop") {
            const page = await context.newPage();
            await page.goto(`${ORIGIN}${BASE.replace(/\/$/, "")}${route}`, {
              waitUntil: "load",
            });
            const label = `${slug(route)}-${viewport.name}-${scheme}`;
            await page.screenshot({
              path: join(OUT, "screenshots", `${label}.png`),
              fullPage: true,
            });
            await page.close();
          }

          await context.close();
        }
      }

      checkSchemesDiffer(documentByScheme, route);
      await checkReducedMotion(browser, route);
      await checkPrint(browser, route);
    }

    checkTitlesUnique(titles);

    // -- Link reachability -------------------------------------------------
    // Static checks already prove internal links resolve to files; this proves
    // the server actually serves them at the URL the page links to.
    const linkContext = await browser.newContext();
    const page = await linkContext.newPage();
    await page.goto(`${ORIGIN}${BASE}`, { waitUntil: "load" });
    const { internalLinks } = await page.evaluate(documentProbe);
    for (const href of [...new Set(internalLinks)]) {
      const response = await page.request.get(`${ORIGIN}${href}`);
      if (!response.ok()) {
        record({
          category: "links",
          rule: "dead-internal-link",
          impact: "critical",
          page: "/",
          message: `${href} returned ${response.status()}`,
        });
      }
    }
    await linkContext.close();
  } finally {
    await browser.close();
    server.kill();
  }

  const deduped = dedupeFindings(findings);
  const meta = {
    // Injected rather than read from the clock inside a pure module.
    generatedAt: new Date().toISOString(),
    target: `${ORIGIN}${BASE}`,
    pages: routes,
    viewports: VIEWPORTS.length,
  };

  await writeFile(join(OUT, "findings.json"), toJson(deduped, meta));
  const markdown = toMarkdown(deduped, meta);
  await writeFile(join(OUT, "report.md"), markdown);

  console.log(`audit: ${deduped.length} finding(s) written to ${OUT}`);
  for (const finding of deduped.slice(0, 20)) {
    console.log(`  [${finding.impact}] ${finding.page} ${finding.rule}: ${finding.message}`);
  }
};

// Findings are reported, never fatal. The workflow does not gate on this job,
// and a crash in the audit itself must not read as a broken site either — it
// is reported as a finding so the failure is visible without being fatal.
try {
  await main();
} catch (error) {
  console.error("audit: driver failed —", error);
  try {
    await mkdir(OUT, { recursive: true });
    const meta = {
      generatedAt: new Date().toISOString(),
      target: `${ORIGIN}${BASE}`,
      pages: [],
      viewports: VIEWPORTS.length,
    };
    const crash = [
      {
        category: "runtime",
        rule: "audit-driver-failed",
        impact: "info",
        page: "-",
        message: `the audit could not complete: ${String(error?.message ?? error)}`,
      },
    ];
    await writeFile(join(OUT, "findings.json"), toJson(crash, meta));
    await writeFile(join(OUT, "report.md"), toMarkdown(crash, meta));
  } catch {
    // Nothing further to do; the log above is the record.
  }
}

process.exitCode = 0;
