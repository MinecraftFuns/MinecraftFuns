---
title: "题解 | 2013 Asia Chengdu Regional Contest"
description: "2013 年 ICPC 亚洲成都区域赛的虚拟赛题解，覆盖图论构造、字符串处理、动态规划、AC 自动机与卷积等算法专题。"
date: "2020-12-24"
tags: ["ICPC", "Editorial"]
---

![hero.webp](https://bafkreidihxmn4zbpx7wmfqywwdpdpejikx5ko72mnj4o62p3pmxykd37zi.ipfs.dweb.link)

## A

[Assignment For Princess](http://acm.hdu.edu.cn/showproblem.php?pid=4781)

> 题意

构造一张 $n$ 个点 $m$ 条边的有向图，每条边的边权分别为 $1,2,...,m$，使得

1. 两点之间最多只有一条有向边，没有自环
1. 从每个点出发可以到达任何点（包括自身）
1. 任意一个有向环的权值和为 $3$ 的倍数。

> 题解

先让所有点在一个环上，以满足条件 $2$。对于 $i\in \{1,2,...,n-1\}$，在 $i$ 和 $i+1$ 间连一条边权为 $i$ 的边。$n$ 和 $1$ 间的边在 $\{n,n+1,...,m\}$ 中选一个权值，使得这个环的权值和为 $3$ 的倍数。

剩下 $m-n$ 条边，$n^2$ 枚举间距 $\ge 2$ 的点对 $(i,j)$，把权值和 $i\rightarrow j$ 距离对 $3$ 同余的边安排到 $i,j$ 之间。

[代码](https://gist.github.com/MinecraftFuns/650895cd40bb3e1eb2cb721d81da40dd)

## B

[Beautiful Soup](http://acm.hdu.edu.cn/showproblem.php?pid=4782)

> 题意

写一个简单的 `HTML` 代码格式化工具。

* `tag`（尖括号 `<>` 包着的内容）内部不用动
* `text`（没被尖括号包着的内容）过滤掉多余的空白字符（`ASCII 32` 空格、`ASCII 9` Tab 和 `ASCII 10` 换行符），使得两个单词之间仅由一个空格分隔。
* 根据深度加空格缩进

> 题解

大模拟，细节比较多，调了一个下午。

[代码](https://gist.github.com/MinecraftFuns/e6fe87c1cc91ccfa99db7b8adcb9dff9)

## C

[Clumsy Algorithm](http://acm.hdu.edu.cn/showproblem.php?pid=4783)

> 题意

有一个 $1\sim n$ 的排列，小 P 想要将其从小到大排序。

> 题解

[代码](https://gist.github.com/MinecraftFuns/33718d2d41fd58ee1816954ae52f1309)

## D

[Dinner Coming Soon](http://acm.hdu.edu.cn/showproblem.php?pid=4784)

> 题意

给出一张 $n$ 个点 $m$ 条边的有向图，小 P 想要在 $T$ 分钟内从 $1$ 号点走到 $n$ 号点。

经过每条边时，要花费一些时间和金钱。小 P 一开始有 $R$ 元，他希望到达 $n$ 号点时手头的钱尽可能多。

小 P 在路上交易盐。除了 $1$ 号点和 $n$ 号点，每个点都有盐，并且给定价格。小 P 每次到一个点，都可以

* 卖出一包盐
* 买入一包盐
* 什么都不干

但是小 P 最多只能携带 $B$ 包盐（他出发时没有带盐）。交易盐不需要时间。

小 P 还有一个设备，可以在 $k$ 个标号为 $0\sim k-1$ 的平行宇宙中穿梭。小 P 一开始在 $0$ 号宇宙。每次使用设备，可以花费 $1$ 分钟从 $i$ 号宇宙穿越到 $(i+1)\bmod k$ 号宇宙中编号相同的点。

平行宇宙中编号相同的点的盐价可能不一样，但是经过相同的边时花费的时间和金钱是相同的。小 P 不能访问 $1\sim k-1$ 号宇宙的 $1$ 号点和 $n$ 号点。

注意：一旦他到达 $n$ 号点旅途就结束。他必须要在 $T$ 分钟内到达 $n$ 号点，并且在旅途中他手头的钱不能是负数。

问他到达 $n$ 号点时手头的钱最多为多少。

> 题解

可以搞个 DP。$f_{t,k,u,b}$ 表示时间为 $t$，在 $k$ 号宇宙的 $u$ 号节点，手头有 $b$ 包盐，最多有多少钱。

转移要么是在当前宇宙走一条边，要么是到下一个宇宙，然后分`买盐 / 卖盐 / 什么都不干`三类讨论。

[代码](https://gist.github.com/MinecraftFuns/5903183985ccc1a06a2af9fdb3ee9940)

## E

[Exhausted Robot](http://acm.hdu.edu.cn/showproblem.php?pid=4785)

## F

[Fibonacci Tree](http://acm.hdu.edu.cn/showproblem.php?pid=4786)

> 题意

给出一张 $n$ 个点 $m$ 条边的无向图，所有边都有权值 $\in\{0,1\}$。问在图上能否找到一棵生成树，使得树边的权值之和是斐波那契数。

> 题解

跑最小生成树和最大生成树，记权值之和分别为 $l,r$。如果 $l\sim r$ 有斐波那契数，答案即为 `Yes`。

证明起来比较困难，但是可以感性理解，在最小生成树的基础上通过不断删除一条权值为 $0$ 的边，增加一条权值为 $1$ 的边，并保持生成树的性质，过渡到最大生成树。

[代码](https://gist.github.com/MinecraftFuns/5873a8de308ab26d1d986fbc92f6da10)

## G

[GRE Words Revenge](http://acm.hdu.edu.cn/showproblem.php?pid=4787)

> 题意

维护一个单词表，支持两种操作

* 增加一个模式串
* 询问一个文本串中模式串的出现总数

字符集为 $\{0,1\}$，**强制在线**。如果一个模式串出现多次，可以假设*每次出现都算作一个新串*。

> 题解

首先想到 AC 自动机。但是 AC 自动机没法修改。考虑开两个 AC 自动机 $S,B$。令 $\text{threshold}\approx\sqrt{n}$，使得 $S$ 的节点数保持 $\le\text{threshold}$，并且每次加新串时重构；当 $S$ 的节点数 $\gt\text{threshold}$ 时，把 $S$ 中的串移到 $B$ 中，然后重构 $B$。实现中直接钦定了 $\text{threshold}=1000$。

[代码](https://gist.github.com/MinecraftFuns/9dafc0a45e7e91fc76bd41813e61ce8a)

## H

[Hard Disk Drive](http://acm.hdu.edu.cn/showproblem.php?pid=4788)

> 题意

操作系统和制造商对于硬盘空间的计算方法不同。操作系统认为 $1\text{KB}=1024\text{B},1\text{MB}=1024\text{KB},...$，而制造商认为 $1\text{KB}=1000\text{B},1\text{MB}=1000\text{KB},...$。给出一个形如 `100[MB]` 的字符串，问制造商的计算方法比操作系统的计算方法少了百分之几，四舍五入保留两位小数。

> 题解

签到题，直接按照题意模拟即可。注意使用 `printf` 输出 `%` 时，要写 `%%`。

[代码](https://gist.github.com/MinecraftFuns/fbcd65f2e03dbbf34fc89b6488952942)

## I

[ICPC Ranking](http://acm.hdu.edu.cn/showproblem.php?pid=4789)

> 题意

模拟一场 ACM 比赛。

评测结果有 $3$ 种

* `ERROR` 评测机炸了，参赛队伍没有 A 掉这题，但是不会罚时
* `NO` 代码假了，参赛队伍没有 A 掉这题，会罚时
* `YES` 参赛队伍 A 掉这题

为了使得比赛更加紧张刺激，有封榜机制。

* 如果一个队伍在封榜前没有切掉某道题，并且在封榜这一瞬间或者之后提交了这题，对于这支队伍来说，这道题就`冻住`了
* 不同的队伍`冻住`的题可能是不同的
* 对于`冻住`的题，榜上只会显示这支队伍提交了几次，而不会显示评测结果

排名由以下因素决定（忽略`冻住`的题，优先级从高到低）

1. `Solved` 切掉的题目数量，题数越多越靠前
1. `Penalty` 设在第一次 `YES` 之前返回 `NO` 的次数为 $x$，第一次 `YES` 的时刻为 $T$，罚时为 $T+20\cdot x$
1. `Last Solved` 最后一道切掉的题切题时间较早的排在前面，如果相同的话，比较倒数第二道切掉的题，以此类推
1. `Name` 按照队伍名字的字典序从大到小排，字典序靠后的排名靠前

比赛结束时会揭榜。

1. 在榜单上选择排名最低的有`冻住`的题的队伍
2. 从这支队伍`冻住`的题目中`解冻`一道题（如果有多道题，`解冻`题目名称字典序最小的题）。公开这题的评测结果，重新计算排名，更改榜单。
3. 重复上述过程，直到所有队伍`冻住`的题都被`解冻`。
4. 得到最终的榜单。

输出揭榜前的榜单，最终的榜单，以及揭榜的过程。

> 题解

首先要解决队伍排序的问题，根据题意，对每支队伍维护以下信息

### 每道题的（实际）状态

`unordered_map<char, bool>`

其中状态只有 `unsolved` 和 `solved`。

### 当前（公开）切掉的题

> 榜单按照此信息排序

* 切掉的题的总罚时 `penalty`

`set<int>`

* 切掉的题的总数 `size()`
* 切掉的题的首次 AC 时间（注意到由于揭榜的特殊操作，时间没有单调性）

### 每道题的罚时

`unordered_map<char, int>`

如果一道题已经切掉，就不再有罚时了。

### 冻住的题的集合

`set<char>`

要按照题号字典序揭榜。

### 队伍名字

最后的排序依据。

## J

[Just Random](http://acm.hdu.edu.cn/showproblem.php?pid=4790)

> 题意

给出两个区间 $[a,b],[c,d]$，在 $[a,b]$ 间随机取一个整数 $x$，$[c,d]$ 间随机取一个整数 $y$，问 $x+y\equiv m\pmod p$ 的概率。

> 题解

为了写起来方便，我们先解决 $[0,a],[0,b]$ 这样的情况，对于 $[a,b],[c,d]$ 这样的情况简单容斥一下。

$[0,a]$ 中有 $a+1$ 个整数，我们可以把这些整数分成 $\lfloor\frac{a+1}{p}\rfloor$ 个长度为 $p$ 的大段，和一个长度为 $(a+1)\bmod p$ 的小段。对 $[0,b]$ 同样操作。

大段和大段的贡献是 $\lfloor\frac{a+1}{p}\rfloor\cdot p\cdot\lfloor\frac{b+1}{p}\rfloor$（对于 $[0,a]$ 大段的每一个数，$[0,b]$ 大段都有 $\lfloor\frac{b+1}{p}\rfloor$ 个数和它匹配）。

大段和小段的贡献是 $(a+1)\bmod p\cdot\lfloor\frac{b+1}{p}\rfloor+(b+1)\bmod p\cdot\lfloor\frac{a+1}{p}\rfloor$（$[0,a]$ 小段的每一个数都可以在 $[0,b]$ 大段找到 $\lfloor\frac{b+1}{p}\rfloor$ 个匹配，$[0,b]$ 小段同理）。

小段和小段的贡献可以算和为 $m+i\cdot p$（从 $i=0$ 开始枚举） 的数对的数量。

[代码](https://gist.github.com/MinecraftFuns/7ead2aeaf1bb3eab34daa1befb441466)
