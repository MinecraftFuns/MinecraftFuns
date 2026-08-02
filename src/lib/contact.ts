import { contact } from "../config/contact.ts";
import type { Link, PlatformName } from "../config/schema.ts";
import { site } from "../config/site.ts";
import { formatFingerprint, publishedKeys } from "./keys.ts";
import { routeUrl } from "./url.ts";

/**
 * Profiles, resolved from handles.
 *
 * The split is deliberate: a *handle* is a fact about me and lives in config; a
 * platform's display name and URL shape are facts about the platform and live
 * here. Storing the full URL in config would write each handle twice, once
 * bare and once inside a link, which is exactly the pair that drifts when an
 * account is renamed.
 */

const PLATFORMS = {
  github: { label: "GitHub", url: (handle: string) => `https://github.com/${handle}` },
  matrix: { label: "Matrix", url: (handle: string) => `https://matrix.to/#/${handle}` },
  twitter: { label: "Twitter", url: (handle: string) => `https://x.com/${handle}` },
} as const;

/* The table above is the authority; the union in schema.ts must agree with it,
   which this line checks rather than assumes. */
const _platformsCoverSchema: Record<PlatformName, unknown> = PLATFORMS;
void _platformsCoverSchema;

/** A `Link` that also carries the bare handle, and whether it proves identity. */
export type Profile = Link & {
  /** As displayed: the handle itself, not a URL. */
  readonly handle: string;
  /**
   * `rel="me"` asserts "this profile is the same person as this site", which is
   * what Mastodon-style verification consumes. True of an account; false of a
   * document such as a key.
   */
  readonly isIdentity: boolean;
};

export const profiles: readonly Profile[] = contact.profiles.map(
  ({ platform, handle }) => ({
    label: PLATFORMS[platform].label,
    handle,
    href: PLATFORMS[platform].url(handle),
    isIdentity: true,
  }),
);

/** The GitHub account URL, built from the one place the handle is written. */
export const githubUrl = PLATFORMS.github.url(site.handle);

/** This site's own key route. Not a profile: it is a document, not an account. */
export const pgpHref = (): string => routeUrl("/pgp");

/**
 * Everything the footer lists. Profiles plus the key, which is ours rather than
 * somebody else's and so carries no `rel="me"`.
 */
export const elsewhere = (): readonly Profile[] => [
  ...profiles,
  { label: "PGP", handle: "PGP", href: pgpHref(), isIdentity: false },
];

/**
 * This site's key fingerprint, formatted for reading.
 *
 * Derived here so the footer and the About page cannot print different ones;
 * they each did their own `publishedKeys` call and formatting, which is two
 * copies of one derivation and exactly what the fingerprint config field was
 * before it.
 */
export const siteFingerprint = async (): Promise<string> => {
  const [key] = await publishedKeys(contact.mailDomain);
  return key === undefined ? "" : formatFingerprint(key.fingerprint);
};
