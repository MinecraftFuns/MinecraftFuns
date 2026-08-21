import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Project } from "../config/projects.ts";
import { badgeFor, isActive, spanOf, wellOrdered } from "./projects.ts";

const project = (overrides: Partial<Project> = {}): Project => ({
  title: "Example",
  description: "x",
  href: "https://example.test",
  since: 2024,
  until: null,
  tags: ["Rust"],
  kind: "side-project",
  ...overrides,
});

describe("spanOf", () => {
  it("shows one year when work began and ended in it", () => {
    assert.equal(spanOf(project({ since: 2026, until: 2026 }), 2030), "2026");
  });

  it("shows a range when work spanned years", () => {
    assert.equal(spanOf(project({ since: 2024, until: 2025 }), 2030), "2024–2025");
  });

  /* Live projects derive their end year at read time. */
  it("runs live work to the year it is read in", () => {
    const live = project({ since: 2024, until: null });
    assert.equal(spanOf(live, 2026), "2024–2026");
    assert.equal(spanOf(live, 2027), "2024–2027");
  });

  it("shows one year for live work begun this year", () => {
    assert.equal(spanOf(project({ since: 2026, until: null }), 2026), "2026");
  });
});

describe("badgeFor", () => {
  /* Liveness and the badge are one fact now, so they cannot disagree. */
  it("gives live work no badge", () => {
    assert.equal(badgeFor(project({ until: null })), null);
    assert.equal(isActive(project({ until: null })), true);
  });

  it("marks finished work archived", () => {
    assert.equal(badgeFor(project({ until: 2025 })), "Archived");
    assert.equal(isActive(project({ until: 2025 })), false);
  });
});

describe("wellOrdered", () => {
  /* Test the span invariant the type cannot express. */
  it("rejects a project that ends before it starts", () => {
    assert.equal(wellOrdered(project({ since: 2026, until: 2024 })).tag, "invalid");
  });

  it("accepts a project that starts and ends in one year", () => {
    assert.equal(wellOrdered(project({ since: 2026, until: 2026 })).tag, "ok");
  });

  it("accepts live work, which has no end to order", () => {
    assert.equal(wellOrdered(project({ until: null })).tag, "ok");
  });
});
