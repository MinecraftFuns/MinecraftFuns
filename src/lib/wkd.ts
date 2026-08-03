import { createHash } from "node:crypto";

import { invalid, ok, type Parsed } from "./adt.ts";

/**
 * Web Key Directory address hashing.
 *
 * Specified by draft-koch-openpgp-webkey-service. The local-part of a mail
 * address is case-mapped, hashed with SHA-1, and the 160-bit digest encoded
 * with Z-Base-32 (RFC 6189 section 5.1.6) into a fixed 32-character string. A
 * key is then published at `/.well-known/openpgpkey/hu/<hash>` on the address's
 * own domain, the "direct" method. The domain is deliberately excluded from
 * the hash, so an internationalised domain name cannot perturb it.
 *
 * SHA-1 is a *naming* function here, not a security one: it derives a stable
 * filename, nothing is authenticated by it, and the key served at that path
 * carries its own signatures. Substituting SHA-256 would produce files no
 * client looks for.
 *
 * Pure, total, and importing nothing from the site, so everything here is
 * checkable against the specification's own test vector.
 */

declare const wkdHashBrand: unique symbol;

/**
 * A Z-Base-32 encoded SHA-1 digest: 32 characters from the Z-Base-32 alphabet.
 * Obtainable only from `wkdHash`, so any value of this type names a real
 * address's directory entry rather than an arbitrary string a caller invented.
 */
export type WkdHash = string & { readonly [wkdHashBrand]: true };

/**
 * RFC 6189 section 5.1.6. Not RFC 4648 base32: the alphabet is permuted so the
 * characters most often confused when transcribed by hand carry the least
 * information, and `0`, `l`, `v`, and `2` are absent entirely.
 */
const ZBASE32_ALPHABET = "ybndrfg8ejkmcpqxot1uwisza345h769";

/** ASCII upper case, and nothing else. See `mapLocalPart`. */
const ASCII_UPPER = /[A-Z]/g;

/**
 * "All upper-case ASCII characters in a User ID are mapped to lowercase.
 * Non-ASCII characters are not changed."
 *
 * Emphatically not `String.prototype.toLowerCase`, which is Unicode-aware and
 * would map U+0130 (LATIN CAPITAL LETTER I WITH DOT ABOVE) to "i" followed by a
 * combining dot: two code points where there was one, a different byte
 * sequence to hash, and therefore a key published at a path no client will ever
 * request. Restricting the pattern to A-Z makes the per-character `toLowerCase`
 * exact, because over that domain the Unicode mapping and the ASCII one agree.
 */
export const mapLocalPart = (local: string): string =>
  local.replace(ASCII_UPPER, (letter) => letter.toLowerCase());

/**
 * Big-endian Z-Base-32.
 *
 * A fold over the bytes carrying a bit accumulator: each byte shifts eight bits
 * in, and every time five or more are available the top five are emitted. The
 * trailing branch pads a final partial group, which WKD never reaches (a
 * SHA-1 digest is 160 bits and 160 is a multiple of 5), but a partial function
 * that happens never to be called is still a partial function, so it is
 * handled and tested.
 */
export const zbase32 = (bytes: Uint8Array): string => {
  const { text, bits, value } = bytes.reduce(
    (state, byte) => {
      let acc = (state.value << 8) | byte;
      let width = state.bits + 8;
      let text = state.text;

      while (width >= 5) {
        width -= 5;
        text += ZBASE32_ALPHABET[(acc >>> width) & 31];
      }

      return { text, bits: width, value: acc & ((1 << width) - 1) };
    },
    { text: "", bits: 0, value: 0 },
  );

  return bits === 0 ? text : text + ZBASE32_ALPHABET[(value << (5 - bits)) & 31];
};

/** The directory entry name for a local-part. */
export const wkdHash = (local: string): WkdHash =>
  zbase32(
    new Uint8Array(createHash("sha1").update(mapLocalPart(local), "utf8").digest()),
  ) as WkdHash;

/**
 * A mail address split at its domain boundary.
 *
 * Deliberately not an RFC 5322 parser. The only question this project asks of
 * an address is "which domain, and what precedes it", and the addresses come
 * from a signed key the site owner controls rather than from user input.
 */
export type MailAddress = {
  readonly local: string;
  readonly domain: string;
};

/**
 * Total. Split at the *last* `@`, which is what the grammar requires: a quoted
 * local-part may legally contain one, a domain never may.
 */
export const parseMailAddress = (raw: string): Parsed<MailAddress> => {
  const at = raw.lastIndexOf("@");
  if (at <= 0 || at === raw.length - 1) {
    return invalid(`not a mail address: ${JSON.stringify(raw)}`);
  }

  return ok({ local: raw.slice(0, at), domain: raw.slice(at + 1) });
};

/** Case-insensitive domain match. DNS is case-insensitive; local-parts are not. */
export const isOnDomain = (address: MailAddress, domain: string): boolean =>
  address.domain.toLowerCase() === domain.toLowerCase();

/** Where a key for this address is published, relative to the domain root. */
export const wkdPath = (local: string): string =>
  `/.well-known/openpgpkey/hu/${wkdHash(local)}`;
