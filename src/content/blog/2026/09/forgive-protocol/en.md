---
title: "The FORGIVE protocol"
description: "Fabric-Overload Relief: Gradients under Iteration-Varying Exemption. A receiver acknowledges past the bytes a switch trimmed, under a budget the critical learning regime tightens, so a congested training fabric is paid for in bounded loss rather than in throttled time."
date: "2026-09-08"
tags: ["Essays", "Networking", "Artificial Intelligence", "Performance"]
---

Congestion control and packet loss impose different costs on a training fabric.
With congestion control off, the most congested fabric in my regime map trimmed
one offered byte in four and carried it again. With DCQCN on, the same fabric
ran 24 percent longer. Its senders took millions of rate cuts, and the trim rate
fell sevenfold. A training job pays one of those costs on every step.

Gradient descent can tolerate losing some gradient bytes, though neither at
every step nor at any rate. I call the protocol **F**abric-**O**verload
**R**elief: **G**radients under **I**teration-**V**arying **E**xemption. It
uses that tolerance when a trimming switch reports congestion. It can forgive
only gradient payload and only after a trim, leaving tensor-parallel and
pipeline traffic alone. The budget tightens during the critical learning regime,
so a flow eligible on step 12 may be ineligible on step 2. The first trim the
receiver cannot forgive puts the flow back under congestion control.

## A trim reports a missing range

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

A dropped packet gives the receiver no range to decide about. A trimmed packet
does. This selective-retransmission transport retransmits every reported range.

## Gradient tolerance varies by step

