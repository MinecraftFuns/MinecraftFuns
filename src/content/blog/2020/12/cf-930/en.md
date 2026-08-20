---
title: "Editorial | CF930 / Codeforces Round 468 (Div. 1)"
description: "Editorial for a virtual-contest run of Codeforces Round 468 (Div. 1): statements, approach, and takeaways for problems A through E."
date: "2020-12-25"
tags: ["Codeforces", "Editorial"]
translation: machine
---

* [Link](https://codeforces.com/contest/930) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/3cPj6)
* [Reference code](https://gist.github.com/MinecraftFuns/706d87a84abcdb36534820a7a8709609) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/YCQPJ)

![hero.webp](https://bafkreibbhurwk7asmxigw7d4teva7d7suus74x2cxeo2gq7lcl2encx2pi.ipfs.dweb.link/)

## Problems not solved independently

* C
* E

## A

> Problem

There is an apple tree; every vertex holds an apple. Each second, an apple not at the root moves one step toward the root, and an apple at the root is added to the answer. Each second, the number of apples at every vertex is taken modulo 2. Find the answer.

> Solution

If none were consumed, apples at the same depth would all reach the root at the same time. It suffices to count how many apples are at each depth, take each depth's count modulo 2, and sum them to get the answer.

> Takeaway

A warm-up problem.

## B

> Problem

K creates a string $S$ made of lowercase English letters and tells it to V. Then K picks any integer k in $[0,\operatorname{len}(S)]$ and moves the first k characters of $S$ to the end. K then tells V the first letter of the new string, and V may additionally ask K for the letter at one position $p$ of the new string (V chooses $p$). If V asks optimally, what is the probability he can uniquely determine k?

> Solution

For each letter, tally the positions where it occurs in the original string. Among the cases sharing the same starting letter, enumerate position $p$ and count how many strings can be uniquely determined; the maximum gives the answer for new strings starting with that letter.

> Takeaway

Solved it during the contest, and redid it independently this time too.

## C

> Problem

T has n segments, each with endpoints that are positive integers in [1, m], and T has noticed that **no integer point is covered by every segment**. S now wants to verify this *fact*. S may ask T questions of the form `how many segments cover a given integer point`. Find the largest set $S$ such that, after S asks about every point in $S$, the *fact* still cannot be verified.

> Solution

The statement is hard to parse. Consider three points `x, y, z`: whenever $\operatorname{ask}(y)$ is less than both $\operatorname{ask}(x)$ and $\operatorname{ask}(z)$, it means some segments fail to pass through point y, i.e. no integer point is covered by every segment. Breaking this condition translates into finding the `longest subsequence that first rises then falls` of $\operatorname{ask}(x)$. $\operatorname{ask}(x)$ can be computed with an $O(n)$ difference array. A Fenwick tree can compute, for each point, the longest non-decreasing subsequence up to it and the longest non-increasing subsequence from it to the end; then stitch the two together.

> Takeaway

Didn't understand the statement during the contest; only worked it out this time with the help of the editorial.

## D

> Problem

On a board there are n black pieces and 1 white piece. Pieces can move up / down / left / right, but cannot overlap another piece. White moves first; if white can avoid ever being trapped by black, white wins. Given the black pieces' coordinates, count the number of starting positions for white that let black win.

> Solution

Consider how a single black piece can block one direction for white. As shown, a black piece can prevent white from moving further right.

![Screenshot 2020-10-16 143227.jpg](https://bafkreia72vqgzevwcd6xeenaemr25mtity2hqlhziz4ggajno7aldm6jj4.ipfs.dweb.link)

The horizontal difference between the black and white piece is odd, and the vertical difference is even. Until the vertical coordinates match, the black piece just needs to keep moving opposite to white; once the vertical coordinates match and the horizontal difference is 1, it can keep pressing against white forever. One black piece can control one direction for white, so four black pieces are needed to control one white piece. The problem becomes: "how many positions have all four directions controlled by black pieces."

Rotating the coordinate system can reduce implementation difficulty.

> Takeaway

Remembered the idea but not the details.

## E

> Problem

There are k coins, each of which can show heads or tails.

Constraints have the form $(l_i,r_i)$. The first n constraints require at least one coin in $[l_i,r_i]$ to show heads; the last m constraints require at least one coin in $[l_i,r_i]$ to show tails.

> Solution

After discretizing the key points, consider a DP where $f[i][0/1]$ denotes, considering key point $i$ and onward, the suffix sum of the number of ways in which $disc[i] \sim disc[i + 1]$ contains a $0/1$. g[i] denotes the number of ways in which $disc[i] \sim disc[i + 1]$ contains both a 0 and a 1. $min[0/1][i]$ denotes, among constraints of type $0/1$, the nearest right endpoint to the right of $i$ whose corresponding left endpoint is not to the left of $i$.

$$f[i][0]=f[i+1][0]+f[i+1][1]-f[min[1][i]][1]+g[i]\times(2^{disc[i+1]-disc[i]}-2)$$

$$f[i][1]=f[i+1][1]+f[i+1][0]-f[min[0][i]][0]+g[i]\times(2^{disc[i+1]-disc[i]}-2)$$

$$g[i]=f[i+1][0]-f[min[0][i]][0]+f[i+1][1]-f[min[1][i]][1]+g[i]\times(2^{disc[i+1]-disc[i]}-2)$$

The answer is $g[0]$.

> Takeaway

Not solved independently.
