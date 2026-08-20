---
title: "Editorial: 2015 ACM-ICPC World Finals - Marrakech"
description: "Editorial for a virtual run of the 2015 ACM-ICPC World Finals in Marrakech, covering min-cost flow, binary search, subsequence matching, pruned BFS, and Huffman coding."
date: "2020-12-24"
tags: ["ICPC", "Editorial"]
translation: machine
---

![hero.webp](https://bafkreibduaf5i5gcyuifev6x4j6uchcgrhm5jgyseogbaoga562foxwik4.ipfs.dweb.link)

## A

[Amalgamated Artichokes](https://icpc.kattis.com/problems/artichoke)

> Problem

Define $\operatorname{price}(k)=p\cdot(\sin(a\cdot k+b)+\cos(c\cdot k+d)+2)$, where $p,a,b,c,d$ are given parameters. Given the sequence $S=[\operatorname{price}(1),\operatorname{price}(2),...,\operatorname{price}(n)]$, find $\max\limits_{1\le i\le j\le n} {S_i-S_j}$.

> Solution

Only a prefix maximum can serve as the answer's $S_i$; the answer's $S_j$ is then the minimum between $S_i$ and the next prefix maximum. A single left-to-right scan suffices.

[Code](https://gist.github.com/MinecraftFuns/118651d0215edc032392e16e1c07add0)

## B

[Asteroids](https://icpc.kattis.com/problems/asteroids)

## C

[Catering](https://icpc.kattis.com/problems/catering)

> Problem

An equipment rental company receives $n$ requests listed in chronological order.

The company has $k$ porters. Each porter can carry one set of equipment, in chronological order, to fulfill some requests. Moving equipment from the location of request $i$ to the location of request $j$ costs a porter some amount. The company is numbered $1$, and the requests are numbered $2\sim n+1$. Every porter must start from the company.

Find the minimum total cost to fulfill all requests.

> Solution

* Connect $S\rightarrow 1$ with an edge of capacity $[0,k]$ and cost $0$
* Split $2\sim n+1$ into two vertices $u_i,v_i$ each, connected by an edge of capacity $[1,1]$ and cost $0$
* Connect $v_i\rightarrow T$ with an edge of capacity $[0,1]$ and cost $0$
* Connect $1\rightarrow u_i$ with an edge of capacity $[0,1]$ and cost $dis_{1,i}$
* Connect $v_i\rightarrow u_j(i\lt j)$ with an edge of capacity $[0,1]$ and cost $dis_{i,j}$

Then use a feasible flow with lower and upper bounds on the arcs with a designated source.

[Code](https://gist.github.com/MinecraftFuns/61be41c71be5766142e8ce2140915dd7)

## D

[Cutting Cheese](https://icpc.kattis.com/problems/cheese)

> Problem

A square block of cheese has $n$ spherical holes in it, and the holes do not overlap. You want to cut the cheese vertically into $s$ slices of equal weight; find the thickness of each slice.

> Solution

The volume of a sphere is $\frac 4 3\pi\cdot R^3$. The volume of a [spherical cap](https://zh.wikipedia.org/wiki/%E7%90%83%E7%BC%BA) is $\pi\cdot h^2\cdot(R-\frac h 3)$ or $\frac 1 6\pi\cdot h\cdot(3r^2+h^2)$, where $R$ is the radius of the sphere, $h$ is the height of the cap, and $r$ is the radius of the cap's base.

Binary search directly on the current slice's thickness, computing the volume of each hole with the two formulas above.

[Code](https://gist.github.com/MinecraftFuns/d39cf08ff1ee39a8be380ad2d0b49381)

## E

[Evolution in Parallel](https://icpc.kattis.com/problems/evolution)

> Problem

You are given $n$ strings over the alphabet $\{A,C,M\}$. You need to split them into $2$ columns such that within each column, each string is a subsequence of the next, and the last string in each column is a subsequence of a given string $s$.

> Solution

If any of the $n$ strings is not a subsequence of $s$, the answer is clearly `impossible`.

Otherwise, first sort the strings by length. Maintain two columns $f,g$. Now consider adding a string $str$, split into three cases.

* If it can be added to neither $f$ nor $g$, the answer is `impossible`
* If it can be added to both $f$ and $g$, put it into a standby sequence $t$. Every string in $t$ must be appendable both to the current $f$ and to the current $g$. If $t$ is non-empty and $str$ cannot be appended to $t$, append $str$ and $t$ to $f,g$
* If it can only be added to one of $f$ or $g$, append $str$ to that column, and append $t$ to the other column

[Code](https://gist.github.com/MinecraftFuns/0562a354c65aae07810f79b2feb7c3f0)

## F

[Keyboarding](https://icpc.kattis.com/problems/keyboard)

> Problem

Given a `virtual keyboard` with $r$ rows and $c$ columns, you can move an on-screen cursor to print text using $5$ control keys: `up / down / left / right / select`.

Initially, the cursor is at the top-left of the keyboard. Each press of an arrow key always jumps the cursor to the next character in that direction that differs from the current character; if no such character exists, the cursor does not move. Each press of the select key prints the character at the cursor's current position.

Find the minimum number of key presses needed to print a given text (a newline must be printed at the end).

> Solution

This one's just brute-force search plus pruning, that's it.

First precompute, for each position, where jumping one step `up / down / left / right` leads, then just brute-force a BFS over it. For pruning, let $vis_{x,y}$ denote the furthest position in the text string that can be matched when passing through position $(x,y)$; during a transition, if the matched position does not increase, that transition can be skipped (this is clearly correct).

[Code](https://gist.github.com/MinecraftFuns/dd7ad9f8ed6a1d37eb44061a46d570d7)

## G

[Pipe Stream](https://icpc.kattis.com/problems/pipe)

## H

[Qanat](https://icpc.kattis.com/problems/qanat)

> Problem

A qanat is an irrigation system consisting of an underground water source and several vertical wells.

![2016_final_H.png](https://bafkreiaqhp2stkm4aoqer65vwrutnviw2o3w4d4mujqmwsamy5vynxicx4.ipfs.dweb.link)

In this problem, it is abstracted as the model shown above.

The wells $A\rightarrow B$ and $B\rightarrow C$ must be dug. You must also dig $n$ vertical wells in between. A vertical well's horizontal coordinate can be any real number in $[0,w]$. The excavated dirt must be transported to $AC$ (ground level); dirt at any position can be transported arbitrarily in the horizontal and vertical directions, and the cost is the shortest distance. You are asked to arrange the positions of these $n$ vertical wells so as to minimize the total cost.

## I

[Ship Traffic](https://icpc.kattis.com/problems/ship)

> Problem

A river is divided into $n$ east-west lanes ($1\le n\le 10^5$), each lane $w$ wide.

A point departs from somewhere on the riverbank (hereafter called the `origin`) at some time within $[t_1,t_2]$, crossing this swimming pool at constant speed $v$ from south to north. Lane $i$ ($i\in\{0,1,2,...,n-1\}$) contains $m_i$ boats moving at constant speed $u$ in the `east / west` direction; initially, the bow of each boat is at distance $p_{i,j}$ from the north-south line through the `origin`, and the boat's length is $l_{i,j}$. From when the point enters lane $i$ until it leaves, no boat may cross this north-south dividing line.

Find the length of the longest feasible departure time interval.

> Solution

Each boat's information can be converted into a constraint `cannot depart during this time interval` $[l_i,r_i)$.

Specifically, for a boat of length $l$ in lane $i$, the bow reaches this line at time $\frac p u$, and the stern leaves this line at time $\frac {p+l} u$; the point cannot be within the lane during $\frac p u\sim\frac {p+l} u$. Consider the two limiting valid cases: the point exits the region exactly when the bow reaches the line, and the point enters the region exactly when the stern leaves the line. So the point cannot depart during $\frac p u-\frac{w\cdot(i+1)}v\sim\frac{p+l}u-\frac{w\cdot i}v$.

So a straightforward difference array suffices.

[Code](https://gist.github.com/MinecraftFuns/9e3d9d06c128ba5a5a5f59a49ea1c967)

## J

[Tile Cutting](https://icpc.kattis.com/problems/tiles)

> Problem

On a rectangular grid sheet of a given length and width, pick four points on the four edges (not including the corners) and connect them in order to form a parallelogram. For $n$ queries, among parallelograms with area between $a_l$ and $a_r$, find which area value has the most parallelograms.

> Solution

![屏幕截图 2020-11-19 151553.jpg](https://bafkreibxizaji54setl57rbbextfjappxg5kzu3xesoil4jl66vnlumedm.ipfs.dweb.link)

The area of the parallelogram equals the area of the enclosing rectangle minus the areas of the four small triangles.

$$(a+d)\cdot(b+c)-a\cdot b-c\cdot d=a\cdot c+b\cdot d$$

Let $d(x)$ denote the number of divisors of $x$, and $ans(x)$ denote the number of parallelograms with area $x$. Then $ans(x)=\sum\limits_{i+j=x}d(i)\cdot d(j)$. This is clearly a convolution, so apply `FFT` directly.

[Code](https://gist.github.com/MinecraftFuns/517fa3ae6129fde1b68c7661851f0a6f)

## K

[Tours](https://icpc.kattis.com/problems/tours)

> Problem

Given a simple graph $G$ containing at least one cycle, find all integers $k$ such that the edges of $G$ can be colored with $k$ colors so that every simple cycle contains the same number of edges of each of the $k$ colors.

> Solution

A structural result. Ignore the bridges in the graph (these clearly cannot affect the answer); for each remaining edge $i$, compute the number of new bridges $w_i$ created by removing $i$. The answer is the $\gcd$ of all $w_i+1$. See this [proof](https://petrichora.github.io/static/8371608fcdb0258cfbaf329445f395b7446766b798583b5ed0b4dfac9bad5ed1.html) :backup[https://web.archive.org/web/20201120083829/https://petrichora.github.io/static/8371608fcdb0258cfbaf329445f395b7446766b798583b5ed0b4dfac9bad5ed1.html].

[Code](https://gist.github.com/MinecraftFuns/1d8b590394f67fef9f7389c514cf345f)

## L

[Weather Report](https://icpc.kattis.com/problems/weather)

> Problem

Consider $4$ kinds of weather, `sunny / cloudy / rainy / foggy`, with known probabilities $p_\text{sunny},p_\text{cloudy},p_\text{rainy},p_\text{frog}$ respectively. You need to transmit the weather for the next $n$ days. You want to binary-encode these $4^n$ possible weather sequences such that no sequence's code is a prefix of another's. Find the minimum expected code length.

> Solution

Huffman coding. Group together the cases with equal occurrence probability when computing.

[Code](https://gist.github.com/MinecraftFuns/23f4ebe4687b9701d6924fa95d08731d)

## M

[Window Manager](https://icpc.kattis.com/problems/windows)
