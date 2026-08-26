/**
 * The control vocabulary.
 *
 * In a module rather than in `Button.astro` because `.astro` frontmatter
 * exports are not importable, and both the card and the gate need to name
 * these; `intro.ts` is here for the same reason.
 *
 * The tone list is the single declaration: the union is read off it, so a
 * tone cannot exist in the type and be missing from the runtime list, and
 * `toneClass` derives the class name rather than looking it up. A lookup
 * table would admit a fourth invalid state on top of the ones the stylesheet
 * already closed, the misspelt value, which renders as unstyled markup that
 * no build step notices.
 */

/** Every tone there is; the type is read off this list. */
export const TONES = ["primary", "secondary", "quiet"] as const;

/** How loudly a control rests. The gesture is identical across all three. */
export type ControlTone = (typeof TONES)[number];

/** `control` is full-size, `compact` the tag-sized WCAG target, `nav` the masthead. */
export type ControlSize = "control" | "compact" | "nav";

/**
 * The class a tone names. The return type is the closed set of three strings
 * the stylesheet defines, so a name that is not one of them cannot be built
 * here and cannot be passed anywhere expecting one.
 */
export const toneClass = (tone: ControlTone): `control-${ControlTone}` =>
  `control-${tone}`;

/** Geometry and type role per size; colour belongs to the tone. */
export const SIZE: Readonly<Record<ControlSize, string>> = {
  control: "min-h-control px-sm text-control",
  compact: "min-h-target px-2xs py-3xs text-body-sm",
  /* Regular weight, unlike the other two: a masthead lists, it does not urge. */
  nav: "min-h-control px-2xs text-body xs:px-xs",
};

/** Shared geometry: every control is an inline box with the same corner. */
export const CONTROL_BASE = "inline-flex items-center rounded-md no-underline";

/**
 * How an icon sits inside a line of text: sized in `em` so it tracks
 * whichever label it accompanies, and never squeezed when the line wraps.
 * One decision, spread at every inline-icon site rather than respelled.
 */
export const INLINE_ICON = { class: "shrink-0", size: "1em" } as const;
