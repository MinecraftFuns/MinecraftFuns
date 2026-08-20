import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { languages } from "../config/languages.ts";
import {
  bcp47Of,
  byPreference,
  dateLocaleOf,
  LANG_SOURCE,
  LANGS,
  nativeNameOf,
  parseLang,
  preferenceOf,
  SITE_LANG,
} from "./lang.ts";

describe("parseLang", () => {
  it("accepts every configured language", () => {
    LANGS.forEach((lang) => {
      assert.deepEqual(parseLang(lang), { tag: "ok", value: lang });
    });
  });

  it("rejects a country code posing as a language", () => {
    // "cn" names a country; the language is "zh".
    assert.equal(parseLang("cn").tag, "invalid");
  });

  it("rejects case and script variants: the filename form is exact", () => {
    for (const raw of ["EN", "En", "zh-Hans", "zh-CN"]) {
      assert.equal(parseLang(raw).tag, "invalid");
    }
  });

  it("is total: no input throws", () => {
    for (const raw of ["", " ", "english", "中文"]) {
      assert.doesNotThrow(() => parseLang(raw));
    }
  });
});

describe("the derived vocabulary", () => {
  it("is a projection of the config, row for row", () => {
    assert.deepEqual(
      LANGS,
      languages.map(({ code }) => code),
    );
    languages.forEach(({ code, bcp47, nativeName, dateLocale }) => {
      assert.equal(bcp47Of(code), bcp47);
      assert.equal(nativeNameOf(code), nativeName);
      assert.equal(dateLocaleOf(code), dateLocale);
    });
  });

  it("derives the pattern source from the config, so the two cannot drift", () => {
    assert.equal(LANG_SOURCE, LANGS.join("|"));
  });

  it("reads the site language off the head of the preference order", () => {
    assert.equal(SITE_LANG, LANGS[0]);
  });

  it("orders by position in the config and nothing else", () => {
    assert.equal(preferenceOf(SITE_LANG), 0);
    assert.ok(byPreference("en", "zh") < 0);
    assert.equal(byPreference("zh", "zh"), 0);
  });

  it("gives the Chinese rendition its script subtag", () => {
    // The content is Simplified Chinese; "zh-Hans" says so where "zh" would
    // leave the script to the reader's browser.
    assert.equal(bcp47Of("zh"), "zh-Hans");
  });
});
