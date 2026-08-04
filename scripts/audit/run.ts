/**
 * Browser audit driver: the only effectful module here.
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
import { mkdir, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

import { AxeBuilder } from "@axe-core/playwright";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

import { clashesBy } from "../../src/prelude/distinct.ts";
import { mapConcurrent } from "../lib/concurrent.ts";
import { filesUnder } from "../lib/files.ts";
import { dedupeFindings, type Finding, type Impact, type MergedFinding } from "./checks.ts";
import { designFindings, TOKEN_NAMES } from "./design.ts";
import {
  documentProbe,
  focusProbe,
  INTERACTIVE_SELECTOR,
  motionProbe,
  overflowProbe,
  pageProbe,
  probeOptions,
  type DocumentFacts,
  type LayoutProbe,
} from "./probe.ts";
import { toJson, toMarkdown, type Meta } from "./report.ts";

const PORT = Number(process.env.AUDIT_PORT ?? 4321);
/** Defaults describe the eventual primary target: joefang.org, served at root. */
const BASE = process.env.SITE_BASE ?? "/";
const SITE = process.env.SITE_URL ?? "https://joefang.org";
const DIST = resolve(process.env.DIST_DIR ?? "dist");
const OUT = resolve(process.env.AUDIT_OUT ?? "audit");
const ORIGIN = `http://localhost:${PORT}`;

const BASE_PREFIX = BASE.replace(/\/+$/, "");
const urlFor = (route: string): string => `${ORIGIN}${BASE_PREFIX}${route}`;
const slug = (route: string): string => route.replace(/^\/|\/$/g, "").replaceAll("/", "_") || "home";

/**
 * 320 is the narrowest width WCAG reflow expects to work; 1440 is a common
 * desktop. Axe runs at the extremes only; the middle widths exist to catch
 * layout overflow, which is where they actually differ.
 */
type Viewport = {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  /** Axe runs at the extremes only; the middle widths catch layout overflow. */
  readonly axe: boolean;
  readonly capture: boolean;
};

const VIEWPORTS: readonly Viewport[] = [
  { name: "narrow", width: 320, height: 640, axe: true, capture: false },
  { name: "mobile", width: 390, height: 844, axe: false, capture: true },
  { name: "tablet", width: 768, height: 1024, axe: false, capture: false },
  { name: "desktop", width: 1440, height: 900, axe: true, capture: true },
];

/* Playwright's own union, so a scheme this list invents fails here rather
   than at the browser. */
type Scheme = "light" | "dark";

const SCHEMES: readonly Scheme[] = ["light", "dark"];
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
const LINK_CONCURRENCY = 8;
const TOUCH_WIDTH = 768;

const findings: Finding[] = [];
const record = (finding: Finding): number => findings.push(finding);
const recordAll = (entries: readonly Finding[]): void => entries.forEach(record);

// ---------------------------------------------------------------------------
// Rule tables
//
// Each probe result maps onto findings the same way, so the mapping is data.
// Adding a check is a row, not another near-identical block.
// ---------------------------------------------------------------------------

/**
 * A layout rule names its findings directly rather than a key into the probe.
 * The message depends on which list it reads, and a key plus a separate
 * `message` leaves that agreement to the reader; a closure states it.
 */
type LayoutRule = {
  readonly category: string;
  readonly rule: string;
  readonly impact: Impact;
  /** Target size matters where fingers are used, not under a desktop pointer. */
  readonly touchOnly: boolean;
  readonly findings: (
    layout: LayoutProbe,
  ) => readonly { readonly selector: string; readonly message: string }[];
};

