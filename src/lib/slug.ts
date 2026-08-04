import { invalid, ok, type Parsed } from "../prelude/adt.ts";

/**
 * What a slug looks like, in one place: lowercase words joined by single
 * hyphens. Exported as a source string so `archive.ts` can build the composite
 * `YYYY/MM/slug` pattern from it rather than restating the last third.
 */
export const SLUG_SOURCE = "[a-z0-9]+(?:-[a-z0-9]+)*";

const SLUG = new RegExp(`^${SLUG_SOURCE}$`);

/**
 * Total. Rejecting anything with a separator is what keeps a flat collection
 * flat: a file nested a folder deep arrives here with a slash and fails.
 */
export const parseSlug = (raw: string): Parsed<string> =>
  SLUG.test(raw)
    ? ok(raw)
    : invalid(`expected a kebab-case slug, got ${JSON.stringify(raw)}`);

/**
 * The URL segment for a human-readable label. Lossy on purpose, and therefore
 * not a parser: "Cloudflare WARP" and "Cloudflare  --  WARP" both become
 * `cloudflare-warp`. Being many-to-one, it leaves the caller to decide what
 * happens when two labels meet; `lib/taxonomy.ts` fails the build, since the
 * alternative is two pages at one URL.
 *
 * Decomposing first keeps the loss from swallowing letters: "über" splits into
 * "u" plus a combining diaeresis, the mark is dropped, and the word survives as
 * "uber" rather than "ber".
 *
 * `toLowerCase` here is the Unicode-aware one, unlike in `lib/wkd.ts` where the
 * specification demands ASCII-only mapping; this output is a URL nobody hashes.
 */
export const slugify = (label: string): string =>
  label
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
