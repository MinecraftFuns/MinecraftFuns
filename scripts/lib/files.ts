/**
 * One directory walk for the whole `scripts/` tree.
 *
 * Three gates had written the same recursive `readdir`, and two others had
 * reached for `{ recursive: true }` instead, so the same question had two
 * idioms and three implementations. The platform's version is the one worth
 * keeping: it is a single call, it does not build a promise tree per level,
 * and it cannot recurse differently in one copy than in another.
 */

import { readdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Every file beneath `dir`, as paths joined onto it. Directories are dropped,
 * and order is whatever the platform returns, so callers that report results
 * sort them.
 */
export const filesUnder = async (dir: string): Promise<readonly string[]> => {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
};
