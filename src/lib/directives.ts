import { invalid, ok } from "../prelude/adt.ts";
import { directive, markupPlugin, registryOf, type Directive } from "./markup.ts";
import type { Lang } from "./lang.ts";

/** Site directive vocabulary; grammar and collision checks live in `markup.ts`. */

/** Render the archived-link marker as an ordinary accessible link. */
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
