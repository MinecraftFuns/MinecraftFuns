import { contact } from "../config/contact.ts";
import type { HttpsUrl, PlatformName } from "../schema.ts";
import { formatFingerprint, publishedKeys } from "./keys.ts";
import { assetUrl, type Href } from "./url.ts";
/** Resolve configured handles with platform-owned labels and URL shapes. */

/** `satisfies` enforces platform coverage and absolute URL return types. */
const PLATFORMS = {
  github: { label: "GitHub", url: (handle: string) => `https://github.com/${handle}` },
  matrix: { label: "Matrix", url: (handle: string) => `https://matrix.to/#/${handle}` },
  twitter: { label: "Twitter", url: (handle: string) => `https://x.com/${handle}` },
} as const satisfies Record<
  PlatformName,
  { readonly label: string; readonly url: (handle: string) => HttpsUrl }
>;

/** Resolved profile link plus display handle and identity status. */
export type Profile = {
  readonly label: string;
  readonly href: Href;
  /** As displayed: the handle itself, not a URL. */
  readonly handle: string;
  /** Whether `rel="me"` can assert site/profile identity. */
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

/** This site's key document, not a profile account. */
export const pgpHref = (): Href => assetUrl("/pgp");

/** Footer links: profiles plus the site's non-profile key document. */
export const elsewhere = (): readonly Profile[] => [
  ...profiles,
  { label: "PGP", handle: "PGP", href: pgpHref(), isIdentity: false },
];

/** Shared derived fingerprint for footer and About page. */
export const siteFingerprint = async (): Promise<string> => {
  const [key] = await publishedKeys(contact.mailDomain);

  /* Missing key is a build defect, not an empty display value. */
  if (key === undefined) {
    throw new TypeError(`src/keys: no key published for ${contact.mailDomain}`);
  }
  return formatFingerprint(key.fingerprint);
};
