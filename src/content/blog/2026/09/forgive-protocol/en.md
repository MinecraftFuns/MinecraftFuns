---
title: "The FORGIVE protocol"
description: "Fabric-Overload Relief: Gradients under Iteration-Varying Exemption. A receiver acknowledges past the bytes a switch trimmed, under a budget the critical learning regime tightens, so a congested training fabric is paid for in bounded loss rather than in throttled time."
date: "2026-09-08"
tags: ["Essays", "Networking", "Artificial Intelligence", "Performance"]
---

An overloaded training fabric sends you a bill, and until now it came in one of
two currencies. Turn congestion control off and you pay in bytes: on the worst
fabric in my regime map, one offered byte in four was trimmed and carried
again. Turn DCQCN on and you pay in time: the same fabric ran 24 percent
longer, bought with millions of rate cuts, and the trim rate fell sevenfold. A
training job pays one of those bills on every step it takes.

Distributed training can pay in a third currency, because it is one of the few
workloads that can afford to lose some of its own bytes. Not all of them, and
not at every moment. What follows is a protocol that spends that tolerance only
where the fabric is congested and only where the model can afford it. I call it
**F**abric-**O**verload **R**elief: **G**radients under
**I**teration-**V**arying **E**xemption. Each part of that is a condition the
code checks. Relief is granted only under overload, since a trimmed packet is
the only thing that triggers it. Only gradient payload is ever eligible, so
tensor-parallel and pipeline traffic are never touched. And the exemption is
iteration-varying: the budget a step allows tightens during the critical
learning regime, so a flow that would be exempt on step 12 is not on step 2. It
is revocable as well, and the receiver's first refusal to forgive is what
revokes it.

## What the switch already tells you