const LAYOUT_RULES: readonly LayoutRule[] = [
  {
    category: "readability",
    rule: "element-overflows-viewport",
    impact: "moderate",
    touchOnly: false,
    findings: (layout) =>
      layout.overflowing.map((item) => ({
        selector: item.selector,
        message: `extends to ${item.right}px, past the ${layout.viewportWidth}px viewport`,
      })),
  },
  {
    category: "readability",
    rule: "text-below-12px",
    impact: "moderate",
    touchOnly: false,
    findings: (layout) =>
      layout.tinyText.map((item) => ({
        selector: item.selector,
        message: `${item.fontSize} text: "${item.sample}"`,
      })),
  },
  {
    category: "readability",
    rule: "text-clipped",
    impact: "moderate",
    touchOnly: false,
    findings: (layout) =>
      layout.clipped.map((item) => ({
        selector: item.selector,
        message: `content is ${item.scrollWidth}px inside a ${item.clientWidth}px box with hidden overflow`,
      })),
  },
  {
    category: "accessibility",
    rule: "target-size-under-24px",
    impact: "moderate",
    touchOnly: true,
    findings: (layout) =>
      layout.smallTargets.map((item) => ({
        selector: item.selector,
        message: `${item.width}x${item.height}px, below the 24x24 minimum (WCAG 2.5.8)`,
      })),
  },
];

type DocumentRule = {
  readonly when: (doc: DocumentFacts) => boolean;
  readonly category: string;
  readonly rule: string;
  readonly impact: Impact;
  readonly message: (doc: DocumentFacts) => string;
};

