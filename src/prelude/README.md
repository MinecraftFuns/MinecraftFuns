# prelude

The vocabulary the rest of the site is written in. Three modules, and the rule
that keeps them here: **nothing in this directory knows the site exists.** They
import nothing, and any project could take them unchanged.

Everything else lives in `src/lib/`, which is this site's domain: posts, docs,
deployments, keys, host directives.

## Where things live

| Directory                           | Holds                                              | Depends on       |
| ----------------------------------- | -------------------------------------------------- | ---------------- |
| `prelude/`                          | the vocabulary; nothing here knows the site exists | nothing          |
| `schema.ts`                         | what may be written in `config/`                   | `prelude/`       |
| `config/`                           | values you edit, and no declarations               | `schema.ts`      |
| `lib/`                              | this site's domain: posts, docs, keys, deployments | all of the above |
| `components/`, `layouts/`, `pages/` | rendering                                          | `lib/`           |

`config/projects.ts` is the one file holding a declaration, and it holds two:
`ProjectKind` is derived from the data beside it, and `Project` instantiates
the shape from `schema.ts` at that kind. Neither can move upstream of the data
they are derived from.

## The dialect, in five rules

**Parse, do not validate.** An untrusted value becomes a domain value at one
boundary, through one function, and nothing downstream re-checks it. That
function returns `Parsed<T>`, never a boolean.

**Make the invalid unrepresentable, then test what is left.** Prefer a closed
sum, a `readonly` field, a `NonEmpty<T>`, or a branded type over a runtime
guard. Where the checker cannot reach (`until >= since`, two labels on one URL
segment, a byte layout), check once at a boundary and test that check. Do not
do both: a property proved by a type does not need a test, and a test does not
excuse a representable invalid state.

**A brand is minted in exactly one place.** `IsoDate`, `Sluggable`, `WkdHash`,
`PostPath`, `Href`: each has one smart constructor holding the only `as` in its
module. A brand asserted at a call site proves nothing. This is why a type and
its constructor stay in the same file: separating them is what lets the brand
leak.

**Accumulate independent failures, fail fast on dependent ones.** `collect` and
`both` gather every reason, because three bad posts are three facts and one
build. `andThen` is for when the second step genuinely needs the first's value.
Every accumulating check ends in `okUnless(reasons, value)`.

**Eliminate totally.** A `switch` over a sum ends in `assertNever`. A lookup
keyed by a union is a `Readonly<Record<Union, T>>`, so a new variant is a
missing key rather than a lost case. Markup that cannot host a `switch` states
exhaustiveness as a type instead; see `EntryList.astro`.

## Naming a sum

The discriminant is called `tag`. A _kind_ classifies types in the sense of
`*` and `* -> *`; a _tag_ discriminates values of a sum, and that is what this
field does. `kind` survives in two places that are not discriminants:
`ProjectKind` is a domain field naming a section, and `PageIntro`'s `kind` prop
selects a variant that carries no payload, where `tag` would read as an HTML
tag.

Variants that carry nothing need no wrapper at all. `Chrome`, `HrefKind`,
`DeploymentRole` and `Impact` are bare unions of string literals, which is what
an `enum` would be minus the runtime object and the numeric unsoundness; they
are eliminated by `Readonly<Record<Union, T>>`. A field appears only when the
variants differ in what they carry.

## The modules

| Module        | What it gives you                                                  |
| ------------- | ------------------------------------------------------------------ |
| `adt.ts`      | `Parsed<T>` and its eliminators, `NonEmpty<T>`, `assertNever`      |
| `distinct.ts` | `distinctBy` keeps the first per key; `clashesBy` reports the rest |
| `memo.ts`     | `memoiseBy` for keyed work, `once` for a build-wide singleton      |

## Conventions

Tests sit beside the module they test, because the test is where a law is
written down and it should be readable next to the law. Types sit beside their
constructors, for the reason above. Neither is separated into a parallel tree.
