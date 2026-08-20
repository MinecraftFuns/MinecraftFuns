---
title: "Game Theory Study Notes"
description: "Study notes on game theory, covering the three theorems of winning/losing states, the Nim game, the SG function and SG theorem, and Wythoff's game."
date: "2020-09-17"
tags: ["Game Theory", "Algorithms", "Notes"]
translation: machine
---

## Three theorems

There is a thing called a game graph: treat each state as a point, and draw an edge from it to every state it can move to, as in the figure below.

![Game graph](https://bafkreielu4ilygbarlazjik3fu6kvmtn3mnkh2hollvthnnprxjqrb4r6m.ipfs.dweb.link)

> Definitions

* Winning state: a state where the first player is guaranteed to win.
* Losing state: a state where the first player is guaranteed to lose.

Then we have:

1. A state with no successor states is a losing state.
1. A state is a winning state if and only if at least one of its successor states is a losing state.
1. A state is a losing state if and only if all of its successor states are winning states.

This is actually pretty intuitive:

1. If you cannot move at all, you have lost.
1. If at least one successor state is losing, then moving to that state makes the opponent lose.
1. If every successor state is winning, then no matter what you do, the opponent wins without lifting a finger.

~~Doesn't starting here feel better? Why does every other article dive straight into the Nim game and crush your confidence before you're even warmed up?~~

## The Nim game

There are `n` piles of items, with `a[i]` items in each pile. Two players alternate taking any positive number of items from any one pile, but must take at least one item. Whoever takes the last item wins.

### Nim sum

There is a mysterious result: compute the XOR of the pile sizes, `a[1] ^ a[2] ^ ... ^ a[n]` (also called the **Nim sum**). If this value is 0, the current state is losing; otherwise it is winning.

### Proof

Let's try to prove this. Following the three theorems above, we only need to establish the correctness of the following two statements to complete the proof.

1. If a state's Nim sum is not 0, we can always turn it into a state with Nim sum 0.
1. If a state's Nim sum is 0, then it either has no successor states, or every successor state has a nonzero Nim sum.

(Since the number of items strictly decreases, they will eventually all be taken, so as long as we can keep the opponent's Nim sum at 0, we are guaranteed to win.)

First, a nonzero XOR sum means that if we lay these numbers out in binary, as in the figure:

| Pile size | Bit 3 | Bit 2 | Bit 1 | Bit 0 |
|------|-------|-------|-------|-------|
| 7    | 0     | 1     | 1     | 1     |
| 9    | 1     | 0     | 0     | 1     |
| 12   | 1     | 1     | 0     | 0     |
| 15   | 1     | 1     | 1     | 1     |

The Nim sum of these piles is 13.

At the highest set bit of the Nim sum (call it column k), there must be an odd number of 1s. Pick out any one of the numbers with a 1 in bit k, XOR it with the Nim sum, and put it back. This guarantees:

* The XOR of this number with the Nim sum is strictly smaller than the number itself (originally the number had at least k binary digits, now it has at most k - 1).
* The Nim sum becomes 0 (XORing a value with itself gives 0).

We pick the number 15 and XOR it with 13, giving a table with Nim sum 0.

| Pile size | Bit 3 | Bit 2 | Bit 1 | Bit 0 |
|------|-------|-------|-------|-------|
| 7    | 0     | 1     | 1     | 1     |
| 9    | 1     | 0     | 0     | 1     |
| 12   | 1     | 1     | 0     | 0     |
| 2    | 0     | 0     | 1     | 0     |

If a state has Nim sum 0, then every bit position has an even number of 1s. The simplest case is when all positions are 0, which means we lose. Otherwise, since we can only take from one pile and must take at least one item, taking any of the 1 bits (in the same row) turns some column's even count of 1s into an odd count.

## The SG function and the SG theorem

### The mex function

First we define a mex (minimum excludent) function, which returns the smallest non-negative integer not present in a set. For example, `mex{0, 1, 5} = 2, mex{2, 3, 4} = 0, mex{} = 0`.

### The SG function

Define `SG(x) = mex(S)`, where **S is the set of SG values of all of x's successor states**. For example, if x has 3 successor states `a, b, c`, then `SG(x) = mex{SG(a), SG(b), SG(c)}`. By the definition of mex, if x has no successor states, S is the empty set, so `SG(x) = 0`. `SG(x) = 0` if and only if x is a losing position.

### The SG theorem

The SG function of a sum of games equals the Nim sum of the SG functions of the individual games. Since SG(x) = 0 means the current position is losing, suppose we have n games with starting positions `S1, S2, ..., Sn` respectively; the combined game is a first-player win if and only if `SG(S1) ^ SG(S2) ^ ... ^ SG(n) != 0`. This theorem is often used to decompose problems.

### The stone-taking problem

> There are n stones. Each turn a player may take `1, 3,` or `4` stones. Whoever takes the last stone wins. What are the SG values for 1 through n?

First, `SG(0) = 0`.

(It is recommended to work through the following by hand to reinforce your understanding.)

* At **x = 1**, we can take `{1}` stone, leaving `{0}`, so **SG(1)** = `mex{SG(0)}` = mex{0} = **1**.
* At **x = 2**, we can take `{1}` stone, leaving `{1}`, so **SG(2)** = `mex{SG(1)}` = mex{1} = **0**.
* At **x = 3**, we can take `{1, 3}` stones, leaving `{2, 0}`, so **SG(3)** = `mex{SG(2), SG(0)}` = mex{0, 1} = **2**.
* At **x = 4**, we can take `{1, 3, 4}` stones, leaving `{3, 1, 0}`, so **SG(4)** = `mex{SG(3), SG(1), SG(0)}` = mex{2, 0, 1} = **3**.
* At **x = 5**, we can take `{1, 3, 4}` stones, leaving `{4, 2, 1}`, so **SG(5)** = `mex{SG(4), SG(2), SG(1)}` = mex{3, 0, 1} = **2**.
* At **x = 6**, we can take `{1, 3, 4}` stones, leaving `{5, 3, 2}`, so **SG(6)** = `mex{SG(5), SG(3), SG(2)}` = mex{3, 2} = **0**.
* At **x = 7**, we can take `{1, 3, 4}` stones, leaving `{6, 4, 3}`, so **SG(7)** = `mex{SG(6), SG(4), SG(3)}` = mex{0, 3, 2} = **1**.
* At **x = 8**, we can take `{1, 3, 4}` stones, leaving `{7, 5, 4}`, so **SG(8)** = `mex{SG(7), SG(5), SG(4)}` = mex{1, 2, 3} = **0**.

...

| x     | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|-------|---|---|---|---|---|---|---|---|---|
| SG(x) | 0 | 1 | 0 | 2 | 3 | 2 | 0 | 1 | 0 |

So we can compute the SG function like this.

```cpp
// f: 可改变当前状态的方式，要在 getSG 之前预处理
// SG: 0 ~ n的 SG 函数值
// S: x 后继状态的集合

int f[N], SG[MX];
bitset<MX> S;

void getSG(int n)
{
    memset(SG, 0, sizeof(SG));
    // 因为 SG(0) 始终等于0，所以 i 从 1 开始
    for (int i = 1; i <= n; i++)
    {
        // 每一次都要将上一状态的后继集合重置
        S.reset();
        for (int j = 0; f[j] <= i && j <= N; j++)
        {
            S.set(SG[i - f[j]]); // 将后继状态的 SG 函数值进行标记
        }
        for (int j = 0;; j++)
        {
            if (!S.test(j))
            { // 查询当前后继状态 SG 值中最小的非零值
                SG[i] = j;
                break;
            }
        }
    }
}
```

## Wythoff's game

### Rules

See [Wikipedia](https://zh.wikipedia.org/wiki/%E5%A8%81%E4%BD%90%E5%A4%AB%E6%B8%B8%E6%88%8F)

There are two piles of stones, and two extremely clever players are playing. Each turn a player may:

1. take any number of stones from either pile, or
1. take the same number of stones from both piles.

Whoever cannot move loses; the question is who wins.

### Idea

Let a be the size of the smaller pile and b the size of the other pile, and call the pair (a, b) the current state. Note that `Δ = b - a` does not change under the `second kind of move`.

List the following positions where the second player wins (henceforth "singular states"):

1. `0 0`
1. `1 2`
1. `3 5`
1. `4 7`
1. `6 10`
1. `8 13`

A singular state is one that cannot reach a smaller singular state in a single move. For example, `1 2` can only move to `0 1` / `0 2` / `1 1`, and cannot reach `0 0`. From `2 x`, one move reaches `1 2`. If the a of a state (a, b) has already appeared in a previous singular state, it can clearly be reduced to that previous singular state in one move via the `first kind of move`, so the first number of a singular state must be a number that has not appeared in any previous singular state. Then, treating `0 0` as the 0th singular state, singular states satisfy `b = a + i` (this can be observed directly). Intuitively, states like `2 3` / `3 4` / `4 5` can all be turned into `1 2` via the `second kind of move`, but `3 5` cannot, because no previous singular state has a difference of 2; `4 7` cannot either, because no previous singular state has a difference of 3.

Perhaps it helps to think of it this way: cross out every state that can reach a singular state in one move, backward; what remains is the next singular state.

## Quickly determining a singular state

Wythoff's result is that the first player loses exactly when `delta * (sqrt(5) + 1) / 2 = a`, and wins otherwise, where `(sqrt(5) + 1) / 2` is `the golden ratio + 1`.
