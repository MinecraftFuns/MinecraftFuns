---
title: "Editorial | \"LightOJ 1289\" LCM from 1 to n"
description: "Editorial for LightOJ 1289, computing lcm(1,2,...,n) in O(n) with a linear sieve plus a recurrence relation."
date: "2020-01-25"
tags: ["Competitive Programming", "Editorial", "Number Theory"]
translation: machine
---

> [Problem statement](https://lightoj.com/problem/lcm-from-1-to-n) :backup[https://archive.is/DSCtc]

## Problem

> Find $\operatorname{lcm}(1,2,...,n)$, multiple test cases.

## Editorial

> `MicroMaker`, resident OI legend, reckoned it had something to do with Euler's totient function, but I stared at it for a while and came up with nothing.
> So brute force it is.

First, use a linear sieve to sieve out all primes in $1\sim 10^8$.
Then consider the following property:

If $n+1=p^k$, where $p$ is a prime, then $\operatorname{lcm}(1,2,...,n+1)=\operatorname{lcm}(1,2,...,n)\times p$;
otherwise, $\operatorname{lcm}(1,2,...,n+1)=\operatorname{lcm}(1,2,...,n)$.

Since the time limit for this problem is $4$ seconds, once we have the recurrence we can push a hundred million through in $O(n)$.

> [Code](https://gist.github.com/MinecraftFuns/ad6289e286a4bddd396a3e58ad3f2e0e) :backup[https://archive.is/PlTAP]

![hero.webp](https://ragnarok.joefang.org/static/xd16scumvtp5qkpclvg9adlj2bhnviu8d.webp)
