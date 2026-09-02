---
title: "Upgrading the Turing Test beyond imitation"
description: "A term essay: the Turing Test rewards convincing conversation, and Eugene Goostman showed convincing is cheap. Telling imitation from understanding means looking inside the model, at its attention and activations."
date: "2024-12-09"
tags: ["Essays", "Cognitive Science", "Artificial Intelligence"]
---

> Written for a COG250Y1 (Introduction to Cognitive Science) essay assignment,
> submitted December 9, 2024. Rewritten here from the APA manuscript: the
> citations became inline links and the register is looser; the argument is
> unchanged. The manuscript, recompiled as submitted, is
> [available as a PDF](https://ragnarok.joefang.org/static/xuk34p6eh2hl8ehhpd8uadpv2ue0j45i6.pdf).

Since [Turing's 1950 paper](https://doi.org/10.1093/mind/LIX.236.433), the
field he helped start has come a long way, and the benchmark he proposed,
the imitation game, has aged badly. The test asks one question: can a
machine hold up its end of a conversation well enough that a human judge
cannot tell it from a person? Language models now do this routinely while
often lacking any deep grasp of the language they produce. The models that
make this urgent are the weaker ones, the systems nobody considers
human-level that pass the original test anyway; frontier work like [OpenAI's
o1](https://arxiv.org/abs/2409.18486) is a separate question. I want an
evaluation that separates intelligence from imitation.

## What the test actually measures

The Turing Test grades a machine on mimicking human conversation and asks
nothing about the thinking behind it. It measures performance, not
comprehension. Focusing on behavior instead of
["internal state"](https://doi.org/10.1007/s11023-022-09616-8) confuses
imitation with mental capability, and a judgment built on surface-level
interaction misses most of what human thinking is actually doing.

## Fooling it is cheap

Today's models produce human-like responses by leveraging statistical
patterns in text; whether they understand those patterns is exactly the open
question. Measurements even show the two abilities pulling apart: [Ye and
colleagues](https://arxiv.org/abs/2303.10420) found that tuning GPT models
on [human feedback](https://arxiv.org/abs/1706.03741) makes their responses
more human-like while compromising their performance on some tasks. Sounding
human and solving problems are not the same skill, and the Turing Test only
checks the first.

The test was being gamed before large language models existed. In a [2014
experiment at the Royal
Society](https://doi.org/10.1080/0952813X.2015.1055826), a chatbot called
Eugene Goostman convinced more than 30% of its human judges that it was
human. Its trick was persona: it played [a 13-year-old Ukrainian boy writing
in his second
language](https://www.npr.org/2014/06/09/320375613/in-a-landmark-first-an-ai-program-fools-the-turing-test),
which lowered expectations enough that evasions and jokes read as
personality. Scott Aaronson [published his conversation with
it](https://scottaaronson.blog/?p=1858), and the responses are nonsense the
moment the questions have answers. Warwick and Shah, who ran the experiment,
later wrote plainly that ["passing the Turing Test has no relationship with
human-like intelligence"](https://doi.org/10.1007/s12559-015-9372-6).
Turing's own claim, that passing implies thinking, is just as debatable:
human conversation tolerates indirect answers, jokes, and tricks, so a
machine can appear human precisely by dodging the parts that would require
thought.

And through all of this, the test says nothing about how the system works
inside. It only sees outputs. Two machines could pass identically, one by
lookup and one by reasoning, and the test could not tell them apart.

## Attention and activations

If the failure is that we only watch behavior, the fix is to also watch the
processing. For current models we have two windows into that: attention and
activations.

[Attention mechanisms](https://doi.org/10.1007/s00521-022-07366-3) let a
model weight the parts of its input by relevance, roughly the way we focus
on some elements of a scene and ignore the rest. In the
[transformer architecture](https://arxiv.org/abs/1706.03762) these weights
are explicit numbers, so we can read off which parts of the input the model
treated as significant when it formed its response.

Attention tells us what mattered; activation patterns tell us what happened
to it. [Zeiler and Fergus](https://doi.org/10.1007/978-3-319-10590-1_53)
showed for convolutional networks that watching which nodes fire on which
inputs maps the internal representations of the model, layer by layer, and
[later work](https://arxiv.org/abs/2206.10611) extends the idea. That map is
what lets us ask whether the model generalizes what it learned or merely
recalls it, which is much closer to what we mean by understanding than any
transcript of its conversation.

## The upgraded test

The evaluation I want keeps behavioral testing but stops trusting it alone.

On the behavioral side, the upgrades are known and already accepted.
Task-specific batteries like
[BIG-bench](https://arxiv.org/abs/2206.04615), whose name is literally
"Beyond the Imitation Game", probe problem-solving and decision-making
instead of dialogue similarity.
[Human-in-the-loop evaluation](https://doi.org/10.1007/s10462-022-10246-w)
keeps people in the judgment for the qualities no metric captures, such as
empathy and creativity.

The core upgrade is internal analysis. Combine attention visualization with
activation analysis and you can trace how information flows through the
model and what logic supports its decisions. Interpretability tools like
[LIME](https://arxiv.org/abs/1602.04938) and
[SHAP](https://arxiv.org/abs/1705.07874) make the same processes legible one
prediction at a time, so we can check whether the path to an answer
resembles reasoning or resembles pattern-matching that happens to land. A
model passes this test only when its processing holds up under inspection.

## Where this falls short

I cannot say whether [GPT-4o](https://arxiv.org/abs/2410.21276) or
[o1](https://arxiv.org/abs/2409.19924) would pass the upgraded test. These
models still stumble on trivially simple questions, the persistent "9.11 >
9.8" comparison being the canonical example, which suggests their grasp of
fundamental concepts is thinner than their fluency implies. And the specific
tools named here will age; LIME and SHAP will be superseded by better
interpretability methods. But the diagnosis does not depend on the tools. A
test that only watches behavior cannot tell imitation from understanding,
and any evaluation that wants to measure machine intelligence, rather than
machine theater, has to open the machine.
