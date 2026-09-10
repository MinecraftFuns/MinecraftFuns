---
title: "The FORGIVE protocol"
description: "Fabric-Overload Relief: Gradients under Iteration-Varying Exemption. A receiver acknowledges past bytes a switch trimmed, within a loss budget that tightens on steps most sensitive to loss. A congested ML training network can then trade bounded loss for less time spent throttled."
date: "2026-09-08"
tags: ["Essays", "Networking", "Artificial Intelligence", "Performance"]
---

Distributed ML training exchanges gradient updates on every step. With packet
trimming on and congestion control off, my most congested
[ASTRA-sim](https://astra-sim.github.io/) fabric retransmitted a quarter of the
offered load. With [DCQCN](https://doi.org/10.1145/2785956.2787484) on, the trim
rate was sevenfold lower and the training run took 24 percent longer to
complete. Every step pays one of those costs.

[Gradient descent](https://developers.google.com/machine-learning/crash-course/linear-regression/gradient-descent)
tolerates some lost gradient bytes, but not on every step and not without limit.
I call the protocol **F**abric-**O**verload
**R**elief: **G**radients under **I**teration-**V**arying **E**xemption. It
forgives only gradient payload and only after a trim: neither
[tensor-parallel](https://arxiv.org/abs/1909.08053) nor
[pipeline-parallel](https://arxiv.org/abs/1811.06965) traffic is eligible. The
loss budget tightens during the
[critical learning regime](https://proceedings.mlsys.org/paper_files/paper/2021/hash/acd593d2db87a799a8d3da5a860c028e-Abstract.html),
so a critical step has a smaller loss budget than a non-critical one.

## A trim reports a missing range

When a queue fills, a switch with packet trimming trims the packet to its header
and forwards that header on a high-priority queue. The receiver learns which
bytes are missing at once, not from a timeout a millisecond later. A drop leaves
nothing to decide; a trim leaves a range.

[NDP](https://doi.org/10.1145/3098822.3098825) introduced packet trimming in
2017. Ultra Ethernet made it optional switch behaviour in
[specification 1.0](https://ultraethernet.org/ultra-ethernet-consortium-uec-launches-specification-1-0-transforming-ethernet-for-ai-and-hpc-at-scale/),
June 2025, alongside a
[default bulk mode](https://arxiv.org/abs/2508.08906) that sprays packets across
paths.

## Gradient tolerance varies by step

[Accordion](https://proceedings.mlsys.org/paper_files/paper/2021/hash/acd593d2db87a799a8d3da5a860c028e-Abstract.html)
reads changes in gradient norms to find critical learning regimes, the periods
where a model is especially sensitive to compression. It compresses lightly
there and hard everywhere else, for up to 5.5 times better compression at
accuracy comparable to uncompressed training.
[DBLP](https://arxiv.org/abs/2605.01989) applies that schedule to network
transport. A hash draw at the sender suppresses whole gradient messages,
tightly during the critical period and loosely after.

What counts as tolerable depends on what the measurement trades for it.
[MLT](https://www.usenix.org/conference/nsdi24/presentation/wang-hao) profiled
sixteen convolutional and recurrent models: under 3 percent of gradient bytes
droppable at fixed rounds and accuracy, 10 percent when more rounds were
allowed. [Weintraub and colleagues](https://arxiv.org/abs/2507.07114) dropped a
tenth of [Llama 2](https://arxiv.org/abs/2307.09288) 7B's gradient bytes
uniformly at random for 1.17 percent worse
[perplexity](https://huggingface.co/docs/transformers/perplexity), and 40 percent
for 6.65 percent worse.

A tolerance is a per-step fraction of a rank's gradient bytes, and applies only
to the gradient
[all-reduce](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html).
ASTRA-sim simulates communication and compute times, not the model, so Accordion
has no gradient norms to read. I treat steps 1, 2, 3 and 20 of twenty as
critical. FORGIVE adapts Accordion's two-level communication schedule as two
loss probabilities: $P_{\text{low}}$ covers those steps and $P_{\text{high}}$
the rest. The literature puts a model's sensitivity to lost gradients early in
training, where three of those four sit.

## The loss budget

A per-model bound holds for the whole run and cannot follow a phase. FORGIVE
gives each receiving
[rank](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html)
one loss budget per training step, the unit at which the classification varies. The collective
schedule already says how many gradient bytes a step will bring a rank, so the
receiver can size that loss budget before the first byte arrives: the step's
tolerance times those bytes. Forgiven bytes never exceed it.

A trimmed packet carries its original sequence number and length, so the
receiver can compute how many of those bytes are still outstanding. A
re-segmented retransmission can straddle the cumulative acknowledgement, and
charging the full length would charge the loss budget for bytes already
delivered. The
receiver then either forgives the range and acknowledges past the hole, or
requests it with the transport's existing NACK.

## Selective repeat removes the repair saving

I built the receiver-side half first. It appeared to cut training time by 4 to
11 percent. The transport underneath was go-back-N: a control run with
[selective repeat](https://www.rfc-editor.org/rfc/rfc2018) put the same burst at
29 ms instead of 1.8 s. Go-back-N put up to 79 bytes on the wire for every byte
the policy removed. I had measured the transport's amplification, not the
policy.

So I went looking for the time the burst was supposed to cost. I swept eight
fabrics at 64 ranks and 400 Gbps, varying congestion control, fan-in and
oversubscription between 2:1 and 4:1. There was nothing there to save: the burst
cost under 1 percent of the 20-step training time in every one, and skipping a
repair round saves at most a round trip per flow, under 0.2 percent of an
all-reduce.

The remaining cost came from congestion control. With DCQCN on, millions of rate cuts
per run reduced the trim rate by a factor of seven to ten and added 18 to 24
percent to the 20-step training time. A loss budget can accept the trims those
rate cuts avoid.

## Congestion-control exemption

Paying for the trims does not stop the rate cuts. So an eligible flow's sender
ignores congestion signals too. It does not reduce its rate until the receiver
requests a retransmission for one of its trims, then obeys congestion control
again.

The exemption covers [ECN](https://www.rfc-editor.org/rfc/rfc3168) marks as well
as trims. Switches here begin ECN-marking at 800 KB of queue and trim only when
the 4 MiB data queue is full, so marks arrive long before trims: at least 74
percent of rate cuts in the worst fabric came from marks no forgiven trim
touches. Exempting only trim-triggered cuts would leave those in place, so
eligible senders ignore every congestion notification packet.

The receiver owns each rank's loss budget, which all flows to that rank share.
Senders cannot see how much remains. A sender learns that the loss budget is
exhausted only when it receives a retransmission request for a trim it expected
to be forgiven. That packet refuses the trim and restores congestion control.
On receipt, the sender applies its rate cut.

## State and decision

FORGIVE assumes a fabric and an interface. From the fabric:

- Packet trimming, on a lossy [RDMA](https://www.rfc-editor.org/rfc/rfc5040)
  network.
- A lossless high-priority queue for the trimmed headers.
- Selective repeat, and a receiver that already reassembles out of order because
  the fabric sprays packets across paths.
- A rate-based congestion control underneath.

From the software above the transport, four facts the wire cannot show:

- Which step is beginning, and what its gradient norms say.
- How many gradient bytes the step will bring this rank.
- Which flows carry them.
- Which step a given flow belongs to.

That is a host-local interface between
[NCCL](https://developer.nvidia.com/nccl) and the network interface card, not a
packet, which is why FORGIVE adds no packet type and changes no header.

The switch trims, reports the missing range, and decides nothing about it. The
scoreboard and the verdict live at the receiver, the mode bit at the sender.

The detector must run before a step's gradient traffic starts. Accordion's
criterion, the rate of change in gradient norms, puts the step inside or outside
the critical learning regime, and that verdict picks the loss budget. No list
of critical steps exists in the protocol.

FORGIVE adapts Accordion's two-level compression schedule into two loss
probabilities:

- `P_low: float`. The loss probability for the eligible gradient bytes a rank
  expects on a critical step. `0.005` here.
- `P_high: float`. The same probability on every other step. `0.4` here.

State per flow, at the receiver:

- `rcv_nxt: Seq`. The lowest sequence number not yet settled, by arrival or by
  forgiveness.
- `scoreboard: dict[Range, State]`. The ranges above `rcv_nxt`, each one
  `Requested`, `Forgiven` or `Received`.

State per flow, at the sender:

- `cc_mode: Mode`. `Exempt` if the flow is a gradient all-reduce, else
  `Obeying`. The receiver's first retransmission request moves it to `Obeying`
  for good.

State per training step, at each receiving rank. No rank reads another's.

- `p: float`. `P_low` or `P_high`, by the detector's verdict on this step.
- `budget: int`. The loss budget in bytes, fixed when the step opens.
- `forgiven: int`. Bytes the receiver acknowledged without receiving.
- `open: bool`. `True` until this rank's all-reduce for the step completes.

At all times, `forgiven` is at most `budget`. A step the detector never
classified has no loss budget, and must be repaired the usual way.

Handlers below are named for where they run. Nothing runs at the
switch. Four calls reach outside the transport for the four facts above:

- `InCriticalRegime(gradients)`. Accordion's criterion, at the receiving rank,
  over the gradients that rank holds. The network does not carry this input.
- `ExpectedGradientBytes(step)`. What this step will deliver to this rank. A
  receiving net plugin is already handed the size of every message posted to it,
  so this is a sum it can keep.
- `StepOf(flow)`. Which step a flow belongs to. Carried nowhere today.
- `IsGradientAllReduce(flow)`. Whether a flow is gradient traffic. A
  communicator's
  [traffic class](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/communicators.html)
  already becomes an IP type of service on
  [RoCE](https://doi.org/10.1145/2785956.2787484), so the
  [DSCP](https://www.rfc-editor.org/rfc/rfc2474) carries it.

Everything else is the transport's own. `Mark` and `Advance` write the
scoreboard, `SendAck` and `SendRetransmissionRequest` are packets it already
sends, and `ReduceRate` and `Retransmit` are what congestion control already
does.

```cpp
Receiver::OnStepBegin(step, gradients):
  critical = InCriticalRegime(gradients)
  entry = steps[step]
  // A critical step can afford less loss.
  entry.p = critical ? P_low : P_high
  entry.budget = Floor(entry.p * ExpectedGradientBytes(step))
  entry.forgiven = 0
  entry.open = true

Receiver::OnAllReduceComplete(step):
  // The step is over. Any later trim on it is repaired.
  steps[step].open = false
```

A range never leaves the state it reaches, so none is charged twice. A range
that arrives without ever being trimmed becomes `Received` directly.

| scoreboard value | trimmed header reports the range | data packet arrives |
| --- | --- | --- |
| absent | run `OnTrimmedHeader` below | `Received`, ACK |
| `Requested` | resend the request at its priority | `Received`, ACK |
| `Forgiven` | ACK, no charge | discard the payload, no credit back |
| `Received` | duplicate ACK, no charge | `Received`, ACK |

```cpp
Receiver::Unsettled(flow, range):
  // Only the bytes the receiver still lacks.
  return the bytes of range at or above flow.rcv_nxt that are marked
    neither Received nor Forgiven on flow.scoreboard

Receiver::Repair(flow, range):
  // Every refusal takes this path. Mark only the unsettled subranges, so
  // a range that is partly Received keeps what it has.
  Mark(flow.scoreboard, Unsettled(flow, range), Requested)
  SendRetransmissionRequest(range, kNormal)
```

```cpp
Receiver::OnTrimmedHeader(flow, range):
  missing = Unsettled(flow, range)
  // Nothing missing after all. Acknowledge and spend nothing.
  if (missing is empty):
    SendAck(flow.rcv_nxt)
    return

  // Only gradients are forgivable. Everything else must be repaired.
  if (!IsGradientAllReduce(flow)):
    Repair(flow, range)
    return

  entry = steps[StepOf(flow)]
  // No loss budget is open for this step, so there is nothing to spend.
  if (entry == null || !entry.open):
    Repair(flow, range)
    return

  // The loss budget will not cover these bytes, so ask for them. That request
  // also puts the sender back under congestion control.
  if (entry.forgiven + Count(missing) > entry.budget):
    Repair(flow, range)
    return

  // Forgiving charges the loss budget once.
  entry.forgiven += Count(missing)
  Mark(flow.scoreboard, missing, Forgiven)
  flow.rcv_nxt = Advance(flow.rcv_nxt, flow.scoreboard)
  // The ACK carries the ECN echo either way, so the signal is still
  // there when this flow obeys congestion control again.
  SendAck(flow.rcv_nxt, ecn_echo)
```

Every path either sends the retransmission request the transport already sends,
or charges the loss budget once.

```cpp
Sender::OnFlowStart(flow):
  // A local decision at the sender. Nothing is signalled.
  flow.cc_mode = IsGradientAllReduce(flow) ? Exempt : Obeying

Sender::OnCongestionNotification(flow):
  // An exempt sender ignores ECN marks as well as trims. Most of
  // DCQCN's slowdown comes from marks.
  if (flow.cc_mode == Exempt):
    return
  ReduceRate(flow)

Sender::OnRetransmissionRequest(flow, range):
  // The receiver refused to forgive, so the exemption ends here and the
  // sender slows down like any other.
  flow.cc_mode = Obeying
  ReduceRate(flow)
  Retransmit(range)
```

Only `OnTrimmedHeader` charges the loss budget, `forgiven` never falls, and a
closed loss budget never reopens. The bound therefore holds at every instant,
not only when a step ends.

## Results

I ran the worst fabric with three seeds and four policy variants each. All four
drew from one random stream, so the sender-side baseline suppresses the same
messages the receiver-side policy may forgive.

Against a tight baseline, $P_{\text{low}} = P_{\text{high}} = 0.005$,
forgiveness with exemption cut the 20-step training time by 12.9, 13.1 and 13.5
percent. The all-reduce span on
non-critical steps fell from 36 ms to 21 ms, while the critical-step span stayed
at 37 ms, within 0.9 ms of the baseline in every seed.

Senders that ignore congestion left the transport calmer, not wilder.
Retransmission timeouts fell by two thirds and rate cuts by half, and
tensor-parallel spans fell too, because gradient flows leave the leaf sooner.

Exempt flows push harder, so the trim rate rose from 0.031 to 0.033, two thirds
of those trims forgiven. About one exempt flow in six met a refusal and went back
under congestion control. The loss-budget invariant held on every step.

The exemption also changes a fabric that barely trims. DCQCN still cuts rates
there 3.3 million times on ECN marks alone, which the exemption also ignores.
Its training time fell 4 percent and its trims doubled, every extra one
forgiven. The congestion burst drained 5 to 22 percent more slowly.

## Forgiveness spends the loss budget only under congestion

Forgiveness and DBLP's sender-side shedding run the same schedule at the same
$P_{\text{low}}$ and $P_{\text{high}}$. What separates them is where the
loss budget goes.

Shedding spends it whether or not the network is congested. Forgiveness spends
it only on bytes the network trimmed, a much smaller set. On the worst fabric,
the receiver-side policy gave up about 9 percent of its gradient bytes and the
sender-side policy 32 percent, and the receiver-side policy finished sooner in
every seed.

A loose baseline, $P_{\text{low}} = P_{\text{high}} = 0.4$, does match
forgiveness on time: 1,433 to 1,466 ms against 1,459 to 1,468 ms, a tie within
the range across their seeds. It gets there by shedding through the critical
steps too, which conflicts with the critical learning regime.

## Limits

Nothing here tests whether a current model tolerates losing 9 percent of its
gradient bytes on non-critical steps. DBLP tested
[EfficientNet](https://arxiv.org/abs/1905.11946) and
[ResNet](https://arxiv.org/abs/1512.03385); Weintraub tested 10 percent uniform
loss on Llama 2 7B without phase dependence. My search turned up no published
work on phase-gated gradient loss at
[Transformer](https://arxiv.org/abs/1706.03762) scale, and none measuring loss
that is bursty and correlated, which packet trimming produces.

A deployment has to run a real detector. Calling a critical step ordinary lets
40 percent of its gradient bytes go where the schedule allows 0.5 percent.
Calling a non-critical step critical only forfeits the gain. Nothing here measures
either, and the cheapest check needs no network: replay a detector over the
gradient norms of a real training run and count the steps it misses.

The two host facts no component carries today need no wire change. The decision
does: forgiving a range writes the transport's own reliability state, which on an
RDMA fabric lives in the network interface card rather than in a plugin above it.
MLT hit that wall and retreated to UDP in user space, and FORGIVE asks more of the
card than MLT did. Ultra Ethernet is putting trimming, the trimmed-header NACK
and selective repeat into silicon, which is where such a card would come from.

The congestion control is DCQCN because that is what the simulator models. Meta
runs its 400 Gbps ML training networks
[with DCQCN off](https://engineering.fb.com/wp-content/uploads/2024/08/sigcomm24-final246.pdf),
where the exemption has nothing to act on. Ultra Ethernet's default is
[Network Signal-based Congestion Control](https://ultraethernet.org/wp-content/uploads/sites/20/2025/06/UE-Specification-6.11.25.pdf#page=377),
which I have not modelled, so nothing here says whether the idea carries to it.

The simulation has one training job. Exempt flows shared the fabric with their
own job's tensor-parallel traffic and one background burst, never with another
job obeying congestion control. That other job is the one that pays for the
exemption, and only a run with a second job would show whether it can absorb the
cost.

The simulation has 64 ranks with tensor parallelism on the network, so eligible
gradient traffic is only 24 percent of the bytes. A fabric carrying only
[data-parallel](https://docs.pytorch.org/tutorials/intermediate/ddp_tutorial.html)
and pipeline-parallel traffic would offer four times as much. Tensor parallelism
over [NVLink](https://www.nvidia.com/en-us/data-center/nvlink/) keeps its own
traffic off this network.

## Prior work

Four systems give up gradient bytes on purpose, and each picks which bytes in a
different way.

- MLT has the sender and receiver agree on a tolerated fraction per tensor
  before training. Once enough of a tensor arrives the receiver stops requesting
  retransmissions, so the bytes it gives up are whichever arrive last. Its bound
  is per model and constant over training, it weakens congestion control for
  every flow with no way back, and its transport is
  [UDP](https://www.rfc-editor.org/rfc/rfc768) in user space, which the authors
  say RDMA network interface cards cannot host.
- [LTP](https://arxiv.org/abs/2305.04279) closes a round early on network
  conditions.
- [OptiReduce](https://www.usenix.org/conference/nsdi25/presentation/warraich)
  bounds each round by an adaptive timeout and spreads the resulting loss over
  the whole gradient with a randomised Hadamard transform.
- [Trimmable gradients](https://doi.org/10.1145/3696348.3696880) lay out each
  packet so its trimmed prefix is already a quantised gradient, which removes
  retransmission entirely and any bound with it: whatever the switch trims is
  accepted.

That last paper's future work asks for a congestion control that deliberately
over-sends and lets the switch trim the excess. The exemption does exactly that,
within the loss budget.

FORGIVE decides per missing range from the switch's trim report, so the bytes it
gives up are the ones the network could not carry rather than the ones that
arrived last. Its loss budget is per receiving rank and training step, not per
model. Its exemption is per flow, stays within that loss budget, and ends at the receiver's
first refusal.

On a fabric that trims and runs selective repeat, the long repair tail MLT, LTP
and OptiReduce were built to reduce does not exist: those systems ran on
[TCP](https://www.rfc-editor.org/rfc/rfc9293) and UDP with millisecond timeouts.
Forgiveness alone does not reduce the congestion-control reaction there, and the
exemption accounts for the whole result. The selective-repeat result and the
lightly congested result exposed that.

The tolerance numbers in the literature come from loss that is uniform and
independent. Packet trimming produces loss that is bursty, correlated across
ranks, and concentrated on the busiest steps. Does a model care about the
difference?
