import type { APIRoute } from "astro";

import { redirectProblems, renderRedirects } from "../lib/hosting.ts";
import { redirects } from "../lib/host-policy.ts";

/**
 * `_redirects`, rendered from the typed policy.
 *
 * The structural checks run here rather than in a test, so a rule that cannot
 * fire fails the build that would have shipped it.
 */
export const GET: APIRoute = () => {
  const problems = redirectProblems(redirects);
  if (problems.length > 0) {
    throw new TypeError(
      `_redirects policy is unsound:\n${problems.map((p) => `  ${p.rule}: ${p.reason}`).join("\n")}`,
    );
  }

  return new Response(renderRedirects(redirects), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
};
