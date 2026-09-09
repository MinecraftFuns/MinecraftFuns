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
trimmed one offered byte in four and carried it again. With
[DCQCN](https://doi.org/10.1145/2785956.2787484) on, that configuration took 24
percent longer to complete. Its senders took millions of rate cuts, and the trim
rate fell sevenfold. The training job pays one of those costs on every step.

[Gradient descent](https://developers.google.com/machine-learning/crash-course/linear-regression/gradient-descent)
can tolerate losing some gradient bytes, though neither at every step nor at any
rate. I call the protocol **F**abric-**O**verload
**R**elief: **G**radients under **I**teration-**V**arying **E**xemption. It
uses that tolerance when a trimming switch reports congestion. It can forgive
only gradient payload and only after a trim, leaving
[tensor-parallel](https://arxiv.org/abs/1909.08053) and
[pipeline-parallel](https://arxiv.org/abs/1811.06965) traffic alone. The budget
tightens during the
[critical learning regime](https://proceedings.mlsys.org/paper_files/paper/2021/hash/acd593d2db87a799a8d3da5a860c028e-Abstract.html),
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

Some training steps tolerate lost gradient updates better than others.
[Accordion](https://proceedings.mlsys.org/paper_files/paper/2021/hash/acd593d2db87a799a8d3da5a860c028e-Abstract.html)
uses changes in gradient norms to identify critical learning regimes, when the
model is especially sensitive to compression. It keeps compression low in those
periods and compresses hard everywhere else, reporting up to 5.5 times better
compression at accuracy comparable to uncompressed training.
[DBLP](https://arxiv.org/abs/2605.01989) applies that schedule to network
transport. It uses a hash draw at the sender to suppress whole gradient messages,
with a tight loss allowance during the critical period and a looser one after it.

[MLT](https://www.usenix.org/conference/nsdi24/presentation/wang-hao) profiled
sixteen convolutional and recurrent neural network models and found 0.7 to 3.3
percent of gradient bytes droppable at the same number of rounds and the same
accuracy, and 10 percent when the target is a quality level and more rounds are
allowed. [Weintraub and colleagues](https://arxiv.org/abs/2507.07114) lose 10
percent of [Llama 2](https://arxiv.org/abs/2307.09288) 7B's gradient bytes
uniformly at random for 1.17 percent worse
[perplexity](https://huggingface.co/docs/transformers/perplexity), and 40
percent for 6.65 percent worse.

My budget is a per-step probability. In my runs, critical steps 1, 2, 3 and 20
have a budget of 0.005; every other step has a budget of 0.4. Only messages from
the gradient
[all-reduce](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html)
are eligible. Tensor-parallel traffic, pipeline traffic, control packets and the
background burst are ineligible.

## Accounting

FORGIVE keeps one accounting entry for each receiving
[rank](https://docs.nvidia.com/deeplearning/nccl/user-guide/docs/usage/collectives.html)
and training step. Every eligible network flow records its byte count when it is
sent. Forgiven bytes plus suppressed bytes for a (rank, step) entry never exceed
that step's probability times the eligible bytes in the entry. Both counters grow
and neither refunds bytes. An entry closes when that rank's all-reduce for the
step completes. Closed entries forgive nothing.

Sender-side suppression and receiver-side forgiveness charge the same entry. I
compare them at equal budget.

A trimmed packet carries its original sequence number and length. The receiver
calculates how many of its bytes it does not already hold. A re-segmented
retransmission can straddle the cumulative acknowledgement point, so charging the
full length would spend budget on bytes already in hand. The receiver either
forgives the missing range and acknowledges past the hole as if the bytes
arrived, or requests it with the transport's existing trim NACK. It sends an ACK
when it forgives and a trim NACK when it does not.

## Selective retransmission removes the repair saving

I built the receiver-side half first. It appeared to reduce training time by 4
to 11 percent. The transport underneath was go-back-N, and a control run with
selective retransmission showed the same congestion burst costing 29 ms instead
of 1.8 s. Under go-back-N every trim made the sender resend its whole window,
up to 79 bytes on the wire for every byte the policy removed. I had measured
the transport's amplification rather than the policy. Nobody deploys go-back-N
without congestion control.

I then tested eight network configurations with 64 ranks at 400 Gbps, varying
congestion control, the number of senders per all-reduce, and the bandwidth
shared at the network spines. The congestion episode cost under 1 percent of the
total time for 20 training steps in every configuration. A sender-side policy that
drops messages before sending them could not shorten enough of that time.
Forgiveness that only skips a repair round can save at most one round trip per
flow. This is under 0.2 percent of an all-reduce.

The eight configurations showed a cost from congestion control. With DCQCN, the
trim rate was lower by a factor of seven to ten and the total time for 20 training
steps was 18 to 24 percent longer. Senders took 3.3 to 13.5 million rate cuts per
run. The loss budget allowed the trims DCQCN avoided, but a real training run has
not tested whether the model tolerates that loss.

## Rate-control exemption

The sender of a network flow whose trimmed bytes are eligible for forgiveness
also ignores congestion signals. It does not reduce its sending rate until the
receiver requests a retransmission for one of its trims. The sender then obeys
congestion control again. Its lost bytes remain within the budget.

The exemption covers both [ECN](https://www.rfc-editor.org/rfc/rfc3168) marks,
which report congestion before a queue is full, and trim notifications. In the
DCQCN configuration here, switches begin ECN-marking at 800 KB of queue and trim
only when the 4 MiB data queue is full. Marks arrive long before trims. In the
most congested configuration, at least 74 percent of rate cuts came from marks
that no forgiven trim affects. Exempting only trim-triggered cuts would leave
three cuts in four in place. Eligible senders ignore every congestion
notification packet, or CNP.

All flows to a receiving rank share its budget entry, but no sender can read the
remaining budget. A retransmission request tells the sender that the receiver
will not forgive a trim. The first request on an exempt flow puts that flow back
under congestion control and applies its rate cut. It needs no new packet type or
header change.

## State and decision

The receiver keeps a scoreboard per flow, the sender keeps one mode bit, and
every flow arriving at a rank shares that rank's loss budget for the step.

Constants:

- `kCriticalSteps: set[Step]`. The steps the schedule treats as critical,
  `{1, 2, 3, 20}` in these runs.
- `kBudgetCritical: float`. The fraction of a rank's eligible gradient bytes
  that may be lost on a critical step, `0.005` here.
- `kBudgetOther: float`. The same fraction on every other step, `0.4` here.

State per flow, at the receiver:

- `rcv_nxt: Seq`. The lowest sequence number not yet settled, whether it was
  settled by arrival or by forgiveness.
- `scoreboard: dict[Range, State]`. The ranges above `rcv_nxt`, each one
  `Requested`, `Forgiven` or `Received`.
- `cc_mode: Mode`. `Exempt` or `Obeying`, set when the flow is created and
  cleared by the first retransmission request the receiver sends it.

State per receiving rank and training step, shared by every flow to that rank:

- `eligible: int`. Gradient bytes registered for this rank and step.
- `forgiven: int`. Bytes the receiver acknowledged without receiving.
- `suppressed: int`. Bytes the sender shed before sending.
- `budget_open: bool`. `True` until this rank's all-reduce for the step
  completes.

For every rank and step, at all times, `forgiven + suppressed` is at most
`Budget(step) * eligible`, where `Budget` returns `kBudgetCritical` on a step in
`kCriticalSteps` and `kBudgetOther` otherwise.

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
  return the bytes of range that are >= flow.rcv_nxt and are marked
    neither Received nor Forgiven on flow.scoreboard
```

`OnTrimmedHeader` runs when a trimming switch reports a missing range.

```cpp
OnTrimmedHeader(flow, range):
  n = UnsettledBytes(flow, range)
  if (n == 0):
    SendAck(flow.rcv_nxt)
    return

  if (!IsGradientAllReduce(flow)):
    SendRetransmissionRequest(range, kNormal)
    return

  (rank, step) = Coordinates(flow)
  if (step not in kSchedule):
    SendRetransmissionRequest(range, kNormal)
    return

  entry = ledger[rank][step]
  if (!entry.budget_open):
    SendRetransmissionRequest(range, Priority(step))
    return

  if (entry.forgiven + entry.suppressed + n >
      Budget(step) * entry.eligible):
    SendRetransmissionRequest(range, Priority(step))
    return

  entry.forgiven += n
  flow.scoreboard[range] = Forgiven
  flow.rcv_nxt = Advance(flow.rcv_nxt, flow.scoreboard)
  SendAck(flow.rcv_nxt, ecn_echo)
```

Every path either sends the retransmission request the transport already sends,
or charges the budget once. No new packet type and no header change. The ACK
carries the ECN echo, so forgiving a range does not hide from the sender the
congestion that caused the trim.

At the sender, the two congestion signals:

```cpp
OnCongestionNotification(flow):
  if (flow.cc_mode == Exempt):
    cnp_ignored++
    return
  ReduceRate(flow)

OnRetransmissionRequest(flow, range):
  flow.cc_mode = Obeying
  ReduceRate(flow)
  Retransmit(range)
```

Re-arming comes before the staleness check, so a stale request still counts as a
refusal. A flow that reaches `Obeying` stays there until it finishes.

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
baseline. The 218 ms saving came from the 16 non-critical steps, whose all-reduce
spans fell by about 15 ms each. Retransmission timeouts fell by two thirds and
taken rate cuts by half because exempt flows leave the leaf switch sooner.

Exempt flows push harder, so the trim rate rose slightly, from 0.031 to 0.033,
and two thirds of those trims were forgiven. Per seed the exempt run ignored
10.4 to 10.9 million congestion notifications, acted on 6.0 to 6.4 million, and
returned 12 to 13 thousand of its 71,680 eligible flows to congestion control.
The budget rule held in every accounting entry.

I preregistered a prediction that a lightly congested configuration would show
no movement because it hardly trims. That prediction was wrong, and I withdrew
it. With DCQCN, senders took 3.3 million rate cuts in that configuration from
ECN marks alone. The exemption applies to those marks. The total time for 20
training steps moved 4 percent, trims doubled, and the receiver forgave every
additional trim.

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
to 1466 ms, against FORGIVE's 1459 to 1468 ms. It also sheds through the critical
steps and gives up 40 percent of the gradient bytes. That conflicts with the
critical learning regime assumed by the work here.

Network congestion varies over time. A trim report identifies the range and
moment where the network would not carry the traffic.

## Limits

Whether a current model tolerates losing 9 percent of its gradient bytes on
non-critical steps is assumed, not tested. DBLP tested
[EfficientNet](https://arxiv.org/abs/1905.11946) and
[ResNet](https://arxiv.org/abs/1512.03385); Weintraub tested 10 percent uniform
loss on Llama 2 7B without phase dependence. Nobody has published phase-gated
gradient loss at
[Transformer](https://arxiv.org/abs/1706.03762) scale or measured loss that is
bursty and correlated, which packet trimming produces. The budget is an assumed
tolerance until a training run tests it.

The congestion control is DCQCN, because that is what the simulator models.
Meta runs its 400 Gbps ML training networks
[with DCQCN off](https://engineering.fb.com/wp-content/uploads/2024/08/sigcomm24-final246.pdf),
where the exemption has nothing to act on. Ultra Ethernet's default is
[Network Signal-based Congestion Control](https://ultraethernet.org/wp-content/uploads/sites/20/2025/06/UE-Specification-6.11.25.pdf#page=377),
a window-based controller with a trim-triggered fast adaptation that I have not
modelled. The idea may transfer to controls that react to marks and trims. I have
not measured that transfer.

The simulation has one training job. Exempt flows shared the network with their
own job's tensor-parallel traffic and a single background burst, never with
another job's flows obeying congestion control. The cost of the exemption would
fall on such a neighbour. The budget bounds that cost, and the refusal revokes
the exemption. A flow that ignores every congestion signal offers neither
measure. Neither proves the cost is acceptable to a neighbour.

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
bounds each round by an adaptive timeout and makes the resulting loss harmless
with Hadamard mixing of the gradient.
[Trimmable gradients](https://doi.org/10.1145/3696348.3696880) lay out each
packet so that its trimmed prefix is already a quantised gradient. This removes
retransmission entirely, without a bound: whatever the switch trims is accepted.
That paper's future work asks for a congestion control that deliberately
over-sends and lets the switch trim the excess. The exemption has that behaviour
within a budget.

FORGIVE decides per missing range from the switch's trim report on a network that
supports selective retransmission. The lost bytes are the ones the network could
not carry, not the ones that happened to be late. Its budget is per receiving
rank and training step. Sender suppression and receiver forgiveness both charge
it. The congestion-control exemption applies per flow, stays within that budget,
and the receiver's first refusal revokes it.

On a network that trims packets and supports selective retransmission, the long
repair tail that MLT, LTP and OptiReduce were built to reduce does not exist.
Those systems used [TCP](https://www.rfc-editor.org/rfc/rfc9293) and UDP with
millisecond timeouts. In these simulations, forgiveness alone does not reduce the
congestion-control reaction. The exemption accounts for the result. I did not
expect that when I started, and two negative results exposed it.

The tolerance numbers I found in the literature come from loss that is uniform
and independent. Packet trimming produces loss that is bursty, correlated across
ranks, and concentrated on the busiest network steps. Does a model care about the
difference?
