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
