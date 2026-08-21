---
title: "Editorial: 2013 Asia Chengdu Regional Contest"
description: "Editorial for a virtual run of the 2013 ICPC Asia Chengdu Regional Contest, covering graph construction, string processing, dynamic programming, Aho-Corasick automata, and convolution."
date: "2020-12-24"
tags: ["ICPC", "Editorial"]
translation: machine
---

![hero.webp](https://ragnarok.joefang.org/static/xckmh92jnejq7ul3jjl1fdprmh52or85k.webp)

## A

[Assignment For Princess](http://acm.hdu.edu.cn/showproblem.php?pid=4781)

> Problem

Construct a directed graph with $n$ vertices and $m$ edges, whose edges carry the weights $1,2,...,m$ respectively, such that

1. there is at most one directed edge between any two vertices, and no self-loops
1. every vertex can reach every vertex (including itself)
1. the sum of weights along any directed cycle is a multiple of $3$.

> Solution

First put all vertices on one cycle, to satisfy condition $2$. For $i\in \{1,2,...,n-1\}$, connect $i$ and $i+1$ with an edge of weight $i$. For the edge between $n$ and $1$, pick a weight from $\{n,n+1,...,m\}$ so that this cycle's weight sum is a multiple of $3$.

For the remaining $m-n$ edges, enumerate the $n^2$ pairs $(i,j)$ with distance $\ge 2$, and assign the edges whose weight, taken mod $3$, matches the $i\rightarrow j$ distance mod $3$ between $i$ and $j$.

[Code](https://gist.github.com/MinecraftFuns/650895cd40bb3e1eb2cb721d81da40dd)

## B

[Beautiful Soup](http://acm.hdu.edu.cn/showproblem.php?pid=4782)

> Problem

Write a simple `HTML` code formatter.

* Leave the contents of a `tag` (content wrapped in angle brackets `<>`) untouched
* For `text` (content not wrapped in angle brackets), strip redundant whitespace (`ASCII 32` space, `ASCII 9` tab, and `ASCII 10` newline) so that words are separated by exactly one space.
* Indent with spaces according to depth

> Solution

Big simulation, lots of fiddly details. Spent an afternoon debugging it.

[Code](https://gist.github.com/MinecraftFuns/e6fe87c1cc91ccfa99db7b8adcb9dff9)

## C

[Clumsy Algorithm](http://acm.hdu.edu.cn/showproblem.php?pid=4783)

> Problem

Given a permutation of $1\sim n$, Little P wants to sort it in ascending order.

> Solution

[Code](https://gist.github.com/MinecraftFuns/33718d2d41fd58ee1816954ae52f1309)

## D

[Dinner Coming Soon](http://acm.hdu.edu.cn/showproblem.php?pid=4784)

> Problem

Given a directed graph with $n$ vertices and $m$ edges, Little P wants to travel from vertex $1$ to vertex $n$ within $T$ minutes.

Traversing each edge costs some time and money. Little P starts with $R$ yuan, and wants to have as much money as possible on hand when he reaches vertex $n$.

Little P trades salt along the way. Every vertex except vertex $1$ and vertex $n$ has salt, at a given price. Each time he arrives at a vertex, he can

* sell a bag of salt
* buy a bag of salt
* do nothing

However, Little P can carry at most $B$ bags of salt at once (he starts with none). Trading salt takes no time.

Little P also has a device that lets him travel among $k$ parallel universes, labeled $0\sim k-1$. He starts in universe $0$. Each use of the device costs $1$ minute and moves him from universe $i$ to the vertex with the same label in universe $(i+1)\bmod k$.

The salt price at a vertex with the same label may differ across parallel universes, but the time and money cost of traversing the same edge is identical. Little P cannot visit vertex $1$ or vertex $n$ in universes $1\sim k-1$.

Note: once he reaches vertex $n$ the journey ends. He must reach vertex $n$ within $T$ minutes, and the money on hand must never be negative during the journey.

Find the maximum amount of money he can have on hand when he reaches vertex $n$.

> Solution

This can be solved with a DP. Let $f_{t,k,u,b}$ denote the maximum amount of money when the time is $t$, he is at vertex $u$ in universe $k$, and he is carrying $b$ bags of salt.

Transitions are either walking one edge in the current universe, or moving to the next universe, in which case there are three cases to consider: `buy salt / sell salt / do nothing`.

[Code](https://gist.github.com/MinecraftFuns/5903183985ccc1a06a2af9fdb3ee9940)

## E

[Exhausted Robot](http://acm.hdu.edu.cn/showproblem.php?pid=4785)

## F

[Fibonacci Tree](http://acm.hdu.edu.cn/showproblem.php?pid=4786)

> Problem

Given an undirected graph with $n$ vertices and $m$ edges, where every edge has weight $\in\{0,1\}$, decide whether the graph has a spanning tree whose edge weights sum to a Fibonacci number.

> Solution

Compute the minimum spanning tree and the maximum spanning tree, and let their weight sums be $l$ and $r$ respectively. If there is a Fibonacci number in $l\sim r$, the answer is `Yes`.

A rigorous proof is fairly involved, but it can be understood intuitively: starting from the minimum spanning tree, repeatedly remove an edge of weight $0$ and add an edge of weight $1$ while preserving the spanning-tree property, gradually transitioning to the maximum spanning tree.

[Code](https://gist.github.com/MinecraftFuns/5873a8de308ab26d1d986fbc92f6da10)

## G

[GRE Words Revenge](http://acm.hdu.edu.cn/showproblem.php?pid=4787)

> Problem

Maintain a word list supporting two operations

* add a pattern string
* query the total number of occurrences of the pattern strings within a text string

The alphabet is $\{0,1\}$, and the problem is **forced online**. If a pattern string occurs multiple times, assume *each occurrence counts as a new match*.

> Solution

The first idea is an Aho-Corasick automaton, but an Aho-Corasick automaton cannot be modified. Consider keeping two Aho-Corasick automata $S,B$. Let $\text{threshold}\approx\sqrt{n}$, keeping the node count of $S$ at $\le\text{threshold}$ and rebuilding it every time a new string is added; when the node count of $S$ exceeds $\text{threshold}$, move the strings in $S$ into $B$ and rebuild $B$. In the implementation, $\text{threshold}=1000$ is simply fixed.

[Code](https://gist.github.com/MinecraftFuns/9dafc0a45e7e91fc76bd41813e61ce8a)

## H

[Hard Disk Drive](http://acm.hdu.edu.cn/showproblem.php?pid=4788)

> Problem

Operating systems and manufacturers compute disk space differently. An operating system takes $1\text{KB}=1024\text{B},1\text{MB}=1024\text{KB},...$, while a manufacturer takes $1\text{KB}=1000\text{B},1\text{MB}=1000\text{KB},...$. Given a string of the form `100[MB]`, find by what percentage the manufacturer's computation falls short of the operating system's, rounded to two decimal places.

> Solution

Free points, just simulate it as stated. Note that when printing a `%` with `printf`, you have to write `%%`.

[Code](https://gist.github.com/MinecraftFuns/fbcd65f2e03dbbf34fc89b6488952942)

## I

[ICPC Ranking](http://acm.hdu.edu.cn/showproblem.php?pid=4789)

> Problem

Simulate an ACM contest.

There are $3$ kinds of judge results

* `ERROR` the judge crashed; the team did not solve the problem, but incurs no penalty
* `NO` the code is wrong; the team did not solve the problem, and incurs a penalty
* `YES` the team solved the problem

To make the contest more tense and exciting, there is a scoreboard freeze mechanism.

* If a team has not solved a problem before the freeze, and submits it at or after the moment of the freeze, that problem becomes `frozen` for that team
* Different teams may have different problems frozen
* For a `frozen` problem, the scoreboard only shows how many times that team submitted it, not the judge result

Rankings are determined by the following factors (ignoring `frozen` problems, from highest to lowest priority)

1. `Solved`, the number of problems solved; more solved ranks higher
1. `Penalty`, letting $x$ be the number of `NO` results returned before the first `YES`, and $T$ be the time of the first `YES`, the penalty is $T+20\cdot x$
1. `Last Solved`, the team whose last solved problem was solved earlier ranks higher; ties are broken by comparing the second-to-last solved problem, and so on
1. `Name`, teams are ranked by team name in descending lexicographic order; a lexicographically later name ranks higher

At the end of the contest, the scoreboard is unfrozen.

1. Among teams that still have frozen problems, pick the one with the lowest rank on the board
1. `Unfreeze` one problem from that team's frozen problems (if there are several, unfreeze the one whose name is lexicographically smallest). Reveal that problem's judge result, recompute rankings, and update the board.
1. Repeat the above process until every team's frozen problems have all been unfrozen.
1. Obtain the final scoreboard.

Output the scoreboard before unfreezing, the final scoreboard, and the unfreezing process.

> Solution

The first thing to solve is team ordering. Based on the problem statement, maintain the following information for each team

### The (actual) state of each problem

`unordered_map<char, bool>`

where the state is only `unsolved` or `solved`.

### Currently (publicly) solved problems

> The scoreboard is sorted by this information

* Total penalty of solved problems, `penalty`

`set<int>`

* Total count of solved problems, `size()`
* First AC time of each solved problem (note that due to the special unfreezing operation, time is not monotonic)

### Penalty of each problem

`unordered_map<char, int>`

Once a problem is solved, it no longer accrues penalty.

### The set of frozen problems

`set<char>`

Problems must be unfrozen in lexicographic order of problem letter.

### Team name

The final tiebreaker.

## J

[Just Random](http://acm.hdu.edu.cn/showproblem.php?pid=4790)

> Problem

Given two intervals $[a,b],[c,d]$, pick a random integer $x$ uniformly from $[a,b]$ and a random integer $y$ uniformly from $[c,d]$. Find the probability that $x+y\equiv m\pmod p$.

> Solution

For convenience, first solve the case $[0,a],[0,b]$, then handle $[a,b],[c,d]$ with a simple inclusion-exclusion.

$[0,a]$ contains $a+1$ integers, which can be split into $\lfloor\frac{a+1}{p}\rfloor$ full blocks of length $p$, plus a partial block of length $(a+1)\bmod p$. Do the same for $[0,b]$.

The contribution of full block against full block is $\lfloor\frac{a+1}{p}\rfloor\cdot p\cdot\lfloor\frac{b+1}{p}\rfloor$ (for each number in a full block of $[0,a]$, there are $\lfloor\frac{b+1}{p}\rfloor$ matching numbers in the full blocks of $[0,b]$).

The contribution of full block against partial block is $(a+1)\bmod p\cdot\lfloor\frac{b+1}{p}\rfloor+(b+1)\bmod p\cdot\lfloor\frac{a+1}{p}\rfloor$ (each number in the partial block of $[0,a]$ can find $\lfloor\frac{b+1}{p}\rfloor$ matches in the full blocks of $[0,b]$, and symmetrically for the partial block of $[0,b]$).

The contribution of partial block against partial block can be computed as the number of pairs summing to $m+i\cdot p$ (enumerating $i$ starting from $0$).

[Code](https://gist.github.com/MinecraftFuns/7ead2aeaf1bb3eab34daa1befb441466)
