import type { APIRoute, GetStaticPaths } from "astro";

import { contact } from "../../../../config.ts";
import { publishedAddresses, type PublishedKey } from "../../../../lib/keys.ts";

/**
 * Web Key Directory, direct method.
 *
 * One route per address the keys actually carry, so the set of published
 * entries is a function of the keys rather than a list maintained beside them.
 * The legacy site kept two hand-placed files here; adding an address to the key
 * would not have created a third, and nothing would have said so.
 *
 * The path is `/.well-known/openpgpkey/hu/<hash>` on the address's own domain.
 * Under a base path it is inert — clients resolve the directory from the
 * address, which has no notion of a subdirectory — but it costs nothing and
 * keeps the two build targets identical in shape.
 */
export const getStaticPaths: GetStaticPaths = async () => {
  const addresses = await publishedAddresses(contact.mailDomain);

  return addresses.map(({ hash, key, address }) => ({
    params: { hash },
    props: { key, address },
  }));
};

type Props = { readonly key: PublishedKey; readonly address: string };

export const GET: APIRoute<Props> = ({ props }) =>
  /*
   * "The HTTP GET method MUST return the binary representation of the OpenPGP
   * key" and SHOULD NOT return an armored one. These are the stored bytes,
   * base64-decoded — not a re-serialisation, which would lose signatures.
   */
  new Response(props.key.binary as BodyInit, {
    headers: { "content-type": "application/octet-stream" },
  });
