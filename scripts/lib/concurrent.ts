/**
 * Bounded fan-out.
 *
 * `limit` tasks stay in flight and each worker takes the next index as it
 * frees, so elapsed time is the slowest worker rather than the sum of every
 * task. The workers share one iterator, which is what makes "next index" a
 * fact rather than an agreement between them.
 *
 * The bound is the point. `Promise.all` over a directory listing opens every
 * file at once, which is fine for twenty pages and is not a property of the
 * code so much as of the site being small.
 */
export const mapConcurrent = async <T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<readonly R[]> => {
  /* Written by index rather than pushed, so results come back in the order
     they were asked for however the workers interleave. */
  const results = new Array<R>(items.length);
  const queue = items.entries();

  const worker = async (): Promise<void> => {
    for (const [index, item] of queue) results[index] = await task(item);
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
};
