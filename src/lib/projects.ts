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

/* Built once. Total by construction: ProjectStatus is derived from the very
   array this is built from, so every status has an entry. */
const BADGE = new Map<ProjectStatus, string | null>(
  projectStatuses.map(({ status, badge }) => [status, badge]),
);

export const badgeFor = (status: ProjectStatus): string | null =>
  BADGE.get(status) ?? null;

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
