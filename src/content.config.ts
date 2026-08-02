import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

import { isoDate, parseIsoDate } from "./lib/time.ts";

/**
 * Content collections.
 *
 * Frontmatter is the one genuinely untrusted input in this project: it is
 * hand-written, unchecked by the typechecker, and read at build time. The
 * schema is therefore a decoder, not a formality — a malformed date fails the
 * build rather than rendering as "Invalid Date" on the live site.
 *
 * `date` is parsed into `IsoDate` here, at the boundary, so every consumer
 * downstream receives a value already known to name a real calendar day in the
 * project's zone. Nothing past this point re-checks it.
 */
const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.md" }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    /*
     * Refine proves validity, transform performs the cast. Splitting them means
     * the failure is reported by Zod with the offending file attached, rather
     * than thrown from inside the smart constructor with no such context.
     */
    date: z
      /*
       * String-only, deliberately. YAML coerces an unquoted 2026-08-01 into a
       * timestamp object — the very confusion this project spent a bug fixing,
       * arriving through the back door of the frontmatter parser. Rejecting it
       * here keeps a calendar date a calendar date, and the message says how.
       */
      .custom<string>((value) => typeof value === "string", {
        message:
          'must be quoted, e.g. date: "2026-08-01" — an unquoted YAML date becomes a timestamp with a time zone attached',
      })
      .refine((raw) => parseIsoDate(raw).tag === "ok", {
        message: "expected a real YYYY-MM-DD calendar date (America/Toronto)",
      })
      .transform((raw) => isoDate(raw)),
    /** Drafts are written but never built. Default keeps frontmatter terse. */
    draft: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { blog };
