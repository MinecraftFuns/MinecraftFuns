import { invalid, ok, type Parsed } from "../prelude/adt.ts";
import { parseSlug, slugify } from "./slug.ts";

/**
 * The labels a collection is browsed by, and the one property of a label a
 * type can be made to carry.
 *
 * A leaf, so `content.config.ts` can decode into these types without reaching
 * back through `astro:content` for them.
 */

declare const sluggableBrand: unique symbol;

/**
 * A label known to yield a non-empty URL segment. `slugify` is many-to-one and
 * lossy, so "!!!" maps to the empty string, and a taxon with no segment is a
 * page at no URL. `taxonomy` requires this, which is why it no longer checks.
 */
export type Sluggable = string & { readonly [sluggableBrand]: true };

/**
 * The one place the property is established, and the only assertion in this
 * file. The two constructors below are instantiations of it, so a label enters
 * the domain by exactly one route.
 */
const parseSluggable = <L extends Sluggable>(raw: string): Parsed<L> =>
  /* The reason names the label as written, not the empty segment it produced:
     the author has to find "!!!" in a file, not "". */
  parseSlug(slugify(raw)).tag === "ok"
    ? ok(raw as L)
    : invalid(`${JSON.stringify(raw)} has no usable URL segment`);

declare const postTagBrand: unique symbol;

/**
 * A label in the blog's taxonomy. Nominally distinct from `DocCategory`: both
 * are strings and may spell "networking", but the two index different
 * collections, and a function pooling them is a bug the checker can refuse
 * rather than a convention somebody must remember.
 */
export type PostTag = Sluggable & { readonly [postTagBrand]: true };

declare const docCategoryBrand: unique symbol;

/** The subject a doc belongs to. One per doc, and not a tag. */
export type DocCategory = Sluggable & { readonly [docCategoryBrand]: true };

export const parsePostTag = (raw: string): Parsed<PostTag> => parseSluggable(raw);

export const parseDocCategory = (raw: string): Parsed<DocCategory> => parseSluggable(raw);
