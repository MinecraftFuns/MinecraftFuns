import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { explain, orThrow } from "../prelude/adt.ts";
import { parseRenditionId } from "./archive.ts";
import {
  alternatesOf,
  assemble,
  canonicalPathOf,
  originalOf,
  othersOf,
  primary,
  provenanceOf,
  renditionOf,
  type Provenance,
  type RenditionRecord,
} from "./article.ts";
import type { Lang } from "./lang.ts";
import { parsePostTag } from "./labels.ts";
import { isoDate, type IsoDate } from "./time.ts";

/**
 * Records are built through the real parsers, so these tests cannot assemble
 * a pair the production boundary would have refused to decode.
 */
const record = (
  id: string,
  date: string,
  options: {
    readonly tags?: readonly string[];
    readonly provenance?: Provenance;
  } = {},
): RenditionRecord<string> => {
  const { path, lang } = orThrow(parseRenditionId(id), id);
  return {
    path,
    lang,
    provenance: options.provenance ?? { tag: "original" },
    date: isoDate(date),
    tags: (options.tags ?? []).map((tag) => orThrow(parsePostTag(tag), tag)),
    entry: id,
  };
};

const translation = (by: "machine" | "human"): Provenance => ({
  tag: "translation",
  by,
});

const articles = (records: readonly RenditionRecord<string>[]) =>
  orThrow(assemble(records), "test");

describe("provenanceOf", () => {
  it("reads absence as the original", () => {
    assert.deepEqual(provenanceOf(undefined), { tag: "original" });
  });

  it("reads the field as who translated", () => {
    assert.deepEqual(provenanceOf("machine"), translation("machine"));
    assert.deepEqual(provenanceOf("human"), translation("human"));
  });
});

describe("assemble", () => {
  it("groups two renditions of one folder into one article", () => {
    const result = articles([
      record("2020/02/cf-1295/zh", "2020-02-03"),
      record("2020/02/cf-1295/en", "2020-02-03", {
        provenance: translation("machine"),
      }),
    ]);

    assert.equal(result.length, 1);
    assert.deepEqual(
      result[0]?.renditions.map((rendition) => rendition.lang),
      ["en", "zh"],
    );
  });

  it("keeps distinct folders distinct, ordered newest first", () => {
    const result = articles([
      record("2020/02/cf-1295/zh", "2020-02-03"),
      record("2025/04/taking-control-of-my-tailnet/en", "2025-04-28"),
    ]);

    assert.deepEqual(
      result.map((article) => article.path.slug),
      ["taking-control-of-my-tailnet", "cf-1295"],
    );
    assert.equal(primary(result[0]!).lang, "en");
    assert.equal(primary(result[1]!).lang, "zh");
  });

  it("rejects renditions disagreeing on the date, naming both files", () => {
    const result = assemble([
      record("2020/02/cf-1295/zh", "2020-02-03"),
      record("2020/02/cf-1295/en", "2020-02-04", {
        provenance: translation("machine"),
      }),
    ]);

    assert.equal(result.tag, "invalid");
    if (result.tag === "invalid") {
      assert.match(explain(result), /zh\.md says 2020-02-03/);
      assert.match(explain(result), /en\.md says 2020-02-04/);
      assert.match(explain(result), /src\/content\/blog\/2020\/02\/cf-1295/);
    }
  });

  it("rejects renditions disagreeing on the tags", () => {
    const result = assemble([
      record("2020/02/cf-1295/zh", "2020-02-03", { tags: ["Codeforces"] }),
      record("2020/02/cf-1295/en", "2020-02-03", {
        tags: ["Codeforces", "Editorial"],
        provenance: translation("machine"),
      }),
    ]);

    assert.equal(result.tag, "invalid");
    if (result.tag === "invalid") {
      assert.match(explain(result), /disagree on the tags/);
    }
  });

  it("tag agreement is agreement on the sequence, not the set", () => {
    const result = assemble([
      record("2020/02/cf-1295/zh", "2020-02-03", { tags: ["A", "B"] }),
      record("2020/02/cf-1295/en", "2020-02-03", {
        tags: ["B", "A"],
        provenance: translation("machine"),
      }),
    ]);

    assert.equal(result.tag, "invalid");
  });

  it("rejects an article that is translations all the way down", () => {
    const result = assemble([
      record("2020/02/cf-1295/zh", "2020-02-03", {
        provenance: translation("human"),
      }),
      record("2020/02/cf-1295/en", "2020-02-03", {
        provenance: translation("machine"),
      }),
    ]);

    assert.equal(result.tag, "invalid");
    if (result.tag === "invalid") {
      assert.match(explain(result), /original is missing/);
    }
  });

  it("rejects a lone rendition marked as a translation, for the same reason", () => {
    // The source text of this article exists nowhere; that is a mistake to
    // name, not a state to render.
    const result = assemble([
      record("2020/02/cf-1295/en", "2020-02-03", {
        provenance: translation("machine"),
      }),
    ]);

    assert.equal(result.tag, "invalid");
  });

  it("accepts an article authored independently in both languages", () => {
    const result = articles([
      record("2020/02/cf-1295/zh", "2020-02-03"),
      record("2020/02/cf-1295/en", "2020-02-03"),
    ]);

    assert.equal(result[0]?.renditions.length, 2);
  });

  it("accumulates failures across articles rather than stopping at one", () => {
    const result = assemble([
      record("2020/02/cf-1295/en", "2020-02-03", {
        provenance: translation("machine"),
      }),
      record("2020/11/cf297/zh", "2020-11-15"),
      record("2020/11/cf297/en", "2020-11-16", {
        provenance: translation("machine"),
      }),
    ]);

    assert.equal(result.tag, "invalid");
    if (result.tag === "invalid") {
      assert.equal(result.reasons.length, 2);
    }
  });

  it("assembles an empty collection into an empty archive", () => {
    assert.deepEqual(articles([]), []);
  });
});

