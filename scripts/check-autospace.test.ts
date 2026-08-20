import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { sites } from "./check-autospace.ts";

/** A document with front matter, since every real rendition has one. */
const doc = (...body: readonly string[]): string =>
  ["---", 'title: "中文 Title"', "---", "", ...body].join("\n");

const columns = (...body: readonly string[]): readonly number[] =>
  sites("x.md", doc(...body)).map((site) => site.column);

describe("check-autospace", () => {
  it("finds the boundary in both directions", () => {
    assert.deepEqual(columns("用 Rust 写的"), [2, 7]);
  });

  it("reports the column of the space itself, one-based", () => {
    const [only] = sites("x.md", doc("语言 Rust"));
    assert.equal(only?.column, 3);
    assert.equal(only?.line, 5);
  });

  it("leaves front matter alone, where no stylesheet can restore the gap", () => {
    assert.deepEqual(columns("纯中文。"), []);
  });

  it("leaves fenced code alone, and resumes after the fence closes", () => {
    assert.deepEqual(columns("```rust", "let 变量 = 1;", "```", "然后 x"), [3]);
  });

  it("does not let a shorter run close a longer fence", () => {
    assert.deepEqual(columns("````", "```", "let 变量 = 1;", "````", "然后 x"), [3]);
  });

  it("masks inline code, link destinations, and bare URLs", () => {
    assert.deepEqual(columns("看 `foo bar` 与 [链接](https://a.example/中文 x)"), []);
  });

  it("still reads link text, which is prose", () => {
    assert.deepEqual(columns("[中文 Title](https://a.example/)"), [4]);
  });

  it("masks a directive payload", () => {
    assert.deepEqual(columns(":backup[https://a.example/中文 x]"), []);
  });

  it("ignores CJK punctuation, which the engine never autospaces", () => {
    assert.deepEqual(columns("结束。 Then it continues"), []);
  });

  it("finds digits, the archive's most common boundary", () => {
    assert.deepEqual(columns("1898 年 1 月"), [5, 7, 9]);
  });

  it("ignores a boundary that is already tight", () => {
    assert.deepEqual(columns("用Rust写的"), []);
  });

  it("spares a token the engine can only half space", () => {
    /* `)` faces 处, and no engine spaces punctuation against an ideograph. */
    assert.deepEqual(columns("差分 O(n) 处理"), []);
    assert.deepEqual(columns("在 C# 里"), []);
  });

  it("spares both ends of such a token, not merely the punctuated one", () => {
    /* Only the bare `a` is reported; `parity(a)` keeps the spaces around it. */
    assert.deepEqual(columns("把 parity(a) 附到 a 的最后"), [15, 17]);
  });

  it("still takes a token whose punctuation is interior", () => {
    assert.deepEqual(columns("用 Node.js 运行"), [2, 10]);
  });

  it("reads the far end of the token, not the far end of the line", () => {
    /* `RFC 7231` faces 见 with a letter and a full stop with a digit. */
    assert.deepEqual(columns("见 RFC 7231。"), [2]);
  });
});
