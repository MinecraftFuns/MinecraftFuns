import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { markdownToHtml } from "satteri";

import { DIRECTIVES, siteMarkup, siteRejections } from "./directives.ts";
import { SITE_LANG } from "./lang.ts";
import {
  directive,
  langOf,
  markupPlugin,
  registryOf,
  rejectionLog,
  resolve,
  type Payload,
} from "./markup.ts";
import { ok } from "../prelude/adt.ts";

const registry = registryOf(DIRECTIVES);
const cx = { lang: SITE_LANG } as const;
const payload = (label: string): Payload => ({ label, attributes: {} });

/** Extract a rendered content node or fail the assertion. */
const content = (result: ReturnType<typeof resolve>) => {
  assert.equal(result.tag, "ok");
  assert.equal(result.value.tag, "content");
  return result.value.tag === "content" ? result.value.node : undefined;
};

describe("resolve: the three cases", () => {
  it("renders a registered name with a well-formed payload", () => {
    const node = content(
      resolve(registry, "text", "backup", payload("https://archive.is/jca7Z"), cx),
    );
    assert.deepEqual(node, {
      type: "link",
      url: "https://archive.is/jca7Z",
      children: [{ type: "text", value: "backup" }],
      data: { hProperties: { className: ["link-muted", "backup"] } },
    });
  });

  it("returns an unpaired unknown name as its own text, so prose survives", () => {
    // Preserve the `30` in `10:30` when Sätteri parses it as a directive.
    assert.deepEqual(resolve(registry, "text", "30", undefined, cx), {
      tag: "ok",
      value: { tag: "literal", text: ":30" },
    });
    assert.deepEqual(resolve(registry, "text", "this", undefined, cx), {
      tag: "ok",
      value: { tag: "literal", text: ":this" },
    });
  });

  it("rejects an unknown name that was paired: that is a typo, not prose", () => {
    const result = resolve(
      registry,
      "text",
      "bakcup",
      payload("https://archive.is/x"),
      cx,
    );
    assert.equal(result.tag, "invalid");
    assert.match(result.tag === "invalid" ? result.reasons[0] : "", /unknown directive/);
  });
});

describe("resolve: totality", () => {
  it("rejects a registered name written at the wrong arity", () => {
    const result = resolve(
      registry,
      "leaf",
      "backup",
      payload("https://archive.is/x"),
      cx,
    );
    assert.equal(result.tag, "invalid");
    assert.match(result.tag === "invalid" ? result.reasons[0] : "", /text directive/);
  });

  it("rejects a registered name with no payload, naming what it wanted", () => {
    // Distinct from the prose case above: the name *is* ours, so silence
    // would be a broken tag rather than a colon in a sentence.
    const result = resolve(registry, "text", "backup", undefined, cx);
    assert.equal(result.tag, "invalid");
    assert.match(
      result.tag === "invalid" ? result.reasons[0] : "",
      /needs the archived URL/,
    );
  });

  it("rejects an unpaired unknown name at leaf arity: '::' is never prose", () => {
    assert.equal(resolve(registry, "leaf", "whatever", undefined, cx).tag, "invalid");
  });

  it("is total: no combination throws", () => {
    for (const arity of ["text", "leaf"] as const) {
      for (const name of ["", "backup", "30", "a-b", "中文"]) {
        for (const load of [undefined, payload(""), payload("x")]) {
          assert.doesNotThrow(() => resolve(registry, arity, name, load, cx));
        }
      }
    }
  });
});

describe("backup payloads", () => {
  const reject = (label: string) => {
    const result = resolve(registry, "text", "backup", payload(label), cx);
    assert.equal(
      result.tag,
      "invalid",
      `expected ${JSON.stringify(label)} to be rejected`,
    );
  };

  it("accepts an https URL, trimming what the author left around it", () => {
    const node = content(
      resolve(registry, "text", "backup", payload("  https://archive.is/x  "), cx),
    );
    assert.equal(
      node !== undefined && "url" in node ? node.url : "",
      "https://archive.is/x",
    );
  });

  it("refuses anything that is not an absolute https URL", () => {
    [
      "",
      "   ",
      "archive.is/x",
      "/local/path",
      "http://archive.is/x",
      "javascript:alert(1)",
    ].forEach(reject);
  });
});

describe("registryOf", () => {
  it("refuses two claims on one name rather than picking the last", () => {
    const twice = [0, 1].map(() =>
      directive<string>({
        name: "same",
        arity: "text",
        parse: ({ label }) => ok(label),
        render: (value) => ({ type: "text", value }),
      }),
    );
    assert.throws(() => registryOf(twice), /declared twice/);
  });
});

