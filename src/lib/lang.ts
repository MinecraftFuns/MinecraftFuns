import { languages } from "../config/languages.ts";
import {
  demand,
  invalid,
  mapNonEmpty,
  ok,
  okUnless,
  orThrow,
  type NonEmpty,
  type Parsed,
} from "../prelude/adt.ts";
import { clashesBy } from "../prelude/distinct.ts";
import type { ReadingTimeWording } from "../schema.ts";
import { parseSlug } from "./slug.ts";

/**
 * The language vocabulary, derived from `config/languages.ts` and nothing
 * else: the config records the preference order, and every policy object
 * here, the union, the parser, the archive pattern, the lookup tables, is a
 * projection of it. There is no second declaration to drift.
 *
 * A leaf, like `labels.ts`: `content.config.ts` and `archive.ts` both need
 * this vocabulary without reaching through the modules that consume it.
 */

/**
 * The union of configured codes, derived so it is closed: every consumer is
 * a policy decision (which rendition a bare URL serves, which routes exist,
 * what `<html lang>` says), and an open string would make each of those a
 * partial function.
 */
export type Lang = (typeof languages)[number]["code"];

/**
 * A row as *written*, literals intact. Not `LanguageConfig`, which is the shape
 * a row must satisfy and types `code` as `Lowercase<string>`. That width is
 * right for a schema and fatal here: `Lang` is derived from the values, so
 * reading the rows back through the schema would hand every consumer an open
 * string.
 */
type ConfiguredLanguage = (typeof languages)[number];

/**
 * The same rows, said to be a list of one type rather than a pair of two.
 *
 * `as const` is what closes `Lang`, and it gives every row its own literal
 * types as a side effect, so the config's type is a tuple of distinct rows.
 * Assigning it to a list of their union is the annotation `mapNonEmpty`
 * cannot infer: inference reads a non-empty list's element from the head, and
 * would take the first row's literals as the type of all of them.
 */
const rows: NonEmpty<ConfiguredLanguage> = languages;

const checked: Parsed<NonEmpty<Lang>> = okUnless(
  [
    /* A code is a filename, a URL segment, and an alternation branch in
       `archive.ts`'s pattern, which is to say a slug: `parseSlug` holds that
       grammar, and asking it is what keeps a second copy from drifting.
       `Lowercase` in the schema already refuses casing at compile time. */
    ...languages
      .filter(({ code }) => parseSlug(code).tag === "invalid")
      .map(({ code }) => `${JSON.stringify(code)} is not a kebab-case language code`),
    ...clashesBy(languages, ({ code }) => code).map(
      ([, later]) => `${JSON.stringify(later.code)} is declared twice`,
    ),
  ],
  mapNonEmpty(rows, ({ code }) => code),
);

/**
 * The configured codes, most preferred first. Eliminated with `orThrow`
 * because a malformed language config is a defect: the build fails at import
 * rather than minting routes from it.
 *
 * Non-empty because the config is, and carrying that through is what makes
 * the head below a read rather than a second trip to `languages`.
 */
export const LANGS: NonEmpty<Lang> = orThrow(checked, "src/config/languages.ts");

/**
 * The head of the preference order: the language the chrome is written in.
 *
 * Derived, not declared, and it carries one special property downstream: it
 * is the only language never served at a suffixed URL, because no article
 * containing it can ever have it displaced from the bare one. Every other
 * language keeps a suffixed address precisely because a better-preferred
 * rendition arriving later would displace it.
 */
export const SITE_LANG: Lang = LANGS[0];

/** Alternation source for `archive.ts`'s id pattern, derived, never restated. */
export const LANG_SOURCE: string = LANGS.join("|");

/** Total: every string maps to a variant, none throws. */
export const parseLang = (raw: string): Parsed<Lang> => {
  const found = LANGS.find((lang) => lang === raw);
  return found === undefined
    ? invalid(
        `expected one of ${LANGS.join(", ")}, got ${JSON.stringify(raw)}; a rendition file is named for its language`,
      )
    : ok(found);
};

/* Index lookups once at module load for O(1) access. */
const indexed = <T>(field: (language: ConfiguredLanguage) => T) =>
  new Map<Lang, T>(languages.map((language) => [language.code, field(language)]));

const bcp47 = indexed(({ bcp47: tag }) => tag);
const nativeName = indexed(({ nativeName: name }) => name);
const dateLocale = indexed(({ dateLocale: locale }) => locale);
const readingTime = indexed(({ readingTime: wording }) => wording);
/* One formatter per language, built at module load rather than per row. */
const countFormat = indexed(({ bcp47: tag }) => new Intl.NumberFormat(tag));
const preference = new Map<Lang, number>(
  languages.map(({ code }, index) => [code, index]),
);

/** Unreachable: `Lang` is derived from the very rows these maps index. */
const found = <T>(map: ReadonlyMap<Lang, T>, lang: Lang): T =>
  demand(map, lang, "src/config/languages.ts");

/**
 * The BCP 47 tag a rendition declares to the platform: `<html lang>` and
 * `hreflang` both read this. Distinct from the code, which names a file and
 * a URL segment: the content in `zh.md` is Simplified Chinese, and
 * "zh-Hans" says so where a bare "zh" would leave the script for the
 * reader's browser to guess.
 */
export const bcp47Of = (lang: Lang): string => found(bcp47, lang);

/**
 * How a language names itself, for the reader deciding whether to switch:
 * a reader of Chinese scans for 中文, not for "Chinese".
 */
export const nativeNameOf = (lang: Lang): string => found(nativeName, lang);

/**
 * The locale dates are formatted under on a page in `lang`. A property of
 * the language, not of the site: a Chinese article dates itself in Chinese.
 */
export const dateLocaleOf = (lang: Lang): string => found(dateLocale, lang);

export type ReadingTimeForm = keyof ReadingTimeWording;

/** Takes the language of the surrounding text, exactly like `dateLocaleOf`. */
export const readingTimeIn = (
  lang: Lang,
  minutes: number,
  form: ReadingTimeForm,
): string => {
  const { before, after } = found(readingTime, lang)[form];
  return `${before}${found(countFormat, lang).format(minutes)}${after}`;
};

/** Position in the preference order, for sorting renditions by it. */
export const preferenceOf = (lang: Lang): number => found(preference, lang);

/** Preference order as a comparator: what `assemble` sorts renditions by. */
export const byPreference = (a: Lang, b: Lang): number =>
  preferenceOf(a) - preferenceOf(b);

/**
 * Who produced a translation. Part of this module because it is frontmatter
 * vocabulary: `content.config.ts` decodes the `translation` field against
 * it. The distinction is honesty rather than metadata: a machine
 * translation is disclosed to the reader as one.
 */
export const TRANSLATORS = ["machine", "human"] as const;

export type Translator = (typeof TRANSLATORS)[number];
