import * as openpgp from "openpgp";

import {
  isOnDomain,
  parseMailAddress,
  wkdHash,
  type WkdHash,
} from "./wkd.ts";

/**
 * The published OpenPGP keys, and the addresses each one answers for.
 *
 * One armored file per key under `src/keys` is the whole source of truth. Every
 * representation the site serves is derived from it: the armored text at
 * `/pgp`, and the binary body at each address's Web Key Directory path. The
 * legacy site stored the same key four times across two encodings, and they had
 * already drifted: its `/pgp` carried 53 packets while the file WKD clients
 * actually fetched carried 58, so the human-readable copy and the
 * machine-readable copy were different keys in every way that mattered.
 *
 * Two rules keep that from recurring:
 *
 *  1. The binary is obtained by *dearmouring*, never by re-serialising a parsed
 *     key. `readKey().write()` emits only the packets openpgp.js models, which
 *     for this key silently discards five signatures. Base64-decoding the
 *     stored block yields the author's exact bytes.
 *  2. Addresses are read from the key itself. A published address that is not
 *     in the key is unrepresentable, because there is nowhere to write one
 *     down.
 */

export type PublishedAddress = {
  readonly local: string;
  readonly address: string;
  readonly hash: WkdHash;
};

export type PublishedKey = {
  /** Source file stem, used only in diagnostics. */
  readonly name: string;
  readonly fingerprint: string;
  readonly armored: string;
  readonly binary: Uint8Array;
  readonly addresses: readonly PublishedAddress[];
};

/*
 * Vite resolves this at build time, so the key files need no runtime path and
 * the dev server reloads on edit. `eager` because there is no laziness to gain:
 * every key is needed to enumerate the routes.
 */
const SOURCES = import.meta.glob("../keys/*.asc", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Readonly<Record<string, string>>;

const stemOf = (path: string): string =>
  path.split("/").at(-1)?.replace(/\.asc$/, "") ?? path;

/** The exact stored bytes, not a re-serialisation. See the note above. */
const dearmor = async (armored: string): Promise<Uint8Array> => {
  const { data } = await openpgp.unarmor(armored);
  return data instanceof Uint8Array
    ? data
    : new Uint8Array(await new Response(data as ReadableStream).arrayBuffer());
};

/**
 * Distinct addresses on `domain`, in key order.
 *
 * A key may carry several User IDs bearing one address: this key has two for
 * `me@joefang.org`, a plain one and a "(Work)" one, and they must collapse to
 * a single directory entry rather than two identical files.
 */
const addressesOn = (
  key: openpgp.Key,
  domain: string,
): readonly PublishedAddress[] => {
  const found = new Map<string, PublishedAddress>();

  key.users.forEach((user) => {
    const email = user.userID?.email;
    if (email === undefined || email === "") return;

    const parsed = parseMailAddress(email);
    if (parsed.tag !== "ok" || !isOnDomain(parsed.value, domain)) return;

    const { local } = parsed.value;
    const hash = wkdHash(local);
    if (!found.has(hash)) found.set(hash, { local, address: email, hash });
  });

  return [...found.values()];
};

const load = async (domain: string): Promise<readonly PublishedKey[]> => {
  const entries = Object.entries(SOURCES).toSorted(([a], [b]) => a.localeCompare(b));

  const keys = await Promise.all(
    entries.map(async ([path, armored]) => {
      const key = await openpgp.readKey({ armoredKey: armored });
      return {
        name: stemOf(path),
        fingerprint: key.getFingerprint(),
        armored: armored.trimEnd(),
        binary: await dearmor(armored),
        addresses: addressesOn(key, domain),
      };
    }),
  );

  /*
   * The address-to-key mapping has to be a function: two keys claiming one
   * address would mean two different files at one URL, which Astro would
   * resolve arbitrarily and a client would never notice. Failing the build is
   * the only honest outcome.
   */
  const claimed = new Map<string, string>();
  keys.forEach((key) =>
    key.addresses.forEach(({ address, hash }) => {
      const owner = claimed.get(hash);
      if (owner !== undefined && owner !== key.name) {
        throw new TypeError(
          `${address} is claimed by both ${owner}.asc and ${key.name}.asc; one address, one key`,
        );
      }
      claimed.set(hash, key.name);
    }),
  );

  return keys;
};

/*
 * Parsed once per build. Both the /pgp endpoint and the directory's
 * getStaticPaths need the same answer, and OpenPGP parsing is the expensive
 * part of either.
 */
const cache = new Map<string, Promise<readonly PublishedKey[]>>();

export const publishedKeys = (domain: string): Promise<readonly PublishedKey[]> => {
  const cached = cache.get(domain);
  if (cached !== undefined) return cached;

  const pending = load(domain);
  cache.set(domain, pending);
  return pending;
};

/**
 * A fingerprint as people transcribe it: upper case, in groups of four.
 *
 * Derived rather than written down. It used to be a config string sitting
 * beside the key, which is a second encoding of the same fact, and the one
 * that goes stale silently, because rotating a key changes the file while
 * leaving the printed fingerprint looking perfectly plausible.
 */
export const formatFingerprint = (fingerprint: string): string =>
  (fingerprint.toUpperCase().match(/.{1,4}/g) ?? []).join(" ");

/** Every published address across every key, newest file order. */
export const publishedAddresses = async (
  domain: string,
): Promise<readonly (PublishedAddress & { readonly key: PublishedKey })[]> =>
  (await publishedKeys(domain)).flatMap((key) =>
    key.addresses.map((address) => ({ ...address, key })),
  );
