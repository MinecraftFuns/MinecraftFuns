import { hosting } from "../config/hosting.ts";
import { orThrow } from "./adt.ts";
import { decodeHostConfig, type HeaderRule, type Redirect } from "./hosting.ts";
import { assetUrl } from "./url.ts";

/**
 * The decoded host policy, bound to this deployment.
 *
 * The two directive files each need the same answer, and each was calling the
 * decoder itself, one derivation written twice, which is how they would
 * eventually be given different arguments. `assetUrl` is applied here rather
 * than inside `lib/hosting.ts`, which is what keeps the decoder pure and
 * testable without a bundler.
 *
 * Decoding throws rather than returning a partial result: emitting a directive
 * file known to be unsound is worse than failing the build that would ship it.
 */
export const hostPolicy = (): {
  readonly headers: readonly HeaderRule[];
  readonly redirects: readonly Redirect[];
} => orThrow(decodeHostConfig(hosting, assetUrl), "config/hosting.ts");
