---
title: "Functional correspondence without isomorphism: evaluating the brain-ANN analogy"
description: "A term essay: the brain does not run backpropagation, and language models still out-predict neuroscientists on their own literature. Marr's levels let both be true; the brain-ANN analogy lives at the computational level."
date: "2025-11-24"
tags: ["Essays", "Cognitive Science", "Artificial Intelligence"]
---

> Written for a PSY290H1F (Behavioural Neuroscience) written assignment,
> submitted November 24, 2025. Rewritten here from the APA manuscript: the
> citations became inline links and the register is looser; the argument is
> unchanged. The manuscript, recompiled as submitted, is
> [available as a PDF](https://ragnarok.joefang.org/static/xdra88a3gk7f0ve3atnon5dq7clq5eilv.pdf).

Large neural networks and the human brain now turn in strikingly similar
behavioral performances on object recognition and language understanding,
and the tempting conclusion, that they are
[the same kind of system](https://doi.org/10.1016/j.neuron.2017.06.011),
[gets voiced regularly](https://www.theverge.com/2017/7/19/15998610/ai-neuroscience-machine-learning-deepmind-demis-hassabis-interview).
Behavioural neuroscience has a precise word for the strong version of that
claim:
[isomorphism](https://doi.org/10.1016/j.nlm.2013.10.021), a
structure-preserving mapping in which a model's parts and operations
correspond one-to-one with identifiable biological mechanisms. My position:
the evidence rejects isomorphism at the implementation level, and still
supports a restricted, genuinely explanatory correspondence at the
computational level. The two halves of that sentence are not in tension,
and sorting out why they are not is the point of this essay.

## The learning rules do not match

Biological synaptic plasticity is local and activity-dependent. Hebbian
learning and spike-timing-dependent plasticity update a synapse from the
activity of the two neurons it connects, and decades of work on
[long-term potentiation and depression](https://doi.org/10.1016/j.neuron.2004.09.012)
show neuromodulators like dopamine
[gating that plasticity by behavioral significance](https://doi.org/10.1038/s41583-020-0277-3),
not by any single scalar loss. Cortical circuits assign credit through
distributed local rules, under constraints of biophysics and
[developmental history](https://doi.org/10.1038/npp.2009.115). No neuron
sees a global error signal.

Deep networks are trained by
[backpropagation](https://doi.org/10.1038/nature14539), which needs exactly
what cortex does not have: weight copies shared between forward and
backward passes, symmetric connectivity between layers, and a loss gradient
propagated precisely, layer by layer. The interesting test of whether the
brain could be doing something backpropagation-like comes from
[Shervani-Tabar and Rosenbaum](https://doi.org/10.1038/s41467-023-37562-1),
who meta-learned plasticity rules constrained to be biologically plausible,
using fixed random feedback pathways instead of exact weight transport. The
discovered rules train deep networks online and beat earlier
random-feedback methods, yet still typically reach only 70 to 80 percent of
backpropagation's performance. Even optimized as hard as we know how,
biologically constrained learning does not converge on gradient descent.
The brain solves credit assignment some other way. On learning rules, the
isomorphism claim is dead.

## And yet the models predict neuroscience

The natural next step would be dismissing deep networks as engineering
tricks with nothing to say about brains. The recent evidence refuses to
cooperate. [BrainBench](https://doi.org/10.1038/s41562-024-02046-9) is a
forward-looking benchmark: given two versions of a neuroscience abstract,
the original and one with a subtly altered result, decide which one
reports what the experiment actually found. Across two hundred such cases,
large language models scored about 81 percent; human neuroscience experts
averaged about 63. BrainGPT, a Mistral-7B tuned further on the neuroscience
literature, did better still, and the models' confidence tracked their
correctness, which suggests they had internalized real regularities about
methods and plausible outcomes rather than guessing fluently.

Whatever is happening there, both the experts and the models face the same
abstract problem: from partial descriptions of methods and prior findings,
infer the most likely outcome. Predictive learning over the literature
turns out to be sufficient for that task at expert level and beyond. And
the parallel extends to how abilities arrive:
[emergent abilities in LLMs](https://arxiv.org/abs/2206.07682) appear
abruptly once scale and training cross thresholds, the way fluent language
comprehension and fine-grained visual recognition emerge in development
only after extended exposure during sensitive periods, a trajectory the
course's lectures on neurodevelopment and learning trace in detail. A
system with none of the brain's learning machinery still reproduces the
shape of the brain's learning curves.

## Marr sorts the ledger

[Marr's three levels](https://doi.org/10.7551/mitpress/9780262514620.001.0001)
hold the two halves apart cleanly. The computational level asks what problem
the system solves and under what constraints; the algorithmic level asks how
information is represented and transformed; the implementational level asks
what hardware runs it. [Ku and colleagues](https://arxiv.org/abs/2503.13401)
argue that LLMs, like the cognitive models before them, should be compared
to minds primarily at the computational level, with the lower levels treated
far more cautiously.

Read the evidence through that frame and the ledger balances. The
learning-rule mismatch lives at the algorithmic and implementational
levels; that is where isomorphism fails, and the meta-learning results
quantify by how much. BrainBench and the emergence parallels live at the
computational level; that is where the correspondence is real, and where a
model can earn explanatory standing the way
[Guest and Martin](https://doi.org/10.1177/1745691620970585) say any
computational model must: by predicting, and by generating hypotheses
someone can test. The course's methods lectures add the caution that keeps
this honest: predictive accuracy alone never proves shared mechanism. A
model can be right for reasons the brain does not use, which is exactly
what the learning-rule evidence says is happening.

## The level it earns

The brain does not run backpropagation, and no amount of benchmark
performance makes it so. But a model does not need to share the brain's
mechanisms to tell us something true about the problems the brain solves.
Large networks are not replicas of nervous systems. They are working
demonstrations that certain computational problems admit solutions at all,
and of what those solutions require: integrating noisy findings into
predictions, growing abrupt capabilities out of gradual experience. That is
a real contribution, made at exactly one of Marr's levels, and it survives
every difference in wiring.