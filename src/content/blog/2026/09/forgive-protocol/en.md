---
title: "The FORGIVE protocol"
description: "Fabric-Overload Relief: Gradients under Iteration-Varying Exemption. A receiver acknowledges past bytes a switch trimmed, within a loss budget that tightens on steps most sensitive to loss. A congested ML training network can then trade bounded loss for less time spent throttled."
date: "2026-09-08"
tags: ["Essays", "Networking", "Artificial Intelligence", "Performance"]
---

Distributed ML training sends gradient updates between machines on every step.
Congestion control and packet loss impose different costs on the network that
carries those updates. With congestion control off, the most congested of eight
network configurations I simulated with [ASTRA-sim](https://astra-sim.github.io/)
trimmed one byte in four of the offered load and carried those bytes again. With
[DCQCN](https://doi.org/10.1145/2785956.2787484) on, that configuration took 24
percent longer to complete. Its senders took millions of rate cuts, and the trim
rate fell sevenfold. The training job pays one of those costs on every step.

[Gradient descent](https://developers.google.com/machine-learning/crash-course/linear-regression/gradient-descent)
can tolerate losing some gradient bytes, though neither at every step nor at any
rate. I call the protocol **F**abric-**O**verload
**R**elief: **G**radients under **I**teration-**V**arying **E**xemption. It
uses that tolerance when a switch trims a packet. It can forgive only gradient
payload and only after a trim, leaving
[tensor-parallel](https://arxiv.org/abs/1909.08053) and
[pipeline-parallel](https://arxiv.org/abs/1811.06965) traffic alone. The budget
tightens during the
[critical learning regime](https://proceedings.mlsys.org/paper_files/paper/2021/hash/acd593d2db87a799a8d3da5a860c028e-Abstract.html),
so a flow eligible on step 12 may be ineligible on step 2. The first trim the
receiver cannot forgive puts the flow back under congestion control.

## A trim reports a missing range

When a queue fills, a switch that supports packet trimming does not drop the
packet. It trims the packet to its header and forwards the header on a
high-priority queue, so the receiver learns which bytes went missing at the
moment they went missing rather than inferring it from a timeout a millisecond
later.
[NDP](https://doi.org/10.1145/3098822.3098825) introduced packet trimming in
2017, and the Ultra Ethernet Consortium made it an optional switch behaviour in
[specification 1.0](https://ultraethernet.org/ultra-ethernet-consortium-uec-launches-specification-1-0-transforming-ethernet-for-ai-and-hpc-at-scale/),
released in June 2025, alongside a
[default bulk mode](https://arxiv.org/abs/2508.08906) that sprays packets across
paths.

A dropped packet gives the receiver no range to decide about. A trimmed packet
does.

## Gradient tolerance varies by step

[Accordion](https://proceedings.mlsys.org/paper_files/paper/2021/hash/acd593d2db87a799a8d3da5a860c028e-Abstract.html)
uses changes in gradient norms to identify critical learning regimes, when the
model is especially sensitive to compression. It keeps compression low in those
periods and compresses hard everywhere else. The paper reports up to 5.5 times
better compression at accuracy comparable to uncompressed training.
[DBLP](https://arxiv.org/abs/2605.01989) applies that schedule to network
transport. It uses a hash draw at the sender to suppress whole gradient messages,
with a tight loss allowance during the critical period and a looser one after it.

[MLT](https://www.usenix.org/conference/nsdi24/presentation/wang-hao) profiled
sixteen convolutional and recurrent neural network models. At the same number of
rounds and the same accuracy, 0.7 to 3.3 percent of gradient bytes were
droppable. Allowing more rounds to reach a quality target raised that to 10
percent. [Weintraub and colleagues](https://arxiv.org/abs/2507.07114) lose 10
percent of [Llama 2](https://arxiv.org/abs/2307.09288) 7B's gradient bytes
uniformly at random for 1.17 percent worse
[perplexity](https://huggingface.co/docs/transformers/perplexity), and 40
percent for 6.65 percent worse.

A budget is a per-step fraction of a rank's gradient bytes. Accordion computes
which steps are critical while training runs; I pinned them instead, to steps 1,
2, 3 and 20, with a budget of 0.005 there and 0.4 everywhere else. Pinning holds
the detector fixed, so the runs below measure the transport alone. They say
nothing about what detector error would cost. Only messages from the gradient
[all-reduce](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html)
are eligible. Tensor-parallel traffic, pipeline traffic, control packets and the
background burst are ineligible.

## Accounting

FORGIVE keeps one accounting entry for each receiving
[rank](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html)
and training step. Each eligible flow's bytes count towards its entry when the
flow starts. The forgiven and suppressed bytes in a (rank, step) entry sum to at
most that step's budget times its eligible bytes. Both counters grow and neither
refunds bytes. An entry closes when that rank's all-reduce for the step
completes. Closed entries forgive nothing.

Sender-side suppression and receiver-side forgiveness charge the same entry. I
compare them at equal budget.

A trimmed packet carries its original sequence number and length. The receiver
calculates how many of its bytes it does not already hold. A re-segmented
retransmission can straddle the cumulative acknowledgement, so charging the full
length would spend budget on bytes already in hand. The receiver either forgives
the missing range and acknowledges past the hole as if the bytes arrived, or
requests it with the transport's existing NACK. It sends an ACK when it forgives
and a NACK when it does not.

## Selective repeat removes the repair saving

I built the receiver-side half first. It appeared to reduce training time by 4
to 11 percent. The transport underneath was go-back-N, and a control run with
[selective repeat](https://www.rfc-editor.org/rfc/rfc2018) showed the same
congestion burst costing 29 ms instead of 1.8 s. Go-back-N put up to 79 bytes on
the wire for every byte the policy removed. I had measured the transport's
amplification rather than the policy. Nobody deploys go-back-N without
congestion control.

I then tested eight network configurations with 64 ranks at 400 Gbps, varying
congestion control, the number of senders per all-reduce, and the
oversubscription at the spine switches. The congestion episode cost under 1
percent of the total time for 20 training steps in every configuration. A
sender-side policy that drops messages before sending them could not shorten
enough of that time. Forgiveness that only skips a repair round can save at most
one round trip per flow. This is under 0.2 percent of an all-reduce.

The eight configurations showed a cost from congestion control. With DCQCN, the
trim rate was lower by a factor of seven to ten and the total time for 20 training
steps was 18 to 24 percent longer. Senders took 3.3 to 13.5 million rate cuts per
run. The loss budget allowed the trims DCQCN avoided, but a real training run has
not tested whether the model tolerates that loss.

## Rate-control exemption

The sender of a flow whose trimmed bytes are eligible for forgiveness
also ignores congestion signals. It does not reduce its sending rate until the
receiver requests a retransmission for one of its trims. The sender then obeys
congestion control again. Its lost bytes remain within the budget.

The exemption covers both [ECN](https://www.rfc-editor.org/rfc/rfc3168) marks
and trim notifications. In the DCQCN configuration here, switches begin
ECN-marking at 800 KB of queue and trim only when the 4 MiB data queue is full.
Marks arrive long before trims. In the most congested configuration, at least 74
percent of rate cuts came from marks that no forgiven trim affects. Exempting
only trim-triggered cuts would leave those in place. Eligible senders ignore
every congestion notification packet.

All flows to a receiving rank share its budget entry, but no sender can read the
remaining budget. A retransmission request tells the sender that the receiver
will not forgive a trim. The first request on an exempt flow puts that flow back
under congestion control and applies its rate cut. It needs no new packet type or
header change.

## State and decision

FORGIVE runs on an RDMA fabric with packet trimming and selective repeat. The
data queue loses packets. The high-priority queue that carries trimmed headers
does not. A rate-based congestion control runs underneath: DCQCN in every run
below, and Ultra Ethernet's NSCC once I model it. The receiver already accepts
out-of-order arrival, since the fabric sprays packets across paths. FORGIVE adds
no packet type and changes no header.

The switch trims and does nothing further. It reports a missing range and
decides nothing about it. Each rank runs the detector over its own gradients and
opens its own entry, so a receiver's budget comes from its own verdict on the
step. The scoreboard and the verdict live at the receiver. The mode bit lives at
the sender.

The detector runs before a step's gradient traffic starts. It reads the rate of
change in gradient norms, Accordion's criterion, and classifies the step as
inside or outside the critical learning regime. The classification picks one of
two budgets, and that budget parameterises the step's entry. No list of critical
steps exists anywhere in the protocol.

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
- `cc_mode: Mode`. `Exempt` or `Obeying`, set when the flow is created and
  cleared by the first retransmission request the receiver sends it.

State per receiving rank and training step, opened when the step begins and
shared by every flow to that rank:

- `budget: float`. Set to `kBudgetCritical` or `kBudgetOther` by the detector's
  verdict on this step.
- `eligible: int`. Gradient bytes registered for this rank and step.
- `forgiven: int`. Bytes the receiver acknowledged without receiving.
- `suppressed: int`. Bytes the sender shed before sending.
- `open: bool`. `True` until this rank's all-reduce for the step completes.

`eligible` is the gradient bytes destined for that rank in that step, which the
collective schedule fixes before the step starts. For every rank and step, at
all times, `forgiven + suppressed` is at most `budget * eligible`. A step whose
entry was never opened forgives nothing, so a receiver that has heard no verdict
for a step repairs it the ordinary way.

A run spends its budget in one place, either shedding at the sender or forgiving
at the receiver. The entry carries both counters so the two can be compared at
the same budget.

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

A retransmission can be re-segmented, so a reported range may overlap bytes the
receiver already has.

```cpp
UnsettledBytes(flow, range):
  // Only the bytes the receiver still lacks. A retransmission can carry
  // bytes it already holds, and those cost no budget.
  return the bytes of range that are >= flow.rcv_nxt and are marked
    neither Received nor Forgiven on flow.scoreboard
```

`OnTrimmedHeader` runs when a trimmed header reports a missing range.

```cpp
OnTrimmedHeader(flow, range):
  n = UnsettledBytes(flow, range)
  // Nothing missing after all. Acknowledge and spend nothing.
  if (n == 0):
    SendAck(flow.rcv_nxt)
    return

  // Only gradients are forgivable. Tensor, pipeline and control traffic
  // is always repaired.
  if (!IsGradientAllReduce(flow)):
    SendRetransmissionRequest(range, kNormal)
    return

  (rank, step) = Coordinates(flow)
  entry = ledger[rank][step]
  // No budget open for this step, so there is nothing to spend.
  if (entry == null || !entry.open):
    SendRetransmissionRequest(range, kNormal)
    return

  // The budget will not cover these bytes, so ask for them. That request
  // also puts the sender back under congestion control.
  if (entry.forgiven + entry.suppressed + n >
      entry.budget * entry.eligible):
    SendRetransmissionRequest(range, kNormal)
    return

  // Forgiving spends budget once and never gives it back.
  entry.forgiven += n
  flow.scoreboard[range] = Forgiven
  flow.rcv_nxt = Advance(flow.rcv_nxt, flow.scoreboard)
  // The ACK still carries the ECN echo, so forgiving a range hides no
  // congestion from the sender.
  SendAck(flow.rcv_nxt, ecn_echo)
```

Every path either sends the retransmission request the transport already sends,
or charges the budget once. No new packet type and no header change.

At the sender, the two congestion signals:

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

A flow that reaches `Obeying` stays there until it finishes.

Only the charge in `OnTrimmedHeader` writes the budget, `forgiven` and
`suppressed` never fall, and a closed budget never reopens. The bound therefore
holds throughout a run, not only when a step ends, and the telemetry can check
it while the run is going.

## Results

I tested the most congested configuration with three random seeds and four
policy variants per seed. All variants used one random selection stream, so the
sender-side baseline suppresses the same messages that the receiver-side policy
may forgive.

Against a baseline with a 0.005 loss budget on every step, forgiveness with
exemption shortened the total time for 20 training steps by 12.9, 13.1 and 13.5
percent across the three seeds. The all-reduce span on non-critical steps fell
from 36 ms to 21 ms. The critical-step span stayed at 37 ms, within 0.9 ms of the
baseline. The 218 ms saving came from the 16 non-critical steps. Retransmission
timeouts fell by two thirds and applied rate cuts by half. Tensor-parallel spans
fell as well, because gradient flows leave the leaf switch sooner.

Exempt flows push harder, so the trim rate rose slightly, from 0.031 to 0.033,
and two thirds of those trims were forgiven. Per seed the exempt run ignored
10.4 to 10.9 million congestion notifications, acted on 6.0 to 6.4 million, and
returned 12 to 13 thousand of its 71,680 eligible flows to congestion control.
The budget rule held in all 1,280 accounting entries of every arm.

I preregistered a prediction that a lightly congested configuration would show
no movement because it hardly trims. That prediction was wrong, and I withdrew
it. With DCQCN, senders took 3.3 million rate cuts in that configuration from
ECN marks alone. The exemption applies to those marks. The total time for 20
training steps fell 4 percent, trims doubled, and the receiver forgave every
additional trim. The burst drained 5 to 22 percent slower. On a fabric this
lightly congested the exemption returns little and costs little.

## Forgiveness uses the budget at congestion

DBLP uses phase-aware sender-side shedding:
it suppresses gradient messages by a random draw based on the training step. I
compare it with receiver-side forgiveness at the same budget.

Sender-side shedding uses its loss budget by a random draw whether or not the
network is congested. Forgiveness uses budget only on bytes the network trims.
In the most congested configuration, the FORGIVE variant lost 8.8 to 9.5 percent
of its gradient bytes; shedding at the same budget lost 32 percent, a factor of
3.4. FORGIVE completed the 20 training steps sooner in every seed.

A comparison that sheds 40 percent of gradient bytes on every step ran in 1433
to 1466 ms, against FORGIVE's 1459 to 1468 ms. It also sheds through the
critical steps. That conflicts with the critical learning regime assumed by the
work here.

Network congestion varies over time. A trim report identifies the range and
moment where the network would not carry the traffic.

## Limits

Whether a current model tolerates losing 9 percent of its gradient bytes on
non-critical steps is assumed, not tested. DBLP tested
[EfficientNet](https://arxiv.org/abs/1905.11946) and
[ResNet](https://arxiv.org/abs/1512.03385); Weintraub tested 10 percent uniform
loss on Llama 2 7B without phase dependence. My search turned up no published
work on phase-gated gradient loss at
[Transformer](https://arxiv.org/abs/1706.03762) scale, and none measuring loss
that is bursty and correlated, which packet trimming produces. The budget is an
assumed tolerance until a training run tests it.

The critical steps were pinned rather than detected. A deployment has to run a
detector, and a detector makes two kinds of mistake. Calling a critical step
ordinary puts a loose budget on the step least able to afford it, which is the
failure the whole schedule exists to prevent. Calling an ordinary step critical
only forfeits the gain. Nothing here measures either, and the cheap first test
does not need the network at all: replay a detector over the gradient norms of a
real training run and count the steps it misses.

The congestion control is DCQCN, because that is what the simulator models.
Meta runs its 400 Gbps ML training networks
[with DCQCN off](https://engineering.fb.com/wp-content/uploads/2024/08/sigcomm24-final246.pdf),
where the exemption has nothing to act on. Ultra Ethernet's default is
[Network Signal-based Congestion Control](https://ultraethernet.org/wp-content/uploads/sites/20/2025/06/UE-Specification-6.11.25.pdf#page=377),
a window-based controller that adjusts on round-trip time, ECN marks and
optionally trims, which I have not modelled. The idea may transfer to controls
that react to marks and trims. Nothing here tests that.

The simulation has one training job. Exempt flows shared the network with their
own job's tensor-parallel traffic and a single background burst, never with
another job's flows obeying congestion control. The cost of the exemption would
fall on such a neighbour. The budget bounds that cost, and the refusal revokes
the exemption. A flow that ignores every congestion signal offers neither
measure. Bounding a cost is not the same as showing a neighbour can absorb it,
and only a run with a second job would show that.

The simulation has 64 ranks with tensor parallelism on the network, so eligible
gradient traffic is only 24 percent of the bytes. The mechanism can therefore
reach at most a quarter of the traffic available on a network carrying data and
pipeline parallelism alone. Tensor parallelism over
[NVLink](https://www.nvidia.com/en-us/data-center/nvlink/) keeps its own traffic
off this network.

## Prior work

Before training, MLT has sender and receiver agree on a tolerated fraction for
each tensor. Once enough of a tensor has arrived, the receiver stops requesting
retransmissions, so the bytes it gives up are whichever arrive last. Its bound is
per model and constant over training. It weakens congestion control globally for
every flow with no way back, and its transport is
[UDP](https://www.rfc-editor.org/rfc/rfc768) in user space; the authors say
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

FORGIVE decides per missing range from the switch's trim report on a network
with selective repeat. The lost bytes are the ones the network could not carry,
not the ones that happened to be late. Its budget is per receiving rank and
training step. Sender suppression and receiver forgiveness both charge it. The
congestion-control exemption applies per flow, stays within that budget, and the
receiver's first refusal revokes it.

On a network that trims packets and runs selective repeat, the long repair tail
that MLT, LTP and OptiReduce were built to reduce does not exist. Those systems
used [TCP](https://www.rfc-editor.org/rfc/rfc9293) and UDP with millisecond
timeouts. In these simulations, forgiveness alone does not reduce the
congestion-control reaction. The exemption accounts for the result. I did not
expect that when I started, and two negative results exposed it.

The tolerance numbers I found in the literature come from loss that is uniform
and independent. Packet trimming produces loss that is bursty, correlated across
ranks, and concentrated on the busiest network steps. Does a model care about the
difference?
