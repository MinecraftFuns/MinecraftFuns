import { hosting } from "../config/hosting.ts";
import { orThrow } from "../prelude/adt.ts";
import { decodeHostConfig, type HeaderRule, type Redirect } from "./hosting.ts";
import { assetUrl } from "./url.ts";

/**
 * The decoded host policy, bound to this deployment. Both directive files read
 * it here so neither can call the decoder with different arguments. `assetUrl`
 * is applied here rather than inside `lib/hosting.ts`, which keeps the decoder
 * testable without a bundler; a policy that will not decode throws, since
 * emitting directives known to be unsound is worse than failing the build.
 */
export const hostPolicy = (): {
  readonly headers: readonly HeaderRule[];
  readonly redirects: readonly Redirect[];
} => orThrow(decodeHostConfig(hosting, assetUrl), "config/hosting.ts");
