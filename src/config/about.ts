import type { EducationEntry } from "./schema.ts";

/**
 * Facts for the About page.
 *
 * Only verifiable ones. Experience, skills and awards are deliberately absent
 * rather than filled with plausible placeholder text: an invented internship
 * that ships to a live CV is worse than a short one. Add entries here; the page
 * renders whatever it finds.
 */
export const education = [
  {
    institution: "University of Toronto",
    credential: "Double major in Computer Science and Cognitive Science",
    detail: "Minor in Statistics",
    period: "Fourth year",
  },
] as const satisfies readonly EducationEntry[];
