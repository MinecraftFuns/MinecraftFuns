---
title: "Language as a cognitive scaffold: inner speech and chain-of-thought"
description: "A term essay: inner speech in humans and chain-of-thought prompting in LLMs do the same job, using language to break hard problems into steps. The differences a well-known comparison found are mostly methodology."
date: "2025-04-07"
tags: ["Essays", "Cognitive Science", "Artificial Intelligence"]
---

> Written for a COG250Y1 (Introduction to Cognitive Science) essay assignment,
> submitted April 7, 2025. Rewritten here from the APA manuscript: the
> citations became inline links and the register is looser; the argument is
> unchanged. Recompiled as submitted, the
> [manuscript](https://ragnarok.joefang.org/static/xve6hiit2kcu0einuec1f7mjp9p5g9khi.pdf)
> and its
> [topic proposal](https://ragnarok.joefang.org/static/xeseeg1qn3nql1eagou954qptqp307vbh.pdf)
> are available as PDFs.

Language is not merely a tool for communication;
[it structures cognition itself](https://doi.org/10.1016/j.actpsy.2025.104803).
The Sapir-Whorf hypothesis holds that
[linguistic categories shape thought](https://doi.org/10.1006/cogp.2001.0748);
the Language of Thought Hypothesis replies that
[cognition runs on something deeper than any natural language](https://doi.org/10.1098/rstb.2012.0111).
Large language models have quietly recontextualized this old debate.
[Chain-of-thought prompting](https://arxiv.org/abs/2201.11903) makes a model
reason step by step in words, and the technique looks suspiciously like
[inner speech](https://doi.org/10.1037/bul0000021), the silent verbalization
humans use to manage complex reasoning. I argue the resemblance is not
cosmetic: in both humans and LLMs, language works as a cognitive scaffold
that breaks complex problems into sequential, manageable steps, and the
differences between the two are mostly about who erects the scaffold.

## Shaper and medium of thought

The early Sapir-Whorf formulations said language determines how you perceive
and categorize the world. The strongest evidence is more modest.
[Boroditsky](https://doi.org/10.1006/cogp.2001.0748) showed that English
speakers reach for horizontal metaphors when thinking about time ("ahead",
"behind") while Mandarin speakers use vertical ones more often: language
biases attention and processing, but the effect is modulatory, not absolute.
[Later cross-linguistic work](https://doi.org/10.1371/journal.pone.0158725)
sharpened this into a neo-Whorfian position: lexical categories measurably
shift memory and attention, yet speakers of different languages share one
perceptual framework underneath. Language organizes cognitive material; it
does not fence it in.

The Language of Thought Hypothesis pulls the other way: cognition operates
over an internal symbolic system, "Mentalese", independent of any spoken
language. [Recent reviews](https://doi.org/10.1017/S0140525X22002849) find
mental representations behaving compositionally, the way linguistic syntax
does, and current versions of the hypothesis allow a dual system: innate
representational machinery, refined and shaped by natural-language input.
Both camps end up somewhere compatible: language biases and organizes
thought as a flexible tool rather than a rigid determinant, which is exactly
the property a scaffold has.

## What the brain shows

People with aphasia, whose language production is severely impaired, keep
[mathematical reasoning and spatial navigation largely intact](https://doi.org/10.1111/nyas.13046):
core cognition survives without language. Neuroimaging agrees, up to a
point. Classical language areas engage selectively for linguistic tasks
while abstract reasoning recruits frontal and parietal circuits, but during
complex tasks the language regions
[co-activate with the circuits for executive control and working memory](https://doi.org/10.1093/scan/nsv094).
Language-based rehearsal
[helps memory retrieval](https://doi.org/10.1016/j.concog.2019.03.005),
verbal labels
[improve discrimination and categorization](https://doi.org/10.1016/j.plrev.2018.12.001),
and disrupting language areas with TMS
[impairs verbal reasoning while sparing nonverbal problem-solving](https://doi.org/10.3390/brainsci13010067).
Thought does not need language; language organizes and amplifies it. That is
what a scaffold does.

## Inner speech

[Alderson-Day and Fernyhough](https://doi.org/10.1037/bul0000021)
distinguish condensed inner speech, brief directive cues, from expanded
inner speech, a full narrative dialogue with yourself. Both do real work.
In [Baddeley's model of working memory](https://doi.org/10.1016/S0079-7421(08)60452-1)
the phonological loop rehearses verbal information through inner speech, and
articulatory suppression, forcing someone to repeat an irrelevant word,
sharply degrades memory performance.
[Jorba and Vicente](https://philpapers.org/rec/JORCPA) describe how adults
monitor and adjust their own problem-solving through internal dialogue,
talking themselves through the steps of a task. Even the phrasing matters:
[third-person self-talk measurably improves emotion regulation](https://doi.org/10.1038/s41598-017-04047-3)
without recruiting extra cognitive control. Inner speech is not a byproduct
of thinking. It is one of the mechanisms.

## Chain-of-thought, the artificial analog

[Wei and colleagues](https://arxiv.org/abs/2201.11903) showed that a few
exemplars of step-by-step reasoning dramatically improve LLM performance on
arithmetic and symbolic tasks. The prompt makes the model think aloud, and
the parallel to human practice is
[explicit in the prompting literature](https://arxiv.org/abs/2209.08141):
humans also perform better when they
[verbalize their process](https://doi.org/10.1016/0361-476X(86)90030-5),
and [explaining a problem, even to yourself](https://doi.org/10.1111/j.1551-6709.2010.01113.x),
promotes the kind of generalization that
[shows up reliably in education research](https://www.edweek.org/leadership/students-can-learn-by-explaining-studies-say/2013/05).
The follow-up techniques double down on process over answer:
[sampling multiple chains and voting](https://arxiv.org/abs/2203.11171),
[searching over trees of intermediate thoughts](https://arxiv.org/abs/2305.10601).
And the chain is legible, which is worth something on its own:
[in medicine, reasoning prompts make the model's diagnostic path auditable](https://doi.org/10.1038/s41746-024-01010-1),
the machine equivalent of a student required to show their work.

## The reported divergence, examined

The strongest counterargument comes from
[Yax, Anlló, and Palminteri](https://doi.org/10.1038/s44271-024-00091-8),
who gave new variants of classic cognitive tests to both humans and LLMs.
Chain-of-thought prompting markedly improved the models; analogous prompts
did not much improve the humans. They read this asymmetry as a difference
between human and machine reasoning. I think the study shows something else.

First, the human sample was psychology students, a population
[already known to be unrepresentative](https://doi.org/10.1016/j.jecp.2017.04.017)
of human cognition at large; participants trained in formal logic might have
responded to structured prompts quite differently. Second, the test items
were rewritten to avoid training-data contamination but
[never validated for difficulty](https://doi.org/10.3389/fpubh.2018.00149),
so nobody knows whether the human and model versions of the task were even
comparable. Third, and most importantly, the asymmetry has a simpler
explanation: humans already run inner speech. An external prompt telling a
person to think step by step is redundant scaffolding on top of scaffolding
they generate themselves, while a model, which has no spontaneous inner
dialogue, gets its entire scaffold from the prompt. Read this way, the
finding is not evidence against the parallel. It is the parallel.

The positive case is that both systems lean on language for the same
operation: decomposition.
[Dove calls language a neuroenhancement](https://doi.org/10.1080/02643294.2019.1637338),
[Fernyhough and Borghi describe inner speech as a cognitive tool](https://doi.org/10.1016/j.tics.2023.08.014),
and [Lupyan and Bergen argue language effectively programs the mind](https://doi.org/10.1111/tops.12155).
On the machine side,
[Goldstein and colleagues found shared computational principles](https://doi.org/10.1038/s41593-022-01026-4)
between human language processing and deep language models. The mechanisms
differ, spontaneous in one case and externally cued in the other, but the
function is the same.

## What follows

If language is the scaffold, some things follow. For education, explicit
verbal strategy, thinking aloud and structured self-talk, is not a crutch
but the mechanism working as designed. For AI,
[reasoning-in-language is also a window into the system](https://doi.org/10.1016/j.tics.2024.07.007),
and architectures that
[borrow the developmental role of inner speech](https://philsci-archive.pitt.edu/24473/)
are a live research direction, with
[language treated as a cognitive and social tool for machines too](https://doi.org/10.1007/s41809-024-00152-8).
The parallel even predicts failures: chain-of-thought
[hurts model performance on exactly the kinds of tasks where deliberation hurts humans](https://arxiv.org/abs/2410.21333),
which is a strange coincidence unless the scaffold really is shared. And if
it is shared, then
[the debate about whether these systems understand anything](https://doi.org/10.1073/pnas.2215907120)
has to reckon with the fact that human understanding leans on the same
linguistic machinery it wants to reserve for itself.

The differences the critics measure are real, but they are differences in
how the scaffold gets built: humans grow their own, and models need it
handed to them in the prompt. What is shared is the scaffold.
