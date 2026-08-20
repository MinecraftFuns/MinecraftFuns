import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readingMinutes } from "./reading.ts";

const words = (count: number) => Array.from({ length: count }, () => "word").join(" ");

describe("readingMinutes", () => {
  it("never returns zero, however short the post", () => {
    // "0 min" reads as a broken template rather than as a short post.
    for (const markdown of ["", " ", "one", words(10)]) {
      assert.equal(readingMinutes(markdown), 1);
    }
  });

  it("scales with word count", () => {
    assert.equal(readingMinutes(words(200)), 1);
    assert.equal(readingMinutes(words(600)), 3);
  });

  it("ignores fenced code, which is not read at prose speed", () => {
    const withCode = `${words(200)}\n\n\`\`\`ts\n${words(4000)}\n\`\`\`\n`;
    assert.equal(readingMinutes(withCode), 1);
  });

  it("ignores inline code spans", () => {
    assert.equal(readingMinutes(`${words(200)} \`${words(2000)}\``), 1);
  });

  it("counts link text but not link targets", () => {
    // A verbose URL does not make a post longer to read.
    const bare = readingMinutes(words(400));
    const linked = readingMinutes(
      `${words(399)} [word](https://example.com/a/very/long/path/that/goes/on)`,
    );
    assert.equal(linked, bare);
  });

  it("does not count markdown markers as words", () => {
    const plain = readingMinutes(words(400));
    const marked = `# ${words(100)}\n\n- ${words(100)}\n\n> ${words(100)}\n\n**${words(100)}**`;
    assert.equal(readingMinutes(marked), plain);
  });

  it("is total: no input throws", () => {
    for (const markdown of ["```unclosed", "[](", "![]()", "***"]) {
      assert.doesNotThrow(() => readingMinutes(markdown));
    }
  });

  it("counts Han text by character, not by whitespace run", () => {
    // A Chinese paragraph has no spaces: as "words" this is one, and an
    // essay of it would read as a one-minute post.
    const han = (count: number) => "字".repeat(count);
    assert.equal(readingMinutes(han(300)), 1);
    assert.equal(readingMinutes(han(900)), 3);
  });

  it("reads mixed prose on both clocks at once", () => {
    // 100 English words and 150 Han characters: half a minute each.
    assert.equal(readingMinutes(`${words(100)} ${"字".repeat(150)}`), 1);
    assert.equal(readingMinutes(`${words(300)} ${"字".repeat(450)}`), 3);
  });

  it("does not let Chinese punctuation masquerade as words", () => {
    // With the Han characters lifted out, the 。remain; were each counted as
    // a word, 300 of them would add a minute and a half.
    assert.equal(readingMinutes("字。".repeat(300)), 1);
  });

  it("splits a run that mixes scripts between the two clocks", () => {
    // "用TypeScript写" is one whitespace run: one word plus two Han
    // characters. Read as words alone, 300 runs would be a 2-minute post;
    // the 600 Han characters make it four.
    const mixed = Array.from({ length: 300 }, () => "用TypeScript写").join(" ");
    assert.equal(readingMinutes(mixed), 4);
  });
});
