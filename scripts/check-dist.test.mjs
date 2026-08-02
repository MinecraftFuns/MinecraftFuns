import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import {
  candidatePaths,
  isCanonicalWithin,
  wkdViolations,
  parseRedirects,
  parseHeaderPatterns,
  hostDirectiveViolations,
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

  it("is total — a malformed escape does not throw", () => {
    assert.doesNotThrow(() => candidatePaths("/MinecraftFuns/%ZZ", "/MinecraftFuns/"));
  });
});

describe("isCanonicalWithin", () => {
  const SITE = "https://minecraftfuns.github.io";

  it("accepts a canonical under the deployment", () => {
    assert.ok(
      isCanonicalWithin(`${SITE}/MinecraftFuns/blog/`, SITE, "/MinecraftFuns/"),
    );
  });

  it("rejects a canonical on another origin", () => {
    assert.equal(
      isCanonicalWithin("https://evil.example/MinecraftFuns/blog/", SITE, "/MinecraftFuns/"),
      false,
    );
  });

  it("rejects a canonical outside the base path", () => {
    assert.equal(isCanonicalWithin(`${SITE}/elsewhere/`, SITE, "/MinecraftFuns/"), false);
  });

  it("is unmoved by a trailing slash on the configured site", () => {
    // The string-prefix version built "https://…//MinecraftFuns/" here and
    // failed a build whose canonical tags were entirely correct.
    assert.ok(
      isCanonicalWithin(`${SITE}/MinecraftFuns/blog/`, `${SITE}/`, "/MinecraftFuns/"),
    );
  });

  it("normalises host case and the default port", () => {
    assert.ok(isCanonicalWithin("https://JoeFang.org:443/blog/", "https://joefang.org", "/"));
  });

  it("is total — unparseable input is rejected, not thrown", () => {
    assert.doesNotThrow(() => isCanonicalWithin("not a url", SITE, "/"));
    assert.equal(isCanonicalWithin("not a url", SITE, "/"), false);
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

  it("leaves destinations on other origins alone — it cannot check them", () => {
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
