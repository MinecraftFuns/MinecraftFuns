/**
 * One directory walk for the whole `scripts/` tree, via the platform's
 * recursive `readdir` rather than a hand-rolled walk: a single call that cannot
 * recurse differently at different call sites.
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Every file beneath `dir`, as paths joined onto it. Order is whatever the
 * platform returns, so callers that report results sort them.
 */
export const filesUnder = async (dir: string): Promise<readonly string[]> => {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
};
