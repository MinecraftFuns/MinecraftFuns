import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { markers } from "./check-directives.ts";

const found = (source: string): readonly string[] =>
  markers("x.md", source).map(({ href }) => href);

describe("check-directives", () => {
  it("catches the typeset marker the archive used to carry", () => {
    assert.deepEqual(
      found(
        "* [Title | host](https://a.example/) [$^\\mathrm{Backup}$](https://b.example/x)",
      ),
      ["https://b.example/x"],
    );
  });

  it("reports the line the marker sits on", () => {
    const [only] = markers("x.md", "prose\n[$^\\mathrm{Backup}$](https://b.example/)");
    assert.equal(only?.line, 2);
  });

  /* The rule must not fire on mathematics, which is never a whole link text. */
  it("leaves inline and display maths alone", () => {
    assert.deepEqual(
      found("The bound is $O(n \\log n)$, see [the proof](https://a.example/)."),
      [],
    );
    assert.deepEqual(found("$$\\mathrm{gcd}(a, b)$$"), []);
  });

  it("leaves the directive itself alone", () => {
    assert.deepEqual(
      found("[Title](https://a.example/) :backup[https://b.example/]"),
      [],
    );
  });

  it("is total: prose with no links yields nothing", () => {
    assert.deepEqual(found("纯中文，没有链接。"), []);
  });
});
