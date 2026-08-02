import { invalid, ok, type Parsed } from "./adt.ts";

/**
 * What a slug looks like, in one place.
 *
 * Lowercase words joined by single hyphens. Two collections need this shape
 * now, and a second copy of it is the kind of thing that agrees today and
 * diverges the first time one of them learns about underscores. The source is
 * exported so `archive.ts` can build the composite `YYYY/MM/slug` pattern from
 * it rather than restating the last third.
 */
export const SLUG_SOURCE = "[a-z0-9]+(?:-[a-z0-9]+)*";

const SLUG = new RegExp(`^${SLUG_SOURCE}$`);

/**
 * Total. Rejects the empty string, capitals, underscores, and anything with a
 * separator in it, which is what keeps a flat collection flat: a file nested a
 * folder deep arrives here with a slash and fails to parse.
 */
export const parseSlug = (raw: string): Parsed<string> =>
  SLUG.test(raw)
    ? ok(raw)
    : invalid(`expected a kebab-case slug, got ${JSON.stringify(raw)}`);

/**
 * The URL segment for a human-readable label.
 *
 * Lossy on purpose, and therefore not a parser: "Cloudflare WARP", "cloudflare
 * warp" and "Cloudflare  --  WARP" all become `cloudflare-warp`. That is what
 * a reader typing a URL expects, and it means the segment cannot be turned
 * back into the label. Because it is many-to-one, the caller has to decide
 * what happens when two labels meet: `lib/taxonomy.ts` treats it as a defect
 * and fails the build, since the alternative is two pages at one URL.
 *
 * Decomposing first is what keeps the loss from swallowing letters. "über"
 * splits into "u" plus a combining diaeresis, the mark is dropped, and the
 * word survives as "uber"; without this the `[^a-z0-9]` pass would delete the
 * whole character and leave "ber". Runs collapse to a single hyphen, so no
 * output ever carries two in a row, and leading and trailing ones are trimmed.
 *
 * `toLowerCase` is the Unicode-aware one, unlike in `lib/wkd.ts` where the
 * specification demands ASCII-only mapping. The difference is that this output
 * is a URL nobody hashes.
 */
export const slugify = (label: string): string =>
  label
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
