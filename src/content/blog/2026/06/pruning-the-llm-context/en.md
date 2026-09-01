---
title: "Pruning the LLM context beats the maximalist approach"
description: "An agent I built for an HCI study in March could search a chunked psychology textbook, carry memory across tool calls, reach a few MCP servers and run a web search, on every question. Calling all of them every time turned out to be the wrong default."
date: "2026-06-27"
tags: ["Essays", "Artificial Intelligence", "Research Methods"]
---

In late March I was building an agent for an HCI study, and we had a list of
things to connect to it. Cosine similarity over embeddings of a chunked
psychology textbook. A couple of MCP servers. Memory persisting across tool
calls, so the scheduler and the handoff between agents could see what had
already happened. A web search API or two.

Context enrichment tools, I called them. I asked my collaborator whether the
agent needed all of them.

Every one of those tools works. One at a time they improve relevance, each
from its own angle, and nobody disputes that. It does not follow that you
should call all of them on every question and hope the pile adds up to a
better answer.

Everyone knows that setting is expensive, and for a while it was also
affordable. From 2023 to 2025 the market paid for bigger and better models
and treated inference spend as the price of being early. Calling everything
every time was a reasonable bet then: some of it hits, the answer improves,
and the bill belongs to the next funding round. Companies now ask what the
spend buys. Firing every tool at every question is the first thing that
looks wasteful.

We built our list the way everyone does, by asking whether each tool might
help. That question always answers yes.

## From tools to agents