When a queue fills, a trimming switch does not drop the packet. It truncates the
packet to its header and forwards the header on a lossless control queue, so the
receiver learns which bytes went missing at the moment they went missing rather
than inferring it from a timeout a millisecond later.
[NDP](https://doi.org/10.1145/3098822.3098825) introduced this in 2017, and the
Ultra Ethernet Consortium made it an optional switch behaviour in
[specification 1.0](https://ultraethernet.org/ultra-ethernet-consortium-uec-launches-specification-1-0-transforming-ethernet-for-ai-and-hpc-at-scale/),
released in June 2025, alongside a
[default bulk mode](https://arxiv.org/abs/2508.08906) that sprays packets across
paths and reassembles out of order at the receiver.

That is what makes a receiver-side decision possible at all. A dropped packet
gives the receiver nothing to decide about. A trimmed packet arrives as a
question: here is a range the fabric would not carry, what do you want done
about it. Every transport built so far answers that question the same way, and
the answer is always send it again.

## What the model can afford, and when

Gradient descent is not uniformly fragile.
[Accordion](https://proceedings.mlsys.org/paper_files/paper/2021/hash/acd593d2db87a799a8d3da5a860c028e-Abstract.html)
identifies critical learning regimes from the rate of change in gradient norms,
keeps compression low inside them and compresses hard everywhere else, and
reports up to 5.5 times better compression at accuracy comparable to
uncompressed training. [DBLP](https://arxiv.org/abs/2605.01989) carries that
phase structure into the transport and sheds whole gradient messages at the
sender by a hash draw, tight during the critical period and loose after it.

The quantities are known well enough to size a budget.
[MLT](https://www.usenix.org/conference/nsdi24/presentation/wang-hao) profiled
sixteen CNN and RNN models and found 0.7 to 3.3 percent of gradient bytes
droppable at the same number of rounds and the same accuracy, and 10 percent
when the target is a quality level and more rounds are allowed. At LLM scale,
[Weintraub and colleagues](https://arxiv.org/abs/2507.07114) lose 10 percent of
Llama 2 7B's gradient bytes uniformly at random for 1.17 percent worse
perplexity, and 40 percent for 6.65 percent worse.

So the budget is a per-step probability rather than a constant. In my runs the
critical steps are pinned to 1, 2, 3 and 20, the budget there is 0.005, and
everywhere else it is 0.4. Only gradient all-reduce payload is eligible.
Tensor-parallel traffic, pipeline traffic, control packets and the background
burst are never eligible for anything.

## The budget belongs to a rank and a step

The tolerance claim is about one rank's gradient for one step, so that is the
granularity the ledger is kept at. Every eligible flow registers its byte count
when it is sent, and the rule is that forgiven bytes plus suppressed bytes for a
(rank, step) entry never exceed that step's probability times the eligible bytes
in the entry. Both counters only grow. Nothing is refunded. The entry closes
when that rank's all-reduce for that step completes, and a closed entry forgives
nothing.

Sender-side suppression and receiver-side forgiveness charge the same entry,
which is what lets the two be compared at equal budget. That comparison turns
out to be the whole result, so it was worth designing the accounting around it
before designing anything else.

The receiver's own decision is small. A trimmed packet arrives carrying the
original sequence number and length; the receiver works out how many of those
bytes it does not already hold, since a re-segmented retransmission can straddle
the cumulative acknowledgement point and charging the full length would spend
budget on bytes already in hand. It then either forgives that range, which means
acknowledging past the hole as if the bytes had arrived, or it requests the
range with the trim NACK that a selective-retransmission transport already
sends. An ACK where a NACK would go, and that is the entire mechanism.

## The first version of this saved nothing

I built the receiver-side half first and measured a 4 to 11 percent reduction
in training time, which was wrong. The transport underneath was go-back-N, and a
control run with selective retransmission showed the same congestion burst
costing 29 ms instead of 1.8 s. Under go-back-N every trim made the sender
resend its whole window, up to 79 bytes on the wire for every byte the policy
removed, so what I had measured was the transport's own amplification and not
the policy at all. Go-back-N with no congestion control is a combination nobody
deploys.

The regime map that followed was worse news. Eight fabric configurations, 64
ranks at 400 Gbps, varying congestion control, all-reduce fan-in and spine
oversubscription: the congestion episode cost under 1 percent of the training
window in every one of them. There was nothing there for admission-time
tolerance to shorten. Forgiveness that only skips a repair round can save at
most one round trip per flow, which is under 0.2 percent of an all-reduce, and
that ceiling is arithmetic rather than an artefact of my implementation.

What the map did find was the price of congestion control itself. DCQCN cut the
trim rate by a factor of seven to ten and lengthened the training window by 18
to 24 percent, spending 3.3 to 13.5 million rate cuts per run to do it. That is
a large, repeatable cost paid to avoid trims the model was willing to absorb.

## Ignoring the congestion signal on purpose

So the second half of the protocol takes that finding at its word. A sender
whose trims would be forgiven also stops reacting to congestion signals. It
holds its rate until the receiver refuses to forgive one of its trims, and from
then on it obeys congestion control again. The flow pays for congestion in
bounded loss instead of in reduced rate.

The one non-obvious choice is how wide the exemption has to be. In the DCQCN
configuration here, switches begin ECN-marking at 800 KB of queue and only trim
when the 4 MiB data queue is full, so marks arrive long before trims do. On the
most congested fabric at least 74 percent of rate cuts came from marks that no
forgiven trim ever touches. Exempting a flow only from trim-triggered cuts would
have left three cuts in four in place and built the null result into the design.
An exempt sender therefore ignores every congestion notification, whatever
caused it.

Revocation costs nothing to build. The budget entry is shared by every sender
talking to one rank, so no sender can read it, but a retransmission request is
already a message the receiver sends exactly when it will not forgive. The first
such request on an exempt flow puts that flow back under congestion control and
applies the rate cut it carries. No new packet type, no header change, and the
signal is available on the fabric as it exists.

## What it measured

The matched wave ran the worst cell of the map, three seeds, four arms per seed
drawn from one random selection stream so that the messages the sender-side
baseline suppresses are the same messages the receiver-side arm may forgive.

Against a tight baseline that forgives almost nothing, forgiveness with
exemption shortened the 20-step training window by 12.9, 13.1 and 13.5 percent
across the three seeds. The mechanism acted where it was aimed: the all-reduce
span on non-critical steps fell from 36 ms to 21 ms while the critical-step span
stayed at 37 ms, within 0.9 ms of the baseline, and 16 non-critical steps at
15 ms each account for the whole 218 ms saved. The transport came out calmer,
not wilder. Retransmission timeouts fell by two thirds and rate cuts actually
taken fell by half, because exempt flows leave the leaf switch sooner.

Exempt flows push harder, so the trim rate rose slightly, from 0.031 to 0.033,
and two thirds of those trims were forgiven. Per seed the exempt run ignored
10.4 to 10.9 million congestion notifications, acted on 6.0 to 6.4 million, and
re-armed 12 to 13 thousand of its 71,680 exempt flows. The budget rule held in
every ledger entry.

I also had a pre-registered prediction that a barely congested fabric would show
no movement, on the reasoning that a fabric which hardly trims gives the
mechanism nothing to act on. That was wrong and I withdrew it rather than
reinterpreting it. DCQCN takes 3.3 million rate cuts on that fabric from ECN
marks alone, and the protocol's own reasoning says the exemption acts on those.
It did: the window moved 4 percent, trims doubled, and every one of the
additional trims was forgiven.

## Spending the budget where the congestion is

The comparison that decides whether any of this is worth having is against
phase-aware shedding at the sender, which is DBLP's own move, at the same
budget.

Shedding spends its budget by a blind draw whether or not the fabric is
congested. Forgiveness spends only what the fabric actually trims, and a trim is
the fabric reporting congestion in the one place and at the one moment it
occurred. On the worst cell, the exempt arm lost 8.8 to 9.5 percent of its
gradient bytes where shedding at the same budget lost 32 percent, a factor of
3.4, and the exempt arm's training window was shorter in every seed.

The fourth arm in the wave is worth stating, because on time alone it beats
both. A baseline that sheds 40 percent on every step ran in 1433 to 1466 ms
against the exempt arm's 1459 to 1468. It gets there by shedding through the
critical steps too, which is the one thing the phase structure exists to
prevent, and it gives up 40 percent of the gradient bytes to do it. That arm is
only available to someone who believes the critical learning regime does not
matter, and the whole line of work here starts from believing it does.

That is the argument for the design in one line. Congestion is not uniform in
time, budgets are, and a trim report is the only signal that knows where the
non-uniformity actually is.

## What the number rests on

Four things this work did not test, and I would rather list them than have a
referee find them.

Tolerance is assumed. That a current model survives losing 9 percent of its
gradient bytes on non-critical steps rests on DBLP's evidence over EfficientNet
and ResNet and on Weintraub's 10 percent uniform loss on Llama 2 7B, which
tested no phase dependence. Nobody has published phase-gated gradient loss at
transformer scale, and nobody has measured loss that is bursty and correlated,
which is exactly what a trimming fabric produces. Until a real training run says
otherwise the claim reads at a budget the model is assumed to tolerate.

The congestion control is DCQCN, because that is what the simulator models.
Meta runs its 400 Gbps training fabrics
[with DCQCN off](https://engineering.fb.com/wp-content/uploads/2024/08/sigcomm24-final246.pdf),
where the exemption has nothing to act on, and Ultra Ethernet's own default is
window-based with a trim-triggered fast adaptation that I have not modelled. The
idea transfers to any control that reacts to marks and trims. Nothing here
measures that it does.

There is one tenant. Exempt flows shared the fabric with their own job's
tensor-parallel traffic and a single background burst, never with another job's
flows obeying congestion control. Against those, the cost of the exemption lands
on the neighbour. The budget bounds that cost and the refusal revokes it, which
is more than an unresponsive flow offers and less than a proof.

And the shape is small: 64 ranks with tensor parallelism on the fabric, so the
eligible gradient traffic is only 24 percent of the bytes. That caps the
mechanism at a quarter of what it could reach on a fabric carrying data and
pipeline parallelism alone, which is what NVLink-scale tensor parallelism leaves
behind.

## What was already there

Receiver-side bounded loss for gradient traffic is not new, and it is worth
being precise about which part is.

MLT agrees a tolerated fraction per tensor before training and has the receiver
stop asking for retransmissions once the rest has arrived, so the bytes it gives
up are whichever ones arrive last. Its bound is per model and constant over
training, its congestion control is weakened globally for every flow with no way
back, and its transport is UDP in user space; the authors say RDMA NICs cannot
host it. [LTP](https://arxiv.org/abs/2305.04279) closes a round early based on
network conditions.
[OptiReduce](https://www.usenix.org/conference/nsdi25/presentation/warraich)
bounds each round by an adaptive timeout and makes the resulting loss harmless
with a Hadamard mixing of the gradient.
[Trimmable gradients](https://doi.org/10.1145/3696348.3696880) go furthest and
lay out each packet so that its trimmed prefix is already a quantised gradient,
which removes retransmission entirely at the cost of any bound at all: whatever
the switch trims is accepted. That paper's own future work asks for a congestion
control that deliberately over-sends and lets the switch trim the excess, which
is close to what the exemption does, with the budget it does not have.

What I have added to that list is three things. The verdict is per range and
driven by the switch's own trim report on a selective-retransmission fabric, so
the bytes lost are the ones the fabric refused rather than the ones that
happened to be late. The budget is per receiving rank and training step, charged
by suppression and forgiveness alike, which puts the accounting at the
granularity the tolerance claim is actually made at. And the congestion-control
exemption is per flow, bounded by that budget, and revoked by the receiver's
first refusal.

There are also two findings that reframe the earlier work rather than extend it.
On a trimming fabric with selective retransmission, the tail that MLT, LTP and
OptiReduce were built to cut does not exist; those systems faced TCP and UDP
with millisecond timeouts, and the fabric has since removed that cost. What
remains to buy back is the congestion-control reaction, and forgiveness alone
buys back none of it. The exemption is carrying the entire result, which is not
what I expected when I started, and it took two negative waves to see.

The open question is the one nobody has answered for any of these systems.
Every tolerance number in the literature comes from loss that is uniform and
independent. A trimming fabric produces loss that is bursty, correlated across
ranks, and concentrated exactly on the steps where the network is busiest. Does
a model care about the difference?
