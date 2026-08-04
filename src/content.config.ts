import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
/* `astro/zod` is the surviving path. The `z` re-exported from `astro:content`
   and from `astro:schema` are both deprecated for removal in Astro 7. */
import { z } from "astro/zod";

import { explain, type Parsed } from "./lib/adt.ts";
import { parseDocCategory, parsePostTag } from "./lib/labels.ts";
import { isoDate, parseIsoDate } from "./lib/time.ts";

/**
 * Refine proves, transform casts. Splitting them is what puts the offending
 * *file* on the message: Zod attaches it, where a throw from inside a smart
 * constructor has no idea which file it was reading.
 */
const decoded = <T extends string>(parse: (raw: string) => Parsed<T>) =>
  z
    .string()
    .min(1)
    .superRefine((raw, ctx) => {
      const parsed = parse(raw);
      if (parsed.tag === "invalid")
        ctx.addIssue({ code: "custom", message: explain(parsed) });
    })
    .transform((raw) => raw as T);

/**
 * Content collections.
 *
 * Frontmatter is the one genuinely untrusted input in this project: it is
 * hand-written, unchecked by the typechecker, and read at build time. The
 * schema is therefore a decoder, not a formality: a malformed date fails the
 * build rather than rendering as "Invalid Date" on the live site.
 *
 * `date` is parsed into `IsoDate` here, at the boundary, so every consumer
 * downstream receives a value already known to name a real calendar day in the
 * project's zone. Nothing past this point re-checks it.
 *
 * Posts are filed at `YYYY/MM/slug.md`, which restates the first two
 * components of that date. The schema cannot see the file path, so the two are
 * reconciled a step later in `lib/archive.ts`; see the note there on why the
 * glob stays permissive and rejects loudly instead of matching narrowly and
 * dropping a misfiled post in silence.
 */
const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.md" }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    /** Drafts are written but never built. Default keeps frontmatter terse. */
    draft: z.boolean().default(false),
    /*
     * The blog's own taxonomy, decoded rather than merely typed. A tag becomes
     * a `PostTag`, which is `Sluggable`, so `taxonomy` needs no per-label check
     * and the failure names the post rather than the collection.
     */
    tags: z.array(decoded(parsePostTag)).default([]),
    /*
     * Refine proves validity, transform performs the cast. Splitting them means
     * the failure is reported by Zod with the offending file attached, rather
     * than thrown from inside the smart constructor with no such context.
     */
    date: z
      /*
       * String-only, deliberately. YAML coerces an unquoted 2026-08-01 into a
       * timestamp object, the very confusion this project spent a bug fixing,
       * arriving through the back door of the frontmatter parser. Rejecting it
       * here keeps a calendar date a calendar date, and the message says how.
       */
      .custom<string>((value) => typeof value === "string", {
        message:
          'must be quoted, e.g. date: "2026-08-01"; an unquoted YAML date becomes a timestamp with a time zone attached',
      })
      /* `superRefine` rather than `refine`, so the reason the parser already
         computed survives instead of being replaced by a generic message. */
      .superRefine((raw, ctx) => {
        const parsed = parseIsoDate(raw);
        if (parsed.tag === "invalid") {
          ctx.addIssue({ code: "custom", message: explain(parsed) });
        }
      })
      .transform((raw) => isoDate(raw)),
  }),
});

/**
 * Reference pages, read when something breaks rather than when it is written.
 *
 * A separate domain, not a second flavour of post. The fields it shares with
 * the blog are written out again on purpose: the two collections agree today
 * by coincidence rather than by contract, and factoring the overlap into one
 * shape would mean every later change to how a post is described arrives in
 * the docs whether it suits them or not.
 *
 * Deliberately dateless. A post is an event and its date is part of what it
 * means; a troubleshooting guide is a claim about how something works now, and
 * stamping it invites a reader to discount it for being old rather than for
 * being wrong. Nothing here is chronological, so the ordering is by title.
 *
 * One `category`, not a list of tags. A doc belongs to a subject; tagging is
 * an affordance for browsing a stream, and a reference section is not one. The
 * value is read as `DocCategory`, which shares no type with a post's tag even
 * when the two spell the same word, so nothing can quietly pool them.
 *
 * The glob stays permissive for the reason the blog's does: `*.md` would match
 * only the flat layout and quietly ignore a file somebody nested, where
 * `**\/*.md` picks it up and `lib/docs.ts` refuses it by name.
 */
const docs = defineCollection({
  loader: glob({ base: "./src/content/docs", pattern: "**/*.md" }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    draft: z.boolean().default(false),
    /* One category, decoded to `DocCategory`: nominally distinct from a post
       tag even where the two spell the same word. */
    category: decoded(parseDocCategory),
  }),
});

export const collections = { blog, docs };
