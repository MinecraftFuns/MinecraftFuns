import assert from "node:assert/strict";
import { describe, it } from "node:test";

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
import type { RootedPath } from "../config/schema.ts";

const reasons = (problems: readonly { reason: string }[]) =>
  problems.map((problem) => problem.reason);

describe("PathPattern", () => {
  it("renders a prefix with the splat the format expects", () => {
    assert.equal(renderPattern(exactPath("/pgp")), "/pgp");
    assert.equal(renderPattern(prefixPath("/pgp.")), "/pgp.*");
  });

  /*
   * The wildcard is a variant, not a character, so matching needs no pattern
   * language and nothing needs escaping. A path containing regex metacharacters
   * is just a string here.
   */
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
    const found = redirectProblems([{ from: prefixPath("/pg"), to: "/pgp", status: 301 }]);
    assert.match(reasons(found)[0], /loop/);
  });

  it("catches a self-redirect", () => {
    const found = redirectProblems([{ from: exactPath("/pgp"), to: "/pgp", status: 301 }]);
    assert.match(reasons(found)[0], /loop/);
  });

  /* First match wins, so anything an earlier rule covers can never fire. */
  it("catches a rule shadowed by an earlier one", () => {
    const found = redirectProblems([
      { from: prefixPath("/p"), to: "/x", status: 301 },
      { from: exactPath("/pgp"), to: "/y", status: 301 },
    ]);
    assert.match(reasons(found)[0], /unreachable/);
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
    assert.match(reasons(found)[0], /rooted path nor an absolute URL/);
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

  it("rejects a path that is not rooted", () => {
    assert.equal(parsePathPattern("pgp").tag, "invalid");
  });

  /* The domain models a trailing wildcard only, so a mid-path one is refused
     rather than silently treated as a literal asterisk. */
  it("rejects a star anywhere but the end", () => {
    assert.equal(parsePathPattern("/a/*/b").tag, "invalid");
    assert.equal(parsePathPattern("/*x").tag, "invalid");
  });

  it("is total: no input throws", () => {
    ["", "*", "/", "//*", "/a**"].forEach((raw) =>
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

  /* The wildcard is not part of the path, so only the literal half is resolved
     and no base logic ever sees an asterisk. */
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

  it("rejects a header rule that does nothing", () => {
    const decoded = decodeHostConfig({ headers: [{ path: "/a" }], redirects: [] }, under);
    assert.equal(decoded.tag, "invalid");
  });

  /* Config is edited by hand, so a run that reports one mistake at a time turns
     a typo into a sequence of builds. */
  it("reports every problem at once rather than the first", () => {
    const decoded = decodeHostConfig(
      {
        // `RootedPath` rejects this at compile time, so config cannot reach
        // the runtime check. The decoder is exported, though, so the check is
        // still live for callers whose input was never typed, hence the cast.
        headers: [{ path: "no-slash" as RootedPath, set: { a: "b" } }],
        redirects: [{ from: "/a/*/b", to: "/c" }],
      },
      under,
    );
    assert.equal(decoded.tag, "invalid");
    if (decoded.tag !== "invalid") return;
    assert.match(decoded.reason, /no-slash/);
    assert.match(decoded.reason, /\/a\/\*\/b/);
  });

  it("carries the structural checks through, on decoded values", () => {
    const decoded = decodeHostConfig(
      { headers: [], redirects: [{ from: "/pg*", to: "/pgp" }] },
      under,
    );
    assert.equal(decoded.tag, "invalid");
    if (decoded.tag !== "invalid") return;
    assert.match(decoded.reason, /loop/);
  });
});

describe("renderHeaders", () => {
  it("indents operations under their pattern and blank-lines between rules", () => {
    const rules: readonly HeaderRule[] = [
      {
        pattern: exactPath("/pgp"),
        ops: [{ kind: "set", name: "content-type", value: "application/pgp-keys" }],
      },
      {
        pattern: prefixPath("/x/"),
        ops: [{ kind: "remove", name: "link" }],
      },
    ];

    assert.equal(
      renderHeaders(rules),
      ["/pgp", "  content-type: application/pgp-keys", "", "/x/*", "  ! link", ""].join(
        "\n",
      ),
    );
  });

  /* `!` is an operator the format spells by prefixing a name, not part of one. */
  it("renders removal with the bang the format defines", () => {
    const text = renderHeaders([
      { pattern: exactPath("/a"), ops: [{ kind: "remove", name: "link" }] },
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
            { kind: "set", name: "content-type", value: "text/plain" },
            { kind: "set", name: "x-robots-tag", value: "noindex" },
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
          { kind: "set", name: "content-type", value: "text/plain" },
          { kind: "set", name: "Content-Type", value: "application/json" },
        ],
      },
    ]);
    assert.equal(found.length, 1, "header names are case-insensitive");
    assert.match(found[0].reason, /more than once/);
  });
});
