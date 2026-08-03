#!/usr/bin/env node
/**
 * The CI build matrix, derived from `src/config/deployments.ts`.
 *
 * A matrix entry naming a base the config does not declare builds an artifact
 * that is internally consistent and wrong, and nothing could have caught it.
 * Emitting the matrix makes that unrepresentable: a deployment exists in one
 * file, and the jobs that build and publish it follow.
 *
 * Values come from `lib/deployment.ts`, so a job's `role` is the one the pages
 * see. That module is pure, which is why it loads under plain Node.
 *
 * Run in CI with GITHUB_OUTPUT set; run with no arguments to print what CI
 * would receive.
 */

import { appendFile } from "node:fs/promises";

import { canonicalTarget, targets } from "../src/lib/deployment.ts";

/**
 * `include` entries for `strategy.matrix`. The projection is explicit so that
 * a field added to a deployment does not silently widen the CI contract.
 *
 * `id` is the deployment's only name: the GitHub environment, the job, the
 * artifact, and the matrix leg all use it.
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
