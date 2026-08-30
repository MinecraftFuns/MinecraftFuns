---
title: "Four dimensions, same problem"
description: "A paper on Sider's four-dimensionalist treatment of the Ship of Theseus. Written as a state and a transition function, the four-dimensional view turns out to need exactly what the three-dimensional causal unity account needs, so it inherits that problem rather than escaping it."
date: "2024-04-17"
tags: ["Essays", "Philosophy", "Metaphysics"]
---

> Written for a PHL233 paper assignment, submitted April 17, 2024. The
> assignment set a passage and asked two questions in 500 words: what is the
> author's argument, and what is a reasonable objection to it. Rewritten
> here from the original, with the citations turned into inline links and a
> looser register; the argument is unchanged, and the paper as submitted is
> [available as a PDF](https://ragnarok.joefang.org/static/xqlb5bikhdhe7ok9jt1s0elsc9qiokj06.pdf).
> The passage is
> [Sider, "The Four-Dimensional Picture"](https://doi.org/10.1093/019924443x.003.0001),
> from "Let us return to the question of whether the Ship of Theseus" to
> "the remaining question is the merely conceptual one of which of these
> spacetime worms counts as a ship." The copy I worked from is
> [here](https://ragnarok.joefang.org/static/x6kfkuln5gkpb03b1e4p9i0drhr8cf0jq.pdf).

On the four-dimensional view an object is a sequence of temporal stages,
each made of spatial parts. The Ship of Theseus becomes a series of stages,
each one the planks standing in the harbor at some moment.

Several sequences of stages, several spacetime worms, can be drawn through
the same planks, and they end in different places. Sider's move is that
choosing among them is a matter of what we mean by "ship". He works through
two candidate meanings, the Replacement Worm and the Same Plank worm, each
picking out its own final stage, and allows a third answer where the
question is Indeterminate because more than one worm is equally good.

The metaphysical question, which one is the Ship of Theseus, has become a
conceptual question about what a ship is. Sider grants that this does not
dissolve the paradox, and claims the conversion itself is the achievement:
the metaphysical difficulty is gone.

## Restating the view

There is not much here that is deductively valid, so the passage is best
read as an inference to the best explanation. That is the claim I want to
test.

Take an object to be an initial state $S$, a set whose elements are the
temporal parts that constitute it, together with a transition function $F:
\text{set} \rightarrow \text{set}$, which takes a stage and returns the next
one. That is equivalent to what Sider describes, and it puts the weight
somewhere useful. The transition function is not a trivial object, and it is
doing all the work. Whether it can be defined at all for the Ship of Theseus
is exactly the open question.

## Causal unity, written the other way

Now a three-dimensional view: an object is a causally unified body of
matter. That account works only if "causal unity" can be spelled out, which
is the standard complaint against it.

Suppose a predicate $CU(x)$ returning true when the parts in $x$ are
causally unified. From it a transition function follows immediately: let $F$
return the causally unified stage sharing the most elements with its input.
Now suppose instead we have $F$. A predicate follows just as fast: let
$CU(x)$ return true when $x$ matches the current stage, meaning the output
of the last call to $F$.

The two are codependent. Assume either is achievable and the other is
constructed in a line.

## What the trade actually buys

So a three-dimensional account built on causal unity and a four-dimensional
account built on a transition function stand or fall together. If the causal
unity problem is bad enough to reject the first, the same problem is sitting
inside the second under a different name.

Sider's conversion of the metaphysics into a question about the word "ship"
looks like progress because the difficulty has been moved rather than
answered. Deciding which spacetime worm the planks trace is deciding which
successive stages belong to one object, and that is the causal unity
question in different notation. The four-dimensional picture does not
resolve the puzzle. It relabels it.

---

## Where the objection came from

Four days before the paper was due I put the idea to a friend in a group
chat, and it came out roughly in the order it appears above. The
four-dimensional view runs into the same trouble the traditional one does:
the transition function is hard to define. The traditional view wants an
object to be causally unified, so that the ship before a plank is replaced
and the ship after it count as one thing, and the intuitive version of that
is just that it looks like the same thing. Spelling out causal unity is the
work nobody has done.

Four-dimensionalism inherits the problem whole. Nothing in the picture says
why the current stage goes to this next stage rather than to some other one.
The reply I got was that defining the transition function is the question of
how to understand the ship, asked in different words, so nothing has been
solved. If causal unity could be defined, the three-dimensional view would
work as well as the four-dimensional one, and then the extra apparatus is
being added for nothing.
