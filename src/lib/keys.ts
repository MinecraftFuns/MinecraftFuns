import { basename } from "node:path/posix";

import * as openpgp from "openpgp";

import { okUnless, orThrow } from "../prelude/adt.ts";
import { clashesBy, distinctBy } from "../prelude/distinct.ts";
import { memoiseBy } from "../prelude/memo.ts";
import { byCodepoint } from "./collate.ts";
import { isOnDomain, parseMailAddress, wkdHash, type WkdHash } from "./wkd.ts";

/**
 * Key files are the source for both armored `/pgp` output and WKD binaries.
 * Dearmouring preserves packets that re-serialization would drop; addresses
 * come from the key so published routes cannot describe absent identities.
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

/* `import.meta.glob` keys use `/` even on hosts with other path separators. */
const stemOf = (path: string): string => basename(path, ".asc");

/** Preserve stored packet bytes; do not re-serialize the parsed key. */
const dearmor = async (armored: string): Promise<Uint8Array> => {
  const { data } = await openpgp.unarmor(armored);
  return data instanceof Uint8Array
    ? data
    : new Uint8Array(await new Response(data as ReadableStream).arrayBuffer());
};

/** Distinct domain addresses in key order; duplicate User IDs share one WKD entry. */
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

  /* Keep first key order, matching `distinctBy` rather than overwriting. */
  return distinctBy(published, (address) => address.hash);
};

/** Find every address claimed by more than one key. */
export const ownershipProblems = (keys: readonly PublishedKey[]): readonly string[] => {
  /* Preserve owner names so each collision identifies both source files. */
  const claims = keys.flatMap((key) =>
    key.addresses.map(({ address, hash }) => ({ address, hash, owner: key.name })),
  );

  return (
    clashesBy(claims, (claim) => claim.hash)
      /* Duplicate User IDs are one entry; only a second owner conflicts. */
      .filter(([first, later]) => first.owner !== later.owner)
      .map(
        ([first, later]) =>
          `${later.address} is claimed by both ${first.owner}.asc and ${later.owner}.asc`,
      )
  );
};

const load = async (domain: string): Promise<readonly PublishedKey[]> => {
  /* Build-time eager glob; keep it inside `load` so plain Node can import tests. */
  const sources = import.meta.glob("../keys/*.asc", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Readonly<Record<string, string>>;

  /* Code-point order keeps key output independent of build locale. */
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

/* Parse once per build; `/pgp` and WKD paths share the result. */
export const publishedKeys = memoiseBy((domain: string) => domain, load);

/** Format a derived fingerprint for transcription. */
export const formatFingerprint = (fingerprint: string): string =>
  (fingerprint.toUpperCase().match(/.{1,4}/g) ?? []).join(" ");

/** Every published address across every key, newest file order. */
export const publishedAddresses = async (
  domain: string,
): Promise<readonly (PublishedAddress & { readonly key: PublishedKey })[]> =>
  (await publishedKeys(domain)).flatMap((key) =>
    key.addresses.map((address) => ({ ...address, key })),
  );
