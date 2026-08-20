---
title: "Sperner's Theorem"
description: "A full proof of Sperner's theorem: an antichain of subsets of an n-element set has at most C(n, ⌊n/2⌋) members."
date: "2021-02-10"
tags: ["Mathematics", "Combinatorics"]
translation: machine
---

## Problem

Given $n\in \mathbb{N}^*$, consider a family of subsets $A_1,A_2,...,A_k$ of the set $S=\{1,2,...,n\}$, where no two subsets contain each other. That is, for $\forall\ 1\le i\lt j\le k$, both $A_i\nsubseteq A_j$ and $A_i\nsupseteq A_j$ hold.

1. When $n=5$, find $k_{\max}$.
1. For $n\in \mathbb{N}^*$, find $f(n)=k_{\max}$.

## Theorem

For $\forall$ set $S$ with $n$ elements, at most $\binom n {\lfloor\frac n 2\rfloor}$ of its subsets can be chosen such that no two of them contain each other.

## Proof

Clearly, if we choose all $\binom n m$ subsets of size $m$, no containment relation can occur. Since the maximum value of $\binom n m$ is $\binom n {\lfloor\frac n 2\rfloor}$, we get $k_{\max}\ge\binom n {\lfloor\frac n 2\rfloor}$.

Next, we need to prove $k_{\max}\le\binom n {\lfloor\frac n 2\rfloor}$.

For a subset $A$ of $S$, define $P_A$ as the set of $|A|!\times|\complement_S A|!$ permutations formed by pairing every permutation of $A$ with every permutation of $\complement_S A$. For example, for $S=\{1,2,3,4,5\}$ and $A=\{2,3\}$, $P_A$ is:

```text
2 3 | 1 4 5
3 2 | 1 4 5
2 3 | 1 5 4
3 2 | 1 5 4
2 3 | 4 1 5
3 2 | 4 1 5
2 3 | 4 5 1
3 2 | 4 5 1
2 3 | 5 1 4
3 2 | 5 1 4
2 3 | 5 4 1
3 2 | 5 4 1
```

$|P_A|=12$.

We can show that for any two subsets $A,B$ of $S$ ($A\neq B$), $A$ and $B$ contain neither the other if and only if $P_A\cap P_B=\varnothing$.

---

> Sufficiency

If $A$ and $B$ have a containment relation, assume without loss of generality that $A\subset B$. Let $C=\complement_B A$ and $D=\complement_S B$; then we can construct the permutation $A\oplus C\oplus D\in (P_A\cap P_B)$. So when $P_A\cap P_B=\varnothing$, $A$ and $B$ contain neither the other.

> Necessity

If $P_A\cap P_B\neq\varnothing$, assume without loss of generality that $|A|\le |B|$. Let $Q\in (P_A\cap P_B)$ be a permutation. Either $A=\varnothing$, in which case $A\subset B$; or $A$ and $B$ are both a prefix of $Q$, and since $|A|\le |B|$, again $A\subset B$. So when $A$ and $B$ contain neither the other, $P_A\cap P_B=\varnothing$.

---

Therefore, the original problem is equivalent to choosing $k$ subsets $\{A_1,A_2,...,A_k\}$ such that for $\forall\ 1\le i\lt j\le k$, $P_{A_i}\cap P_{A_j}=\varnothing$.

Note that the set of all permutations of $S$ has size $n!$, so:

$$\sum_{i=1}^k |P_{A_i}|\le n!$$

That is:

$$\sum_{i=1}^k |A_i|!\times(n-|A_i|)!\le n!$$

Dividing both sides by $n!$ gives:

$$\sum_{i=1}^k \frac 1 {\binom n{|A_i|}} \le 1$$

Since $\binom n{|A_i|}\le \binom n{\lfloor\frac n 2\rfloor}$, we have $\frac 1{\binom n{|A_i|}} \ge \frac 1{\binom n{\lfloor\frac n 2\rfloor}}$, so $k\le\binom n{\lfloor\frac n 2\rfloor}$. This proves the original proposition.

![girl](https://bafkreifsxipccvifscj2hlt2iyc7j2fnklu3jcon66fatllp432xoq2mdu.ipfs.dweb.link)

[Image source](https://twitter.com/i/status/1356483004672053248) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/ghpIM)

## References

[Sperner's theorem and its proof | www.cnblogs.com](https://www.cnblogs.com/suncongbo/p/10321099.html) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/YiT9t)
