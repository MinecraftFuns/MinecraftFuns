---
title: "Editorial | CF297 / Codeforces Round 180 (Div. 1)"
description: "Editorial for a virtual-contest run of Codeforces Round 180 (Div. 1), covering the approach and solution for problems A through E."
date: "2020-11-15"
tags: ["Codeforces", "Editorial"]
translation: machine
---

* [Link](https://codeforces.com/contest/297) :backup[https://archive.is/rE0U8]
* [Reference code](https://gist.github.com/MinecraftFuns/9c16b6a800123e37711594ee341bf834) :backup[https://archive.is/SoEeF]

## Problems I didn't solve on my own

* C
* E

## A

> Problem

You are given two binary strings a, b. Define `parity(str): if str has an odd number of 1s, return 1, otherwise return 0`. There are two operations:

* Append parity(a) to the end of a
* Delete a digit from the front of a

You may perform any number of operations. Determine whether a can be turned into b.

> Solution

Note that if a has an even number of 1s, the number of 1s can never increase (if a has an odd number of 1s, first append a 1 at the end, after which the number of 1s can never increase). With a suitable strategy, a can be turned into any binary string whose number of 1s is less than or equal to a's. It suffices to count the number of 1s in a and b.

> Takeaway

AC'd it during the contest, and solved it independently again on review.

## B

> Problem

There are k kinds of 🐟, each with a weight, and after sorting by weight from small to large they receive a numbering. Alice holds n 🐟, Bob holds m 🐟. Given the indices of the fish Alice and Bob hold, determine whether the total weight of Alice's 🐟 can exceed Bob's.

> Solution

First discretize the indices, then take a suffix sum. Scan from back to front; once Alice's 🐟 count at some position exceeds Bob's, assign INF to the weight of every 🐟 after that point and 1 to every 🐟 before it. This guarantees the total weight of Alice's 🐟 exceeds Bob's.

> Takeaway

AC'd it during the contest, and solved it independently again on review.

## C

> Problem

There is an array s of n **pairwise distinct** non-negative integers. Split it into two arrays a, b such that:

* $a_i,b_i$ are non-negative integers
* $s_i=a_i+b_i$

At the same time, each of a and b must contain no more than $\lceil \frac n 3 \rceil$ repeated values.

> Solution

Constructive. After sorting the array s:

1. Fill the first $\frac 1 3$ of a with $1\sim \frac n 3$, and fill b to match.
1. Fill the middle $\frac 1 3$ of b with $\frac n 3 \sim \frac{2n} 3$, and fill a to match.
1. Fill the last $\frac 1 3$ of b with $n-i-1$, and fill a to match.

This guarantees the front and back segments of a are pairwise distinct, and the middle and back segments of b are pairwise distinct.

> Takeaway

Still remembered it was a three-segment construction, but couldn't work out the strategy. Not solved independently.

## D

> Problem

Fill an $h*w$ carpet with k colors. For every pair of squares sharing an edge, a constraint is given requiring them to be the same color or different colors. It suffices to satisfy $3\over 4$ of these constraints. If a construction is possible, give one.

> Solution

The problem gives $k$ colors, but for $k\ge 2$ only two colors are actually needed, and a construction always exists. For $k=1$, simply check whether the number of `E` constraints exceeds $3\over 4$ of the total. Otherwise, note there are $h*(w-1)+w*(h-1)$ constraints; first satisfy the larger of $h*(w-1)$ and $w*(h-1)$, then pick some of the remaining constraints to satisfy. Flip the board first so that $h\le w$. Then every constraint within a row can be satisfied, and the vertical relations between rows can always be more than half satisfied (fix the color of the first block; if that fill fails to satisfy at least half, flip the whole row's colors, and then more than half are satisfied). Adding them together exceeds $3\over 4$ of the total.

> Takeaway

Solved independently.

## E

> Problem

A cycle has 2n vertices. Choose 3 distinct chords, build 6 bear dens at their endpoints, and require the distance between the two endpoints of every chord (distance defined as the number of dens passed along the cycle, taking the smaller value) to be equal. Count the number of ways to do this.

> Solution

Three chords can be in five kinds of relations in total, of which 2 and 5 are valid.

![Five types](https://ragnarok.joefang.org/static/xho9ek2kf454j53ii5cgidfvnhskn7i4g.png)

But counting cases 2 and 5 directly is hard, so instead subtract the counts of cases 1, 3, and 4 from the total.

Suppose we can compute the number of chords to the left and right of each chord, denoted $L_i, R_i$. For type 1, the answer is $\sum L_i \cdot R_i$. Types 3 and 4 are computed together. Their common feature, viewed from two chords (the top two for type 3, the vertical two for type 4), is that one chord crosses itself and one line is disjoint from itself. The count is then $\sum (L_i + R_i)*(n-L_i-R_i-1)\over 2$ (each case gets counted twice).

Now the question is how to compute $L_i,R_i$. Viewed from chord $(x_i,y_i)$ (with $x_i\lt y_i$), chord $(x_j,y_j)$ lies to its left (with $x_j\lt y_j$) if $x_j\lt x_i$, and $y_j\gt y_i \text{ or } y_j \lt x_i$, or $y_j\gt x_j\gt y_i$. Otherwise, $x_i\lt x_j\lt y_j\lt y_i$. This can be solved with 2D partial order. Complexity $n \log n$.

> Takeaway

Not solved independently.
