import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  canonicalLinks,
  candidatePaths,
  CHECKS,
  clientScripts,
  expectedCanonical,
  wkdViolations,
  parseRedirects,
  parseHeaderPatterns,
  hostDirectiveViolations,
  extractReferences,
  inspect,
  isInternal,
  linkIntegrity,
  missingRequired,
  noOutput,
  normaliseBase,
  offPaletteColours,
  paletteFrom,
  stylesheetIntegrity,
  templateLeakage,
  webKeyDirectory,
  undefinedCustomProperties,
} from "./check-dist.mjs";

/*
 * These are predominantly *negative* tests. A checker that has quietly stopped
 * catching things still reports success, which is the worst possible failure
 * mode for the last gate before production, so each check is fed input it is
 * supposed to reject, and asserted to reject it.
 */

const TOKENS = `
  --color-ink-black-950: #0a0f1a;
  --color-eggshell-50: #f8f5ed;
  --color-ink-black-500: #496ab6;
`;

/*
 * A well-formed artifact publishes a key directory, so the fixtures carry a
 * minimal one. Presence is asserted rather than assumed: a build that silently
 * stopped emitting the key would otherwise look exactly like a clean run.
 * `wkdViolations` is tested directly for the malformed cases.
 */
const WKD_FIXTURE = {
  ".well-known/openpgpkey/policy": "",
  ".well-known/openpgpkey/hu/s8y7oh5xrdpu9psba3i5ntk64ohouhga": Buffer.from([
    0x98, 0x01,
  ]),
};

/** Build a throwaway dist tree and inspect it. */
const inspectTree = async (files, options = {}) => {
  const dist = await mkdtemp(join(tmpdir(), "check-dist-"));
  for (const [path, contents] of Object.entries({ ...WKD_FIXTURE, ...files })) {
    const full = join(dist, path);
    await mkdir(join(full, ".."), { recursive: true });
    await writeFile(full, contents);
  }
  const base = options.base ?? "/MinecraftFuns/";
  const site = options.site ?? "https://example.test";

  return inspect({
    dist,
    base,
    site,
    /* Defaults to the build's own parameters, so a fixture that says nothing
       about deployments behaves as it did. The cases that matter pass a
       canonical deployment *different* from the one being built, which is the
       arrangement the exact check exists for. */
    canonical: options.canonical ?? { origin: site, base },
    tokensCss: options.tokensCss ?? TOKENS,
  });
};

/**
 * A page carrying the canonical URL its own position implies.
 *
 * `route` is required for anything but the site root: the canonical check is
 * an exact comparison, so a helper that stamped one URL onto every fixture
 * would make every nested page a violation. It previously did exactly that,
 * and the containment check could not tell.
 */
const page = (body, route = "") =>
  `<!doctype html><html><head>
   <link rel="canonical" href="https://example.test/MinecraftFuns/${route}"/>
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

  it("strips a fragment that itself contains a question mark", () => {
    // The standard splits the fragment first; a pattern reaching for the
    // earliest of `?` or `#` would keep "?y" as part of the filename.
    assert.ok(
      candidatePaths("/MinecraftFuns/work#a?y", "/MinecraftFuns/").includes(
        "work/index.html",
      ),
    );
  });

  it("decodes an escaped path so it can name a file on disk", () => {
    assert.ok(
      candidatePaths("/MinecraftFuns/caf%C3%A9/", "/MinecraftFuns/").includes(
        "café/index.html",
      ),
    );
  });

  it("yields nothing for a protocol-relative reference at the root base", () => {
    // "//evil.example/x" starts with "/" and so passed the old prefix test.
    assert.deepEqual(candidatePaths("//evil.example/x", "/"), []);
  });

  it("is total: a malformed escape does not throw", () => {
    assert.doesNotThrow(() => candidatePaths("/MinecraftFuns/%ZZ", "/MinecraftFuns/"));
  });
});

