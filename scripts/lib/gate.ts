/**
 * What every source gate has in common: a name, a list of problems, and an
 * exit code.
 *
 * The list is the point. "Passes" is the empty list, the identity of the
 * monoid the checks are folded with, so no gate decides separately whether it
 * succeeded. What a gate must still decide is how its problems read, which is
 * why `body` is a parameter: a line number, a class name, and a viewport are
 * different facts, and flattening them into one record shape would buy
 * uniformity at the price of saying less.
 */

/** One block per problem, blank line between. The usual body. */
export const each =
  <P>(render: (problem: P) => string) =>
  (problems: readonly P[]): string =>
    problems.map(render).join("\n\n");

/**
 * Report and set the exit code. The console and `process.exitCode` are the
 * only effects; the problems are returned so a caller can keep inspecting them.
 */
/**
 * What a gate reports. Generic in the problem, which is the whole point of
 * `body` being a parameter: a line number, a class name, and a viewport are
 * different facts, and one flattened record shape would say less about each.
 */
export type Report<P> = {
  readonly name: string;
  readonly problems: readonly P[];
  /** Phrase completing "<name>: OK, …". */
  readonly passed: string;
  /** Phrase completing "<name>: n problem(s) …". May be empty. */
  readonly failed: string;
  readonly body: (problems: readonly P[]) => string;
};

export const report = <P>({
  name,
  problems,
  passed,
  failed,
  body,
}: Report<P>): readonly P[] => {
  if (problems.length === 0) {
    console.log(`${name}: OK, ${passed}`);
    return problems;
  }

  /* Trimmed rather than branched: a gate with no extra context to give on
     failure passes an empty phrase, which is a value and not a case. */
  console.error(`${name}: ${problems.length} problem(s) ${failed}`.trim());
  console.error(`\n${body(problems)}\n`);
  process.exitCode = 1;
  return problems;
};

/**
 * A gate that cannot run at all, which is not the same as one that found
 * nothing. Reported separately so an absent `dist/` never reads as a pass.
 */
export const cannotRun = (name: string, reason: string): void => {
  console.error(`${name}: ${reason}`);
  process.exitCode = 1;
};
