---
title: "A Few Notes on Digit DP"
description: "Notes on the digit DP technique, with code for five example problems from LightOJ, HDU, and SPOJ."
date: "2020-01-31"
tags: ["Competitive Programming", "Dynamic Programming"]
translation: machine
---

> Digit DP is used to solve problems of the following form:
> *Given a closed interval $[L,R]$, find the total number of integers in this interval that satisfy **some condition**.*
>
> Digit DP is a fairly simple idea: it enumerates the possibilities digit by digit, and adds a cache for the common part.
> For problems with **multiple test cases**, the cache **does not need to be cleared** between test cases (because the cache targets the general case, while boundary cases are counted directly without caching, so the cache can be shared).
>
> Personally, I feel that implementing digit DP with `memoized DFS` is a bit easier than with plain `DP`.
> One property of digit DP is that `dfs(x, y, z)` is fully determined once the triple `(x, y, z)` is fixed, so it can be cached. But at boundary cases the cache is not general, so those are counted directly.
>
> What digit DP does is this: brute-force counting enumerates as $\operatorname{for} i \in [l,r]$, with no shared part, but digit DP counts by fixing each digit one at a time, which gives it the advantage that a large amount of repetition appears and can be optimized away.

## [LightOJ 1140] How Many Zeroes?

[Problem statement](https://lightoj.com/problem/how-many-zeroes) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/XMt5F)

> Problem

Find the total number of $0$ digits across the decimal representations of the numbers in the interval $[m,n]$.

> [Code](https://gist.github.com/MinecraftFuns/1b9c14c48f3b97ef0569118ab4d5b8f0) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/Q1cKT)

## [HDU 2089] No 62

[Problem statement](http://acm.hdu.edu.cn/showproblem.php?pid=2089) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/3qZ07)

> Problem

Find the count of numbers in the interval $[m,n]$ whose decimal representation contains neither **consecutive** $62$ nor the digit $4$.

> [Code](https://gist.github.com/MinecraftFuns/7cb99fc1f7a3d49d276150e631e1cae6) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/GhRzB)

## [HDU 3555] Bomb

[Problem statement](http://acm.hdu.edu.cn/showproblem.php?pid=3555) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/s4kqt)

> Problem

Find the count of numbers in the interval $[1,N]$ whose decimal representation contains consecutive $49$.

> [Code](https://gist.github.com/MinecraftFuns/7b44a11ad2577f184308d6922679e2a1) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/HkwAi)

See the comments.

## [SPOJ BALNUM] Balanced Numbers

[Problem statement](https://www.spoj.com/problems/BALNUM/) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/mcUdB)

> Problem

A positive integer is considered a **balanced number** if:

1. every even digit appears an odd number of times in its decimal representation, and
1. every odd digit appears an even number of times in its decimal representation.

~~That translation above is pretty much garbage, just get the gist.~~

For example, $77$, $211$, $6222$, and $112334445555677$ are balanced numbers, while $351$, $21$, and $662$ are not.

Given an interval $[A,B]$, find the count of balanced numbers in it.

> [Code](https://gist.github.com/MinecraftFuns/8858579de244917dc00ac2945562d9fa) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/VbQNF)

See the comments.

## [SPOJ MYQ10] Mirror Number

[Problem statement](https://www.spoj.com/problems/MYQ10/) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/iMb7a)

> Problem

A **mirror number** is a palindrome containing only the digits $0$, $1$, and $8$.

Find how many mirror numbers are in $[a,b]$.

> [Code](https://gist.github.com/MinecraftFuns/8ecae1ca0531d6c867636f2cc603b547) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/kPbc1)

The data range is $10^{44}$, so the input has to be stored in a character array.
Also remember to special-case whether $a$ itself is a palindrome.

---

If you need to compile and run this, you can go to the [Gist](https://gist.github.com/MinecraftFuns/9eb0c738620c9b0b805dddb5b3f2a03c) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/yGvqo) to copy the common header.

If your compiler does not support C++11, change `constexpr` to `const`.

![hero.webp](https://ragnarok.joefang.org/static/x7edpe48fsn0iu41d8hi0qbjn89r78bmf.webp)