describe("expectedCanonical", () => {
  const CANONICAL = "https://joefang.org";

  it("maps the site root to the canonical root", () => {
    assert.equal(expectedCanonical("index.html", CANONICAL, "/"), `${CANONICAL}/`);
  });

  it("maps a directory route to its slash-terminated URL", () => {
    assert.equal(
      expectedCanonical("blog/index.html", CANONICAL, "/"),
      `${CANONICAL}/blog/`,
    );
  });

  it("maps a nested archive route", () => {
    assert.equal(
      expectedCanonical("blog/2025/04/slug/index.html", CANONICAL, "/"),
      `${CANONICAL}/blog/2025/04/slug/`,
    );
  });

  it("maps a bare .html file, which is how 404 is emitted", () => {
    assert.equal(expectedCanonical("404.html", CANONICAL, "/"), `${CANONICAL}/404/`);
  });

  it("mounts on a canonical base path when the canonical copy has one", () => {
    assert.equal(
      expectedCanonical("blog/index.html", CANONICAL, "/site/"),
      `${CANONICAL}/site/blog/`,
    );
  });

  it("does not depend on the base the artifact was built for", () => {
    /* The whole point: the same page emitted by any deployment must claim the
       same canonical URL. The function takes no build parameters, so this is
       true by construction rather than by care. */
    assert.equal(
      expectedCanonical("blog/index.html", CANONICAL, "/"),
      `${CANONICAL}/blog/`,
    );
  });

  it("agrees on every spelling of the canonical base", () => {
    for (const base of ["", "/", "//"]) {
      assert.equal(expectedCanonical("index.html", CANONICAL, base), `${CANONICAL}/`);
    }
  });

  it("normalises host case and the default port", () => {
    assert.equal(
      expectedCanonical("index.html", "https://JoeFang.org:443", "/"),
      "https://joefang.org/",
    );
  });

  it("is total: an unparseable origin yields undefined rather than throwing", () => {
    assert.doesNotThrow(() => expectedCanonical("index.html", "not a url", "/"));
    assert.equal(expectedCanonical("index.html", "not a url", "/"), undefined);
  });
});

describe("host directive parsing", () => {
  it("reads redirect fields and ignores comments and blank lines", () => {
    const text = "# a comment\n\n/gpg /pgp 301\n/pgp.* /pgp 301\n";
    assert.deepEqual(parseRedirects(text), [
      { from: "/gpg", to: "/pgp", status: "301" },
      { from: "/pgp.*", to: "/pgp", status: "301" },
    ]);
  });

  it("reads header patterns but not the operations indented beneath them", () => {
    const text = "# c\n/pgp\n  content-type: application/pgp-keys\n\n/x/*\n  ! link\n";
    assert.deepEqual(parseHeaderPatterns(text), ["/pgp", "/x/*"]);
  });

  it("is total on an empty file", () => {
    assert.deepEqual(parseRedirects(""), []);
    assert.deepEqual(parseHeaderPatterns(""), []);
  });
});

describe("hostDirectiveViolations", () => {
  const resolves = (reference, isPrefix = false) =>
    isPrefix ? reference === "/real/" : reference === "/real";

  it("passes directives whose paths were built", () => {
    assert.deepEqual(
      hostDirectiveViolations({
        redirects: [{ from: "/old", to: "/real", status: "301" }],
        headerPatterns: ["/real", "/real/*"],
        resolves,
      }),
      [],
    );
  });

  /* Exactly how the legacy files rotted: rules outliving what they described. */
  it("catches a redirect to a path no file satisfies", () => {
    const found = hostDirectiveViolations({
      redirects: [{ from: "/old", to: "/declaration", status: "301" }],
      headerPatterns: [],
      resolves,
    });
    assert.match(found[0], /\/declaration, which no file satisfies/);
  });

  it("catches a header rule matching nothing that was built", () => {
    const found = hostDirectiveViolations({
      redirects: [],
      headerPatterns: ["/gone/*"],
      resolves,
    });
    assert.match(found[0], /matches nothing that was built/);
  });

  it("leaves destinations on other origins alone: it cannot check them", () => {
    assert.deepEqual(
      hostDirectiveViolations({
        redirects: [
          { from: "/a", to: "https://example.test/x", status: "301" },
          { from: "/b", to: "//cdn.example.test/x", status: "301" },
        ],
        headerPatterns: [],
        resolves,
      }),
      [],
    );
  });
});

