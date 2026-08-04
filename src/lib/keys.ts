import { basename } from "node:path/posix";

import * as openpgp from "openpgp";

import { okUnless, orThrow } from "../prelude/adt.ts";
import { clashesBy, distinctBy } from "../prelude/distinct.ts";
import { memoiseBy } from "../prelude/memo.ts";
import { byCodepoint } from "./collate.ts";
import { isOnDomain, parseMailAddress, wkdHash, type WkdHash } from "./wkd.ts";

/**
 * The published OpenPGP keys, and the addresses each one answers for.
 *
 * One armored file per key under `src/keys` is the whole source of truth: the
 * armored text at `/pgp` and the binary at each Web Key Directory path are
 * both derived from it. Two rules keep the copies from drifting apart, which
 * is what the legacy site's four stored copies had already done.
 *
 *  1. The binary is obtained by *dearmouring*, never by re-serialising a parsed
 *     key. `readKey().write()` emits only the packets openpgp.js models, which
 *     for this key silently discards five signatures.
 *  2. Addresses are read from the key itself, so a published address that is
 *     not in the key has nowhere to be written down.
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

/* The POSIX variant specifically: these are `import.meta.glob` keys, which are
   URL-shaped and separated by `/` whatever the host platform is. */
const stemOf = (path: string): string => basename(path, ".asc");

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
const addressOn = (user: openpgp.User, domain: string): PublishedAddress | undefined => {
  const email = user.userID?.email;
  if (email === undefined || email === "") return undefined;

  const parsed = parseMailAddress(email);
  if (parsed.tag !== "ok" || !isOnDomain(parsed.value, domain)) return undefined;

  const { local } = parsed.value;
  return { local, address: email, hash: wkdHash(local) };
};

const addressesOn = (key: openpgp.Key, domain: string): readonly PublishedAddress[] => {
  const published = key.users
    .map((user) => addressOn(user, domain))
    .filter((address) => address !== undefined);

  /* First occurrence wins, which is `distinctBy`'s contract; a collection's
     own overwrite rule would keep the last. */
  return distinctBy(published, (address) => address.hash);
};

/**
 * Addresses claimed by more than one key.
 *
 * The address-to-key mapping has to be a function: two keys claiming one
 * directory entry would put two files at one URL, resolved arbitrarily and
 * never noticed by a client. Carrying the owner already seen keeps the
 * counterpart in hand, so a message cannot print "undefined".
 *
 * Every clash, not the first: three are three facts about `src/keys`, and
 * reporting them one build at a time turns one mistake into three builds.
 */
export const ownershipProblems = (keys: readonly PublishedKey[]): readonly string[] => {
  /* Flattened first, so a clash is between two *claims* and each names the key
     it came from. */
  const claims = keys.flatMap((key) =>
    key.addresses.map(({ address, hash }) => ({ address, hash, owner: key.name })),
  );

  return (
    clashesBy(claims, (claim) => claim.hash)
      /* One key naming an address twice is one directory entry, not a conflict:
         this key really does carry two User IDs for `me@joefang.org`. Only a
         second *owner* means two files at one URL. */
      .filter(([first, later]) => first.owner !== later.owner)
      .map(
        ([first, later]) =>
          `${later.address} is claimed by both ${first.owner}.asc and ${later.owner}.asc`,
      )
  );
};

const load = async (domain: string): Promise<readonly PublishedKey[]> => {
  /*
   * Vite resolves this at build time, so the key files need no runtime path
   * and the dev server reloads on edit. `eager` because there is no laziness
   * to gain: every key is needed to enumerate the routes.
   *
   * Inside the function rather than at module scope so that plain Node can
   * import this file. `import.meta.glob` is a build-time transform and throws
   * anywhere else, which is why nothing here was testable before.
   */
  const sources = import.meta.glob("../keys/*.asc", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Readonly<Record<string, string>>;

  /* Code points, not collation: these are file stems, and their order must
     not depend on the build machine's locale. */
  const entries = Object.entries(sources).toSorted(([a], [b]) => byCodepoint(a, b));

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

  return orThrow(
    okUnless(ownershipProblems(keys), keys),
    "src/keys holds one key per address",
  );
};

/*
 * Parsed once per build. Both the /pgp endpoint and the directory's
 * getStaticPaths need the same answer, and OpenPGP parsing is the expensive
 * part of either.
 */
export const publishedKeys = memoiseBy((domain: string) => domain, load);

/**
 * A fingerprint as people transcribe it: upper case, in groups of four.
 * Derived rather than written down, because rotating a key changes the file
 * while leaving a printed fingerprint looking perfectly plausible.
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
