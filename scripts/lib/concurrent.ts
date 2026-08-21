/** Run at most `limit` tasks concurrently; preserve input order in results. */
export const mapConcurrent = async <T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<readonly R[]> => {
  /* Index writes preserve input order despite worker interleaving. */
  const results = new Array<R>(items.length);
  const queue = items.entries();

  const worker = async (): Promise<void> => {
    for (const [index, item] of queue) results[index] = await task(item);
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
};

/** Open file handles, which a directory listing otherwise bounds. */
export const READ_CONCURRENCY = 16;
