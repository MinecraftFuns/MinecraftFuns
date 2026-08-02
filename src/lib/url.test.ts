import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isWithin, joinBase } from "./url.ts";

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
    // The reason this is not a bare startsWith.
    assert.equal(isWithin("/MinecraftFuns/workshop", "/MinecraftFuns/work"), false);
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
