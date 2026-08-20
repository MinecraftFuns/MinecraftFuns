---
title: "Sperner 定理"
description: "Sperner 定理的完整证明：n 元集合中两两不包含的子集族最多有 C(n, ⌊n/2⌋) 个。"
date: "2021-02-10"
tags: ["Mathematics", "Combinatorics"]
---

## 问题

给定 $n\in \mathbb{N}^*$，集合 $S=\{1,2,...,n\}$ 的一组子集 $A_1,A_2,...,A_k$，其中任意两个子集互不包含。即，对于 $\forall\ 1\le i\lt j\le k$，均有 $A_i\nsubseteq A_j$，并且 $A_i\nsupseteq A_j$。

1. 当 $n=5$ 时，求 $k_{\max}$
1. 对 $n\in \mathbb{N}^*$，求 $f(n)=k_{\max}$

## 定理

对于 $\forall$ 包含 $n$ 个元素的集合 $S$，最多可以选择其 $\binom n {\lfloor\frac n 2\rfloor}$ 个子集，使得任意两个子集互不包含。

## 证明

显然，如果我们选择全部 $\binom n m$ 个大小为 $m$ 的子集，肯定不会出现包含关系。而 $\binom n m$ 的最大值为 $\binom n {\lfloor\frac n 2\rfloor}$，所以 $k_{\max}\ge\binom n {\lfloor\frac n 2\rfloor}$。

接下来，我们要证明 $k_{\max}\le\binom n {\lfloor\frac n 2\rfloor}$。

对于 $S$ 的一个子集 $A$，定义 $P_A$ 为 $A$ 的全排列和 $\complement_S A$ 的全排列两两组合形成的 $|A|!\times|\complement_S A|!$ 个排列所构成的集合。例如，对于 $S=\{1,2,3,4,5\}$，$A=\{2,3\}$，$P_A$ 为：

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

$|P_A|=12$。

可以说明，对于 $S$ 的任意两个子集 $A,B$（$A\neq B$），当且仅当 $P_A\cap P_B=\varnothing$ 时，$A$ 和 $B$ 互不包含。

---

> 充分性

若 $A,B$ 存在包含关系，不妨设 $A\subset B$。令 $C=\complement_B A,D=\complement_S B$，则可以构造排列 $A\oplus C\oplus D\in (P_A\cap P_B)$。所以 $P_A\cap P_B=\varnothing$ 时，$A$ 和 $B$ 互不包含。

> 必要性

若 $P_A\cap P_B\neq\varnothing$，不妨假设 $|A|\le |B|$。设排列 $Q\in (P_A\cap P_B)$。要么 $A=\varnothing$，则 $A\subset B$；要么 $A$ 和 $B$ 同时为 $Q$ 的一个前缀，又有 $|A|\le |B|$，故 $A\subset B$。所以 $A$ 和 $B$ 互不包含时，$P_A\cap P_B=\varnothing$。

---

因此，原问题等价于选出 $k$ 个子集 $\{A_1,A_2,...,A_k\}$，使得对于 $\forall\ 1\le i\lt j\le k$，有 $P_{A_i}\cap P_{A_j}=\varnothing$。

注意到 $S$ 的全排列大小为 $n!$，则有：

$$\sum_{i=1}^k |P_{A_i}|\le n!$$

即：

$$\sum_{i=1}^k |A_i|!\times(n-|A_i|)!\le n!$$

两边同除以 $n!$，得：

$$\sum_{i=1}^k \frac 1 {\binom n{|A_i|}} \le 1$$

由于 $\binom n{|A_i|}\le \binom n{\lfloor\frac n 2\rfloor}$，$\frac 1{\binom n{|A_i|}} \ge \frac 1{\binom n{\lfloor\frac n 2\rfloor}}$，所以 $k\le\binom n{\lfloor\frac n 2\rfloor}$。原命题得证。

![girl](https://bafkreifsxipccvifscj2hlt2iyc7j2fnklu3jcon66fatllp432xoq2mdu.ipfs.dweb.link)

[图片来源](https://twitter.com/i/status/1356483004672053248) :backup[https://archive.is/ghpIM]

## 参考

[Sperner定理及其证明 | www.cnblogs.com](https://www.cnblogs.com/suncongbo/p/10321099.html) :backup[https://archive.is/YiT9t]
