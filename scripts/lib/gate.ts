/** Shared source-gate reporting; each gate supplies its problem renderer. */

/** Render one blank-line-separated block per problem. */
export const each =
  <P>(render: (problem: P) => string) =>
  (problems: readonly P[]): string =>
    problems.map(render).join("\n\n");

/** Gate report; `body` preserves each check's problem shape. */
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

  /* Empty `failed` needs trimming, not a special branch. */
  console.error(`${name}: ${problems.length} problem(s) ${failed}`.trim());
  console.error(`\n${body(problems)}\n`);
  process.exitCode = 1;
  return problems;
};

/** Report an unavailable gate as failure, not as an empty result. */
export const cannotRun = (name: string, reason: string): void => {
  console.error(`${name}: ${reason}`);
  process.exitCode = 1;
};
