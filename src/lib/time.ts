import { site } from "../config/site.ts";
import { demand, invalid, ok, orThrow, type Parsed } from "../prelude/adt.ts";
import { memoiseBy } from "../prelude/memo.ts";
import { dateLocaleOf, SITE_LANG } from "./lang.ts";

/**
 * Time: zones, calendar dates, and clock reads.
 *
 * Two rules hold everywhere in this project:
 *
 *  1. A calendar date ("2026-07-14") and an instant (a point on the timeline)
 *     are different types. Converting between them requires a zone, and if the
 *     zone is left implicit the runtime supplies the host's, which is how this
 *     site once rendered "Jul 13" for a post dated the 14th.
 *  2. That zone is always the project's configured zone. Never the host's, and
 *     never UTC as a silent fallback. UTC appears below only as an intermediate
 *     arithmetic base, never as a display or clock-reading zone.
 *
 * `Temporal` would express all of this natively, but it does not yet clear the
 * two-year Baseline bar, so the offset resolution is done by hand.
 */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

declare const timeZoneBrand: unique symbol;

/** An IANA zone identifier the runtime has confirmed it can resolve. */
export type TimeZone = string & { readonly [timeZoneBrand]: true };

/**
 * Total. Validation is a construction attempt rather than a lookup in
 * `Intl.supportedValuesOf("timeZone")`, because that list holds only canonical
 * names and would reject working aliases such as "US/Eastern".
 */
export const parseTimeZone = (raw: string): Parsed<TimeZone> => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: raw });
    return ok(raw as TimeZone);
  } catch {
    return invalid(`unknown IANA time zone: ${JSON.stringify(raw)}`);
  }
};

/** Smart constructor. Throws, so a bad zone fails the build rather than a page. */
export const timeZone = (raw: string): TimeZone =>
  orThrow(parseTimeZone(raw), "invalid time zone");

/**
 * The project's canonical zone: the one configurable option this module has.
 *
 * Change this single line to relocate every date the site renders. Everything
 * downstream reads it rather than assuming a zone, and each primitive below
 * also takes an explicit `zone`, so the module stays reusable for content that
 * belongs to some other zone.
 */
export const SITE_TIME_ZONE: TimeZone = timeZone(site.timeZone);

/**
 * Formatting locale of the site's own language: what chrome-context dates,
 * index rows and the footer, are rendered under. Separate from the zone,
 * which they vary independently of, and read from `config/languages.ts`
 * rather than declared again here. A page in another language passes that
 * language's locale to `formatDateIn` explicitly.
 */
const SITE_LOCALE: string = dateLocaleOf(SITE_LANG);

// ---------------------------------------------------------------------------
// Calendar dates
// ---------------------------------------------------------------------------

declare const isoDateBrand: unique symbol;

/**
 * A `YYYY-MM-DD` calendar date verified to name a real day.
 *
 * The brand is erased at runtime: a plain string with zero representation
 * cost. Its only power is that `parseIsoDate`/`isoDate` are the sole way to
 * obtain one, so any value of this type has already been checked.
 */
export type IsoDate = string & { readonly [isoDateBrand]: true };

const ISO_DATE_SHAPE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Total: every string maps to a variant, none throws.
 *
 * Shape alone is insufficient: "2026-02-31" matches the pattern but names no
 * day. Checking that all three components survive a round trip through `Date`
 * rejects it, because the constructor silently overflows February 31st into
 * March 3rd.
 */
export const parseIsoDate = (raw: string): Parsed<IsoDate> => {
  if (!ISO_DATE_SHAPE.test(raw)) {
    return invalid(`expected YYYY-MM-DD, got ${JSON.stringify(raw)}`);
  }

  // Fixed offsets, safe because the shape test already succeeded.
  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(5, 7));
  const day = Number(raw.slice(8, 10));

  // UTC here is pure arithmetic on a calendar triple; no zone is implied, and
  // the value never escapes this function.
  const probe = new Date(Date.UTC(year, month - 1, day));
  const roundTrips =
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day;

  return roundTrips
    ? ok(raw as IsoDate)
    : invalid(`not a real calendar date: ${JSON.stringify(raw)}`);
};

/** Smart constructor for authored content. Throws, failing the build. */
export const isoDate = (raw: string): IsoDate =>
  orThrow(parseIsoDate(raw), "invalid date in site content");

/**
 * Calendar components, read lexically off the fixed-width representation.
 *
 * No zone appears here: a calendar date *has* a year and a month by
 * construction. Recovering them by converting to an instant and asking a clock
 * is what rendered "Jul 13" for a post dated the fourteenth: the conversion is
 * the bug, so the correct implementation refuses to make it.
 */
export const yearOf = (date: IsoDate): string => date.slice(0, 4);
export const monthOf = (date: IsoDate): string => date.slice(5, 7);

/**
 * ISO 8601 was designed so lexicographic order coincides with chronological
 * order for fixed-width dates, so this needs no parsing at all. Total,
 * antisymmetric, and transitive, exactly `toSorted`'s contract.
 */
