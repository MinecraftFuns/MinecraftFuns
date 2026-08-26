import type { ListingPageConfig } from "../schema.ts";

/**
 * The docs listing's copy. The meta description is worded around the site
 * name, which stays declared once in `SiteConfig`; this file held the last
 * literal spelling of it.
 */
export const docsPage = {
  intro: {
    eyebrow: "Docs",
    heading: "Guides worth writing down once.",
    lede: "Reference pages and troubleshooting notes. They have no reading order; each exists to be looked up when something breaks.",
    label: "All docs",
    empty: "No docs published yet.",
  },
  description: { before: "Reference and troubleshooting guides by ", after: "." },
} as const satisfies ListingPageConfig;
