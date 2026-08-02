import type { APIRoute } from "astro";

import { headerProblems, renderHeaders } from "../lib/hosting.ts";
import { headerRules } from "../lib/host-policy.ts";

/**
 * `_headers`, rendered from the typed policy.
 *
 * Injected rather than placed in `src/pages`, because Astro excludes any route
 * file whose name begins with an underscore and this one must be named exactly
 * `_headers`.
 */
export const GET: APIRoute = () => {
  const problems = headerProblems(headerRules);
  if (problems.length > 0) {
    // Emitting a file known to be self-contradictory is worse than not building.
    throw new TypeError(
      `_headers policy is unsound:\n${problems.map((p) => `  ${p.rule}: ${p.reason}`).join("\n")}`,
    );
  }

  return new Response(renderHeaders(headerRules), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
