import type { ListIntro } from "./listings.ts";
import { paginate, type Listing } from "./paging.ts";
import { countedNoun } from "./plural.ts";
import { PAGE_SIZE, tagBase, type PostSummary, type PostTag } from "./posts.ts";
import type { Taxon } from "./taxonomy.ts";
import type { RootedPath } from "../schema.ts";

/**
 * One tag's listing, and the copy its pages share.
 *
 * A tag's first page and its later pages are separate route files for the
 * same reason the blog's are, so what they have in common is written here
 * rather than in both.
 *
 * Today every tag fits on a page: the largest holds ten posts against a page
 * size of twelve, so no `/page/2/` is generated at all. Paginating them
 * anyway is what keeps there from being a second, unpaginated code path to
 * retrofit the first time a tag outgrows a page.
 */
export type TagListing = {
  readonly tag: PostTag;
  readonly base: RootedPath;
  readonly pages: Listing<PostSummary>;
  readonly intro: ListIntro;
  readonly title: string;
  readonly description: string;
};

export const tagListing = (taxon: Taxon<PostTag, PostSummary>): TagListing => {
  const count = countedNoun(taxon.items.length, "post");

  return {
    tag: taxon.label,
    base: tagBase(taxon.label),
    pages: paginate(taxon.items, PAGE_SIZE),
    intro: {
      eyebrow: "Tag",
      heading: taxon.label,
      lede: `${count} tagged ${taxon.label}, newest first.`,
      label: `Posts tagged ${taxon.label}`,
      empty: "No posts published yet.",
    },
    title: `Posts tagged ${taxon.label}`,
    description: `Writing tagged ${taxon.label}, newest first.`,
  };
};