export const compareIsoDate = (a: IsoDate, b: IsoDate): number =>
  a < b ? -1 : a > b ? 1 : 0;

/**
 * Newest first, without mutating the input.
 *
 * The accessor form is the general one: not every dated record carries its date
 * in a top-level `date` field, while a content-collection entry keeps it under
 * `data`. Taking a projection avoids reshaping records just to sort them.
 */
export const byRecencyWith = <T>(
  items: readonly T[],
  dateOf: (item: T) => IsoDate,
): readonly T[] => items.toSorted((a, b) => compareIsoDate(dateOf(b), dateOf(a)));

/** Partial application of `byRecencyWith` for the common shape. */
export const byRecency = <T extends { readonly date: IsoDate }>(
  items: readonly T[],
): readonly T[] => byRecencyWith(items, (item) => item.date);

// ---------------------------------------------------------------------------
// Zone resolution
// ---------------------------------------------------------------------------

/* Constructing an `Intl` formatter is the expensive half; formatting is
   cheap, so both formatters below are built once per key. */
const wallClockFormatter = memoiseBy(
  (zone: TimeZone) => zone,
  (zone: TimeZone) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }),
);

export type WallClock = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
};

/**
 * What a clock on the wall in `zone` reads at `instant`.
 *
 * The parts are indexed in a single pass. Searching the array once per field
 * would rescan it six times for a list the formatter already returns in one
 * piece, and this runs for every rendered date.
 */
export const wallClockAt = (instant: Date, zone: TimeZone): WallClock => {
  const fields = new Map(
    wallClockFormatter(zone)
      .formatToParts(instant)
      .map((part) => [part.type, Number(part.value)] as const),
  );

  /* Unreachable: `wallClockFormatter` requests all six fields just above. */
  const field = (type: Intl.DateTimeFormatPartTypes): number =>
    demand(fields, type, `the ${zone} formatter`);

  return {
    year: field("year"),
    month: field("month"),
    day: field("day"),
    hour: field("hour"),
    minute: field("minute"),
    second: field("second"),
  };
};

/** Offset of `zone` from UTC at `instant`, in milliseconds. */
const offsetMsAt = (instant: Date, zone: TimeZone): number => {
  const wall = wallClockAt(instant, zone);
  const asIfUtc = Date.UTC(
    wall.year,
    wall.month - 1,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
  );
  // Drop sub-second precision so the comparison is like-for-like.
  return asIfUtc - (instant.getTime() - instant.getMilliseconds());
};

/**
 * The instant at which `date` begins in `zone`.
 *
 * Resolved in two passes because the offset itself depends on the instant: the
 * first pass guesses using the offset at UTC midnight, and the second corrects
 * it using the offset actually in force at that guess. One correction suffices
 * for every real transition, which never exceeds an hour or two.
 *
 * On a spring-forward day whose midnight does not exist, the result lands on
 * the first instant that does, the standard, and only sensible, resolution.
 */
export const startOfDayIn = (date: IsoDate, zone: TimeZone = SITE_TIME_ZONE): Date => {
  const utcMidnight = Date.parse(`${date}T00:00:00Z`);
  const guess = new Date(utcMidnight - offsetMsAt(new Date(utcMidnight), zone));
  return new Date(utcMidnight - offsetMsAt(guess, zone));
};

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/* A space separates the two halves of the key. Neither an IANA zone
   identifier nor a BCP 47 tag may contain one, so no two distinct pairs
   collide. */
const displayFormatter = memoiseBy(
  (zone: TimeZone, locale: string) => `${zone} ${locale}`,
  (zone: TimeZone, locale: string) =>
    new Intl.DateTimeFormat(locale, {
      timeZone: zone,
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
);

/**
 * Renders a calendar date as read in `zone`.
 *
 * The instant is pinned to the start of that day *in the same zone* used to
 * format it, so the value round-trips: the rendered day always equals the
 * authored day, on every build host.
 */
export const formatDateIn = (
  date: IsoDate,
  zone: TimeZone = SITE_TIME_ZONE,
  locale: string = SITE_LOCALE,
): string => displayFormatter(zone, locale).format(startOfDayIn(date, zone));

/** The current year as read in `zone`: the only clock read in the project. */
export const currentYearIn = (zone: TimeZone = SITE_TIME_ZONE): number =>
  wallClockAt(new Date(), zone).year;

// ---------------------------------------------------------------------------
// Site-bound aliases
// ---------------------------------------------------------------------------
//
// Every primitive above already defaults its zone to SITE_TIME_ZONE, so an
// unqualified date is a Toronto date by construction: an author writing
// `date: isoDate("2026-07-14")` has stated a Toronto day and needs to say
// nothing further. These aliases are the vocabulary call sites read best.

export const formatIsoDate = (date: IsoDate): string => formatDateIn(date);

export const currentYear = (): number => currentYearIn();
