#!/usr/bin/env node
/** CI build matrix derived from declared deployments. */

import { appendFile } from "node:fs/promises";

import {
  canonicalTarget,
  targets,
  type DeploymentTarget,
} from "../src/lib/deployment.ts";

/** Exactly the fields consumed by CI; explicit projection prevents drift. */
export type MatrixLeg = Pick<DeploymentTarget, "id" | "origin" | "base" | "role">;

export const matrixInclude = (
  deployments: readonly DeploymentTarget[],
): readonly MatrixLeg[] =>
  deployments.map(({ id, origin, base, role }) => ({ id, origin, base, role }));

/** `GITHUB_OUTPUT` values must be single-line. */
export const renderOutputs = (outputs: Readonly<Record<string, unknown>>): string =>
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