describe("langOf", () => {
  it("reads the rendition's language from its own filename", () => {
    assert.equal(langOf(new URL("file:///c/blog/2021/03/slug/zh.md")), "zh");
    assert.equal(langOf(new URL("file:///c/blog/2021/03/slug/en.md")), "en");
  });

  it("falls back to the site language for anything that is not a rendition", () => {
    assert.equal(langOf(undefined), SITE_LANG);
    assert.equal(langOf(new URL("file:///c/README.md")), SITE_LANG);
    assert.equal(langOf(new URL("file:///c/blog/slug/zh-CN.md")), SITE_LANG);
  });
});

// ---------------------------------------------------------------------------
// Through the real Markdown pipeline
//
// The unit tests above prove the decision procedure; these prove the wiring,
// which is where every surprise in this module was found. Sätteri drops a
// directive nobody handles, so "the plugin did nothing" and "the plugin did
// the right thing" look identical in a page and differ only here.
// ---------------------------------------------------------------------------

/** Compile as the site does, and report anything the plugin rejected. */
const render = (source: string, file = "zh.md") => {
  siteRejections.assertClean(); // drain what an earlier case left, so failures attribute
  const { html } = markdownToHtml(source, {
    features: { directive: true },
    mdastPlugins: [siteMarkup],
    fileURL: new URL(`file:///content/blog/2021/03/slug/${file}`),
  });
  let rejected: string | undefined;
  try {
    siteRejections.assertClean();
  } catch (error) {
    rejected = error instanceof Error ? error.message : String(error);
  }
  return { html, rejected };
};

describe("the pipeline: prose survives the feature being on", () => {
  it("keeps a time, a port, and an unspaced colon exactly as written", () => {
    // Not hypothetical: `10:30` parses as a directive named `30`, and the
    // archive really does link `http://183.91.54.237:7080/...`, whose label
    // would otherwise ship pointing at a different host than it names.
    const { html, rejected } = render(
      "The train at 10:30. Note:this. See [http://a.b:7080/x](http://a.b:7080/x).",
    );
    assert.equal(rejected, undefined);
    assert.match(html, /The train at 10:30\. Note:this\./);
    assert.match(html, />http:\/\/a\.b:7080\/x</);
  });

  it("leaves emoji shortcodes alone", () => {
    const { html, rejected } = render("Shipped :tada: and :+1: today.");
    assert.equal(rejected, undefined);
    assert.match(html, /Shipped :tada: and :\+1: today\./);
  });
});

describe("the pipeline: directives render", () => {
  it("renders a backup in the rendition's own language", () => {
    assert.match(render(":backup[https://archive.is/x]", "zh.md").html, /备份<\/a>/u);
    assert.match(render(":backup[https://archive.is/x]", "en.md").html, /backup<\/a>/);
  });

  it("escapes what it is given, because the compiler writes the attribute", () => {
    const { html } = render(':backup[https://archive.is/"><script>alert(1)</script>]');
    assert.doesNotMatch(html, /<script>/);
  });
});

describe("the pipeline: a rejected directive is reported, not dropped", () => {
  it("reports a typo and leaves the source visible", () => {
    // Sätteri drops an unhandled directive, so the failure this guards
    // against is a paragraph that silently loses a word.
    const { html, rejected } = render(
      "A [x](https://e.com/) :bakcup[https://archive.is/x]",
    );
    assert.match(rejected ?? "", /unknown directive "bakcup"/);
    assert.match(rejected ?? "", /slug\/zh\.md:1/);
    assert.match(html, /:bakcup\[https:\/\/archive\.is\/x\]/);
  });

  it("reports a container rather than deleting the block and its contents", () => {
    const { rejected } = render(":::aside\nEverything inside.\n:::");
    assert.match(rejected ?? "", /container directive "aside"/);
  });

  it("reports a malformed payload", () => {
    assert.match(render(":backup[not-a-url]").rejected ?? "", /is not a URL/);
  });
});

describe("the rejection log", () => {
  /* The reason the log is a value: one plugin's refusals are not another's. */
  it("keeps two logs independent", () => {
    const mine = rejectionLog();
    markdownToHtml(":backup[nope]", {
      features: { directive: true },
      mdastPlugins: [markupPlugin(registry, mine)],
    });
    assert.doesNotThrow(() => siteRejections.assertClean());
    assert.throws(() => mine.assertClean(), /is not a URL/);
  });

  it("says nothing when every directive resolved", () => {
    render(":backup[https://archive.is/x]");
    assert.doesNotThrow(() => siteRejections.assertClean());
  });

  it("drains, so a rebuild does not re-report what was already raised", () => {
    // Compiled directly rather than through `render`, which drains for us.
    siteRejections.assertClean();
    markdownToHtml(":backup[nope]", {
      features: { directive: true },
      mdastPlugins: [siteMarkup],
    });
    assert.throws(() => siteRejections.assertClean(), /is not a URL/);
    assert.doesNotThrow(() => siteRejections.assertClean());
  });
});
