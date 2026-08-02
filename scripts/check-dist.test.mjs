import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  candidatePaths,
  extractReferences,
  inspect,
  isInternal,
  normaliseBase,
  offPaletteColours,
  paletteFrom,
  undefinedCustomProperties,
} from "./check-dist.mjs";

/*
 * These are predominantly *negative* tests. A checker that has quietly stopped
 * catching things still reports success, which is the worst possible failure
 * mode for the last gate before production — so each check is fed input it is
 * supposed to reject, and asserted to reject it.
 */

const TOKENS = `
  --color-ink-black-950: #0a0f1a;
  --color-eggshell-50: #f8f5ed;
  --color-ink-black-500: #496ab6;
`;

/** Build a throwaway dist tree and inspect it. */
const inspectTree = async (files, options = {}) => {
  const dist = await mkdtemp(join(tmpdir(), "check-dist-"));
  for (const [path, contents] of Object.entries(files)) {
    const full = join(dist, path);
    await mkdir(join(full, ".."), { recursive: true });
    await writeFile(full, contents);
  }
  return inspect({
    dist,
    base: options.base ?? "/MinecraftFuns/",
    site: options.site ?? "https://example.test",
    tokensCss: options.tokensCss ?? TOKENS,
  });
};

const page = (body) =>
  `<!doctype html><html><head>
   <link rel="canonical" href="https://example.test/MinecraftFuns/"/>
   </head><body>${body}</body></html>`;

const checksIn = (violations) => new Set(violations.map((v) => v.check));

describe("normaliseBase", () => {
  it("agrees on every spelling of the same base", () => {
    for (const base of ["/MinecraftFuns", "/MinecraftFuns/", "MinecraftFuns//"]) {
      assert.equal(normaliseBase(base), "/MinecraftFuns/");
    }
  });

  it("maps every spelling of the root to /", () => {
    for (const base of ["", "/", "//"]) assert.equal(normaliseBase(base), "/");
  });
});

describe("extractReferences", () => {
  it("finds href and src across tags and casing", () => {
    const found = extractReferences(
      `<a href="/a">x</a><img SRC="/b.png"><link href='/skipped'><script src="/c.js">`,
    );
    // Single-quoted attributes are deliberately out of scope; Astro emits
    // double quotes. Asserted so the limitation is visible rather than assumed.
    assert.deepEqual(found, ["/a", "/b.png", "/c.js"]);
  });

  it("returns an empty list rather than throwing on empty input", () => {
    assert.deepEqual(extractReferences(""), []);
  });
});

describe("isInternal", () => {
  it("rejects references carrying their own authority", () => {
    for (const href of [
      "https://example.com",
      "//cdn.example.com/x.js",
      "mailto:a@b.c",
      "#main",
    ]) {
      assert.equal(isInternal(href), false, `treated as internal: ${href}`);
    }
  });

  it("accepts rooted paths", () => {
    assert.ok(isInternal("/MinecraftFuns/work"));
  });
});

describe("candidatePaths", () => {
  it("maps the base itself to the index", () => {
    assert.deepEqual(candidatePaths("/MinecraftFuns/", "/MinecraftFuns/"), [
      "index.html",
    ]);
  });

  it("offers directory and extension forms for a route", () => {
    assert.deepEqual(candidatePaths("/MinecraftFuns/work", "/MinecraftFuns/"), [
      "work",
      "work/index.html",
      "work.html",
    ]);
  });

  it("strips query and fragment before resolving", () => {
    assert.ok(
      candidatePaths("/MinecraftFuns/work?x=1#top", "/MinecraftFuns/").includes(
        "work/index.html",
      ),
    );
  });

  it("yields nothing for a reference outside the base", () => {
    assert.deepEqual(candidatePaths("/work", "/MinecraftFuns/"), []);
  });
});

describe("undefinedCustomProperties", () => {
  it("catches a typo'd custom property", () => {
    const css = ":root{--ink:#000}.a{color:var(--inkk)}";
    assert.deepEqual(undefinedCustomProperties(css), ["--inkk"]);
  });

  it("passes a stylesheet whose references all resolve", () => {
    assert.deepEqual(undefinedCustomProperties(":root{--ink:#000}.a{color:var(--ink)}"), []);
  });
});

