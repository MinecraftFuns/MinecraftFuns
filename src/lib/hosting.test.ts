import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { explain } from "../prelude/adt.ts";

import {
  covers,
  decodeHostConfig,
  exactPath,
  headerProblems,
  parsePathPattern,
  patternMatches,
  prefixPath,
  redirectProblems,
  renderHeaders,
  renderPattern,
  renderRedirects,
  type HeaderRule,
  type Redirect,
} from "./hosting.ts";

/* Join so empty findings fail assertions instead of producing `undefined`. */
const reasons = (problems: readonly { readonly reason: string }[]): string =>
  problems.map((problem) => problem.reason).join("\n");

describe("PathPattern", () => {
  it("renders a prefix with the splat the format expects", () => {
    assert.equal(renderPattern(exactPath("/pgp")), "/pgp");
    assert.equal(renderPattern(prefixPath("/pgp.")), "/pgp.*");
  });

  /* The wildcard is structural; other characters remain literal. */
  it("matches without a pattern language, so metacharacters are literal", () => {
    assert.ok(patternMatches(exactPath("/a.b+c"), "/a.b+c"));
    assert.equal(patternMatches(exactPath("/a.b+c"), "/axbxc"), false);
    assert.ok(patternMatches(prefixPath("/pgp."), "/pgp.asc"));
    assert.equal(patternMatches(prefixPath("/pgp."), "/pgpXasc"), false);
  });

  it("matches an exact pattern only against itself", () => {
    assert.ok(patternMatches(exactPath("/pgp"), "/pgp"));
    assert.equal(patternMatches(exactPath("/pgp"), "/pgp.asc"), false);
  });
});

describe("covers", () => {
  it("has a prefix cover everything beneath it", () => {
    assert.ok(covers(prefixPath("/pg"), exactPath("/pgp")));
    assert.ok(covers(prefixPath("/pg"), prefixPath("/pgp.")));
  });

  it("does not let an exact pattern cover anything but itself", () => {
    assert.ok(covers(exactPath("/pgp"), exactPath("/pgp")));
    assert.equal(covers(exactPath("/pgp"), prefixPath("/pgp")), false);
    assert.equal(covers(exactPath("/pg"), exactPath("/pgp")), false);
  });

  /* Exhaustively check that coverage implies matching every inner path. */
  const PATHS = ["", "/", "/a", "/a/", "/ab", "/a/b", "/b"] as const;
  const PATTERNS = PATHS.flatMap((path) => [exactPath(path), prefixPath(path)]);

  it("never covers a pattern that matches a path the coverer does not", () => {
    PATTERNS.forEach((outer) =>
      PATTERNS.filter((inner) => covers(outer, inner)).forEach((inner) =>
        PATHS.filter((path) => patternMatches(inner, path)).forEach((path) =>
          assert.ok(
            patternMatches(outer, path),
            `${renderPattern(outer)} covers ${renderPattern(inner)}, which matches ${JSON.stringify(path)}`,
          ),
        ),
      ),
    );
  });

  /* Prevent the coverage law from passing vacuously. */
  it("does cover something, and does refuse something", () => {
    assert.ok(PATTERNS.some((inner) => covers(prefixPath("/a"), inner)));
    assert.ok(PATTERNS.some((inner) => !covers(exactPath("/a"), inner)));
  });

  /* These properties support ordered shadow detection. */
  it("is reflexive", () => {
    PATTERNS.forEach((pattern) => assert.ok(covers(pattern, pattern)));
  });

  it("is transitive", () => {
    PATTERNS.forEach((a) =>
      PATTERNS.filter((b) => covers(a, b)).forEach((b) =>
        PATTERNS.filter((c) => covers(b, c)).forEach((c) =>
          assert.ok(
            covers(a, c),
            `${renderPattern(a)} covers ${renderPattern(b)} covers ${renderPattern(c)}`,
          ),
        ),
      ),
    );
  });
});

