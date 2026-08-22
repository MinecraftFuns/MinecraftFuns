import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { required, undefinedIn } from "./check-vocabulary.ts";

describe("check-vocabulary", () => {
  it("derives one variant per declared tone", () => {
    assert.deepEqual(
      required().map(({ selector }) => selector),
      [".control-primary", ".control-secondary", ".control-quiet"],
    );
  });

  it("accepts a rule defined on its own", () => {
    assert.deepEqual(
      undefinedIn(".control-primary { color: red }", required().slice(0, 1)),
      [],
    );
  });

  it("accepts a rule defined in a selector list, where the gesture lives", () => {
    const css = ".control-primary,\n.control-secondary {\n  border: 1px solid red;\n}";
    assert.deepEqual(undefinedIn(css, required().slice(0, 2)), []);
  });

  /* The failure this gate exists for: markup still emits it, nothing defines it. */
  it("reports a variant the stylesheet lost", () => {
    const lost = undefinedIn(".control-primary { color: red }", required());
    assert.deepEqual(
      lost.map(({ selector }) => selector),
      [".control-secondary", ".control-quiet"],
    );
  });

  it("does not accept a longer name as the variant", () => {
    assert.deepEqual(
      undefinedIn(".control-primary-alt { color: red }", required().slice(0, 1)).length,
      1,
    );
  });
});