describe("palette checks", () => {
  it("reads the palette from the token layer", () => {
    assert.equal(paletteFrom(TOKENS).size, 3);
  });

  it("catches a colour from outside the palette", () => {
    const palette = paletteFrom(TOKENS);
    // Linear's lavender: plausible-looking, explicitly banned.
    assert.deepEqual(offPaletteColours(".a{color:#5e6ad2}", palette), ["#5e6ad2"]);
  });

  it("accepts palette colours regardless of case", () => {
    assert.deepEqual(offPaletteColours(".a{color:#0A0F1A}", paletteFrom(TOKENS)), []);
  });
});

describe("inspect", () => {
  it("passes a well-formed artifact", async () => {
    const violations = await inspectTree({
      "index.html": page('<a href="/MinecraftFuns/work">w</a>'),
      "favicon.svg": "<svg/>",
      "work/index.html": page("work"),
    });
    assert.deepEqual(violations, []);
  });

  it("catches a link that forgot the base path", async () => {
    // The exact bug that passed a clean typecheck and full test run.
    const violations = await inspectTree({
      "index.html": page('<a href="/work">w</a>'),
      "favicon.svg": "<svg/>",
      "work/index.html": page("work"),
    });
    assert.ok(checksIn(violations).has("base-path"));
  });

  it("catches a link to a page that was never built", async () => {
    const violations = await inspectTree({
      "index.html": page('<a href="/MinecraftFuns/cv">cv</a>'),
      "favicon.svg": "<svg/>",
    });
    assert.ok(checksIn(violations).has("dead-link"));
  });

  it("catches a missing required file", async () => {
    const violations = await inspectTree({ "index.html": page("x") });
    assert.ok(
      violations.some((v) => v.check === "output" && v.detail.includes("favicon")),
    );
  });

  it("catches an empty build", async () => {
    const violations = await inspectTree({ "notes.txt": "x" });
    assert.ok(checksIn(violations).has("output"));
  });

  it("catches client JavaScript, inline or emitted", async () => {
    const inline = await inspectTree({
      "index.html": page("<script>alert(1)</script>"),
      "favicon.svg": "<svg/>",
    });
    assert.ok(checksIn(inline).has("zero-js"));

    const emitted = await inspectTree({
      "index.html": page("x"),
      "favicon.svg": "<svg/>",
      "_astro/island.js": "console.log(1)",
    });
    assert.ok(checksIn(emitted).has("zero-js"));
  });

  it("catches a rendered undefined", async () => {
    const violations = await inspectTree({
      "index.html": page("<p>undefined</p>"),
      "favicon.svg": "<svg/>",
    });
    assert.ok(checksIn(violations).has("leakage"));
  });

  it("catches a missing or foreign canonical", async () => {
    const missing = await inspectTree({
      "index.html": "<!doctype html><html><body>x</body></html>",
      "favicon.svg": "<svg/>",
    });
    assert.ok(checksIn(missing).has("canonical"));

    const foreign = await inspectTree({
      "index.html":
        '<!doctype html><html><head><link rel="canonical" href="https://elsewhere.test/"/></head><body>x</body></html>',
      "favicon.svg": "<svg/>",
    });
    assert.ok(checksIn(foreign).has("canonical"));
  });

  it("catches an off-palette colour in emitted CSS", async () => {
    const violations = await inspectTree({
      "index.html": page("x"),
      "favicon.svg": "<svg/>",
      "_astro/index.css": ".a{color:#5e6ad2}",
    });
    assert.ok(checksIn(violations).has("palette"));
  });

  it("accumulates rather than stopping at the first violation", async () => {
    // One CI round-trip per defect is how a gate gets disabled.
    const violations = await inspectTree({
      "index.html": page('<a href="/work">w</a><p>undefined</p>'),
      "_astro/index.css": ".a{color:#5e6ad2;border-color:var(--nope)}",
    });
    const checks = checksIn(violations);
    for (const expected of ["base-path", "leakage", "palette", "css-var", "output"]) {
      assert.ok(checks.has(expected), `missed ${expected}`);
    }
  });

  it("applies the root base correctly", async () => {
    const violations = await inspectTree(
      {
        "index.html": `<!doctype html><html><head><link rel="canonical" href="https://example.test/"/></head><body><a href="/work">w</a></body></html>`,
        "favicon.svg": "<svg/>",
        "work/index.html": "<html><head><link rel=\"canonical\" href=\"https://example.test/work/\"/></head><body>w</body></html>",
      },
      { base: "/" },
    );
    assert.deepEqual(violations, []);
  });
});
