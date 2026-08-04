import { contact } from "../config/contact.ts";
import type { HttpsUrl, PlatformName } from "../config/schema.ts";
import { formatFingerprint, publishedKeys } from "./keys.ts";
import { routeUrl, type Href } from "./url.ts";

/**
 * Profiles, resolved from handles.
 *
 * The split is deliberate: a *handle* is a fact about me and lives in config; a
 * platform's display name and URL shape are facts about the platform and live
 * here. Storing the full URL in config would write each handle twice, once
 * bare and once inside a link, which is exactly the pair that drifts when an
 * account is renamed.
 */

/**
 * `satisfies` is the whole agreement between this table and `PlatformName`: a
 * missing platform and a platform the union never named are both errors here,
 * and the annotation types each `url` so its template literal is checked to be
 * an absolute URL rather than merely a string. This replaced a dummy binding
 * that asserted the same coverage in runtime code nobody could run.
 */
const PLATFORMS = {
  github: { label: "GitHub", url: (handle: string) => `https://github.com/${handle}` },
  matrix: { label: "Matrix", url: (handle: string) => `https://matrix.to/#/${handle}` },
  twitter: { label: "Twitter", url: (handle: string) => `https://x.com/${handle}` },
} as const satisfies Record<
  PlatformName,
  { readonly label: string; readonly url: (handle: string) => HttpsUrl }
>;

/** A resolved link that also carries the bare handle, and whether it proves
 *  identity. */
export type Profile = {
  readonly label: string;
  readonly href: Href;
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

/** This site's own key route. Not a profile: it is a document, not an account. */
export const pgpHref = (): Href => routeUrl("/pgp");

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

  /* No key is a defect, not an empty string. Correspondence here goes through
     the Primary User ID, so a build with nothing to print would ship a page
     offering a way to reach me and no way to reach me. */
  if (key === undefined) {
    throw new TypeError(`src/keys: no key published for ${contact.mailDomain}`);
  }
  return formatFingerprint(key.fingerprint);
};
