---
title: "DASCTF easystream3: recovering an LFSR from four known characters"
description: "A writeup for the easystream3 crypto challenge: the keystream hands you the register's state for free, and the mask is small enough to brute force."
date: "2022-09-30"
tags: ["CTF", "Security"]
---

> `name`: easystream3  
> `category`: crypto  
> `tag`: stream cipher  
> `flag`: `DASCTF{88ac22ea2ce99c7a325fe6ce2ddd3718}`  

This was my first CTF. I am a first-year undergraduate and I knew close to
nothing about security going in, so I expected to be lost. Competitive
programming turns out to prepare you for more of it than I thought: both reward
writing code quickly, and both reward keeping your nerve when the thing in front
of you does not make sense yet. The difference is that an OI problem tells you
what it wants, and a CTF problem makes you work that out first.

![hero.webp](https://ragnarok.joefang.org/static/xeenv11353go28aobqp0sp539k0r24l6m.webp)

The source is on [GitHub Gist](https://gist.github.com/MinecraftFuns/d6873a1b8aa67d83df02408afb58e2a4),
and it is worth reading before the rest of this.

## What the register actually does

The problem points you at `class lfsr()`.

```py
class lfsr():
    def __init__(self, seed, mask, length):
        self.length_mask = 2 ** length - 1
        self.mask = mask & self.length_mask
        self.state = seed & self.length_mask
        print(self.state, self.mask)

    def next(self):
        next_state = (self.state << 1) & self.length_mask
        i = self.state & self.mask & self.length_mask
        output = 0
        while i != 0:
            output ^= (i & 1)
            i = i >> 1
        next_state ^= output
        self.state = next_state
        return output

    def getrandbit(self, nbit):
        output = 0
        for _ in range(nbit):
            output = (output << 1) ^ self.next()
        return output
```

Two things fall out of `next()`.

The first is how the output bit is computed. `i` is `state & mask`, and the loop
XORs all of its bits together, so `output` is the parity of `state & mask`. In
C++ it would be `std::popcount(state & mask) & 1`.

The second is where that bit goes. `state` is shifted left by one, the top bit
falls off the end under `length_mask`, and `output` is XORed into the bottom.
The output bit is not merely derived from the state; it becomes part of it.

That second point is the whole challenge. The register is 32 bits wide, so after
32 calls to `next()` the original seed is gone and the state *is* the last 32
output bits. Those bits are not secret: they follow immediately from the four
characters the flag has to begin with, `DASC`. The state costs nothing to
recover.

## Brute-forcing the mask

That leaves `mask`, and there is nothing clever in
[my solution](https://gist.github.com/MinecraftFuns/44173a642b4886c86a2f4198f02c20a2).
It walks all $2^{32}$ values of a 32-bit unsigned integer and keeps whichever
ones reproduce the next three known bytes, `TF{`, and the closing `}`. Crude,
but a 32-bit space is small enough that crude is the correct answer.

## Verdict

easystream3 is entry level and needs very little insight. If it were a
Codeforces problem I would tag it `implementation`.

> This article is also available in [Chinese](https://ragnarok.joefang.org/static/x56c6fe33759pnuroopva8hslmkuptif5.pdf).
