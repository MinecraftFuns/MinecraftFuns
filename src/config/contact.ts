import type { ContactConfig } from "./schema.ts";

/**
 * How to reach me, and where I am.
 *
 * A profile is a handle on a platform. The label and the URL shape are
 * knowledge about the platform, not about me, so they live in `lib/contact.ts`
 * and each account appears here exactly once. Writing the full URL instead
 * would put the handle in two places and let them drift.
 *
 * Note the deliberate absence of a plaintext address: correspondence goes
 * through the PGP Primary User ID. The fingerprint is not written down here
 * either — it is read from the key, so rotating the key cannot leave a stale
 * one printed in the footer.
 */
export const contact = {
  /** The domain whose addresses this site publishes keys for. */
  mailDomain: "joefang.org",

  profiles: [
    { platform: "github", handle: "MinecraftFuns" },
    { platform: "matrix", handle: "@multiset:matrix.org" },
    { platform: "twitter", handle: "SerendipityArk" },
  ],
} as const satisfies ContactConfig;
