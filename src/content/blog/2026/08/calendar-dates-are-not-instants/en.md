---
title: A calendar date is not an instant
description: How a one-line date format shipped the wrong day, and why the fix was a type rather than a patch.
date: "2026-08-01"
tags: ["TypeScript", "Time"]
---

This site rendered `Jul 13, 2026` for a post dated the fourteenth. The
`datetime` attribute beside it said `2026-07-14`. Both came from the same
field.

The offending line was ordinary enough to read past:

```ts
new Date(post.date).toLocaleDateString("en-CA", { /* ... */ });
```

## Two types wearing one costume

`"2026-07-14"` names a box on a wall calendar. It has no hour, and it does not
identify a moment: "the fourteenth" begins at different instants in Auckland
and in Toronto.

`new Date("2026-07-14")` does not preserve that. The ECMAScript spec parses a
date-only ISO string as **UTC midnight**, producing a specific point on the
timeline. `toLocaleDateString` then projects that point back onto a calendar,
and with no `timeZone` option, it uses the host's. Toronto sits five hours
behind UTC in winter, so midnight UTC is still 7pm on the thirteenth.

The value made a round trip through a type that could not hold it, and came
back a day short.

## Why it survived CI

The build was green. Types checked, tests passed, and the site deployed. The
bug reproduced only where the clock disagreed with UTC, which meant it
appeared on my laptop and vanished in CI, the failure mode most likely to be
dismissed as a fluke.

Nothing in the pipeline had an opinion about the *output*. That gap was worth
more attention than the date bug itself.

## The fix is a type

Adding `timeZone` to the formatter would have corrected the symptom. Instead
the calendar date became its own type, with the only route in going through a
parser:

```ts
declare const isoDateBrand: unique symbol;
export type IsoDate = string & { readonly [isoDateBrand]: true };

export const parseIsoDate = (raw: string): Parsed<IsoDate> => { /* ... */ };
```

The brand is erased at runtime: an `IsoDate` is a plain string. Its entire
value is that you cannot obtain one without going through the parser, so any
value of that type has already been checked. Shape alone is not enough:
`2026-02-31` matches `YYYY-MM-DD` and names no day, which a round trip through
`Date.UTC` catches, since the constructor quietly overflows it into March.

Conversions to an instant are now explicit and always take a zone, defaulting
to the project's own rather than the host's. The build produces identical
output in Toronto, Auckland, and CI.

## The general shape

Whenever a value converts through another type to be displayed, the conversion
takes a parameter. Supply it, or the environment will, and the environment
does not know what you meant.
