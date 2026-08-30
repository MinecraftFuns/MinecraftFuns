---
title: "Editorial | CF521 / Codeforces Round 295 (Div. 1)"
description: "Editorial for a virtual-contest run of Codeforces Round 295 (Div. 1), covering the approach and solution for problems A through E."
date: "2020-11-15"
tags: ["Codeforces", "Editorial"]
translation: machine
---

* [Link](https://codeforces.com/contest/521) :backup[https://archive.is/eYPv5]
* [Reference code](https://gist.github.com/MinecraftFuns/2c5339a7521d9f65f7085570cda67efd) :backup[https://archive.is/y9LG6]

## Problems not solved independently

* 521E

## A

> Problem

The alphabet is $\{A,T,C,G\}$. Given a string $S$ of length $n$, count the number of ways to construct a string $T$ such that, over all cyclic shifts, the total number of matching positions between $S$ and $T$ is maximized.

> Solution

~~Not hard to see~~ that, because of the shifting, each character of $T$ contributes the count of matching characters in $S$. The total number of matches is maximized exactly when every character of $T$ is one of the characters with the highest occurrence count in $S$. So it suffices to count the occurrences of each character in $S$; if $x$ characters tie for the highest count, the answer is $x^n$ (each position of $T$ can independently pick any of these $x$ characters).

> Takeaway

A bit of observation.

## B

> Problem

V and P built a shape from $m$ blocks, numbered $0\sim m-1$. Set up a Cartesian coordinate system with the ground as the $x$-axis and straight up as the positive $y$-axis. Each block's position is given by the coordinates of its bottom-left corner, and every block's coordinates are integers.

> Solution

As stated, since each digit of a base-$m$ number has place value $m$, both players' strategies are simple greedy. V needs to remove the largest currently removable value, and P needs to remove the smallest currently removable value. Maintain a set of currently removable blocks. Each time a block is removed, trigger a local update: check the removability of the surrounding $5\times 5$ blocks and update the set.

> Takeaway

Simple to think through, brutal to implement.

## C

> Problem

Given an $n$-digit decimal number $a_1a_2...a_n$, insert $k$ plus signs between the digits to form an expression. Find the sum, over all ways of inserting them, of the expression's value.

> Solution

Consider the contribution of each $a_i$ to the answer, which depends on the position of the nearest $+$ after $a_i$.

* If the $+$ is right after $a_i$, then $a_i$ itself contributes $10^0\times a_i$, and the remaining $+$s can be placed in $\binom {n-2} {k-1}$ ways, contributing $10^0\times a_i\times\binom {n-2} {k-1}$
* If the $+$ is right after $a_{i+1}$, then $a_i$ itself contributes $10^1\times a_i$, and the remaining $+$s can be placed in $\binom {n-3} {k-1}$ ways, contributing $10^1\times a_i\times\binom {n-3} {k-1}$
* If the $+$ is right after $a_{i+2}$, then $a_i$ itself contributes $10^2\times a_i$, and the remaining $+$s can be placed in $\binom {n-4} {k-1}$ ways, contributing $10^2\times a_i\times\binom {n-4} {k-1}$

And so on. Note that when $a_i$ is the same distance from the $+$, the multiplied binomial coefficient is the same, so they can be computed together. This gives

$$
\sum_{i=1}^{n-k}10^{i-1}\times (\sum_{j=1}^{n-i}a_j\times \binom{n-1-i}{k-1}+a_{n-i+1}\times\binom{n-i}{k})
$$

## D

> Problem

Given $k$ positive integers $a_1,a_2,...,a_k$.

There are $n$ operations, each given by three parameters $t$, $i$, and a positive integer $b$.

* $t=1$: set $a_i$ to $b$
* $t=2$: add $b$ to $a_i$
* $t=3$: multiply $a_i$ by $b$

You may choose at most $m$ of these $n$ operations to execute, and you may choose the execution order, with the goal of maximizing $\prod_{i=1}^{k} a_i$.

> Solution

First, once the chosen operations are fixed, the execution order should always be assignments first, then additions, then multiplications.

Since a chosen assignment operation can never make $a_i$ smaller, an assignment can be converted into an addition. Then note that, for the same $i$, all additions should be executed greedily from largest to smallest, so additions can in turn be converted into multiplications. Finally, sorting the resulting multiplications tells you which operations should be executed.

> Takeaway

Simple greedy.

## E

> Problem

Given a simple undirected graph with $n$ vertices and $m$ edges, determine whether there exist two vertices with at least three pairwise vertex-disjoint simple paths between them.

> Solution

This is the graph for samples $1,2$; the red edges form its spanning tree.

![18f227ee32f4cc1dc8e27cae7344f8d989b9f9cc407d5a4c938495b90c4485a8.jpg](https://ragnarok.joefang.org/static/xlap2red9gjtf9ki1qje4jud7ervhc27v.jpg)

![56c3ac4a9a28df775875ec857621a6cfbeec97a793de03064e3e34e61df38cb3.jpg](https://ragnarok.joefang.org/static/xvdqg2nm0hn7edkrag6oa7ku46kvq2bh7.jpg)

Observation: if two cycles share an edge, then there exist two vertices satisfying the requirement, since we can take the endpoints of the shared segment as $u,v$, giving three paths. From the spanning-tree perspective, an answer exists whenever some tree edge is covered by two non-tree edges.

Now DFS each connected component once. For every non-tree edge $(a,b)$, brute-force mark the tree edges it covers. If a tree edge was already marked by a non-tree edge $(c,d)$, the answer can be obtained directly from $(a,b)$ and $(c,d)$.

![Screenshot 2020-11-11 171828.jpg](https://ragnarok.joefang.org/static/x4vgl77m1oralla8uo0mfm8b0499eu966.jpg)

Fix $dep_b\gt dep_a$, $dep_d\gt dep_c$, with $d$ an ancestor of $b$. Let $e=\operatorname{LCA}(a,c)$; the three paths are $d\rightarrow e$, $d\rightarrow b\rightarrow a\rightarrow e$, and $d\rightarrow c\rightarrow e$. Finding the paths can be implemented by brute-force walking up parent pointers.

> Takeaway

A constructive problem.
