#!/usr/bin/env node
/**
 * The CI build matrix, derived from `src/config/deployments.ts`.
 *
 * The workflow used to spell every origin and base path out again in YAML,
 * which was a third copy of facts already stated in the config and in the
 * Astro defaults. Nothing could have made the three agree, and the failure
 * mode was silent: a matrix entry naming a base the config did not declare
 * builds an artifact that is internally consistent and wrong.
 *
 * Emitting the matrix instead makes that unrepresentable. A deployment exists
 * in one file; the jobs that build and publish it follow.
 *
 * The values are read from `lib/deployment.ts` rather than re-derived here,
 * so the `role` a job sees is the same one the pages see. That module is pure
 * and its only environment read is defensive, which is why it loads under
 * plain Node with no bundler.
 *
 * Usage: run in CI with GITHUB_OUTPUT set; run locally with no arguments to
 * print what CI would receive.
 */

import { appendFile } from "node:fs/promises";

import { canonicalTarget, targets } from "../src/lib/deployment.ts";

/**
 * `include` entries for `strategy.matrix`.
 *
 * `id` is the deployment's only name: the GitHub environment, the job, the
 * artifact, and the matrix leg all use it, so nothing downstream has to map
 * one identifier onto another.
 */
export const matrixInclude = (deployments) =>
  deployments.map(({ id, origin, base, role }) => ({ id, origin, base, role }));

/** GITHUB_OUTPUT is line-oriented, so every value must be a single line. */
export const renderOutputs = (outputs) =>
  Object.entries(outputs)
    .map(([name, value]) => `${name}=${JSON.stringify(value)}`)
    .join("\n");

const main = async () => {
  const body = renderOutputs({
    targets: matrixInclude(targets),
    canonical: matrixInclude([canonicalTarget])[0],
  });

  const output = process.env.GITHUB_OUTPUT;
  if (output === undefined) {
    console.log(body);
    return;
  }
  await appendFile(output, `${body}\n`);
};

if (process.argv[1] === new URL(import.meta.url).pathname) {
  await main();
}
