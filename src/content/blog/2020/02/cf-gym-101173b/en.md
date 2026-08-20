---
title: "Editorial |「Codeforces Gym 101173B」Bipartite Blanket | Hall's Theorem / Stable Marriage Problem"
description: "Editorial for Codeforces Gym 101173B (counting perfect matching subsets in a vertex-weighted bipartite graph), with background on Hall's theorem and the stable marriage problem (Gale-Shapley algorithm)."
date: "2020-02-05"
tags: ["Codeforces", "Editorial", "Graph Theory", "Combinatorics"]
translation: machine
---

![hero.webp](https://ragnarok.joefang.org/static/x9m8ui2hvfidi6uv53ohui5ngosh1taho.webp)

> Collected a handful of resources here so I don't have to go digging again

## Problem link

* [Codeforces](https://codeforces.com/gym/101173/attachments)
* [PDF](https://bafkreibxglqbn6e7btfmilq5vtnyefyguvjidrnrn4t6vuoklnolrbcoea.ipfs.inbrowser.link/)

---

## Problem statement

Given an *n × m* **bipartite graph** with vertex weights, how many **subsets that form a perfect matching** have a total weight of at least *t*

### Concept: perfect matching

If, in some matching of a graph, **every vertex is matched**, then it is a perfect matching.  
> Obviously, a **perfect matching** must be a **maximum matching** *(every vertex in a perfect matching is already matched, so adding a new matching edge would necessarily conflict with an existing one)*, but **not every graph** has a **perfect matching**.

[Related knowledge - Maximum matching / Perfect matching](https://bafkreihpfhjisduom22td3xbtbsseecbgesxqbit3vrjerorwtkr42gedq.ipfs.inbrowser.link/)

> Matching: in graph theory, a "matching" is a set of edges in which no two edges share a common vertex.  
> Maximum matching: among all matchings of a graph, the one containing the most matching edges is called the graph's maximum matching.  

---

## Solution

### Approach

> Note: if a vertex subset *V1* of *X* belongs to some perfect matching, and a vertex subset *V2* of *Y* also belongs to some perfect matching, then *V1 + V2* must also belong to some perfect matching.

Enumerate the states of *X* and *Y* separately, and use **Hall's theorem** to determine whether each vertex subset belongs to some perfect matching, then tally them together at the end.

### Code

> Full code available [here](https://bafkreifugimlrvug7s66weh3slmlcwtksjubnm4dj5g4wmaxo7rrv3upnm.ipfs.inbrowser.link/)

```cpp
C int N = 20;
C int _U = N + 1;

C int U = N + 5;
C int SIZE = 1 << _U;

int n, m, t;
int wx[U], wy[U];
int cover_x[SIZE], cover_y[SIZE], cnt[SIZE];

bitset<SIZE> fx, fy;
vector<int> x, y;

inline void solve(int n, int *wx, int *cover_x, bitset<SIZE> &fx, vector<int> &x)
{
    for (R int s = 0; s < (1 << n); s++)
    {
        fx[s] = 1;

        int sum = 0;
        for (R int i = 0; i < n; i++)
        {
            if (s & (1 << i))
            {
                cover_x[s] |= cover_x[s ^ (1 << i)];
                sum += wx[i];
                fx[s] = fx[s] & fx[s ^ (1 << i)];
            }
        }

        if (fx[s] && cnt[s] <= cnt[cover_x[s]])
        {
            x.emplace_back(sum);
        }
        else
        {
            fx[s] = 0;
        }
    }
}

char str[U];

inline void init()
{
    for (R int s = 0; s < (1 << 20); s++)
    {
        cnt[s] = cnt[s >> 1] + (s & 1);
    }
}

int main()
{
    init();

    io::read(n, m);
    for (R int i = 0; i < n; i++)
    {
        scanf("%s", str);
        for (R int j = 0; j < m; j++)
        {
            if (str[j] == '1')
            {
                cover_x[1 << i] |= (1 << j);
                cover_y[1 << j] |= (1 << i);
            }
        }
    }

    io::readln(wx, wx + n);
    io::readln(wy, wy + m);

    io::read(t);

    solve(n, wx, cover_x, fx, x);
    solve(m, wy, cover_y, fy, y);

    sort(x.begin(), x.end());

    ll ans = 0;
    for (const auto &val : y)
    {
        ans += x.end() - lower_bound(x.begin(), x.end(), t - val);
    }
    io::writeln(ans);
}
```

---

## Hall's theorem

### Statement

Suppose:

1. We have female guests numbered *1* through *N*, and male guests numbered *1* through *N*.
2. Each female guest writes on her own card the numbers of the male guests she likes (with no limit on how many, she can even write all of them).
3. These cards are collected.

From the collected cards, we want to determine whether there exists a pairing such that every female guest gets a male guest she likes.

To achieve such a pairing, we note the following fact:

> For any *k* female guests chosen, if we combine their cards, the number of distinct male guests written on them (counting duplicates only once) must be at least *k*; otherwise these female guests would end up scrambling over the same men, and no pairing would exist.

Hall's theorem states that if the above fact holds for every nonempty subset of female guests, then a pairing must exist.

### Proof

![证明霍尔定理](https://bafkreifydvtalnuxr6o7l6dm3jbcxl54v6a7m6corqkc7tns6gob7rpkxi.ipfs.dweb.link)

Cached - [http://faculty.wwu.edu/sarkara/hall.pdf](https://bafkreigxbfy2otqvi3rzfvldrlvhvwqvagxdkext7m4llohjjl7vbhnqx4.ipfs.inbrowser.link/)

### A neat corollary

Suppose the two vertex sets are `X` and `Y`; then the size of the bipartite graph's maximum matching is `|X| - max{|W| - N(W)}`, where `W` is a subset of `X`  
> For certain special problems, this lets you find the maximum matching directly without building the graph  
> From [Hall定理 二分图完美匹配 - dummyummy - 博客园](https://bafkreih6gsfrwjjtaqgap4u3rffvh34bm2mwpjpwopzxwylfnsuz66vqgm.ipfs.inbrowser.link/)  
> Let the two vertex sets of bipartite graph `G` be `X` and `Y` (assume `|X| ≤ |Y|`). The **necessary and sufficient condition** for `G` to have a set of vertex-disjoint edges with one endpoint exactly covering `X` (that is, **a perfect matching on the `X` side exists**) is: **any `k` vertices in `X` are adjacent to at least `k` vertices in `Y`**; that is, for a vertex subset `W` of `X`, letting `N(W)` denote all neighbors of `W`, Hall's theorem says that for any `W`, `|W| ≤ |N(W)|`

---

## The stable marriage problem

There are now **N men** and **N women**; **each man** has ranked his preference for all **N women**, and **each woman** has ranked her preference for all **N men**; we now need to determine a stable dating arrangement.  
> **Definition of stable** If **man i** and **woman a** are paired, and **man j** and **woman b** are paired, but **man i** prefers **woman b**, and **woman b** finds that she prefers **man i** over her own **boyfriend j**, then nothing stops **man i** and **woman b** from eloping together; this is what makes the arrangement unstable. If no such situation exists, the arrangement is called stable.  

### How to solve it

> In 1962, American mathematicians *David Gale* and *Lloyd Shapley* devised a **strategy for finding a stable marriage**. No matter how many men and women there are, and no matter what their individual preferences are, **applying this strategy** always **produces a stable marriage arrangement**. In other words, they proved that **a stable marriage arrangement always exists**. *Interestingly, this strategy reflects a lot of real-life situations.*

In this strategy:

1. Men pursue the women they like, round after round
2. Women may choose to accept or reject their suitors

In the **first round**, every **man** picks the **woman ranked first** on his list and proposes to her.

At this point, a woman **may face one of three situations**:

* No one proposes to her
* Exactly one person proposes to her
* More than one person proposes to her

The woman's response strategy:

* In the first case, the woman **does nothing** and simply **keeps waiting**
* In the second case, she **accepts that person's proposal** and agrees to **be his girlfriend for now**
* In the third case, she picks **her favorite** among all her suitors, agrees to **be his girlfriend for now**, and **rejects all the others**

> After the first round, some men already have girlfriends, while others are still single.

**In the second round of courting**, every **single man** picks his **favorite** among all the **women who haven't rejected him yet** and proposes to her, **regardless of whether she is currently single**.

**Just as in the first round**, the women choose their **favorite** among the proposers and reject the rest.

*Note that if the woman **already has a boyfriend** and she **encounters a better suitor**, she **must reject her current boyfriend** and go to the new suitor.*

> This way, some single men will gain girlfriends, and some who already had one may get dumped and become single again.  
> In every following round, single men keep pursuing the next woman on their list, and each woman picks the best among all her suitors, including her current boyfriend, and says no to everyone else.

This continues round after round until, at some point, **no one is single anymore**; the next round has no new proposals, and the whole process ends automatically. **The resulting marriage arrangement** is then guaranteed to be stable.

![稳定婚姻](https://bafkreicclusoacxzjhfkqrgzr4gebazxa5qlgszcl6n3kxna4mcmdwavzi.ipfs.dweb.link)

### Correctness

Could this strategy, like the earlier patch-up method, run forever without terminating? No.

We will now show that as the number of rounds grows, everyone is eventually paired.

> Since in every round at least one man proposes to some woman, the total number of proposals increases as the rounds go on.  
> If the whole process never ends because everyone got paired, eventually some man must end up having proposed to every woman.  
> And once a woman has been proposed to even once, she can never be single again afterward.  
> Since this man has proposed to every woman, all women are now non-single, which means everyone is now paired.

Next, we still need to prove that the resulting pairing is indeed stable.

> First note that as the rounds progress, the woman a man is pursuing only gets worse, while a woman's boyfriend can only get better.  
> Suppose **man A** and **woman 1** each already have their own partner, but **man A** prefers **woman 1** over his current partner. Then **man A** must have already proposed to **woman 1** at some earlier point. Since **woman 1** did not end up with **man A**, she must have rejected him, meaning she had already found a man better than **man A**.  
> This proves that the situation where two people are not paired together yet each thinks the other is better than their current partner can never happen.

---

## References

> To avoid references 404ing or the original site responding slowly, all references have been converted to `PDF` format, uploaded to `GitHub`, and distributed via `jsDelivr`  
> Links to the original content can be found in the `footnotes`  
> Some references are scattered throughout the text instead, sorry about that

* [GYM 101173B - Bipartite Blanket - a free man - CSDN](https://bafybeia52k3ua4uxmsi5s57pykdaxfcr4i7aicota723l3sf3vsh4j4hpq.ipfs.inbrowser.link/)
* [【Codeforces】Gym 101173B Bipartite Blanket 霍尔定理+状压DP - Ogiso_Setsuna - 博客园](https://bafkreiankx4zl2htixcquhgmicn25kg4i5iyhplovqwrfdi2fjaglfwadi.ipfs.inbrowser.link/)
* [稳定婚姻匹配问题 - 唔哩Wulili - 博客园](https://bafkreihtn7raqggotg2x7ie2vwqz57l7ihmjsqx6cnaodevth5akgwk3la.ipfs.inbrowser.link/)
* [Hall's marriage theorem - Wikipedia](https://bafkreied4azbfmpmagjuoboqj42irglrvi6tfhsartswdv6jdt4d5git2a.ipfs.inbrowser.link/)