Gradient descent is not uniformly fragile.
[Accordion](https://proceedings.mlsys.org/paper_files/paper/2021/hash/acd593d2db87a799a8d3da5a860c028e-Abstract.html)
identifies critical learning regimes from the rate of change in gradient norms,
keeps compression low inside them and compresses hard everywhere else, and
reports up to 5.5 times better compression at accuracy comparable to
uncompressed training. [DBLP](https://arxiv.org/abs/2605.01989) applies that
phase structure to transport. It sheds whole gradient messages at the sender by
a hash draw, tight during the critical period and loose after it.

[MLT](https://www.usenix.org/conference/nsdi24/presentation/wang-hao) profiled
sixteen CNN and RNN models and found 0.7 to 3.3 percent of gradient bytes
droppable at the same number of rounds and the same accuracy, and 10 percent
when the target is a quality level and more rounds are allowed. At LLM scale,
[Weintraub and colleagues](https://arxiv.org/abs/2507.07114) lose 10 percent of
Llama 2 7B's gradient bytes uniformly at random for 1.17 percent worse
perplexity, and 40 percent for 6.65 percent worse.

My budget is a per-step probability. In my runs, critical steps 1, 2, 3 and 20
have a budget of 0.005; every other step has a budget of 0.4. Only gradient
all-reduce payload is eligible. Tensor-parallel traffic, pipeline traffic,
control packets and the background burst are ineligible.

## Accounting

The ledger records one rank's gradient for one step. Every eligible flow
registers its byte count when it is sent. Forgiven bytes plus suppressed bytes
for a (rank, step) entry never exceed that step's probability times the eligible
bytes in the entry. Both counters grow and neither refunds bytes. An entry
closes when that rank's all-reduce for the step completes. Closed entries
forgive nothing.

Sender-side suppression and receiver-side forgiveness charge the same entry. I
compare them at equal budget. That comparison is the main result.

A trimmed packet carries its original sequence number and length. The receiver
calculates how many of those bytes it does not already hold. A re-segmented
retransmission can straddle the cumulative acknowledgement point, so charging
the full length would spend budget on bytes already in hand. The receiver either
forgives the range and acknowledges past the hole as if the bytes arrived, or
it requests the range with the trim NACK that a selective-retransmission
transport already sends. It sends an ACK when it forgives and a trim NACK when
it does not.

## Selective retransmission removes the gain

I built the receiver-side half first. It appeared to reduce training time by 4
to 11 percent. The transport underneath was go-back-N, and a control run with
selective retransmission showed the same congestion burst costing 29 ms instead
of 1.8 s. Under go-back-N every trim made the sender resend its whole window,
up to 79 bytes on the wire for every byte the policy removed. I had measured
the transport's amplification rather than the policy. Nobody deploys go-back-N
without congestion control.

The regime map that followed was worse news. Eight fabric configurations, 64
ranks at 400 Gbps, varying congestion control, all-reduce fan-in and spine
oversubscription: the congestion episode cost under 1 percent of the training
window in every one of them. Admission-time tolerance could not shorten enough
of the training window. Forgiveness that only skips a repair round can save at
most one round trip per flow. This is under 0.2 percent of an all-reduce.

The map found a cost from congestion control. With DCQCN, the trim rate was
lower by a factor of seven to ten and the training window was 18 to 24 percent
longer. Senders took 3.3 to 13.5 million rate cuts per run. The model could
absorb the trims it avoided.

## Rate-control exemption

A sender whose trims are eligible for forgiveness also stops reacting to
congestion signals. It holds its rate until the receiver requests a
retransmission for one of its trims. The sender then obeys congestion control
again. Its lost bytes remain within the budget.

The exemption covers ECN marks and trim notifications. In the DCQCN
configuration here, switches begin ECN-marking at 800 KB of queue and trim only
when the 4 MiB data queue is full. Marks arrive long before trims. On the most
congested fabric, at least 74 percent of rate cuts came from marks that no
forgiven trim affects. Exempting only trim-triggered cuts would leave three
cuts in four in place. Eligible senders ignore every congestion notification.

Every sender talking to a rank shares its budget entry, so no sender can read
it. A retransmission request already tells the sender that the receiver will
not forgive a trim. The first request on an exempt flow puts that flow back
under congestion control and applies its rate cut. It needs no new packet type
or header change.

## Results

The matched wave ran the worst cell of the map. It used three seeds and four
arms per seed drawn from one random selection stream. The sender-side baseline
suppresses the same messages that the receiver-side arm may forgive.

Against a tight baseline that forgives almost nothing, forgiveness with
exemption shortened the 20-step training window by 12.9, 13.1 and 13.5 percent
across the three seeds. The all-reduce span on non-critical steps fell from 36
ms to 21 ms. The critical-step span stayed at 37 ms, within 0.9 ms of the
baseline. Sixteen non-critical steps at 15 ms each account for the 218 ms saved.
Retransmission timeouts fell by two thirds and rate cuts actually taken fell by
half because exempt flows leave the leaf switch sooner.

Exempt flows push harder, so the trim rate rose slightly, from 0.031 to 0.033,
and two thirds of those trims were forgiven. Per seed the exempt run ignored
10.4 to 10.9 million congestion notifications, acted on 6.0 to 6.4 million, and
re-armed 12 to 13 thousand of its 71,680 exempt flows. The budget rule held in
every ledger entry.

I preregistered a prediction that a barely congested fabric would show no
movement because it hardly trims. That prediction was wrong, and I withdrew it.
DCQCN takes 3.3 million rate cuts on that fabric from ECN marks alone. The
exemption applies to those marks. The window moved 4 percent, trims doubled,
and the receiver forgave every additional trim.

## Forgiveness uses the budget at congestion

[DBLP](https://arxiv.org/abs/2605.01989) uses phase-aware shedding at the
sender. I compare it with receiver-side forgiveness at the same budget.

Shedding spends its budget by a random draw whether or not the fabric is
congested. Forgiveness spends budget only on bytes the fabric trims. On the
worst cell, the exempt arm lost 8.8 to 9.5 percent of its gradient bytes;
shedding at the same budget lost 32 percent, a factor of 3.4. The exempt arm's
training window was shorter in every seed.

A baseline that sheds 40 percent on every step ran in 1433 to 1466 ms, against
the exempt arm's 1459 to 1468 ms. It also sheds through the critical steps and
gives up 40 percent of the gradient bytes. That conflicts with the critical
learning regime assumed by the work here.

Congestion varies over time. A trim report identifies the range and moment
where the fabric would not carry the traffic.

## Limits

Whether a current model tolerates losing 9 percent of its gradient bytes on
non-critical steps is assumed, not tested. DBLP tested EfficientNet and ResNet;
Weintraub tested 10 percent uniform loss on Llama 2 7B without phase dependence.
Nobody has published phase-gated gradient loss at transformer scale or measured
loss that is bursty and correlated, which a trimming fabric produces. The budget
is an assumed tolerance until a training run tests it.

The congestion control is DCQCN, because that is what the simulator models.
Meta runs its 400 Gbps training fabrics
[with DCQCN off](https://engineering.fb.com/wp-content/uploads/2024/08/sigcomm24-final246.pdf),
where the exemption has nothing to act on. Ultra Ethernet's default is
window-based with a trim-triggered fast adaptation that I have not modelled.
The idea may transfer to controls that react to marks and trims. I have not
measured that transfer.

The simulation has one tenant. Exempt flows shared the fabric with their own
job's tensor-parallel traffic and a single background burst, never with another
job's flows obeying congestion control. The cost of the exemption would fall on
such a neighbour. The budget bounds that cost, and the refusal revokes the
exemption. An unresponsive flow offers neither measure. Neither proves the cost
is acceptable to a neighbour.

The simulation has 64 ranks with tensor parallelism on the fabric, so eligible
gradient traffic is only 24 percent of the bytes. The mechanism can therefore
reach at most a quarter of the traffic available on a fabric carrying data and
pipeline parallelism alone. NVLink-scale tensor parallelism leaves that traffic
on the fabric.

## Prior work

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
[Trimmable gradients](https://doi.org/10.1145/3696348.3696880) lay out each
packet so that its trimmed prefix is already a quantised gradient. This removes
retransmission entirely, without a bound: whatever the switch trims is accepted.
That paper's future work asks for a congestion control that deliberately
over-sends and lets the switch trim the excess. The exemption has that behaviour
within a budget.

FORGIVE decides per range from the switch's trim report on a
selective-retransmission fabric. The lost bytes are the ones the fabric refused,
not the ones that happened to be late. Its budget is per receiving rank and
training step. Sender suppression and receiver forgiveness both charge it. The
congestion-control exemption applies per flow, stays within that budget, and the
receiver's first refusal revokes it.

On a trimming fabric with selective retransmission, the long repair tail that
MLT, LTP and OptiReduce were built to reduce does not exist. Those systems used
TCP and UDP with millisecond timeouts. Forgiveness alone does not reduce the
congestion-control reaction. The exemption accounts for the result. I did not
expect that when I started, and two negative waves exposed it.

Every tolerance number in the literature comes from loss that is uniform and
independent. A trimming fabric produces loss that is bursty, correlated across
ranks, and concentrated on the busiest network steps. Does a model care about
the difference?
