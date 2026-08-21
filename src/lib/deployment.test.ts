import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deployments } from "../config/deployments.ts";
import { explain } from "../prelude/adt.ts";
import {
  activeTarget,
  canonicalHref,
  canonicalSitemapUrl,
  canonicalTarget,
  developmentTarget,
  findTarget,
  indexable,
  siteRelative,
  targets,
  type DeploymentRole,
} from "./deployment.ts";

/* Test derivation shape so renaming a deployment does not rewrite the suite. */

describe("targets", () => {
  it("lists the canonical deployment first, then every mirror", () => {
    assert.equal(targets.length, 1 + deployments.mirrors.length);
    assert.equal(targets[0]?.id, deployments.canonical.id);
  });

  it("marks exactly one target canonical", () => {
    const canonical = targets.filter((target) => target.role === "canonical");
    assert.equal(canonical.length, 1);
  });

  it("derives the role rather than reading it from config", () => {
    /* Roles are derived; config cannot declare a mirror canonical by hand. */
    assert.equal("role" in deployments.canonical, false);
    assert.equal(canonicalTarget.role, "canonical");
    targets
      .filter((target) => target.id !== canonicalTarget.id)
      .forEach((target) => assert.equal(target.role, "mirror"));
  });
});

describe("developmentTarget", () => {
  it("prefers a mirror, because a based deployment is the harder URL shape", () => {
    assert.equal(
      developmentTarget.id,
      deployments.mirrors[0]?.id ?? deployments.canonical.id,
    );
  });
});

describe("findTarget", () => {
  it("identifies a declared deployment", () => {
    const found = findTarget(canonicalTarget.origin, canonicalTarget.base);
    assert.equal(found.tag, "ok");
    assert.equal(found.tag === "ok" && found.value.id, canonicalTarget.id);
  });

  it("accepts a base written without its trailing slash", () => {
    const mirror = targets.find((target) => target.role === "mirror");
    if (mirror === undefined) return;

    const found = findTarget(mirror.origin, mirror.base.replace(/\/$/, ""));
    assert.equal(found.tag, "ok");
    assert.equal(found.tag === "ok" && found.value.id, mirror.id);
  });

  it("normalises host case and a default port through the URL parser", () => {
    const shouted = canonicalTarget.origin.toUpperCase().replace("HTTPS", "https");
    assert.equal(findTarget(shouted, canonicalTarget.base).tag, "ok");
  });

  it("rejects an origin no deployment declares, naming the ones that exist", () => {
    const found = findTarget("https://typo.example", "/");
    assert.equal(found.tag, "invalid");
    assert.ok(explain(found).includes(canonicalTarget.origin));
  });

  it("rejects a declared origin at the wrong base", () => {
    assert.equal(findTarget(canonicalTarget.origin, "/elsewhere/").tag, "invalid");
  });

  it("is total: no input throws", () => {
    for (const origin of ["", "not a url", "//", "https://x"]) {
      for (const base of ["", "/", "x"]) {
        assert.doesNotThrow(() => findTarget(origin, base));
      }
    }
  });
});

describe("activeTarget", () => {
  it("reports the absent site as a reason rather than throwing", () => {
    const found = activeTarget(undefined);
    assert.equal(found.tag, "invalid");
    assert.ok(explain(found).includes("astro.config"));
  });
});

describe("siteRelative", () => {
  it("is the identity at the root base", () => {
    const relative = siteRelative("/", "/blog/2026/");
    assert.equal(relative.tag === "ok" && relative.value, "/blog/2026/");
  });

  it("strips a base path", () => {
    const relative = siteRelative("/MinecraftFuns/", "/MinecraftFuns/blog/");
    assert.equal(relative.tag === "ok" && relative.value, "/blog/");
  });

  it("maps a deployment's own root to the site root", () => {
    const relative = siteRelative("/MinecraftFuns/", "/MinecraftFuns/");
    assert.equal(relative.tag === "ok" && relative.value, "/");
  });

  it("tolerates a base written without its trailing slash", () => {
    const relative = siteRelative("/MinecraftFuns", "/MinecraftFuns/blog/");
    assert.equal(relative.tag === "ok" && relative.value, "/blog/");
  });

  it("rejects a pathname outside its own base rather than truncating it", () => {
    assert.equal(siteRelative("/MinecraftFuns/", "/blog/").tag, "invalid");
  });

  it("does not treat a sibling with a shared prefix as being within", () => {
    /* A shared string prefix is not a shared deployment root. */
    assert.equal(
      siteRelative("/MinecraftFuns/", "/MinecraftFunsXL/blog/").tag,
      "invalid",
    );
  });

  it("is total: no input throws", () => {
    for (const base of ["", "/", "/a/"]) {
      for (const path of ["", "/", "/a", "//", "%"]) {
        assert.doesNotThrow(() => siteRelative(base, path));
      }
    }
  });
});

describe("canonicalHref", () => {
  it("points a canonical build at itself", () => {
    const href = canonicalHref(canonicalTarget, "/blog/");
    assert.equal(href.tag === "ok" && href.value, `${canonicalTarget.origin}/blog/`);
  });

  it("points a mirror at the canonical origin, not at itself", () => {
    const mirror = targets.find((target) => target.role === "mirror");
    if (mirror === undefined) return;

    const href = canonicalHref(mirror, `${mirror.base}blog/`);
    assert.equal(href.tag, "ok");
    /* The property that matters: the mirror's own origin and base appear
       nowhere in the URL it advertises as canonical. */
    assert.ok(href.tag === "ok" && href.value.startsWith(canonicalTarget.origin));
    assert.ok(href.tag === "ok" && !href.value.includes(mirror.base.slice(1, -1)));
  });

  it("agrees between targets: one page has one canonical URL", () => {
    const mirror = targets.find((target) => target.role === "mirror");
    if (mirror === undefined) return;

    const fromCanonical = canonicalHref(canonicalTarget, "/docs/declaration/");
    const fromMirror = canonicalHref(mirror, `${mirror.base}docs/declaration/`);

    assert.equal(fromCanonical.tag, "ok");
    assert.deepEqual(fromCanonical, fromMirror);
  });

  it("keeps the site root canonical to the canonical root", () => {
    const mirror = targets.find((target) => target.role === "mirror");
    if (mirror === undefined) return;

    const href = canonicalHref(mirror, mirror.base);
    assert.equal(href.tag === "ok" && href.value, `${canonicalTarget.origin}/`);
  });

  it("propagates the reason when the pathname is outside the base", () => {
    const mirror = targets.find((target) => target.role === "mirror");
    if (mirror === undefined) return;

    assert.equal(canonicalHref(mirror, "/elsewhere/").tag, "invalid");
  });
});

describe("canonicalSitemapUrl", () => {
  it("is an absolute URL on the canonical origin", () => {
    const url = canonicalSitemapUrl();
    assert.ok(url.startsWith(canonicalTarget.origin));
    assert.ok(url.endsWith("/sitemap-index.xml"));
  });
});

describe("indexable", () => {
  it("admits the canonical copy and refuses a mirror", () => {
    assert.equal(indexable("canonical"), true);
    assert.equal(indexable("mirror"), false);
  });

  it("is total over the role", () => {
    const roles: readonly DeploymentRole[] = ["canonical", "mirror"];
    roles.forEach((role) => assert.equal(typeof indexable(role), "boolean"));
  });
});
