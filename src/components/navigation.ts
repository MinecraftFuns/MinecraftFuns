import ArrowLeft from "@lucide/astro/icons/arrow-left";
import ArrowRight from "@lucide/astro/icons/arrow-right";

/**
 * Which way a control carries the reader, and the arrow that says so.
 *
 * The glyph and the side it sits on are one decision, not two. An arrow
 * pointing back belongs before the label because that is the direction it
 * travels through the line; an arrow pointing on belongs after it. Pairing
 * them here means the combination that reads backwards, a left arrow
 * trailing its label, cannot be written down.
 *
 * Direction is a property of a component's role rather than a choice a page
 * makes: a section's trailing control always goes deeper into an index, and
 * a back link always returns from one. Neither call site is asked.
 */

/** Every direction there is; the type is read off this list. */
export const DIRECTIONS = ["forward", "back"] as const;

export type Direction = (typeof DIRECTIONS)[number];

/** The icon components are Astro factories; take the type from one of them. */
type ArrowIcon = typeof ArrowRight;

/** An arrow, and the side of the label it belongs on. */
export type Arrow = {
  readonly icon: ArrowIcon;
  /** Whether the arrow precedes the label. */
  readonly leads: boolean;
};

export const ARROW: Readonly<Record<Direction, Arrow>> = {
  forward: { icon: ArrowRight, leads: false },
  back: { icon: ArrowLeft, leads: true },
};