const DOCUMENT_RULES: readonly DocumentRule[] = [
  {
    when: (doc) => doc.scriptCount > 0,
    category: "runtime",
    rule: "unexpected-script",
    impact: "moderate",
    message: (doc) =>
      `${doc.scriptCount} script element(s); this site is intended to ship no client JavaScript`,
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
    message: (doc) => `body renders in ${doc.bodyFontFamily}; the webfont did not apply`,
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
const discoverRoutes = async (dir: string): Promise<readonly string[]> => {
  return (await filesUnder(dir))
    .filter((path) => path.endsWith("index.html"))
    .map((path) => `/${relative(dir, path).replace(/index\.html$/, "")}`.replace(/\/+/g, "/"))
    .sort();
};

// ---------------------------------------------------------------------------
// Per-page audit
// ---------------------------------------------------------------------------

/** Where a finding was seen: the page, and the context it was rendered in. */
type Where = {
  readonly page: string;
  readonly viewport: string;
  readonly colorScheme: string;
};

/* Written out rather than tabulated: the two events carry different payloads,
   so a shared row type would have to widen both to `unknown`. */
const attachRuntimeListeners = (page: Page, where: Where): void => {
  page.on("pageerror", (error) =>
    record({
      ...where,
      category: "runtime",
      rule: "uncaught-exception",
      impact: "critical",
      message: error.message,
    }),
  );

  page.on("requestfailed", (request) =>
    record({
      ...where,
      category: "runtime",
      rule: "request-failed",
      impact: "serious",
      message: `${request.method()} ${request.url()}: ${request.failure()?.errorText ?? "failed"}`,
    }),
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

const auditAxe = async (page: Page, where: Where): Promise<void> => {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  recordAll(
    violations.flatMap((violation) =>
      violation.nodes.slice(0, 5).map((node) => ({
        ...where,
        category: "accessibility",
        rule: violation.id,
        impact: (violation.impact ?? "moderate") as Impact,
        selector: node.target.join(" "),
        message: violation.help,
        help: violation.helpUrl,
      })),
    ),
  );
};

const auditDocument = async (
  page: Page,
  where: Where,
  interactiveCount: number,
): Promise<DocumentFacts> => {
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
      message: `no outline or shadow under programmatic focus: ${unmarked.join(", ")}; verify by tabbing`,
    });
  }

  return doc;
};

const auditPage = async (
  context: BrowserContext,
  route: string,
  viewport: Viewport,
  scheme: Scheme,
): Promise<DocumentFacts | null> => {
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
    LAYOUT_RULES.filter(
      ({ touchOnly }) => !touchOnly || viewport.width <= TOUCH_WIDTH,
    ).flatMap(({ category, rule, impact, findings }) =>
      findings(layout).map(({ selector, message }) => ({
        ...where,
        category,
        rule,
        impact,
        selector,
        message,
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
/* `prepare` defaults to doing nothing rather than being checked at each use:
   an absent hook and a hook that changes nothing are the same run. */
const overRoutes = async (
  browser: Browser,
  {
    contextOptions,
    prepare = async (_page: Page) => {},
    visit,
  }: {
    readonly contextOptions?: Parameters<Browser["newContext"]>[0];
    readonly prepare?: (page: Page) => Promise<void>;
    readonly visit: (page: Page, route: string) => Promise<void>;
  },
  routes: readonly string[],
): Promise<void> => {
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  await prepare(page);

  for (const route of routes) {
    await page.goto(urlFor(route), { waitUntil: "load" });
    await visit(page, route);
  }

  await context.close();
};

const checkSchemesDiffer = (
  route: string,
  byScheme: ReadonlyMap<Scheme, DocumentFacts>,
): void => {
  const light = byScheme.get("light");
  const dark = byScheme.get("dark");
  if (light === undefined || dark === undefined) return;

  if (light.backgroundColor === dark.backgroundColor) {
    record({
      category: "readability",
      rule: "schemes-identical",
      impact: "serious",
      page: route,
      message: `light and dark render the same background (${light.backgroundColor}); the colour scheme is not applying`,
    });
  }
};

const checkTitlesUnique = (titles: readonly (readonly [string, string])[]): void => {
  clashesBy(titles, ([, title]) => title).forEach(([[first], [route, title]]) =>
    record({
      category: "meta",
      rule: "duplicate-title",
      impact: "minor",
      page: route,
      message: `shares its title with ${first}: "${title}"`,
    }),
  );
};

/** Static checks prove links resolve to files; this proves the server serves them. */
const checkLinks = async (browser: Browser, links: readonly string[]): Promise<void> => {
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
    console.error("audit: no built pages found; run the build first");
    return [];
  }
  console.log(`audit: ${routes.length} route(s) at ${urlFor("/")}`);

  const server = await startPreview();
  const browser = await launchBrowser();

  try {
    /* Seeded from `routes`, so every lookup below has a value. Read through a
       helper rather than asserting one: the map and the loop are built from the
       same list, and a helper that inserts on miss keeps that a fact rather
       than a claim. */
    const documentsByRoute = new Map<string, Map<Scheme, DocumentFacts>>(
      routes.map((route) => [route, new Map()]),
    );
    const documentsFor = (route: string): Map<Scheme, DocumentFacts> => {
      const found = documentsByRoute.get(route);
      if (found !== undefined) return found;
      const fresh = new Map<Scheme, DocumentFacts>();
      documentsByRoute.set(route, fresh);
      return fresh;
    };
    const titles: [string, string][] = [];
    const links = new Set<string>();

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
            documentsFor(route).set(scheme, doc);
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

const write = async (
  collected: readonly MergedFinding[],
  routes: readonly string[],
): Promise<void> => {
  const meta: Meta = {
    generatedAt: new Date().toISOString(),
    target: `${SITE}${BASE}`,
    pages: routes,
    viewports: VIEWPORTS.length,
  };
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, "findings.json"), toJson(collected, meta));
  await writeFile(join(OUT, "report.md"), toMarkdown(collected, meta));
};

// Findings are reported, never fatal; a crash in the audit is itself recorded
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
  console.error("audit: driver failed:", error);
  await write(
    [
      {
        category: "runtime",
        rule: "audit-driver-failed",
        impact: "info",
        page: "-",
        message: `the audit could not complete: ${error instanceof Error ? error.message : String(error)}`,
        /* No context to merge across: the driver failed once, not per page. */
        contexts: [],
      },
    ],
    [],
  ).catch(() => undefined);
}

process.exitCode = 0;
