---
title: "Machine-checked proofs for AI-written software"
description: "A product manager writes the requirements, one agent turns them into Lean, another writes the code, and the checker proves the code satisfies the spec. The human reviews only the formalisation, and most of that pipeline already works today."
date: "2026-09-01"
tags: ["Essays", "Artificial Intelligence", "Software Engineering"]
---

Someone in a group chat this morning was going after a course on generative
software engineering. The objection was that a professor who spent years in
formal methods should know which parts of a system you cannot vibe your way
through. I replied with the line I had been sitting on since July: this year's
frontier models can write Lean.

The rest came out over four more messages. I had been chewing on it since July
and had never written any of it down.

## The pipeline

Start with the entities. Account, device, organisation, policy, and the
relations among them. Those get formalised first, together with the invariants
that hold across the whole business: every device belongs to exactly one
organisation, no policy grants a permission its parent organisation lacks.

Then the product manager writes the local rules, in the precondition, action,
postcondition shape they already use for acceptance criteria. Given a device
enrolled and an administrator holding revoke permission, when revocation runs,
then the device holds no active session.

An agent takes it from there and turns the English into something machine
checkable over those entity relations. Parts of it need temporal logic, since
the requirements that matter are about sequences: what stays true while a
multi-step action is in flight, and what becomes true once it lands.

Then an agent writes the implementation and proves the global invariants and
the pre/post pairs hold under it. A human reads the formalisation and asks
whether it says what the business meant.

If that reading is sound, the product does not pass tests against the spec. It
conforms to it.

## Most of that already runs