describe("wkdViolations", () => {
  const HASH = "s8y7oh5xrdpu9psba3i5ntk64ohouhga";
  const key = (bytes) => ({ name: HASH, bytes: Uint8Array.from(bytes) });

  it("passes a directory holding a binary key and a policy file", () => {
    assert.deepEqual(wkdViolations({ policy: true, keys: [key([0x98, 0x01])] }), []);
  });

  it("accepts the other public-key packet framing", () => {
    assert.deepEqual(wkdViolations({ policy: true, keys: [key([0x99, 0x01])] }), []);
  });

  it("catches a missing policy file, which the specification requires", () => {
    const found = wkdViolations({ policy: false, keys: [key([0x98])] });
    assert.equal(found.length, 1);
    assert.match(found[0], /policy/);
  });

  it("catches a directory with no keys at all", () => {
    assert.match(wkdViolations({ policy: true, keys: [] })[0], /no keys/);
  });

  it("catches an armored key where the binary one is mandatory", () => {
    // "-----BEGIN" starts with 0x2d. This is the specific mistake the spec
    // warns against, and it would leave clients unable to import the key.
    const found = wkdViolations({ policy: true, keys: [key([0x2d, 0x2d])] });
    assert.match(found[0], /binary, not armored/);
  });

  it("catches an empty key file", () => {
    assert.match(wkdViolations({ policy: true, keys: [key([])] })[0], /is empty/);
  });

  it("catches a filename that is not a Z-Base-32 hash", () => {
    const found = wkdViolations({
      policy: true,
      // 'l' and '0' are absent from Z-Base-32; a name using them would mean
      // the encoder had drifted onto RFC 4648's alphabet.
      keys: [{ name: "l0" + "a".repeat(30), bytes: Uint8Array.from([0x98]) }],
    });
    assert.match(found[0], /Z-Base-32/);
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

  it("allows an undefined property that supplies a fallback", () => {
    // Tailwind's override slots are deliberately unset: an unset --tw-leading
    // means "nothing overrode the role's line height".
    const css = ".a{line-height:var(--tw-leading,var(--text-body--line-height))}";
    assert.deepEqual(undefinedCustomProperties(css), ["--text-body--line-height"]);
  });

  it("still catches a bare read nested inside a fallback", () => {
    assert.deepEqual(
      undefinedCustomProperties(".a{color:var(--tw-x,var(--gone))}"),
      ["--gone"],
    );
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
      "work/index.html": page("work", "work/"),
    });
    assert.deepEqual(violations, []);
  });

  it("catches a link that forgot the base path", async () => {
    // The exact bug that passed a clean typecheck and full test run.
    const violations = await inspectTree({
      "index.html": page('<a href="/work">w</a>'),
      "favicon.svg": "<svg/>",
      "work/index.html": page("work", "work/"),
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

  it("catches a mirror that canonicalises to itself instead of to the canonical copy", async () => {
    /* The regression that motivated the exact check. This artifact is
       internally consistent and passes every other gate: its canonical tag
       points at a real page, on its own origin, under its own base. It is
       still wrong, because the authoritative copy lives elsewhere. */
    const selfCanonical = await inspectTree(
      {
        "index.html": `<!doctype html><html><head><link rel="canonical" href="https://mirror.test/MinecraftFuns/"/></head><body>x</body></html>`,
        "favicon.svg": "<svg/>",
      },
      {
        site: "https://mirror.test",
        base: "/MinecraftFuns/",
        canonical: { origin: "https://joefang.test", base: "/" },
      },
    );
    assert.ok(checksIn(selfCanonical).has("canonical"));
  });

  it("accepts a mirror that canonicalises to the canonical copy", async () => {
    const violations = await inspectTree(
      {
        "index.html": `<!doctype html><html><head><link rel="canonical" href="https://joefang.test/"/></head><body><a href="/MinecraftFuns/work">w</a></body></html>`,
        "favicon.svg": "<svg/>",
        "work/index.html": `<html><head><link rel="canonical" href="https://joefang.test/work/"/></head><body>w</body></html>`,
      },
      {
        site: "https://mirror.test",
        base: "/MinecraftFuns/",
        canonical: { origin: "https://joefang.test", base: "/" },
      },
    );
    assert.deepEqual(violations, []);
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

/*
 * The checks that used to live inside `inspect` as pushes into a shared
 * accumulator. Each is now a function of an artifact literal, so it can be
 * tested without writing a directory and building a site into it, and each
 * appears once in `CHECKS`.
 */

const artifact = (over = {}) => ({
  base: "/",
  normalisedBase: "/",
  canonical: { origin: "https://example.test", base: "/" },
  present: new Set(["index.html", "favicon.svg"]),
  relativeFiles: ["index.html", "favicon.svg"],
  html: [],
  css: [],
  js: [],
  redirects: [],
  headerPatterns: [],
  wkd: { policy: false, keys: [] },
  palette: new Set(["#5e6ad2"]),
  ...over,
});

const doc = (path, text) => ({ path, text });

describe("checks as data", () => {
  it("names every check exactly once", () => {
    assert.equal(new Set(CHECKS).size, CHECKS.length);
    assert.ok(CHECKS.every((check) => typeof check === "function"));
  });

  /* A conformant artifact, minimal but not empty: an empty one is *not*
     silent, because the WKD spec requires a policy file and at least one key,
     and a check that stayed quiet about their absence would be wrong. */
  it("finds nothing in a conformant artifact", () => {
    const wkd = {
      policy: true,
      keys: [
        {
          name: "s8y7oh5xrdpu9psba3i5ntk64ohouhga",
          bytes: Uint8Array.from([0x98, 0x01]),
        },
      ],
    };
    assert.deepEqual(
      CHECKS.flatMap((check) => check(artifact({ wkd }))),
      [],
    );
  });

  it("is not vacuously quiet: an artifact publishing no key says so", () => {
    assert.deepEqual(
      webKeyDirectory(artifact()).map(({ check }) => check),
      ["wkd", "wkd"],
    );
  });

  it("reports an emitted build with no pages, and stops there", () => {
    assert.equal(noOutput(artifact({ html: [] })).length, 1);
    assert.deepEqual(noOutput(artifact({ html: [doc("index.html", "<html/>")] })), []);
  });

  it("requires the files a deployment cannot work without", () => {
    const found = missingRequired(artifact({ present: new Set(["index.html"]) }));
    assert.deepEqual(
      found.map(({ detail }) => detail),
      ["missing required file: favicon.svg"],
    );
  });

  it("catches both an emitted script file and an inline one", () => {
    const found = clientScripts(
      artifact({
        js: ["_astro/island.js"],
        html: [doc("index.html", "<html><body><script>x()</script></body></html>")],
      }),
    );
    assert.equal(found.length, 2);
    assert.ok(found.every(({ check }) => check === "zero-js"));
  });

  it("catches a prop that rendered as undefined", () => {
    const found = templateLeakage(
      artifact({ html: [doc("a.html", "<p>undefined</p>")] }),
    );
    assert.deepEqual(
      found.map(({ detail }) => detail),
      ["rendered undefined in a.html"],
    );
  });

  it("separates a link outside the base from one that merely resolves nowhere", () => {
    const found = linkIntegrity(
      artifact({
        base: "/app/",
        normalisedBase: "/app/",
        html: [doc("index.html", '<a href="/elsewhere/">a</a><a href="/app/gone/">b</a>')],
        present: new Set(["index.html"]),
        relativeFiles: ["index.html"],
      }),
    );
    assert.deepEqual(found.map(({ check }) => check), ["base-path", "dead-link"]);
  });

  it("holds every page to the canonical deployment, not the one being built", () => {
    const mirrored = artifact({
      canonical: { origin: "https://canonical.test", base: "/" },
      html: [doc("a/index.html", '<link rel="canonical" href="https://mirror.test/a/"/>')],
    });
    assert.match(canonicalLinks(mirrored)[0].detail, /should be https:\/\/canonical.test\/a\//);
  });

  it("reports a page with no canonical link at all", () => {
    const found = canonicalLinks(artifact({ html: [doc("a.html", "<html/>")] }));
    assert.match(found[0].detail, /no canonical link/);
  });

  it("reports a stylesheet using a property nothing defines", () => {
    const found = stylesheetIntegrity(
      artifact({ css: [doc("a.css", ".x{color:var(--nope)}")] }),
    );
    assert.deepEqual(found.map(({ check }) => check), ["css-var"]);
  });

  it("treats an empty palette as a defect rather than a vacuous pass", () => {
    const found = stylesheetIntegrity(artifact({ palette: new Set() }));
    assert.deepEqual(found.map(({ check }) => check), ["palette"]);
  });
});
