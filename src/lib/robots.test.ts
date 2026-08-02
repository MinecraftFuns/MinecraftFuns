import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { allowAll, disallowAll, renderRobots, type Robots } from "./robots.ts";

const lines = (robots: Robots): readonly string[] =>
  renderRobots(robots).split("\n");

describe("renderRobots", () => {
  it("emits a user-agent line per agent, then the group's rules", () => {
    const text = renderRobots({
      groups: [
        {
          userAgents: ["GoogleBot", "BingBot"],
          rules: [
            { kind: "disallow", path: "/private/" },
            { kind: "allow", path: "/private/public/" },
          ],
        },
      ],
      sitemaps: [],
    });

    assert.equal(
      text,
      [
        "User-agent: GoogleBot",
        "User-agent: BingBot",
        "Disallow: /private/",
        "Allow: /private/public/",
        "",
      ].join("\n"),
    );
  });

  it("separates groups with a blank line", () => {
    const text = renderRobots({
      groups: [
        { userAgents: ["a"], rules: [{ kind: "allow", path: "/" }] },
        { userAgents: ["b"], rules: [{ kind: "disallow", path: "/" }] },
      ],
      sitemaps: [],
    });
    assert.match(text, /Allow: \/\n\nUser-agent: b/);
  });

  it("puts sitemap records outside any group, where the RFC places them", () => {
    const text = renderRobots(allowAll(["https://joefang.org/sitemap-index.xml"]));
    const sitemapIndex = text.split("\n").indexOf(
      "Sitemap: https://joefang.org/sitemap-index.xml",
    );
    const lastRule = text.split("\n").findLastIndex((line) => line.startsWith("Allow:"));
    assert.ok(sitemapIndex > lastRule, "sitemap must follow the groups");
    assert.match(text, /\n\nSitemap:/);
  });

  it("ends with exactly one newline", () => {
    const text = renderRobots(allowAll([]));
    assert.ok(text.endsWith("\n"));
    assert.equal(text.endsWith("\n\n"), false);
  });

  it("omits the sitemap block entirely when there is none", () => {
    assert.equal(renderRobots(allowAll([])).includes("Sitemap"), false);
  });
});

describe("allowAll", () => {
  it("says Allow: / rather than the legacy's bare Disallow:", () => {
    // Both mean the same to a conformant parser. Only one of them says so,
    // and the other reads at a glance as the exact opposite of its meaning.
    const text = renderRobots(allowAll([]));
    assert.match(text, /^User-agent: \*\nAllow: \/\n$/);
    assert.equal(text.includes("Disallow:"), false);
  });

  it("advertises every sitemap it is given", () => {
    const text = renderRobots(allowAll(["https://a.test/s.xml", "https://b.test/s.xml"]));
    assert.match(text, /Sitemap: https:\/\/a\.test\/s\.xml/);
    assert.match(text, /Sitemap: https:\/\/b\.test\/s\.xml/);
  });
});

describe("disallowAll", () => {
  it("blocks everything", () => {
    assert.deepEqual(lines(disallowAll()), ["User-agent: *", "Disallow: /", ""]);
  });

  it("advertises no sitemap: a map of pages it must not fetch is a contradiction", () => {
    assert.equal(renderRobots(disallowAll()).includes("Sitemap"), false);
  });
});
