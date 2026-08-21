import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
/* Use `astro/zod`; Astro 7 removes the other `z` re-exports. */
import { z } from "astro/zod";

import { explain, type Parsed } from "./prelude/adt.ts";
import { parseDocCategory, parsePostTag } from "./lib/labels.ts";
import { TRANSLATORS } from "./lib/lang.ts";
import { isoDate, parseIsoDate } from "./lib/time.ts";

/** Validate with Zod so errors retain the offending file. */
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

/** Decode frontmatter at the build boundary; archive paths are reconciled later. */
const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.md" }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    draft: z.boolean().default(false),
    /* Absent marks the original; articles reject all-translation groups. */
    translation: z.enum(TRANSLATORS).optional(),
    /* Decode tags as branded `PostTag` values before taxonomy grouping. */
    tags: z.array(decoded(parsePostTag)).default([]),
    /* Separate refinement preserves file-aware parser errors. */
    date: z
      /* Keep YAML dates as strings; coercion would attach a timezone. */
      .custom<string>((value) => typeof value === "string", {
        message:
          'must be quoted, e.g. date: "2026-08-01"; an unquoted YAML date becomes a timestamp with a time zone attached',
      })
      /* Preserve parser errors instead of replacing them with generic text. */
      .superRefine((raw, ctx) => {
        const parsed = parseIsoDate(raw);
        if (parsed.tag === "invalid") {
          ctx.addIssue({ code: "custom", message: explain(parsed) });
        }
      })
      .transform((raw) => isoDate(raw)),
  }),
});

/** Reference collection; dateless, single-category, ordered by title. */
const docs = defineCollection({
  loader: glob({ base: "./src/content/docs", pattern: "**/*.md" }),
  schema: z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    draft: z.boolean().default(false),
    /* `DocCategory` remains distinct from post tags. */
    category: decoded(parseDocCategory),
  }),
});

export const collections = { blog, docs };
