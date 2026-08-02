import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isWithin, joinBase, joinRoute } from "./url.ts";

/** The two base paths this project actually deploys to. */
const PROJECT_BASE = "/MinecraftFuns/";
const ROOT_BASE = "/";

describe("joinBase", () => {
  it("prefixes rooted paths under a project base", () => {
    assert.equal(joinBase(PROJECT_BASE, "/work"), "/MinecraftFuns/work");
    assert.equal(joinBase(PROJECT_BASE, "/favicon.svg"), "/MinecraftFuns/favicon.svg");
  });

  it("leaves rooted paths alone under a root base", () => {
    assert.equal(joinBase(ROOT_BASE, "/work"), "/work");
    assert.equal(joinBase(ROOT_BASE, "/"), "/");
  });

  it("maps the home path to the base itself", () => {
    assert.equal(joinBase(PROJECT_BASE, "/"), "/MinecraftFuns/");
  });

  it("never emits a doubled slash, whatever shape the base arrives in", () => {
    // Astro normalises BASE_URL with a trailing slash, but the config value is
    // written without one; both must produce the same link.
    for (const base of ["/MinecraftFuns", "/MinecraftFuns/", "/MinecraftFuns//"]) {
      assert.equal(joinBase(base, "/work"), "/MinecraftFuns/work");
    }
    for (const base of ["/", "//", ""]) {
      assert.equal(joinBase(base, "/work"), "/work");
    }
  });

  it("roots a relative path before joining", () => {
    assert.equal(joinBase(PROJECT_BASE, "work"), "/MinecraftFuns/work");
    assert.equal(joinBase(ROOT_BASE, "work"), "/work");
  });

  it("passes through anything that carries its own authority", () => {
    // Prefixing these would corrupt them.
    for (const href of [
      "https://joefang.org/pgp",
      "http://example.com",
      "mailto:someone@example.com",
      "matrix:u/multiset",
      "//cdn.example.com/asset.js",
      "#main",
    ]) {
      assert.equal(joinBase(PROJECT_BASE, href), href, `mangled: ${href}`);
    }
  });

  it("is total — no input throws", () => {
    for (const base of ["", "/", "///"]) {
      for (const path of ["", "/", "x", "#", "://"]) {
        assert.doesNotThrow(() => joinBase(base, path));
      }
    }
  });

  it("is idempotent on an already-rooted result under a root base", () => {
    const once = joinBase(ROOT_BASE, "/work");
    assert.equal(joinBase(ROOT_BASE, once), once);
  });

  it("leaves an asset path unslashed — a file is not a directory", () => {
    assert.equal(joinBase(PROJECT_BASE, "/favicon.svg"), "/MinecraftFuns/favicon.svg");
  });
});

describe("joinRoute", () => {
  it("terminates a route with the slash its built directory has", () => {
    assert.equal(joinRoute(PROJECT_BASE, "/blog"), "/MinecraftFuns/blog/");
    assert.equal(joinRoute(ROOT_BASE, "/blog"), "/blog/");
  });

  it("agrees with the canonical form of a nested archive route", () => {
    assert.equal(
      joinRoute(PROJECT_BASE, "/blog/2026/08/a-post"),
      "/MinecraftFuns/blog/2026/08/a-post/",
    );
  });

  it("maps the home path to the base itself, already slashed", () => {
    assert.equal(joinRoute(PROJECT_BASE, "/"), "/MinecraftFuns/");
    assert.equal(joinRoute(ROOT_BASE, "/"), "/");
  });

  it("is idempotent — re-resolving a route does not stack slashes", () => {
    const once = joinRoute(ROOT_BASE, "/blog");
    assert.equal(joinRoute(ROOT_BASE, once), once);
  });

  it("puts the slash before a fragment, not after it", () => {
    assert.equal(joinRoute(PROJECT_BASE, "/about#contact"), "/MinecraftFuns/about/#contact");
    assert.equal(joinRoute(PROJECT_BASE, "/blog?tag=time"), "/MinecraftFuns/blog/?tag=time");
  });

  it("passes through anything that carries its own authority", () => {
    ["https://example.com", "mailto:a@b.c", "#main", "//cdn.example.com/x"].forEach(
      (href) => {
        assert.equal(joinRoute(PROJECT_BASE, href), href, `mangled: ${href}`);
      },
    );
  });

  it("is total — no input throws", () => {
    const paths = ["", "/", "//", "?", "#", "a", "/a/b/c/", "?#"];
    [PROJECT_BASE, ROOT_BASE, ""].forEach((base) => {
      paths.forEach((path) => {
        assert.doesNotThrow(() => joinRoute(base, path));
      });
    });
  });
});

describe("isWithin", () => {
  it("matches the section landing page", () => {
    assert.ok(isWithin("/MinecraftFuns/work", "/MinecraftFuns/work"));
  });

  it("matches descendants", () => {
    assert.ok(isWithin("/MinecraftFuns/work/thing", "/MinecraftFuns/work"));
    assert.ok(isWithin("/MinecraftFuns/work/", "/MinecraftFuns/work"));
  });

  it("does not match a sibling sharing a prefix", () => {
    // Slash-terminating both sides is what makes the bare startsWith correct:
    // the separator is part of the prefix being tested.
    assert.equal(isWithin("/MinecraftFuns/workshop", "/MinecraftFuns/work"), false);
  });

  it("is indifferent to which side already carries its slash", () => {
    const pairs = [
      ["/MinecraftFuns/blog/", "/MinecraftFuns/blog/"],
      ["/MinecraftFuns/blog", "/MinecraftFuns/blog/"],
      ["/MinecraftFuns/blog/", "/MinecraftFuns/blog"],
    ];
    pairs.forEach(([pathname, target]) => {
      assert.ok(isWithin(pathname, target), `${pathname} within ${target}`);
    });
  });

  it("does not match unrelated sections", () => {
    assert.equal(isWithin("/MinecraftFuns/writing", "/MinecraftFuns/work"), false);
    assert.equal(isWithin("/MinecraftFuns/", "/MinecraftFuns/work"), false);
  });

  it("works identically at the root base", () => {
    assert.ok(isWithin("/work/thing", "/work"));
    assert.equal(isWithin("/workshop", "/work"), false);
  });
});
