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
});
