---
title: "Editorial | \"HDU 3501\" Calculation 2"
description: "Editorial for HDU 3501, using Euler's totient function to prove that the sum of numbers less than n and coprime to n equals n×φ(n)/2."
date: "2020-01-25"
tags: ["Competitive Programming", "Editorial", "Number Theory"]
translation: machine
---

> [Problem statement](http://acm.hdu.edu.cn/showproblem.php?pid=3501) :backup[https://archive.is/d0rtx]

## Problem

Compute the sum of positive integers less than a positive integer $n$ that are not coprime to $n$.

## Editorial

A basic Euler's totient function problem.

Conclusion: the sum of numbers less than $n$ and coprime to $n$ equals $\frac{n\times\varphi(n)} 2$.

> [Code](https://gist.github.com/MinecraftFuns/53a5c887560d3c4fcf47ade3e1ab15a0) :backup[https://archive.is/cfBZB]

### Proof

Consider the following fact:

> If $a,b$ are coprime, then $b-a,b$ are coprime.

List all numbers less than $n$ and coprime to $n$, forming a table of length $\varphi(n)$: $[a_1,a_2,...,a_{\varphi(n)}]$.

Then list a new table $[n-a_1,n-a_2,...,n-a_{\varphi(n)}]$.

By our reasoning, both tables consist of numbers less than $n$ and coprime to $n$, so the two tables should be identical.

Adding corresponding entries of the two tables gives $n$, and both tables have length $\varphi(n)$, so the sum of numbers less than $n$ and coprime to $n$ equals $\frac{n\times\varphi(n)} 2$; the proposition is proved.

### On coding habits

Personally, I'd rather not use `#define` for constants, and use `const` or `constexpr` instead. Also, code shouldn't be full of mysterious magic numbers; use meaningful constant names instead.

`#define int long long` is an extremely bad habit. For the sake of runtime efficiency, you should think carefully about a variable's value range and pick an appropriate type (though that's a different story on Codeforces, since you don't have time to sweat those details when you're rushing out code).

![hero.webp](https://ragnarok.joefang.org/static/xqifcrgr6lll6138ms4ckjvqrrorkfrc9.webp)
