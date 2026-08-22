import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { barrelImports } from "./check-imports.ts";

const lines = (source: string): readonly number[] =>
  barrelImports("x.ts", source).map(({ line }) => line);

describe("check-imports", () => {
  it("catches the barrel, which pulls in every icon", () => {
    assert.deepEqual(lines('import { ArrowRight } from "@lucide/astro";'), [1]);
  });

  it("catches a dynamic barrel import too", () => {
    assert.deepEqual(lines('const m = await import("@lucide/astro");'), [1]);
  });

  /* The whole point: a deep import of one icon is what we want. */
  it("leaves a per-icon import alone", () => {
    assert.deepEqual(
      lines('import ArrowRight from "@lucide/astro/icons/arrow-right";'),
      [],
    );
  });

  it("does not fire on a package that merely starts with the same name", () => {
    assert.deepEqual(lines('import x from "@lucide/astro-extra";'), []);
  });

  it("reports the line the import sits on", () => {
    assert.deepEqual(lines('const a = 1;\nimport y from "@lucide/astro";'), [2]);
  });
});
