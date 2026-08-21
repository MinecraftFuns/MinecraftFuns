import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sitemapFilter } from "./sitemap.ts";

const at = (base: string, path: string) => `https://example.test${base}${path}`;

describe("sitemapFilter", () => {
  const include = sitemapFilter("/MinecraftFuns/");

  it("drops the excluded route", () => {
    assert.equal(include(at("/MinecraftFuns", "/404/")), false);
  });

  /* Exclusions are route matches, not substring matches inside slugs. */
  it("keeps a route that only contains an excluded one as text", () => {
    assert.ok(include(at("/MinecraftFuns", "/blog/2026/08/404-is-a-http-code/")));
    assert.ok(include(at("/MinecraftFuns", "/404-handling/")));
  });

  it("keeps ordinary pages", () => {
    ["/", "/blog/", "/about/"].forEach((route) =>
      assert.ok(include(at("/MinecraftFuns", route))),
    );
  });

  /* Resolve both the configured base and the page URL. */
  it("excludes under a root deployment too", () => {
    const atRoot = sitemapFilter("/");
    assert.equal(atRoot(at("", "/404/")), false);
    assert.ok(atRoot(at("", "/blog/")));
  });

  /* An excluded route under one base is not excluded under another. */
  it("does not match the same path outside the deployment's base", () => {
    assert.ok(include(at("", "/404/")));
  });
});
