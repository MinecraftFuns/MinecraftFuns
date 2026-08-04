import {
  authoredProjects,
  projectKinds,
  type Project,
  type ProjectKind,
} from "../config/projects.ts";
import { collect, invalid, ok, orThrow, type Parsed } from "../prelude/adt.ts";

/**
 * Presentation logic for the project list. The data is config; deciding what to
 * show and in what order is not.
 */

/**
 * `until >= since` is an ordering no type can state, so it is the one thing
 * about a span checked at runtime, once, at the boundary every consumer reads
 * through.
 */
export const wellOrdered = (project: Project): Parsed<Project> =>
  project.until === null || project.until >= project.since
    ? ok(project)
    : invalid(
        `${project.title}: ends in ${project.until} but starts in ${project.since}`,
      );

/** The authored list, checked. Read this rather than the config directly. */
export const projects: readonly Project[] = orThrow(
  collect(authoredProjects.map(wellOrdered)),
  "config/projects.ts",
);

/** Whether work continues. The single fact `until` encodes. */
export const isActive = (project: Project): boolean => project.until === null;

/**
 * The badge a project shows, or `null` for none. Derived, because "archived"
 * and "the span has ended" were two authored claims about one fact.
 */
export const badgeFor = (project: Project): string | null =>
  isActive(project) ? null : "Archived";

/**
 * The span a card shows. Live work runs to the year it is read in, so the
 * range advances on its own rather than wanting an edit every January.
 */
export const spanOf = (project: Project, thisYear: number): string => {
  const end = project.until ?? thisYear;
  return end === project.since ? `${project.since}` : `${project.since}–${end}`;
};

/** The home page shows a selection, not the list; the flag is where it is chosen. */
export const featuredProjects = (): readonly Project[] =>
  projects.filter((project) => project.featured === true);

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