Five tools give thirty-two combinations, and comparing them honestly means
one evaluation run each. I moved it to something easier to measure: four
specialist agents, sixteen subsets counting the empty one, on a physics
slice of [GPQA-Diamond](https://arxiv.org/abs/2311.12022), graduate-level
science written so a search engine does not help. Trimming the agents nobody
needs saves real money.
[Yulang Chen and colleagues](https://arxiv.org/abs/2605.08813) cut token
cost by as much as seventy-nine percent.

A bandit went first. Bandit algorithms decide which slot machine to keep
playing, and this one dropped the specialists not earning their tokens. A
sampler then searched what was left, drawing subsets in proportion to how
well they scored. That catches specialists that only work in combination.

The best combination was two of the four, a domain specialist and a symbolic
checker, at about eighty-five percent. All four scored lower and cost more.
The sampler landed within a point of that pair. I was pleased for about a
week.

## Everything under it was published

Sparse beats dense:
[Yunxuan Li and colleagues](https://doi.org/10.18653/v1/2024.findings-emnlp.427)
swept connectivity in multi-agent debate in 2024 and found sparse
arrangements matching or beating full ones at a fraction of the compute.
[Guibin Zhang and colleagues](https://arxiv.org/abs/2410.02506) pruned the
redundant messages between agents that same year, and gave the redundancy a
formal definition.
[Zhexuan Wang and colleagues](https://doi.org/10.18653/v1/2025.acl-long.1170)
dropped whole agents the year after, cutting prompt tokens by twenty-one
percent, better than anything I managed. Zhang's group came back with
[an agentic supernet](https://arxiv.org/abs/2502.04180) that learns a
distribution over architectures and draws a fresh one per question, with
token cost in the objective.

The two-stage design already had a paper and a name, and the name was the
one I had been using.
[Xuan Yu and colleagues](https://arxiv.org/abs/2602.11491) posted CMAB-GFN
in February, where a combinatorial bandit prunes low-value actions into
compact high-scoring subspaces and the flow network explores inside them.
Same arrangement, same stated reason, and a better paper than the one I
would have written.

I had searched the literature before building. I searched for the name of my
algorithm, and these papers are indexed by what they do, so none came up.
The most useful thing I found came later, while I was checking that the
project was really dead.

## A number you can count

Take your candidates, run each of them on questions you already have answers
for, and count the questions where every candidate got it wrong. Divide by
the number of questions.

Nothing built on those candidates can score above one minus that fraction,
so long as its final answer is one of theirs. Routing, voting, cascades,
debate, running the whole committee: each ends by picking a member's answer,
and where no member is right there is nothing to pick. The bound predates
language models and belongs to the ensemble literature, which calls it the
accuracy of an oracle that always picks a correct member if there is one.
[Josef Chen](https://arxiv.org/abs/2606.27288) restates it for language
models and adds the part that stings: your gain over always using your best
single candidate is that candidate's error rate minus the shared-failure
rate.

Nothing here needs a router. It needs a table of which candidate got which
question right. Everyone builds that table. Almost nobody goes back to it.
If the distance between your best single candidate and that ceiling is
smaller than what orchestration costs, nothing in this class can pay for
itself, and you know before writing any of it.

I had the table. Sixteen rows, eighty-six questions, in the repository the
whole time.

## The gap nobody reaches

The same paper ran that count across sixty-seven models. On multiple-choice
GPQA-Diamond the best single model scored 0.846 against a per-question
oracle at 1.000, fifteen points of headroom. Four trained routers went after
it. The best took nine percent with a confidence interval straddling zero,
and a router built out of a language model sent every question to the
strongest model and took none.

Then they deleted the options from seventy-nine of those questions and ran
them again. The shared-failure rate went from roughly zero to 0.127. Same
questions, same subject, and the ceiling came down on the models' heads,
because a model that cannot produce an answer can still recognise one in a
list.

My evaluation was multiple choice throughout, because GPQA is. It sat where
the headroom is real and nobody has reached it. That is a bad place to stand
and claim your router works. Adding candidates does not fix it. The gain
grows with how differently they fail, and only with the logarithm of how
many there are, so going from four agents to six would have bought about
fourteen percent more headroom for four times the search space.

## A row nobody reports

Reading these systems I kept looking for one number and never found it: how
often the right move is to run almost nothing.

One recent framework rules it out by construction, guaranteeing "at least
two active agents". It carries no single-agent row and no plain single-model
row, though its tightest budget is three cents a question. Another has an
early exit that stops the system after one round, shows two easy questions
taking it in a figure, and never says how often it fires.

The field works hard on who belongs on the committee. Nobody reports how
often it should have been one person. In the same
ceiling paper, majority voting across all four hundred and fifty-five
three-model combinations of one pool did worse on average than the best
single member. [Wenzhe Li and colleagues](https://arxiv.org/abs/2502.00674) found
that taking several answers from the strongest model alone beats mixing
different models by six points on one preference benchmark.

## Transfer was the only result

Which two of the four agents win on a physics slice is a fact about that
slice. A finding would have been transfer: whether a composition learned in
one domain still pays in a neighbouring one.

That is the bar the better work already clears. Zhang's group takes a
supernet trained on MATH, runs it on GSM8K and on three different model
backbones, and reports the cost each time.

Mine could not clear it, and could not be tested either. I scored subsets
against a utility table computed over all eighty-six questions, so the
sampler was fitted to the same numbers that judged it, and nothing in the
design would have caught that. The one study I found asking whether this
family of samplers generalises at all comes from
[Adesh Gupta and colleagues](https://arxiv.org/abs/2503.01819), who
fine-tuned on the Game of 24, tested on the Game of 42, and report that
diversity and accuracy both fall away.

## What I would keep

The count. It costs nothing and runs before the rest, and it would have told
me how little headroom there was before I spent months deciding which subset
should fill it.

All of it measures accuracy, and what I asked in March was about what a
person notices. Those come apart. Last year
[Jijie Zhou and colleagues](https://doi.org/10.1145/3706598.3713701) found
participants rating a system on an eight-billion-parameter open model on par
with the same system on GPT-4o, across a gap in capability and price any
benchmark would show you.

Nobody has run that comparison for what I was actually asking. Whether a
person can tell a sparse configuration from a dense one is unmeasured as far
as I can find, so the field has spent two years optimising the cost of
something without checking whether anyone notices. If they cannot,
firing every tool at every question is a bill we pay to satisfy our own
intuitions about relevance. In March I asked which tools to keep. The
question I should have asked was whether the participants would notice.
