import { languages } from "../config/languages.ts";
import { invalid, ok, okUnless, orThrow, type Parsed } from "../prelude/adt.ts";
import { clashesBy } from "../prelude/distinct.ts";

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
 * What a code must look like to be a filename, a URL segment, and an
 * alternation branch in `archive.ts`'s pattern: kebab-case, like a slug.
 * `Lowercase` in the schema already refuses casing at compile time; this is
 * the half a type cannot see, checked once at module load.
 */
const CODE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const checked: Parsed<readonly Lang[]> = okUnless(
  [
    ...languages
      .filter(({ code }) => !CODE.test(code))
      .map(({ code }) => `${JSON.stringify(code)} is not a kebab-case language code`),
    ...clashesBy(languages, ({ code }) => code).map(
      ([, later]) => `${JSON.stringify(later.code)} is declared twice`,
    ),
  ],
  languages.map(({ code }) => code),
);

/**
 * The configured codes, most preferred first. Eliminated with `orThrow`
 * because a malformed language config is a defect: the build fails at import
 * rather than minting routes from it.
 */
export const LANGS: readonly Lang[] = orThrow(checked, "src/config/languages.ts");

/**
 * The head of the preference order: the language the chrome is written in.
 *
 * Derived, not declared, and it carries one special property downstream: it
 * is the only language never served at a suffixed URL, because no article
 * containing it can ever have it displaced from the bare one. Every other
 * language keeps a suffixed address precisely because a better-preferred
 * rendition arriving later would displace it.
 */
export const SITE_LANG: Lang = languages[0].code;

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

/*
 * Lookups, indexed once at module load: O(1) per read against a `find` per
 * read, which over four languages is about taste, but these run for every
 * rendered row and link.
 */
const indexed = <T>(field: (language: (typeof languages)[number]) => T) =>
  new Map<Lang, T>(languages.map((language) => [language.code, field(language)]));

const bcp47 = indexed(({ bcp47: tag }) => tag);
const nativeName = indexed(({ nativeName: name }) => name);
const dateLocale = indexed(({ dateLocale: locale }) => locale);
const preference = new Map<Lang, number>(
  languages.map(({ code }, index) => [code, index]),
);

/**
 * Unreachable: `Lang` is derived from the very rows the maps index, so a
 * member of the union cannot miss. It throws rather than defaulting, as in
 * `time.ts`, because the only plausible default is another language's
 * value, precisely the silent wrong answer a lookup table exists to avoid.
 */
const found = <T>(map: ReadonlyMap<Lang, T>, lang: Lang): T => {
  const value = map.get(lang);
  if (value === undefined) {
    throw new TypeError(`no language config for ${JSON.stringify(lang)}`);
  }
  return value;
};

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
