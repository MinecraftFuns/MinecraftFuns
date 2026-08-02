/**
 * Browser audit driver — the only effectful module here.
 *
 * Non-blocking by construction: it always exits 0 and the workflow does not
 * gate deployment on it, because an audit that can fail a deploy is one that
 * gets disabled the first time it is inconvenient.
 *
 * Contexts are created per (viewport, scheme) and reused across routes: a
 * context is a fresh browser profile while a page is cheap, so ordering the
 * loop contexts-outermost costs eight profiles rather than one per page visit.
 */

import { spawn } from "node:child_process";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { AxeBuilder } from "@axe-core/playwright";
import { chromium } from "playwright";

import { dedupeFindings } from "./checks.mjs";
import { designFindings, TOKEN_NAMES } from "./design.mjs";
import {
  documentProbe,
  focusProbe,
  INTERACTIVE_SELECTOR,
  motionProbe,
  overflowProbe,
  pageProbe,
  probeOptions,
} from "./probe.mjs";
import { toJson, toMarkdown } from "./report.mjs";

const PORT = Number(process.env.AUDIT_PORT ?? 4321);
/** Defaults describe the eventual primary target: joefang.org, served at root. */
const BASE = process.env.SITE_BASE ?? "/";
const SITE = process.env.SITE_URL ?? "https://joefang.org";
const DIST = resolve(process.env.DIST_DIR ?? "dist");
const OUT = resolve(process.env.AUDIT_OUT ?? "audit");
const ORIGIN = `http://localhost:${PORT}`;

const BASE_PREFIX = BASE.replace(/\/+$/, "");
const urlFor = (route) => `${ORIGIN}${BASE_PREFIX}${route}`;
const slug = (route) => route.replace(/^\/|\/$/g, "").replaceAll("/", "_") || "home";

/**
 * 320 is the narrowest width WCAG reflow expects to work; 1440 is a common
 * desktop. Axe runs at the extremes only — the middle widths exist to catch
 * layout overflow, which is where they actually differ.
 */
const VIEWPORTS = [
  { name: "narrow", width: 320, height: 640, axe: true, capture: false },
  { name: "mobile", width: 390, height: 844, axe: false, capture: true },
  { name: "tablet", width: 768, height: 1024, axe: false, capture: false },
  { name: "desktop", width: 1440, height: 900, axe: true, capture: true },
];

const SCHEMES = ["light", "dark"];
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const LINK_CONCURRENCY = 8;
const TOUCH_WIDTH = 768;

const findings = [];
const record = (finding) => findings.push(finding);
const recordAll = (entries) => entries.forEach(record);

/**
 * Bounded worker pool: `limit` tasks stay in flight and each worker takes the
 * next index as it frees, so elapsed time is the slowest worker rather than
 * the sum of every task.
 */
