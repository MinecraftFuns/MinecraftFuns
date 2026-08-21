import type { Eagerness } from "../lib/speculation.ts";

/**
 * How eagerly to load the next page before it is asked for.
 *
 * `moderate` is the hover hint: the engine acts after the pointer rests on a
 * link for around 200ms, or on pointer-down if that comes first. `eager` and
 * `immediate` would fetch on approach or on sight, which for an archive of a
 * few hundred pages spends a reader's bandwidth on pages they are scrolling
 * past. `conservative`, the default for document rules, waits for the press
 * and buys back only the handful of milliseconds between press and release.
 */
export const speculation = { eagerness: "moderate" } as const satisfies {
  readonly eagerness: Eagerness;
};
