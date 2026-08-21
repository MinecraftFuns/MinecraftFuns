import { invalid, ok, type Parsed } from "../prelude/adt.ts";
import { parseSlug, slugify } from "./slug.ts";

/** Labels used for collection browsing and their branded URL property. */

declare const sluggableBrand: unique symbol;

/** Label proven to produce a non-empty URL segment. */
export type Sluggable = string & { readonly [sluggableBrand]: true };

/** Establish the URL-segment proof at the parsing boundary. */
const parseSluggable = <L extends Sluggable>(raw: string): Parsed<L> =>
  /* Report authored label, not its empty slug. */
  parseSlug(slugify(raw)).tag === "ok"
    ? ok(raw as L)
    : invalid(`${JSON.stringify(raw)} has no usable URL segment`);

declare const postTagBrand: unique symbol;

/** Blog label, nominally distinct from `DocCategory`. */
export type PostTag = Sluggable & { readonly [postTagBrand]: true };

declare const docCategoryBrand: unique symbol;

/** Documentation subject, distinct from post tags. */
export type DocCategory = Sluggable & { readonly [docCategoryBrand]: true };

export const parsePostTag = (raw: string): Parsed<PostTag> => parseSluggable(raw);

export const parseDocCategory = (raw: string): Parsed<DocCategory> => parseSluggable(raw);
