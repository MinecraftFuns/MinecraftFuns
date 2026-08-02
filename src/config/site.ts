/**
 * Site identity.
 *
 * Config is a leaf: it imports nothing but types, holds no function calls, and
 * knows nothing about how any of it is rendered. Everything here is a value
 * somebody might reasonably want to change without reading a line of code.
 */
export const site = {
  /** Shown as the brand, and used as the document title. */
  name: "Joe Fang",

  /** GitHub account. The profile URL is built from it; do not repeat it. */
  handle: "MinecraftFuns",

  /**
   * The origin this site is *canonically* published at.
   *
   * Distinct from the origin a given build targets, which comes from SITE_URL
   * and may be a mirror. The two are compared to decide whether a build asks to
   * be indexed, so they are genuinely different knobs rather than a repetition.
   */
  canonicalOrigin: "https://joefang.org",

  description:
    "Computer Science and Cognitive Science at the University of Toronto. Projects, writing, and CV.",

  /** Document language, for `<html lang>`. */
  locale: "en",

  /**
   * IANA zone. Every date the site renders is read in it, so an authored date
   * with no time attached means that day *here*.
   */
  timeZone: "America/Toronto",

  /** BCP 47 tag used to format dates. Varies independently of the zone. */
  dateLocale: "en-CA",
} as const;

export const nav = [
  { label: "Projects", href: "/projects" },
  { label: "Blog", href: "/blog" },
  { label: "About", href: "/about" },
] as const;

/**
 * Routes that are files rather than documents.
 *
 * Kept out of the sitemap: it lists pages for a crawler to index, and a key or
 * a policy file is neither. Prefixes, matched against the path.
 */
export const nonDocumentRoutes = ["/pgp", "/.well-known/"] as const;
