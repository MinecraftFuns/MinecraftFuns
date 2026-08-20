import { invalid, ok } from "../prelude/adt.ts";
import { directive, markupPlugin, registryOf, type Directive } from "./markup.ts";
import type { Lang } from "./lang.ts";

/**
 * The tags this site defines, and the only place a new one is declared.
 *
 * `markup.ts` owns the grammar and the collision rule; this file owns the
 * vocabulary. Adding a tag is one `directive({ name, arity, parse, render })`
 * and one entry in `DIRECTIVES` below, and the closed registry then does the
 * rest: the name becomes writable, every other `:word` in the archive keeps
 * being prose, and a typo of the new name fails the build.
 */

/**
 * The archived copy of the link just before it.
 *
 *     [Peter Lowe's blocklist](https://pgl.yoyo.org/adservers/) :backup[https://archive.is/jca7Z]
 *
 * The archive it replaces spelled this with Unicode modifier letters,
 * `[<U+1D2E><U+1D43>...](url)`, which draws a raised word by *spelling* it in
 * raised characters. That is invisible styling: a screen reader announces the
 * letters one by one or not at all, the size cannot follow the type scale,
 * and no stylesheet can reach it. Here the marker is an ordinary link and the
 * raising is the theme's job.
 */
const backup = directive<string>({
  name: "backup",
  arity: "text",

  /* A payload is one absolute https URL and nothing else. Parsed with `URL`
     rather than a pattern: a regexp that accepts every URL and no near-miss
     is longer than this and harder to be sure of. */
  parse: ({ label }) => {
    const raw = label.trim();
    if (raw === "") {
      return invalid(
        "a backup needs the archived URL: write :backup[https://archive.is/...]",
      );
    }

    const url = URL.parse(raw);
    if (url === null) return invalid(`${JSON.stringify(raw)} is not a URL`);
    if (url.protocol !== "https:") {
      return invalid(`${JSON.stringify(raw)} is not https; an archive link must be`);
    }
    return ok(url.href);
  },

  /* An `a` with a class, built as mdast rather than as a string of HTML: the
     compiler escapes the URL, so this renderer has no escaping to get wrong.
     Appearance stays with `.link-muted`, which owns every quiet link on the
     site; `.backup` adds only the raising. */
  render: (href, { lang }) => ({
    type: "link",
    url: href,
    children: [{ type: "text", value: LABEL[lang] }],
    data: { hProperties: { className: ["link-muted", "backup"] } },
  }),
});

/**
 * What the marker reads, in the language of the rendition it sits in. Keyed
 * by `Lang`, so a language added to `config/languages.ts` fails to compile
 * here until it has a word: a Chinese article saying "backup" in English is
 * the kind of small wrongness nothing else would catch.
 */
const LABEL: Readonly<Record<Lang, string>> = {
  en: "backup",
  zh: "存档",
};

/** Every directive the archive may use. */
export const DIRECTIVES: readonly Directive[] = [backup];

/** The wired plugin, which is what `astro.config.ts` installs. */
export const siteMarkup = markupPlugin(registryOf(DIRECTIVES));