describe("renderRedirects", () => {
  it("emits from, to and status per line", () => {
    const rules: readonly Redirect[] = [
      { from: exactPath("/gpg"), to: "/pgp", status: 301 },
      { from: prefixPath("/pgp."), to: "/pgp", status: 308 },
    ];
    assert.equal(renderRedirects(rules), "/gpg /pgp 301\n/pgp.* /pgp 308\n");
  });
});

describe("redirectProblems", () => {
  it("passes a sound policy", () => {
    assert.deepEqual(
      redirectProblems([
        { from: exactPath("/gpg"), to: "/pgp", status: 301 },
        { from: prefixPath("/pgp."), to: "/pgp", status: 301 },
      ]),
      [],
    );
  });

  it("catches a rule that redirects into its own match set", () => {
    const found = redirectProblems([
      { from: prefixPath("/pg"), to: "/pgp", status: 301 },
    ]);
    assert.match(reasons(found), /loop/);
  });

  it("catches a self-redirect", () => {
    const found = redirectProblems([
      { from: exactPath("/pgp"), to: "/pgp", status: 301 },
    ]);
    assert.match(reasons(found), /loop/);
  });

  /* First match wins, so anything an earlier rule covers can never fire. */
  it("catches a rule shadowed by an earlier one", () => {
    const found = redirectProblems([
      { from: prefixPath("/p"), to: "/x", status: 301 },
      { from: exactPath("/pgp"), to: "/y", status: 301 },
    ]);
    assert.match(reasons(found), /unreachable/);
  });

  it("does not call a later rule shadowed when order is right", () => {
    assert.deepEqual(
      redirectProblems([
        { from: exactPath("/pgp"), to: "/y", status: 301 },
        { from: prefixPath("/p"), to: "/x", status: 301 },
      ]),
      [],
    );
  });

  it("catches a destination that is neither rooted nor absolute", () => {
    const found = redirectProblems([{ from: exactPath("/a"), to: "pgp", status: 301 }]);
    assert.match(reasons(found), /rooted path nor an absolute URL/);
  });

  it("accepts a destination leaving the site", () => {
    assert.deepEqual(
      redirectProblems([
        { from: exactPath("/x"), to: "https://example.test/y", status: 301 },
      ]),
      [],
    );
  });

  it("is total: an empty policy is not a problem", () => {
    assert.deepEqual(redirectProblems([]), []);
  });
});

describe("parsePathPattern", () => {
  it("reads a plain path as exact and a trailing star as a prefix", () => {
    assert.deepEqual(parsePathPattern("/pgp"), { tag: "ok", value: exactPath("/pgp") });
    assert.deepEqual(parsePathPattern("/pgp."), {
      tag: "ok",
      value: exactPath("/pgp."),
    });
    assert.deepEqual(parsePathPattern("/pgp.*"), {
      tag: "ok",
      value: prefixPath("/pgp."),
    });
  });

  /* Only trailing wildcards are valid; rootedness is enforced by the type. */
  it("rejects a star anywhere but the end", () => {
    assert.equal(parsePathPattern("/a/*/b").tag, "invalid");
    assert.equal(parsePathPattern("/*x").tag, "invalid");
  });

  it("is total on every rooted path: none throws", () => {
    (["/", "//*", "/a**", "/*", "/a*b*"] as const).forEach((raw) =>
      assert.doesNotThrow(() => parsePathPattern(raw)),
    );
  });
});

