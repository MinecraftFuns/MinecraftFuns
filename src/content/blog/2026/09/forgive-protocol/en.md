---
title: "The FORGIVE protocol"
description: "Fabric-Overload Relief: Gradients under Iteration-Varying Exemption. A receiver forgives bytes a switch trimmed, each range with an optional probability, within a loss budget that tightens on steps most sensitive to loss and vests as bytes arrive. A congested ML training network can then trade bounded loss for less time spent throttled."
date: "2026-09-08"
tags: ["Essays", "Networking", "Artificial Intelligence", "Performance"]
---

Distributed ML training exchanges gradient updates on every step. With packet
trimming on and congestion control off, my most congested
[ASTRA-sim](https://astra-sim.github.io/) fabric hit a 25 percent
retransmission rate. With [DCQCN](https://doi.org/10.1145/2785956.2787484) on,
the trim rate was sevenfold lower and the training run took 24 percent longer
to complete. Every step pays one of those costs.

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
transport. A hash draw at the sender sheds whole gradient messages,
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
tolerance $p$ times those bytes. Forgiven bytes never exceed it.

A trimmed packet carries its original sequence number and length, so the
receiver can compute how many of those bytes are still outstanding. A
re-segmented retransmission can straddle the cumulative acknowledgement, and
charging the full length would charge the loss budget for bytes already
delivered. The
receiver then either forgives the range and acknowledges past the hole, or
requests its retransmission, as the transport already does.

FORGIVE vests the loss budget: it becomes available in proportion to the bytes
that arrive. A loss budget available in full at step start is exhausted by the
opening burst. With
$\text{received}$ the distinct gradient bytes a rank has received this step and
$\text{forgiven}$ the bytes it has forgiven, a missing range of length
$\text{len}$ may be forgiven only if
$\text{forgiven} + \text{len} \le p \times (\text{received} + \text{forgiven} + \text{len})$,
equivalently
$\text{forgiven} + \text{len} \le \frac{p}{1 - p} \times \text{received}$.
Forgiven bytes are at most a fraction $p$ of the bytes received or forgiven so
far. At step completion, $\text{received} + \text{forgiven}$ equals the step's
expected bytes, $\text{expected}$, so $\text{forgiven} \le p \times \text{expected}$
still holds; vesting adds a bound at every instant before that. A refused range
is requested for retransmission and reconsidered if it is trimmed again.

A range that passes the vesting rule is then forgiven with probability $P$, a
fresh draw per trimmed header, $0 \le P \le 1$, $P = 1$ by default. A range the
draw refuses is requested for retransmission and charges nothing. It stays
outstanding until it arrives or a later trim of it is forgiven. $P$ changes how
much of the loss budget is charged, not the two budget rules.

## Selective repeat removes the loss-recovery saving

I built the loss schedule first, as sender-side shedding at admission. It
appeared to cut training time by 4 to 11 percent. The transport underneath was go-back-N: a control run with
[selective repeat](https://www.rfc-editor.org/rfc/rfc2018) cut the same burst's
completion time from 1.8 s to 29 ms. Go-back-N put up to 79 bytes on the wire
for every byte the policy removed. I had measured the transport's
amplification, not the policy.

So I went looking for the time the burst was supposed to cost. I swept eight
fabrics at 64 ranks and 400 Gbps, varying congestion control, incast ratio and
oversubscription between 2:1 and 4:1. There was nothing there to save: the
burst cost under 1 percent of the 20-step training time in every one, and
skipping a round of loss recovery saves at most a round trip per flow, under
0.2 percent of an all-reduce.

The remaining cost came from congestion control. With DCQCN on, millions of rate cuts
per run reduced the trim rate by a factor of eight to ten and added 18 to 25
percent to the 20-step training time. A loss budget can cover the trims those
rate cuts avoid.

## Congestion-control exemption

Forgiving the trims does not stop the rate cuts. So an eligible flow's sender
ignores congestion signals too, for as long as the receiver reports that the
loss budget is not exhausted.

The exemption covers [ECN](https://www.rfc-editor.org/rfc/rfc3168) marks as well
as trims. Switches here begin ECN-marking at 800 KB of queue occupancy and trim
only when the 4 MiB data queue is full, so marks arrive long before trims: at
least 74 percent of rate cuts in the worst fabric came from marks no forgiven
trim touches. Ignoring trims alone would leave those in place, so eligible
senders ignore every congestion notification packet.

The receiver owns each rank's loss budget, which all flows to that rank share.
Senders cannot see how much remains. A retransmission request does not tell
them either, since vesting and the draw refuse ranges the loss budget could
still cover. So the receiver's acknowledgements and retransmission requests
carry two flags. `exemption-eligible` is fixed when the flow is created:
gradient all-reduce payload on a step with $p > 0$. `budget-exhausted` is set
while
$\text{forgiven} + \text{outstanding} + \text{one packet} > p \times \text{expected}$,
where $\text{outstanding}$ counts distinct trimmed bytes neither arrived nor
forgiven, and one packet is 4,096 bytes, the largest range the next trim can
carry. A sender ignores congestion signals while its flow is eligible and not
exhausted. It obeys congestion control again when a report sets
`budget-exhausted`, and ignores them again if a later report clears the flag.
The latest report wins.

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
packet, which is why FORGIVE adds no packet type. Its only wire change is the
two flags on the receiver's feedback.

The switch trims, reports the missing range, and decides nothing about it. The
scoreboard and the forgiveness decision live at the receiver, the mode bit at
the sender.

The detector must run before a step's gradient traffic starts. Accordion's
criterion, the rate of change in gradient norms, puts the step inside or outside
the critical learning regime, and that classification picks the loss budget.
No list of critical steps exists in the protocol.

FORGIVE adapts Accordion's two-level compression schedule into two loss
probabilities, and adds a forgiveness probability:

- `P_low: float`. The loss probability for the eligible gradient bytes a rank
  expects on a critical step. `0.005` here.
- `P_high: float`. The same probability on every other step. `0.1` here.
- `P: float`. The probability of forgiving a range that passes the vesting
  rule, drawn fresh per trimmed header. `1` by default.

State per flow, at the receiver:

- `rcv_nxt: Seq`. The lowest sequence number not yet settled, by arrival or by
  forgiveness.
- `scoreboard: dict[Range, State]`. The ranges above `rcv_nxt`, each one
  `Requested`, `Forgiven` or `Received`.
- `exemption_eligible: bool`. Fixed when the flow is created: `True` for
  gradient all-reduce payload on a step with `p > 0`.

State per flow, at the sender:

- `cc_mode: Mode`. `Obeying` when the flow starts. After that it follows the
  two flags on the receiver's latest report.

State per training step, at each receiving rank. No rank reads another's.

- `p: float`. `P_low` or `P_high`, by the detector's classification of this step.
- `budget: int`. The loss budget in bytes for the whole step. It vests as
  bytes arrive.
- `received: int`. Distinct gradient bytes this rank has received this step.
  The data path counts a byte when it first becomes `Received`.
- `forgiven: int`. Bytes the receiver acknowledged without receiving.
- `outstanding: int`. Distinct trimmed bytes neither received nor forgiven. A
  trim adds its new bytes; an arrival or a forgiveness takes them off.
- `open: bool`. `True` until this rank's all-reduce for the step completes.

At all times, `forgiven` is at most `budget`. A step the detector never
classified has no loss budget, and must go through ordinary loss recovery.

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
sends, and `ReduceRate` and `Retransmit` are what congestion control and loss
recovery already do. `Draw(P)` is true with probability `P`.

```cpp
Receiver::OnStepBegin(step, gradients):
  critical = InCriticalRegime(gradients)
  entry = steps[step]
  // A critical step can afford less loss.
  entry.p = critical ? P_low : P_high
  entry.budget = Floor(entry.p * ExpectedGradientBytes(step))
  entry.received = 0
  entry.forgiven = 0
  entry.outstanding = 0
  entry.open = true

Receiver::OnAllReduceComplete(step):
  // The step is over. Any range trimmed later is requested for
  // retransmission.
  steps[step].open = false
```

A range never leaves the state it reaches, so none is charged twice. A range
that arrives without ever being trimmed becomes `Received` directly.

| scoreboard value | trimmed header reports the range | data packet arrives |
| --- | --- | --- |
| absent | run `OnTrimmedHeader` below | `Received`, ACK |
| `Requested` | run `OnTrimmedHeader` below | `Received`, ACK |
| `Forgiven` | ACK, no charge | discard the payload, no credit back |
| `Received` | duplicate ACK, no charge | `Received`, ACK |

```cpp
Receiver::Unsettled(flow, range):
  // Only the bytes the receiver still lacks.
  return the bytes of range at or above flow.rcv_nxt that are marked
    neither Received nor Forgiven on flow.scoreboard

Receiver::Flags(flow):
  // Both flags ride on every acknowledgement and retransmission request.
  entry = steps[StepOf(flow)]
  exhausted = flow.exemption_eligible &&
    entry.forgiven + entry.outstanding + kPacketBytes > entry.budget
  return (flow.exemption_eligible, exhausted)

Receiver::Repair(flow, range):
  // Every refusal takes this path. Mark only the unsettled subranges, so
  // a range that is partly Received keeps what it has.
  Mark(flow.scoreboard, Unsettled(flow, range), Requested)
  SendRetransmissionRequest(range, kNormal, Flags(flow))
```

```cpp
Receiver::OnTrimmedHeader(flow, range):
  missing = Unsettled(flow, range)
  // Nothing missing after all. Acknowledge and charge nothing.
  if (missing is empty):
    SendAck(flow.rcv_nxt, Flags(flow))
    return

  // Only gradients are forgivable. Everything else is requested for
  // retransmission.
  if (!IsGradientAllReduce(flow)):
    Repair(flow, range)
    return

  entry = steps[StepOf(flow)]
  // No loss budget is open for this step, so there is nothing to charge.
  if (entry == null || !entry.open):
    Repair(flow, range)
    return

  // A range trimmed again is already outstanding. Count only new bytes.
  entry.outstanding += Count(bytes of missing not marked Requested)
  len = Count(missing)

  // Vesting. Forgiven bytes stay within a fraction p of the bytes received
  // or forgiven so far.
  if (entry.forgiven + len >
      entry.p * (entry.received + entry.forgiven + len)):
    Repair(flow, range)
    return

  // The draw. A refused range charges nothing and stays outstanding.
  if (!Draw(P)):
    Repair(flow, range)
    return

  // Forgiving charges the loss budget once.
  entry.forgiven += len
  entry.outstanding -= len
  Mark(flow.scoreboard, missing, Forgiven)
  flow.rcv_nxt = Advance(flow.rcv_nxt, flow.scoreboard)
  // The ACK carries the ECN echo either way, so the signal is still
  // there when this flow obeys congestion control again.
  SendAck(flow.rcv_nxt, ecn_echo, Flags(flow))
```

Every path either sends the retransmission request the transport already sends,
or charges the loss budget once.

```cpp
Sender::OnFlowStart(flow):
  // Every flow obeys congestion control until the first report arrives,
  // one round trip after it starts.
  flow.cc_mode = Obeying

Sender::OnReport(flow, exemption_eligible, budget_exhausted):
  // Every acknowledgement and retransmission request is a report. The
  // latest one wins, so the exemption can end and begin again within a
  // step.
  flow.cc_mode =
    (exemption_eligible && !budget_exhausted) ? Exempt : Obeying

Sender::OnCongestionNotification(flow):
  // An exempt sender ignores ECN marks as well as trims. Most of
  // DCQCN's slowdown comes from marks.
  if (flow.cc_mode == Exempt):
    return
  ReduceRate(flow)

Sender::OnRetransmissionRequest(flow, range):
  // OnReport has already applied this request's flags. A refusal alone no
  // longer ends the exemption.
  if (flow.cc_mode == Obeying):
    ReduceRate(flow)
  Retransmit(range)
```

Only `OnTrimmedHeader` charges the loss budget, neither `forgiven` nor
`received` ever falls, and a closed loss budget never reopens. The bound
therefore holds at every instant, not only when a step ends, and `forgiven`
never exceeds $\frac{p}{1 - p} \times \text{received}$ at any instant.

## Results

I ran the worst fabric with three seeds for each policy variant. All variants
drew from one random stream, so the sender-side baseline sheds the same
messages the receiver-side policy may forgive.

Against a tight baseline, $P_{\text{low}} = P_{\text{high}} = 0.005$,
forgiveness with exemption at $P_{\text{high}} = 0.1$ cut the 20-step training
time by 16.1 to 16.7 percent and gave up 7.55 to 7.57 percent of gradient bytes.
The median all-reduce completion time on non-critical steps fell from 32.3 ms to
17.4 ms; on critical steps it stayed at the baseline's. Plain DCQCN with no loss
at all stayed within -1.1 to +0.8 percent of that tight baseline over five
seeds, so every figure here is measured against DCQCN with no loss tolerance.

With the loss budget available in full at step start, the same policy cut
training time by only 9.1 to 10.2 percent, for 7.9 to 8.1 percent of gradient
bytes. The opening burst exhausted it. In one seed's trim-level accounting, the
first fifth of a step trimmed seven times more bytes than the last fifth,
12.3 GB against 1.8 GB. The vested rule forgave 18 percent of the trimmed bytes
that arrived in the first fifth and 60 percent of those in the last. Its bound
is a line through the origin, so it is biased toward the end of the step.
Whether that costs anything is open.

Those runs forgave every range the vesting rule allowed, $P = 1$. At
$P = 0.25$, training time still fell 15.8 to 16.9 percent and the loss fell to
5.5 percent. At $P = 0$ the receiver forgives nothing and the exemption stays:
training time fell 15.0 to 15.7 percent at zero loss, with 9.5 to 10.5 percent
of bytes retransmitted against 5.2 to 5.9 percent under $P = 1$. The exemption
is about fifteen of the sixteen points. Forgiveness is about one point, and it
halves the retransmission load. $P$ is a loss dial rather than a time dial.

Ignoring congestion signals did not destabilize the fabric. Retransmission
timeouts fell by more than half, senders received a third as many congestion
notification packets, and tensor-parallel completion times stayed within 4.4
percent of the baseline either way, inside that metric's seed spread.

Exempt flows sustain a higher sending rate, so the trim rate more than doubled,
from about 3 percent to 6.7 to 7.4 percent. The `budget-exhausted` flag changed
about 0.5 times per exempt flow. Of the exempt flows, 19 percent went back to
obeying congestion control after their exemption began, for 0.17 ms each on
average. The loss-budget invariant held on every step.

The exemption also changes a fabric that barely trims. With eight spines per
leaf the same fabric is not oversubscribed, and the tight baseline trims 0.02 to
0.04 percent of bytes. Seven senders still converge on every receiving link, so
DCQCN cuts rates there on every step, on signals the exemption ignores. Training
time fell 4.5 to 7.5 percent for 1.0 to 1.3 percent of gradient bytes, and
exempt senders trimmed ten times as much as the baseline.

## Forgiveness charges the loss budget only under congestion

Forgiveness and DBLP's sender-side shedding run the same schedule at the same
$P_{\text{low}}$ and $P_{\text{high}}$. What separates them is where the
loss budget goes.

Shedding charges it whether or not the network is congested. Forgiveness
charges it only for bytes the network trimmed. On the worst fabric at the same
loss budget, sender-side shedding gave up 8.1 percent of its gradient bytes,
slightly more than forgiveness, and cut training time by only 2.4 to 3.3
percent.

A loose baseline, $P_{\text{low}} = P_{\text{high}} = 0.1$, sheds through the
critical steps too, which conflicts with the critical learning regime, and
gains nothing for it. Its training time fell 2.6 to 3.9 percent for 10.0 to
10.2 percent of gradient bytes, no more than shedding under the schedule
recovered.

## Limits

Nothing here tests whether a current model tolerates losing up to 10 percent of
its gradient bytes on non-critical steps. DBLP tested
[EfficientNet](https://arxiv.org/abs/1905.11946) and
[ResNet](https://arxiv.org/abs/1512.03385); Weintraub tested 10 percent uniform
loss on Llama 2 7B without phase dependence. My search turned up no published
work on phase-gated gradient loss at
[Transformer](https://arxiv.org/abs/1706.03762) scale, and none measuring loss
that is bursty and correlated, which packet trimming produces.

A deployment has to run a real detector. Calling a critical step ordinary lets
10 percent of its gradient bytes go where the schedule allows 0.5 percent.
Calling a non-critical step critical only forfeits the gain. Nothing here measures
either, and the cheapest check needs no network: replay a detector over the
gradient norms of a real training run and count the steps it misses.

The two host facts no component carries today need no wire change. The decision
does: forgiving a range writes the transport's own reliability state, which on an
RDMA fabric lives in the network interface card rather than in a plugin above it.
MLT hit that wall and retreated to UDP in user space, and FORGIVE asks more of the
card than MLT did. Ultra Ethernet is putting trimming, the retransmission
request for a trimmed header and selective repeat into silicon, which is where
such a card would come from.

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
  the whole gradient with a randomized Hadamard transform.
- [Trimmable gradients](https://doi.org/10.1145/3696348.3696880) lay out each
  packet so its trimmed prefix is already a quantized gradient, which removes
  retransmission entirely and any bound with it: whatever the switch trims is
  accepted.

That last paper's future work asks for a congestion control that deliberately
over-sends and lets the switch trim the excess. The exemption does exactly that,
within the loss budget.

FORGIVE decides per missing range from the switch's trim report, so the bytes it
gives up are the ones the network could not carry rather than the ones that
arrived last. Its loss budget is per receiving rank and training step, not per
model. Its exemption is per flow, stays within that loss budget, and follows
the receiver's latest report on it.

On a fabric that trims and runs selective repeat, the long loss-recovery tail
MLT, LTP and OptiReduce were built to reduce does not exist: those systems ran
on [TCP](https://www.rfc-editor.org/rfc/rfc9293) and UDP with millisecond
timeouts.
Forgiveness alone does not reduce the rate cuts there, and the
exemption accounts for most of the result. The selective-repeat result, the
lightly congested result and the $P = 0$ run exposed that.

The tolerance numbers in the literature come from loss that is uniform and
independent. Packet trimming produces loss that is bursty, correlated across
ranks, and concentrated on the busiest steps. Does a model care about the
difference?
