import type { APIRoute } from "astro";

import { contact } from "../config/contact.ts";
import { publishedKeys } from "../lib/keys.ts";

/**
 * The public keys, armored, for a human to read or `gpg --import`.
 *
 * Served as the stored text verbatim. Re-armouring through openpgp.js would
 * drop the packets it does not model and quietly publish a less complete key
 * than the one in the repository, which is exactly how the legacy site came to
 * serve 53 packets here and 58 to Web Key Directory clients.
 */
export const GET: APIRoute = async () => {
  const keys = await publishedKeys(contact.mailDomain);
  const body = `${keys.map((key) => key.armored).join("\n")}\n`;

  return new Response(body, {
    headers: {
      /* RFC 3156. Browsers show it as text; GnuPG recognises it as a key. */
      "content-type": "application/pgp-keys; charset=utf-8",
    },
  });
};