const mapConcurrent = async (items, limit, task) => {
  const queue = items.entries();
  const worker = async () => {
    for (const [, item] of queue) await task(item);
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
};

// ---------------------------------------------------------------------------
// Rule tables
//
// Each probe result maps onto findings the same way, so the mapping is data.
// Adding a check is a row, not another near-identical block.
// ---------------------------------------------------------------------------

const LAYOUT_RULES = [
  {
    key: "overflowing",
    category: "readability",
    rule: "element-overflows-viewport",
    impact: "moderate",
    touchOnly: false,
    message: (item, layout) =>
      `extends to ${item.right}px, past the ${layout.viewportWidth}px viewport`,
  },
  {
    key: "tinyText",
    category: "readability",
    rule: "text-below-12px",
    impact: "moderate",
    touchOnly: false,
    message: (item) => `${item.fontSize} text: "${item.sample}"`,
  },
  {
    key: "clipped",
    category: "readability",
    rule: "text-clipped",
    impact: "moderate",
    touchOnly: false,
    message: (item) =>
      `content is ${item.scrollWidth}px inside a ${item.clientWidth}px box with hidden overflow`,
  },
  {
    // Target size matters where fingers are used, not under a desktop pointer.
    key: "smallTargets",
    category: "accessibility",
    rule: "target-size-under-24px",
    impact: "moderate",
    touchOnly: true,
    message: (item) =>
      `${item.width}x${item.height}px, below the 24x24 minimum (WCAG 2.5.8)`,
  },
];

const DOCUMENT_RULES = [
  {
    when: (doc) => doc.scriptCount > 0,
    category: "runtime",
    rule: "unexpected-script",
    impact: "moderate",
    message: (doc) =>
      `${doc.scriptCount} script element(s) — this site is intended to ship no client JavaScript`,
  },
  {
    when: (doc) => doc.title.trim() === "",
    category: "meta",
    rule: "missing-title",
    impact: "serious",
    message: () => "document has no title",
  },
  {
    when: (doc) => doc.description.trim() === "",
    category: "meta",
    rule: "missing-description",
    impact: "minor",
    message: () => "no meta description",
  },
  {
    when: (doc) => doc.h1Count !== 1,
    category: "meta",
    rule: "h1-count",
    impact: "moderate",
    message: (doc) => `${doc.h1Count} <h1> elements; exactly one is expected`,
  },
  {
    when: (doc) => !/Inter/i.test(doc.bodyFontFamily),
    category: "readability",
    rule: "webfont-not-applied",
    impact: "minor",
    message: (doc) => `body renders in ${doc.bodyFontFamily} — the webfont did not apply`,
  },
];

const RUNTIME_EVENTS = [
  {
    event: "pageerror",
    rule: "uncaught-exception",
    impact: "critical",
    message: (error) => String(error?.message ?? error),
  },
  {
    event: "requestfailed",
    rule: "request-failed",
    impact: "serious",
    message: (request) =>
      `${request.method()} ${request.url()} — ${request.failure()?.errorText ?? "failed"}`,
  },
];

// ---------------------------------------------------------------------------
// Server and routes
// ---------------------------------------------------------------------------

const startPreview = async () => {
  const server = spawn(
    process.execPath,
    ["node_modules/astro/bin/astro.mjs", "preview", "--port", String(PORT)],
    { stdio: "ignore" },
  );

  const deadline = Date.now() + 60_000;
  const ready = async () => {
    const response = await fetch(urlFor("/")).catch(() => null);
    if (response?.ok) return true;
    if (Date.now() > deadline) return false;
    await new Promise((next) => setTimeout(next, 250));
    return ready();
  };

  if (await ready()) return server;
  server.kill();
  throw new Error(`preview server did not become ready on ${urlFor("/")}`);
};

/** Routes discovered from the build, so new pages are covered automatically. */
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

  return (await walk(dir))
    .filter((path) => path.endsWith("index.html"))
    .map((path) => `/${relative(dir, path).replace(/index\.html$/, "")}`.replace(/\/+/g, "/"))
    .sort();
};

// ---------------------------------------------------------------------------
// Per-page audit
// ---------------------------------------------------------------------------

const attachRuntimeListeners = (page, where) => {
  RUNTIME_EVENTS.forEach(({ event, rule, impact, message }) =>
    page.on(event, (subject) =>
      record({ ...where, category: "runtime", rule, impact, message: message(subject) }),
    ),
  );

  page.on("console", (message) =>
    message.type() === "error"
      ? record({
          ...where,
          category: "runtime",
          rule: "console-error",
          impact: "serious",
          message: message.text().slice(0, 300),
        })
      : undefined,
  );

  page.on("response", (response) =>
    response.status() >= 400
      ? record({
          ...where,
          category: "runtime",
          rule: "http-error",
          impact: "serious",
          message: `${response.status()} ${response.url()}`,
        })
      : undefined,
  );
};

const auditAxe = async (page, where) => {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  recordAll(
    violations.flatMap((violation) =>
      violation.nodes.slice(0, 5).map((node) => ({
        ...where,
        category: "accessibility",
        rule: violation.id,
        impact: violation.impact ?? "moderate",
        selector: node.target.join(" "),
        message: violation.help,
        help: violation.helpUrl,
      })),
    ),
  );
};

const auditDocument = async (page, where, interactiveCount) => {
  const doc = await page.evaluate(documentProbe);

  recordAll(
    DOCUMENT_RULES.filter(({ when }) => when(doc)).map(({ category, rule, impact, message }) => ({
      ...where,
      category,
      rule,
      impact,
      message: message(doc),
    })),
  );

  // Keyboard focus must be visible; a mouse user never sees this fail.
  const unmarked = interactiveCount > 0 ? await page.evaluate(focusProbe, INTERACTIVE_SELECTOR) : [];
  if (unmarked.length > 0) {
    record({
      ...where,
      category: "accessibility",
      rule: "focus-indicator-unclear",
      impact: "info",
      message: `no outline or shadow under programmatic focus: ${unmarked.join(", ")} — verify by tabbing`,
    });
  }

  return doc;
};