describe("elimination", () => {
  const bilingual = articles([
    record("2020/02/cf-1295/zh", "2020-02-03"),
    record("2020/02/cf-1295/en", "2020-02-03", {
      provenance: translation("machine"),
    }),
  ])[0]!;

  const zhOnly = articles([record("2020/09/game-theory/zh", "2020-09-17")])[0]!;

  const enOnly = articles([
    record("2025/04/taking-control-of-my-tailnet/en", "2025-04-28"),
  ])[0]!;

  it("primary is the best-preferred rendition the article has", () => {
    assert.equal(primary(bilingual).lang, "en");
    assert.equal(primary(enOnly).lang, "en");
    assert.equal(primary(zhOnly).lang, "zh");
  });

  it("renditionOf answers for what exists and only that", () => {
    assert.equal(renditionOf(bilingual, "zh")?.lang, "zh");
    assert.equal(renditionOf(zhOnly, "en"), undefined);
    assert.equal(renditionOf(enOnly, "zh"), undefined);
  });

  it("othersOf is every rendition but the given language, in preference order", () => {
    assert.deepEqual(
      othersOf(bilingual, "en").map((rendition) => rendition.lang),
      ["zh"],
    );
    assert.deepEqual(
      othersOf(bilingual, "zh").map((rendition) => rendition.lang),
      ["en"],
    );
    assert.deepEqual(othersOf(zhOnly, "zh"), []);
  });

  it("originalOf finds the source a translation was made from", () => {
    assert.equal(originalOf(bilingual)?.lang, "zh");
    assert.equal(originalOf(zhOnly)?.lang, "zh");
  });

  it("gives the default language the bare URL, always", () => {
    assert.equal(canonicalPathOf(bilingual, "en"), "/blog/2020/02/cf-1295");
    assert.equal(
      canonicalPathOf(enOnly, "en"),
      "/blog/2025/04/taking-control-of-my-tailnet",
    );
  });

  it("gives a sole rendition the bare URL, whatever its language", () => {
    // A Chinese-only article lives at its slug: the language is metadata,
    // not identity.
    assert.equal(canonicalPathOf(zhOnly, "zh"), "/blog/2020/09/game-theory");
  });

  it("moves the non-default rendition to its suffix only when both exist", () => {
    assert.equal(canonicalPathOf(bilingual, "zh"), "/blog/2020/02/cf-1295/zh");
  });

  it("declares alternates for a bilingual article and none otherwise", () => {
    assert.deepEqual(alternatesOf(bilingual), [
      { hrefLang: "en", route: "/blog/2020/02/cf-1295" },
      { hrefLang: "zh-Hans", route: "/blog/2020/02/cf-1295/zh" },
      { hrefLang: "x-default", route: "/blog/2020/02/cf-1295" },
    ]);
    assert.deepEqual(alternatesOf(zhOnly), []);
    assert.deepEqual(alternatesOf(enOnly), []);
  });
});

/* Assertions keep the compile-time model checks live. */
describe("the model", () => {
  it("keeps language out of article identity", () => {
    const zh = record("2020/02/cf-1295/zh", "2020-02-03");
    const en = record("2020/02/cf-1295/en", "2020-02-03");
    assert.deepEqual(zh.path, en.path);
    assert.notEqual(zh.lang as Lang, en.lang as Lang);
  });

  it("carries the agreed date on the article", () => {
    const [article] = articles([record("2020/09/game-theory/zh", "2020-09-17")]);
    const date: IsoDate = article!.date;
    assert.equal(date, "2020-09-17");
  });
});
