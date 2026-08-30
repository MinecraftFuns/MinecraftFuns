---
title: "Editorial | CF986 / Codeforces Round 485 (Div. 1)"
description: "Editorial for a virtual-contest run of Codeforces Round 485 (Div. 1), covering the approach and solution for problems A through F."
date: "2020-12-25"
tags: ["Codeforces", "Editorial"]
translation: machine
---

* [Link](https://codeforces.com/contest/986) :backup[https://archive.is/Stt8O]
* [Reference code](https://gist.github.com/MinecraftFuns/e6138d1ec8a09d6b53fb9c59b0b03442) :backup[https://archive.is/dmAM4]

![0.webp](https://ragnarok.joefang.org/static/x5gef7arlska2hl3bngdu32259d9ncll8.webp)

## Problems not solved independently

* D (hard to implement)
* E

## A

> Problem

A connected graph with $n$ vertices and $k$ kinds of goods, one kind at each vertex. The cost of shipping goods is the shortest-path distance between the two vertices. For each vertex, find the minimum cost to gather s kinds of goods there. $n\le 10^5,k\le 100$.

> Solution

Note that $k$ is small, so run a shortest-path search for each kind of goods; `dis[i][j]` denotes the distance from $i$ to the nearest instance of goods $j$. Then, for each vertex, find its $s$ nearest kinds of goods.

> Takeaway

AC'd in the contest, and redid it independently later.

## B

> Problem

There is a sequence of length $n$: $1, 2, ... , n$. Shuffling means randomly picking two numbers and swapping them. $\mathrm{Petr}$ performs $3n$ operations, $\mathrm{Alex}$ performs $7n+1$ operations. Given a permutation of $1\sim n$, determine who shuffled it.

> Solution

Note that $3n$ has the same parity as $n$, while $7n+1$ has the opposite parity of $n$. Also, the number of operations used to restore the sequence has the same parity as the number of operations used to shuffle it. So the sequence can be restored in $\mathrm{O}(n)$ (by repeatedly swapping $a_{a_i}$ and $a_i$ until $a_i=i$), and then the parity of the restoration count can be compared against $n$.

> Takeaway

AC'd in the contest, and redid it independently later.

## C

> Problem

A set of $m$ integers, each between $0$ and $2 ^ n - 1$. Build an undirected graph with each integer as a vertex; two integers `x, y` are joined by an edge whenever `x & y = 0`. Count the number of connected components.

> Solution

Let z be the bitwise complement of x; then `x & y = 0` means `y & z = z`, i.e. the set bits of y are a subset of the set bits of z. There are only `2 ^ 22` states in total, so a brute-force search plus marking for every unmarked x is well within the time limit.

> Takeaway

Solved it independently when I redid it.

## D

> Problem

Given $N$, choose $M$ positive integers $a_1,a_2,...a_M$ (repeats allowed) such that $\prod_{i=1}^{m} a_i \ge N$, minimizing their sum.

> Solution

~~Brute-forcing small cases shows that using $2$s and $3$s is the most economical.~~ Studying $x^{\log(\frac N x)}$ shows it is maximized at $x = e$, and both $2$ and $3$ are close to $e$. So use $3$s to build up the sum. Let $k$ be the sum of the $M$ positive integers, then:

* $k \% 3 = 0$: use all $3$s
* $k \% 3 = 1$: use two $2$s, the rest $3$s
* $k \% 3 = 2$: use one $2$, the rest $3$s

The value of k can be found by binary search, but binary search is too slow. Solving $N = 3 ^ {\frac k 3}$ gives $k\approx log_{3}^N \cdot 3$. The length of $N$ (at most $log_{10}^N$) can be used to estimate an approximate value of $k$, then multiplied up brute-force from there. This one's constant-factor hell, so $\mathrm{FFT}$ is clearly needed, probably with base-compressed bignums too.

> Takeaway

I still remember the approach, but it's fairly hard to implement.

## E

> Problem

Given a tree where each vertex has a weight ($\le 10^7$), and m queries; each query gives `x, y, w` and asks for the product, over the vertices on the path `x -> y`, of `gcd(vertex weight, w)`, modulo $10^9+7$.

> Solution

First, decompose the query $(x, y, w)$ into

$$
ans(1,x) \times ans(1,y) \times \mathrm{gcd}(w,val_{lca(x,y)})\over ans(w,lca_{x,y})^2
$$

Then it's a tree difference: offline the queries onto the tree and resolve them with a single $\mathrm{dfs}$. $\gcd$ is essentially taking the $\min$ of each prime's exponent. Note there are only about $6\cdot 10^5$ primes below $10^7$. Give each prime a bucket, where $vec[p][i]$ denotes, within the part currently being processed, the number of vertices whose prime factorization has $p$ raised to the power $i$.

> Takeaway

Not solved independently.

## F

> Problem

Given $n, k$, determine whether $n$ can be written as a sum of several divisors of $k$. The problem stipulates this is not allowed when $k = 1$.

> Solution

There are at most $50$ distinct values of $k$, so offline the queries and solve for each $k$ separately. First factorize $k$ into primes. If the number of distinct prime factors is greater than $2$, solve it with shortest path on residues; if it equals $2$, let the two primes be $a, b$ and just solve $ax + by = n$; if it equals 1, just check whether $n \% p$ equals $0$.

For the residue shortest-path: work in the residue system of the smallest prime factor, and add an edge of weight $fac_x$ from $i$ to $(i + fac_x) \% fac_1$ for each other prime factor. Running shortest path this way, the result $dis_i$ is the minimum value reachable using several of $p_2 \sim p_n$ that is $\equiv i \pmod{p_1}$. If $dis_i \le n$, it can be topped up to exactly $n$ using $p_1$; otherwise there is no solution.

> Takeaway

Solved independently.