[Zhe Ye and colleagues](https://arxiv.org/abs/2608.13522) released Vero in
August: 43 multi-module instances curated from real repositories and translated
into Lean 4, 743 scored APIs, 2,705 specifications, and no Lean solution to any
of them published anywhere, so nothing in it was in anybody's training data.
GPT-5.5 at its highest reasoning setting passes 87.3 percent of those
specifications. A machine wrote implementations and proofs against
human-curated specs, at repository scale, and cleared seven in eight.

The setting matters more than the model. Instances fully solved, out of 43.
GPT-5.5 at high reasoning effort: twenty-seven. Claude Opus 4.8: eight. Claude
Sonnet 5: two. GPT-5.5 at medium effort: two. The gap between one model and
itself is wider than the gap between flagships from different labs, so the
largest improvement available to you today is a configuration flag.

The authors go further and check how a proof got accepted, not only whether it
was. I would not have thought to. 368 specification outcomes get
rejected because the agent closed them with `native_decide`, asking the
compiler to evaluate a claim rather than the kernel to prove it, clustered
where you would expect: 67 in base58, 60 in a bitmask library, 53 in
Reed-Solomon. The best one is the oracle split, where the agent defines the
scored function as a noncomputable copy of the specification's own witness so
the proof becomes trivial, then hangs a real algorithm underneath through
`@[implemented_by]`. The program runs, and it runs the real algorithm. Vero
reports the submission produced no output difference from the reference across
20,440 generated graphs.

Every one of those was caught, by an allowlist naming the three axioms you
accept plus a few hundred lines of grader. That grader was written once, it
covered all 2,705 specifications, and it shipped with the paper. So the human
reads specifications, and the number of those tracks the number of
requirements, which product was always going to write anyway. Code review is
priced per line of code. This is priced per requirement.

## Somebody shipped this in 1999

The four layers I typed into that chat are Event-B, and I did not know it.

Event-B splits a model in two. A context holds carrier sets, constants and
axioms, which is the entity layer. A machine holds invariants and events, each
guarded by a condition and changing state, which is the global-invariant and
precondition-action-postcondition layer. You refine the machine downward toward
an implementation, discharging proof obligations at each step, with a gluing
invariant tying abstract variables to concrete ones.

Its predecessor shipped. The classical B method had a toolset in 1993, and
Paris Métro Line 14 opened driverless in 1999, built by Siemens Mobility France
for RATP with the software and the data held in a single B project. Event-B
came out of the same group in the mid-1990s to widen the scope from software to
whole systems. [Alstom's U400](https://link.springer.com/chapter/10.1007/978-3-030-58298-2_8)
signalling product uses B for code generation and runs on roughly a hundred
metro lines.

The architecture has a quarter century of trains behind it. What kept it inside
railways was the cost of writing the models.

## What it used to cost

seL4 is the number everyone quotes. 8,700 lines of C, around twenty person
years of proof, roughly 200,000 lines of Isabelle, more than twenty lines of
proof for every line of implementation. Gernot Heiser puts design,
implementation and correctness proof together at
[under four hundred dollars a line](https://microkerneldude.org/2016/06/16/verified-software-can-and-will-be-cheaper-than-buggy-stuff/).

He also draws a comparison. Pistachio, a conventionally built microkernel of
similar scope developed a few years earlier under similar conditions, cost
about six person years and made no assurance claims at all. So the money
multiple was two or three. The barrier was staffing a decade of proof
engineers, and almost nobody could.

That is why the deployments all have enormous blast radius. In May, Apple
published its post-quantum
[corecrypto](https://security.apple.com/blog/formal-verification-corecrypto/)
implementations along with the proofs, having verified ML-KEM and ML-DSA
faithful to FIPS 203 and 204 using Cryptol, SAW and Isabelle. corecrypto runs
on more than two and a half billion active devices. The verification caught a
defect in ML-DSA polynomial arithmetic, an unchecked carry that random testing
rarely hit.

Billions of devices buys twenty person years of proof engineering. A device
management product cannot, and that is the arithmetic that is moving.

## Keep the specifications small

The scaling law here comes with its own remedy.
[Matichuk and colleagues](https://trustworthy.systems/publications/nictaabstracts/Matichuk_MAJKS_15.abstract)
analysed 15,018 lemmas and around 215,000 lines of proof from seL4 and the two
largest developments in the Archive of Formal Proofs, and found a consistent
quadratic relationship between the size of a property's formal statement and
the size of its proof. Earlier work on seL4 found effort tracking proof size
linearly, so the chain implies cost growing with the square of specification
size.

A square rewards decomposition. Splitting a specification of size n into k
modules takes the cost from n squared to roughly one kth of that, which reads
as a design instruction, and it is the one Event-B refinement already gives.
Build the entity layer once, keep each machine small, and the exponent stops
deciding whether you can afford this.

Vero shows the same shape from the other end: 87.3 percent of individual
specifications, but 27 of 43 whole instances, because an instance needs every
obligation to close at once.

## A month of work, roughly

Most of the parts are off the shelf. Structured requirements have a whole
tooling ecosystem now, since spec-driven development got product organisations
writing preconditions and postconditions in EARS or Gherkin shape without
anyone calling it formal methods. Lean and its libraries are there. The agents
are there, at 87.3 percent per specification. Vero's grader and axiom allowlist
are published.

What is missing for any given company is the entity layer for its own domain,
the glue between the structured requirement and the formalisation, and a review
surface for the human. A month with coding agents gets you a working loop over
one bounded domain, which I think is an honest estimate. What that month buys
is a demonstration that the loop closes on real requirements, and nobody has
shown that yet.

## Where the seam is

The layer I put in without checking is the least ready of the four.
[Bisharat and colleagues](https://arxiv.org/abs/2606.05792) ran 30 models
across eight families over 205 TLA+ specifications and got 26.6 percent
syntactic correctness from the parser and 8.6 percent semantic correctness from
the model checker, with successes confined to progressive prompting. Vero says
the same thing in a different formalism: every one of the six specifications
that failed on its smart contract instance quantifies over a chain state or an
execution trace, and none of the seventeen that passed does.

That is the sequencing layer, and it carries "mark the device stale if it has
not been seen within a reasonable window." Worth noting the TLA+ study ran
proprietary models under few-shot prompting only, not agentically with a model
checker in the loop, which is the configuration that moved Vero's numbers by an
order of magnitude. Entities and invariants are ready today. Sequencing has
not been measured under the setup that works.

Two smaller things I owe the idea. Curry-Howard, the correspondence making a
proof and a program the same kind of object, is what lets Lean do this at all,
but extracting a program from a proof is a different tradition and not this
pipeline; here the agent writes ordinary code and separately discharges
Hoare-style obligations, and what ships is the code. And proofs do not delete
your tests. Apple, holding real proofs on two and a half billion devices, says
cost limited their scope to the post-quantum work and that they still rely on
conventional cryptographic testing. A proof retires the tests for a property
somebody stated; the rest are still working.

## The experiment I want someone to run

Lean fluency will not scale to product headcount, so the reviewer gets a second
model translating the formal statement back into English and compares two
sentences. Nobody has tested whether a person reading that back-translation
catches a weakened quantifier or a dropped precondition. The nearest evidence
is [IronSpec](https://www.usenix.org/system/files/osdi24-goldweber.pdf), which
found ten specification bugs across all six real verified systems its authors
examined, back when every specification was written by a human expert who cared.

A cheaper version of the same question: how often do two specifications that
differ in meaning back-translate into the same English? A week answers it, and
the answer sets a ceiling on the interface that no model progress raises.

Two things, then, and they are coming apart. Checking that the properties you
stated hold is now nearly automatic, and getting cheaper every quarter. Knowing
you stated the right ones is as hard as it was in 1999. Line 14 managed the
second because the people writing the
requirements knew what a train must never do. Nobody yet knows what an
enterprise device management product must never do. Can a person read a
specification and notice what it forgot to say?
