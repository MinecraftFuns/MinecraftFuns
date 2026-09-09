---
title: "The FORGIVE protocol"
description: "Fabric-Overload Relief: Gradients under Iteration-Varying Exemption. A receiver acknowledges past bytes a switch trimmed, within a loss budget that tightens on steps most sensitive to loss. A congested ML training network can then trade bounded loss for less time spent throttled."
date: "2026-09-08"
tags: ["Essays", "Networking", "Artificial Intelligence", "Performance"]
---

Distributed ML training sends gradient updates between machines on every step.
With packet trimming on and congestion control off, the most congested fabric I
simulated with [ASTRA-sim](https://astra-sim.github.io/) retransmitted a quarter
of the offered load. Turning [DCQCN](https://doi.org/10.1145/2785956.2787484) on
cut its trim rate sevenfold and added 24 percent to its completion time. The
training job pays one of those costs on every step.

[Gradient descent](https://developers.google.com/machine-learning/crash-course/linear-regression/gradient-descent)
can tolerate losing some gradient bytes, but not on every step and not without
limit. I call the protocol **F**abric-**O**verload
**R**elief: **G**radients under **I**teration-**V**arying **E**xemption. It
forgives only gradient payload and only after a trim: neither
[tensor-parallel](https://arxiv.org/abs/1909.08053) nor
[pipeline-parallel](https://arxiv.org/abs/1811.06965) traffic is eligible. The
budget tightens during the
[critical learning regime](https://proceedings.mlsys.org/paper_files/paper/2021/hash/acd593d2db87a799a8d3da5a860c028e-Abstract.html),
so a trim that step 12 would forgive must be repaired on step 2. The first trim
the receiver cannot forgive puts the flow back under congestion control.

## A trim reports a missing range

When a queue fills, a switch that supports packet trimming truncates the packet
to its header instead of dropping it, and forwards that header on a
high-priority queue. The receiver learns which bytes went missing when the trim
happens rather than from a timeout a millisecond later. A drop would have left
it nothing to decide about; a trim leaves it a range.

[NDP](https://doi.org/10.1145/3098822.3098825) introduced packet trimming in
2017, and the Ultra Ethernet Consortium made it an optional switch behaviour in
[specification 1.0](https://ultraethernet.org/ultra-ethernet-consortium-uec-launches-specification-1-0-transforming-ethernet-for-ai-and-hpc-at-scale/),
released in June 2025, alongside a
[default bulk mode](https://arxiv.org/abs/2508.08906) that sprays packets across
paths.

## Gradient tolerance varies by step

[Accordion](https://proceedings.mlsys.org/paper_files/paper/2021/hash/acd593d2db87a799a8d3da5a860c028e-Abstract.html)
uses changes in gradient norms to identify critical learning regimes, when the
model is especially sensitive to compression. It keeps compression low in those
periods and compresses hard everywhere else. The paper reports up to 5.5 times
better compression at accuracy comparable to uncompressed training.
[DBLP](https://arxiv.org/abs/2605.01989) applies that schedule to network
transport. It uses a hash draw at the sender to suppress whole gradient messages,
with a tight loss allowance during the critical period and a looser one after it.

What counts as tolerable depends on what the measurement is willing to trade.
[MLT](https://www.usenix.org/conference/nsdi24/presentation/wang-hao) profiled
sixteen convolutional and recurrent models and found under 3 percent of gradient
bytes droppable with both the round count and the accuracy fixed, and 10 percent
once more rounds were allowed to reach a quality target.
[Weintraub and colleagues](https://arxiv.org/abs/2507.07114) lost a tenth of
[Llama 2](https://arxiv.org/abs/2307.09288) 7B's gradient bytes uniformly at
random for 1.17 percent worse
[perplexity](https://huggingface.co/docs/transformers/perplexity), and 40 percent
of them for 6.65 percent worse.

A budget is a per-step fraction of a rank's gradient bytes, charged only against
messages from the gradient
[all-reduce](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html).
Tensor-parallel traffic, pipeline traffic, control packets and the background
burst are ineligible. ASTRA-sim models communication rather than the model, so
there are no gradient norms for Accordion to read. Steps 1, 2, 3 and 20 of
twenty are pinned critical at a budget of 0.005 and the rest run at 0.4, which
follows the literature in putting a model's sensitivity to lost gradient
information early in training.

## Accounting

A bound stated per model holds for the whole run and cannot follow a phase.
FORGIVE keeps one accounting entry for each receiving
[rank](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html)
and training step, which is the grain the phase varies at. Sender-side
suppression and receiver-side forgiveness charge the same entry, so the two
policies can be compared at one budget.

Each eligible flow's bytes count towards the entry for its rank and step when
the flow starts, and the forgiven and suppressed bytes in that entry sum to at
most the step's budget times its eligible bytes. Both counters grow and neither
refunds bytes. An entry closes when that rank's all-reduce for the step
completes, and nothing may be charged to a closed entry.

A trimmed packet carries its original sequence number and length, so the
receiver can work out how many of its bytes are still missing. A re-segmented
retransmission can straddle the cumulative acknowledgement, and charging the
full length would spend budget on bytes already in hand. The receiver then
either forgives the range and acknowledges past the hole as if the bytes had
arrived, or requests it with the transport's existing NACK.

## Selective repeat removes the repair saving

I built the receiver-side half first. It appeared to reduce training time by 4
to 11 percent. The transport underneath was go-back-N, and a control run with
[selective repeat](https://www.rfc-editor.org/rfc/rfc2018) showed the same
congestion burst costing 29 ms instead of 1.8 s. Go-back-N put up to 79 bytes on
the wire for every byte the policy removed. I had measured the transport's
amplification rather than the policy.

So I went looking for the time the burst was supposed to be costing. I swept
eight fabrics at 64 ranks and 400 Gbps, varying congestion control, fan-in and
oversubscription between 2:1 and 4:1. There was nothing there to save. The burst
cost under 1 percent of the 20-step training time in every one, and forgiveness
that only skips a repair round saves at most a round trip per flow, under 0.2
percent of an all-reduce.

The time was going somewhere else. With DCQCN on, millions of rate cuts per run
bought a trim rate seven to ten times lower and cost 18 to 24 percent of the
20-step training time. A loss budget can pay for the trims DCQCN spends that
time avoiding.

## Rate-control exemption

Paying for the trims does not stop the rate cuts. So the sender of a flow whose
trimmed bytes are eligible for forgiveness ignores congestion signals as well.
It does not reduce its rate until the receiver requests a retransmission for one
of its trims, and then obeys congestion control again.

The exemption covers both [ECN](https://www.rfc-editor.org/rfc/rfc3168) marks
and trim notifications. In the DCQCN configuration here, switches begin
ECN-marking at 800 KB of queue and trim only when the 4 MiB data queue is full.
Marks arrive long before trims. In the most congested configuration, at least 74
percent of rate cuts came from marks that no forgiven trim affects. Exempting
only trim-triggered cuts would leave those in place, so eligible senders ignore
every congestion notification packet.

The budget is knowledge the receiver keeps to itself. All flows to a rank share
its entry, and no sender can read what is left of it, so the only way a sender
learns it has run out is a retransmission request for a trim it expected to be
forgiven. That request puts the flow back under congestion control and applies
its rate cut. One packet the transport already sends does the accounting, the
signalling and the revocation.

## State and decision

FORGIVE runs on an RDMA fabric with packet trimming and selective repeat. The
data queue loses packets. The high-priority queue that carries trimmed headers
does not. A rate-based congestion control runs underneath, DCQCN in every run
below. The receiver already accepts out-of-order arrival, since the fabric
sprays packets across paths. FORGIVE adds no packet type and changes no header.

The switch trims, reports the missing range, and decides nothing about it. Each
rank runs the detector over the gradients it holds and opens its own entry, so a
receiver's budget comes from its own verdict on the step. The scoreboard and the
verdict live at the receiver. The mode bit lives at the sender.

The detector must run before a step's gradient traffic starts. It reads the rate
of change in gradient norms, Accordion's criterion, and classifies the step as
inside or outside the critical learning regime. The classification picks one of
two budgets, and that budget parameterises the step's entry. No list of critical
steps exists in the protocol.

Two budgets:

- `kBudgetCritical: float`. The fraction of a rank's eligible gradient bytes
  that may be lost on a step the detector calls critical. `0.005` in these runs.
- `kBudgetOther: float`. The same fraction on every other step. `0.4` in these
  runs.

State per flow, at the receiver:

- `rcv_nxt: Seq`. The lowest sequence number not yet settled, whether it was
  settled by arrival or by forgiveness.
- `scoreboard: dict[Range, State]`. The ranges above `rcv_nxt`, each one
  `Requested`, `Forgiven` or `Received`.

State per flow, at the sender:

- `cc_mode: Mode`. `Exempt` when an eligible flow is created and `Obeying` from
  the first retransmission request the receiver sends it. A flow that is not
  eligible is created `Obeying` and never leaves it.

State per receiving rank and training step, opened when the step begins and
shared by every flow to that rank:

- `budget: float`. Set to `kBudgetCritical` or `kBudgetOther` by the detector's
  verdict on this step.
- `eligible: int`. Gradient bytes registered for this rank and step so far. Each
  eligible flow registers its own when it starts, so the denominator grows
  through the step.
- `forgiven: int`. Bytes the receiver acknowledged without receiving.
- `suppressed: int`. Bytes the sender shed before sending.
- `open: bool`. `True` until this rank's all-reduce for the step completes.

For every rank and step, at all times, `forgiven + suppressed` is at most
`budget * eligible`. Because `eligible` grows through the step, the bound is
tightest at the start of one. A step whose entry was never opened forgives
nothing, so a step the detector has not classified must be repaired the ordinary
way.

```cpp
OnStepBegin(rank, step, gradients):
  // Is this step inside the critical learning regime? Gradient norms
  // answer, one step at a time.
  critical = InCriticalRegime(gradients)
  entry = ledger[rank][step]
  // Critical steps get the tight budget, every other step the loose one.
  entry.budget = critical ? kBudgetCritical : kBudgetOther
  entry.eligible = entry.forgiven = entry.suppressed = 0
  // Open before the step's first gradient byte, or those bytes go
  // uncounted.
  entry.open = true
```

A range on the scoreboard never leaves the state it reaches, so no range is
charged twice. A range that arrives without ever being trimmed becomes
`Received` directly.

| scoreboard value | trimmed header reports the range | data packet arrives |
| --- | --- | --- |
| absent | run `OnTrimmedHeader` below | `Received`, ACK |
| `Requested` | resend the request at its priority | `Received`, ACK |
| `Forgiven` | ACK, no charge | discard the payload, no credit back |
| `Received` | duplicate ACK, no charge | `Received`, ACK |

```cpp
Unsettled(flow, range):
  // Only the bytes the receiver still lacks. A retransmission can carry
  // bytes it already holds, and those cost no budget.
  return the bytes of range at or above flow.rcv_nxt that are marked
    neither Received nor Forgiven on flow.scoreboard

Repair(flow, range):
  // Every refusal takes this path. Mark only the unsettled subranges, so
  // a range that is part Received keeps what it already has.
  Mark(flow.scoreboard, Unsettled(flow, range), Requested)
  SendRetransmissionRequest(range, kNormal)
```

`OnTrimmedHeader` runs when a trimmed header reports a missing range.

```cpp
OnTrimmedHeader(flow, range):
  missing = Unsettled(flow, range)
  // Nothing missing after all. Acknowledge and spend nothing.
  if (missing is empty):
    SendAck(flow.rcv_nxt)
    return

  // Only gradients are forgivable. Everything else must be repaired.
  if (!IsGradientAllReduce(flow)):
    Repair(flow, range)
    return

  (rank, step) = Coordinates(flow)
  entry = ledger[rank][step]
  // No budget open for this step, so there is nothing to spend.
  if (entry == null || !entry.open):
    Repair(flow, range)
    return

  // The budget will not cover these bytes, so ask for them. That request
  // also puts the sender back under congestion control.
  if (entry.forgiven + entry.suppressed + Count(missing) >
      entry.budget * entry.eligible):
    Repair(flow, range)
    return

  // Forgiving spends budget once and never gives it back.
  entry.forgiven += Count(missing)
  Mark(flow.scoreboard, missing, Forgiven)
  flow.rcv_nxt = Advance(flow.rcv_nxt, flow.scoreboard)
  // The ACK carries the ECN echo either way, so the congestion signal
  // survives for whenever this flow obeys congestion control again.
  SendAck(flow.rcv_nxt, ecn_echo)
```

Every path either sends the retransmission request the transport already sends,
or charges the budget once.

At the sender:

```cpp
OnCongestionNotification(flow):
  // An exempt sender ignores ECN marks as well as trims. Most of the
  // slowing down DCQCN imposes comes from marks.
  if (flow.cc_mode == Exempt):
    cnp_ignored++
    return
  ReduceRate(flow)

OnRetransmissionRequest(flow, range):
  // The receiver refused to forgive, so the exemption ends here and the
  // sender slows down like any other.
  flow.cc_mode = Obeying
  ReduceRate(flow)
  Retransmit(range)
```

A flow that reaches `Obeying` never returns to `Exempt`.

Only `OnTrimmedHeader` charges against the budget. `forgiven` and `suppressed`
never fall, and a closed entry never reopens, so the bound holds throughout a
run rather than only when a step ends, and the telemetry can check it during the
run.

## Results

I tested the most congested configuration with three random seeds and four
policy variants per seed. All variants used one random selection stream, so the
sender-side baseline suppresses the same messages that the receiver-side policy
may forgive.

Against a baseline with a 0.005 loss budget on every step, forgiveness with
exemption cut the 20-step training time by 12.9, 13.1 and 13.5 percent across
the three seeds. It acted where it was aimed. The all-reduce span
on non-critical steps fell from 36 ms to 21 ms, and the critical-step span
stayed at 37 ms, within 0.9 ms of the baseline in every seed.

Senders that ignore congestion left the transport calmer, not wilder.
Retransmission timeouts fell by two thirds and applied rate cuts by half, and
tensor-parallel spans fell too, because gradient flows leave the leaf switch
sooner.

The cost side stayed small. Exempt flows push harder, so the trim rate rose from
0.031 to 0.033, and two thirds of those trims were forgiven. About one exempt
flow in six met a refusal and went back under congestion control, so the
revocation is not dead code. The budget rule held in every accounting entry.

The exemption even moves a fabric with almost nothing to forgive. A lightly
congested configuration barely trims, but DCQCN still cuts rates there 3.3
million times on ECN marks alone, and marks are most of what the exemption
ignores. Its 20-step training time fell 4 percent and its trims doubled, with
the receiver forgiving every extra one, at the price of a burst that drained 5
to 22 percent slower.

## Forgiveness spends the budget only under congestion

DBLP uses phase-aware sender-side shedding: it suppresses gradient messages by a
random draw whose probability depends on the training step.

Shedding spends whether or not the network is congested. Forgiveness spends only
on bytes the network trimmed, which is a much smaller set. In the most congested
configuration, FORGIVE gave up about 9 percent of its gradient bytes against
shedding's 32 percent, and still finished the 20 training steps sooner in every
seed.

A baseline that sheds 40 percent on every step does match FORGIVE on time, 1,433
to 1,466 ms against FORGIVE's 1,459 to 1,468 ms, a tie inside the seed spread of
both. It buys that by shedding through the critical steps as well, which
conflicts with the critical learning regime assumed by the work here.

## Limits

Whether a current model tolerates losing 9 percent of its gradient bytes on
non-critical steps is assumed, not tested. DBLP tested
[EfficientNet](https://arxiv.org/abs/1905.11946) and
[ResNet](https://arxiv.org/abs/1512.03385); Weintraub tested 10 percent uniform
loss on Llama 2 7B without phase dependence. My search turned up no published
work on phase-gated gradient loss at
[Transformer](https://arxiv.org/abs/1706.03762) scale, and none measuring loss
that is bursty and correlated, which packet trimming produces.

A deployment has to run a real detector. Calling a critical step ordinary lets
40 percent of its gradient bytes go where the schedule allows 0.5 percent.
Calling an ordinary step critical only forfeits the gain. Nothing here measures
either, and the cheapest check needs no network: replay a detector over the
gradient norms of a real training run and count the steps it misses.

The congestion control is DCQCN, because that is what the simulator models.
Meta runs its 400 Gbps ML training networks
[with DCQCN off](https://engineering.fb.com/wp-content/uploads/2024/08/sigcomm24-final246.pdf),
where the exemption has nothing to act on. Ultra Ethernet's default is
[Network Signal-based Congestion Control](https://ultraethernet.org/wp-content/uploads/sites/20/2025/06/UE-Specification-6.11.25.pdf#page=377),
a window-based controller that adjusts on round-trip time, ECN marks and
optionally packet trimming, which I have not modelled. The idea may transfer to
controls that react to marks and trims. Nothing here tests that.

The simulation has one training job. Exempt flows shared the network with their
own job's tensor-parallel traffic and a single background burst, never with
another job's flows obeying congestion control. The cost of the exemption would
fall on such a neighbour. The budget bounds that cost and the refusal revokes
the exemption, but bounding a cost is not the same as showing a neighbour can
absorb it, and only a run with a second job would show that.

The simulation has 64 ranks with tensor parallelism on the network, so eligible
gradient traffic is only 24 percent of the bytes, a quarter of what the
mechanism would reach on a network carrying data-parallel and pipeline-parallel
traffic alone. Tensor parallelism over
[NVLink](https://www.nvidia.com/en-us/data-center/nvlink/) keeps its own traffic
off this network.

## Prior work

Before training, MLT has the sender and receiver agree on a tolerated fraction
for each tensor. Once enough of a tensor has arrived, the receiver stops
requesting retransmissions, so the bytes it gives up are whichever arrive last.
Its bound is per model and constant over training. It weakens congestion control for every
flow with no way back, and its transport is
[UDP](https://www.rfc-editor.org/rfc/rfc768) in user space: the authors say
[RDMA](https://www.rfc-editor.org/rfc/rfc5040) network interface cards cannot
host it.
[LTP](https://arxiv.org/abs/2305.04279) closes a round early based on network
conditions.
[OptiReduce](https://www.usenix.org/conference/nsdi25/presentation/warraich)
bounds each round by an adaptive timeout and spreads the resulting loss over the
whole gradient with a randomised Hadamard transform.
[Trimmable gradients](https://doi.org/10.1145/3696348.3696880) lay out each
packet so that its trimmed prefix is already a quantised gradient. This removes
retransmission entirely, without a bound: whatever the switch trims is accepted.
That paper's future work asks for a congestion control that deliberately
over-sends and lets the switch trim the excess. The exemption has that behaviour
within a budget.

FORGIVE decides per missing range from the switch's trim report, so the bytes it
gives up are the ones the network could not carry rather than the ones that
arrived last. Its budget is per receiving rank and training step rather than per
model. Its exemption applies per flow, stays inside that budget, and ends at the
receiver's first refusal.

On a network that trims packets and runs selective repeat, the long repair tail
that MLT, LTP and OptiReduce were built to reduce does not exist. Those systems
used [TCP](https://www.rfc-editor.org/rfc/rfc9293) and UDP with millisecond
timeouts. Forgiveness alone does not reduce the congestion-control reaction
there, and the exemption accounts for the whole result. Two negative results
exposed that.

The tolerance numbers I found in the literature come from loss that is uniform
and independent. Packet trimming produces loss that is bursty, correlated across
ranks, and concentrated on the busiest network steps. Does a model care about the
difference?
