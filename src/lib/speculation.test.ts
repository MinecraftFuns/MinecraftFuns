import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hrefPattern, prefetchRules, serialise } from "./speculation.ts";

describe("speculation", () => {
  it("scopes the pattern to the deployment, not the origin", () => {
    assert.equal(hrefPattern("/"), "/*");
    assert.equal(hrefPattern("/MinecraftFuns/"), "/MinecraftFuns/*");
  });

  it("tolerates a base that forgot its trailing slash", () => {
    assert.equal(hrefPattern("/MinecraftFuns"), "/MinecraftFuns/*");
  });

  it("builds one document rule carrying the configured eagerness", () => {
    const [rule, ...rest] = prefetchRules("/", "moderate").prefetch;
    assert.equal(rest.length, 0);
    assert.deepEqual(rule, {
      source: "document",
      where: { href_matches: "/*" },
      eagerness: "moderate",
    });
  });

  it("cannot spell a closing script tag, whatever the base", () => {
    const hostile = serialise(prefetchRules("/</script><script>evil()//", "eager"));
    assert.equal(hostile.includes("<"), false);
    assert.deepEqual(
      JSON.parse(hostile),
      prefetchRules("/</script><script>evil()//", "eager"),
    );
  });
});
