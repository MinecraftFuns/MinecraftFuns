import { blogPage } from "../config/blog.ts";
import { site } from "../config/site.ts";
import { affixed } from "./identity.ts";

/**
 * The blog listing's read side. The copy itself is config data; this
 * module only re-exports it under the names the routes share, and fills the
 * description's one insertion point with the site name.
 */

export type { ListIntroConfig as ListIntro } from "../schema.ts";

/** The blog index, on every one of its pages. */
export const BLOG_INTRO = blogPage.intro;

/** Interpolated rather than written out, so the name has one source. */
export const BLOG_DESCRIPTION = affixed(blogPage.description, site.name);