const auditPage = async (context, route, viewport, scheme) => {
  const page = await context.newPage();
  const where = { page: route, viewport: viewport.name, colorScheme: scheme };

  attachRuntimeListeners(page, where);
  await page.goto(urlFor(route), { waitUntil: "load" });

  // Geometry does not vary with colour scheme, so design is measured once.
  const { layout, design } = await page.evaluate(
    pageProbe,
    probeOptions(TOKEN_NAMES, scheme === "light"),
  );

  if (layout.documentScrollWidth > layout.viewportWidth + 1) {
    record({
      ...where,
      category: "readability",
      rule: "horizontal-overflow",
      impact: "serious",
      message: `page scrolls horizontally: ${layout.documentScrollWidth}px of content in a ${layout.viewportWidth}px viewport`,
    });
  }

  recordAll(
    LAYOUT_RULES.filter(({ touchOnly }) => !touchOnly || viewport.width <= TOUCH_WIDTH).flatMap(
      ({ key, category, rule, impact, message }) =>
        layout[key].map((item) => ({
          ...where,
          category,
          rule,
          impact,
          selector: item.selector,
          message: message(item, layout),
        })),
    ),
  );

  if (design !== null) {
    recordAll(designFindings(design, { page: route, viewport: viewport.name }));
  }

  if (viewport.axe) await auditAxe(page, where);

  const doc =
    viewport.name === "desktop" ? await auditDocument(page, where, layout.interactiveCount) : null;

  // Reuse the loaded page rather than navigating again for a screenshot.
  if (viewport.capture) {
    await page.screenshot({
      path: join(OUT, "screenshots", `${slug(route)}-${viewport.name}-${scheme}.png`),
      fullPage: true,
    });
  }

  await page.close();
  return doc;
};

// ---------------------------------------------------------------------------
// Cross-cutting passes
// ---------------------------------------------------------------------------

/**
 * Visit every route once in a single throwaway context. Shared by the
 * reduced-motion and print passes, which differ only in setup and inspection.
 */
const overRoutes = async (browser, { contextOptions, prepare, visit }, routes) => {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  if (prepare) await prepare(page);

  for (const route of routes) {
    await page.goto(urlFor(route), { waitUntil: "load" });
    await visit(page, route);
  }

  await context.close();
};

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
      message: `light and dark render the same background (${light.backgroundColor}) — the colour scheme is not applying`,
    });
  }
};

const checkTitlesUnique = (titles) => {
  const seen = new Map();
  titles.forEach(([route, title]) => {
    const existing = seen.get(title);
    if (existing === undefined) seen.set(title, route);
    else
      record({
        category: "meta",
        rule: "duplicate-title",
        impact: "minor",
        page: route,
        message: `shares its title with ${existing}: "${title}"`,
      });
  });
};

/** Static checks prove links resolve to files; this proves the server serves them. */
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
 * while the engine tracks what readers actually run.
 */
const launchBrowser = async () =>
  chromium.launch({ channel: "chrome" }).catch((error) => {
    console.warn(`audit: stable Chrome unavailable (${error?.message ?? error}); using bundled Chromium`);
    return chromium.launch();
  });

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
    const documentsByRoute = new Map(routes.map((route) => [route, new Map()]));
    const titles = [];
    const links = new Set();

    for (const scheme of SCHEMES) {
      for (const viewport of VIEWPORTS) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          colorScheme: scheme,
          deviceScaleFactor: 1,
        });

        for (const route of routes) {
          const doc = await auditPage(context, route, viewport, scheme);
          if (doc !== null) {
            documentsByRoute.get(route).set(scheme, doc);
            if (scheme === "light") {
              titles.push([route, doc.title]);
              doc.internalLinks.forEach((href) => links.add(href));
            }
          }
        }

        await context.close();
      }
    }

    documentsByRoute.forEach((byScheme, route) => checkSchemesDiffer(route, byScheme));
    checkTitlesUnique(titles);

    await overRoutes(
      browser,
      {
        contextOptions: { viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" },
        visit: async (page, route) => {
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
        },
      },
      routes,
    );

    // A CV that cannot be printed is a CV with a missing feature.
    await overRoutes(
      browser,
      {
        contextOptions: { viewport: { width: 1200, height: 1600 } },
        prepare: (page) => page.emulateMedia({ media: "print" }),
        visit: async (page, route) => {
          if (await page.evaluate(overflowProbe)) {
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
        },
      },
      routes,
    );

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

// Findings are reported, never fatal — a crash in the audit is itself recorded
// so the failure stays visible without reading as a broken site.
try {
  const routes = await main();
  const deduped = dedupeFindings(findings);
  await write(deduped, routes);

  console.log(`audit: ${deduped.length} finding(s) written to ${OUT}`);
  deduped
    .slice(0, 20)
    .forEach((f) => console.log(`  [${f.impact}] ${f.page} ${f.rule}: ${f.message}`));
} catch (error) {
  console.error("audit: driver failed —", error);
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
  ).catch(() => undefined);
}

process.exitCode = 0;
