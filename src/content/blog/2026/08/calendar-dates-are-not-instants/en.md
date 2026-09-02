---
title: A calendar date is not an instant
description: "This site printed Jul 13 for a post dated the fourteenth, with the right date sitting in the datetime attribute beside it. A calendar date and an instant are different things, and TypeScript was happy to call both of them Date."
date: "2026-08-01"
tags: ["TypeScript", "Time"]
---

This site rendered `Jul 13, 2026` for a post I had dated the fourteenth. The
`datetime` attribute sitting right next to it said `2026-07-14`. Both were
reading the same field, which is the sort of thing that makes you go and check
the field before you start suspecting the code.

The line responsible is ordinary enough to read straight past:

```ts
new Date(post.date).toLocaleDateString("en-CA", { /* ... */ });
```

## Two types spelled the same way

`"2026-07-14"` names a box on a wall calendar, not a moment: the fourteenth
begins at different instants in Auckland and in Toronto.

`new Date("2026-07-14")` throws that distinction away. The
[ECMAScript spec](https://tc39.es/ecma262/#sec-date-time-string-format)
parses a date-only ISO string as **UTC midnight**, which is a specific point
on the timeline. `toLocaleDateString` then puts that point back onto a
calendar, and with no `timeZone` option it uses whichever calendar the host
happens to be on. Toronto runs four hours behind UTC in July, so UTC
midnight is still eight in the evening on the thirteenth.

## Why CI never caught it

The build was green. Types checked, tests passed, the site deployed. The bug
only appeared where the clock disagreed with UTC, which meant my laptop and not
CI, and the natural response to a failure that will not reproduce on the build
server is to assume you imagined it.

Nothing in the pipeline had an opinion about the *output* at all. That bothered
me more than the wrong day did.

## Fixing the symptom, or fixing the type

Passing `timeZone` to the formatter prints the right day. It also fixes exactly
one call site, and nothing stops the next one from making the same mistake.

So the calendar date got a type of its own, with the parser as the only way in:

```ts
declare const isoDateBrand: unique symbol;
export type IsoDate = string & { readonly [isoDateBrand]: true };

export const parseIsoDate = (raw: string): Parsed<IsoDate> => { /* ... */ };
```

The brand is erased at runtime, so an `IsoDate` is still a plain string. The
entire point is that you cannot obtain one without going through the parser.

Checking the shape alone would not be enough. `2026-02-31` matches
`YYYY-MM-DD` perfectly well and is not a day. A round trip through `Date.UTC`
catches it, because the constructor quietly rolls it over into March instead of
complaining.

Converting to an actual instant is now something you have to ask for, and it
takes a zone every time, defaulting to the project's own rather than the
machine's. The build produces identical output in Toronto, in Auckland, and in
CI.

## What I took from it

When a value passes through a second type on its way to being displayed, that
conversion takes a parameter whether or not you supply one. Leave it out and
`toLocaleDateString` picks the host's zone, as do `toString` and every
`getDate`-style accessor on `Date`.