describe("decodeHostConfig", () => {
  const under = (path: string) => `/base${path}`;

  it("applies the base to patterns and to internal destinations", () => {
    const decoded = decodeHostConfig(
      {
        headers: [{ path: "/pgp", set: { "content-type": "application/pgp-keys" } }],
        redirects: [{ from: "/gpg", to: "/pgp" }],
      },
      under,
    );

    assert.equal(decoded.tag, "ok");
    if (decoded.tag !== "ok") return;
    assert.equal(renderRedirects(decoded.value.redirects), "/base/gpg /base/pgp 301\n");
    assert.match(renderHeaders(decoded.value.headers), /^\/base\/pgp$/m);
  });

  /* Resolve only the literal prefix; the wildcard is not a path segment. */
  it("resolves only the literal half of a prefix", () => {
    const decoded = decodeHostConfig(
      { headers: [], redirects: [{ from: "/pgp.*", to: "/pgp" }] },
      under,
    );
    assert.equal(decoded.tag, "ok");
    if (decoded.tag !== "ok") return;
    assert.equal(renderRedirects(decoded.value.redirects), "/base/pgp.* /base/pgp 301\n");
  });

  it("leaves a destination on another origin alone", () => {
    const decoded = decodeHostConfig(
      { headers: [], redirects: [{ from: "/x", to: "https://example.test/y" }] },
      under,
    );
    assert.equal(decoded.tag, "ok");
    if (decoded.tag !== "ok") return;
    assert.match(renderRedirects(decoded.value.redirects), /https:\/\/example\.test\/y/);
  });

  it("defaults the status to a permanent move", () => {
    const decoded = decodeHostConfig(
      { headers: [], redirects: [{ from: "/a", to: "/b" }] },
      (path) => path,
    );
    assert.equal(decoded.tag === "ok" && decoded.value.redirects[0]?.status, 301);
  });

  /* The decoder still handles an empty `set` object at runtime. */
  it("rejects a header rule whose only declaration is empty", () => {
    const decoded = decodeHostConfig(
      { headers: [{ path: "/a", set: {} }], redirects: [] },
      under,
    );
    assert.equal(decoded.tag, "invalid");
  });

  /* Report independent hand-edited config errors together. */
  it("reports every problem at once rather than the first", () => {
    const decoded = decodeHostConfig(
      {
        headers: [{ path: "/a*/b", set: { a: "b" } }],
        redirects: [{ from: "/c/*/d", to: "/e" }],
      },
      under,
    );
    assert.equal(decoded.tag, "invalid");
    if (decoded.tag !== "invalid") return;
    assert.match(explain(decoded), /\/a\*\/b/);
    assert.match(explain(decoded), /\/c\/\*\/d/);
  });

  it("carries the structural checks through, on decoded values", () => {
    const decoded = decodeHostConfig(
      { headers: [], redirects: [{ from: "/pg*", to: "/pgp" }] },
      under,
    );
    assert.equal(decoded.tag, "invalid");
    if (decoded.tag !== "invalid") return;
    assert.match(explain(decoded), /loop/);
  });
});

describe("renderHeaders", () => {
  it("indents operations under their pattern and blank-lines between rules", () => {
    const rules: readonly HeaderRule[] = [
      {
        pattern: exactPath("/pgp"),
        ops: [{ tag: "set", name: "content-type", value: "application/pgp-keys" }],
      },
      {
        pattern: prefixPath("/x/"),
        ops: [{ tag: "remove", name: "link" }],
      },
    ];

    assert.equal(
      renderHeaders(rules),
      ["/pgp", "  content-type: application/pgp-keys", "", "/x/*", "  ! link", ""].join(
        "\n",
      ),
    );
  });

  /* Removal prefixes the property name with the format's `!` operator. */
  it("renders removal with the bang the format defines", () => {
    const text = renderHeaders([
      { pattern: exactPath("/a"), ops: [{ tag: "remove", name: "link" }] },
    ]);
    assert.match(text, /^ {2}! link$/m);
  });
});

describe("headerProblems", () => {
  it("passes distinct header names", () => {
    assert.deepEqual(
      headerProblems([
        {
          pattern: exactPath("/a"),
          ops: [
            { tag: "set", name: "content-type", value: "text/plain" },
            { tag: "set", name: "x-robots-tag", value: "noindex" },
          ],
        },
      ]),
      [],
    );
  });

  it("catches a header set twice in one rule, where only the last survives", () => {
    const found = headerProblems([
      {
        pattern: exactPath("/a"),
        ops: [
          { tag: "set", name: "content-type", value: "text/plain" },
          { tag: "set", name: "Content-Type", value: "application/json" },
        ],
      },
    ]);
    assert.equal(found.length, 1, "header names are case-insensitive");
    assert.match(reasons(found), /more than once/);
  });
});
