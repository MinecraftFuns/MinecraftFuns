import {
  projectKinds,
  projects,
  projectStatuses,
  type Project,
  type ProjectKind,
  type ProjectStatus,
} from "../config/projects.ts";

/**
 * Presentation logic for the project list. The data is config; deciding what to
 * show and in what order is not.
 */

/**
 * The badge a status shows, or `null` for none.
 *
 * Total by construction, and now visibly so: `ProjectStatus` is the key type
 * of the very record being indexed, so the lookup cannot miss. The `Map` this
 * replaces returned `string | null | undefined` and coalesced the impossible
 * `undefined` into `null`, which put two absences with different meanings
 * behind one value. Only one of them was ever real.
 */
export const badgeFor = (status: ProjectStatus): string | null => projectStatuses[status];

export type ProjectSection = {
  readonly kind: ProjectKind;
  readonly heading: string;
  readonly blurb: string;
  readonly items: readonly Project[];
};

/**
 * Sections in config order, with empty ones omitted; an empty heading
 * advertises a gap, where saying nothing simply says nothing.
 */
export const projectSections = (): readonly ProjectSection[] => {
  const grouped = Object.groupBy(projects, (project) => project.kind);

  return projectKinds
    .map((kind) => ({ ...kind, items: grouped[kind.kind] ?? [] }))
    .filter((section) => section.items.length > 0);
};
