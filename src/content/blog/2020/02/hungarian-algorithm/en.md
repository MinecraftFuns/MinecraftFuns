---
title: "Template | Hungarian Algorithm"
description: "Template notes on the Hungarian algorithm for maximum bipartite matching, with a custom implementation and the OI Wiki reference implementation."
date: "2020-02-05"
tags: ["Algorithms", "Graph Theory"]
translation: machine
---

![hero.webp](https://bafkreigiqanywlpgo4etmho2wzvgezta6vnu7z3weehrx64cqhrelplz5y.ipfs.dweb.link)

## Bipartite graphs

### Definition

A bipartite graph, also called a bigraph, does exactly what its English name says.
A bipartite graph is a graph whose **nodes consist of two sets**, with **no edges inside either set**.
> In other words, **there exists a way** to partition the nodes into two sets satisfying the property above.

![Bipartite graph](https://bafkreiht47wu537dh3gegkjvdpxkodwe32dq5eor3w56k6gntco5h6swrm.ipfs.dweb.link)

### Properties

* If the points in the two sets are colored **black** and **white** respectively, it can be observed that **every edge** in a bipartite graph must connect **one black point** and **one white point**.
* A bipartite graph has **no cycle** of **odd** length, `since every edge goes from one set to the other, and only an even number of steps can return to the same set.`

### Checking

* Whether the graph's vertices can be split into two sets satisfying the condition.
* DFS or BFS can be used to traverse the graph. If an odd cycle is found, it is not bipartite; otherwise it is.

## Template

> Finding the matching with the maximum number of edges in a bipartite graph is called the maximum matching problem.

The **Hungarian algorithm** solves this problem, with time complexity $O(N\cdot M)$.

The algorithm proceeds roughly as follows:

1. Start from any unmatched point `u`, and pick any of its edges `u - v`. If `v` is not yet matched, the match succeeds and `match count++`. If `v` is already matched, try to find another match for `v`'s current match (this step may be executed recursively multiple times); if that attempt succeeds, the match succeeds and `match count++`.

2. If the match in the previous step fails, pick another edge that has not yet been tried and repeat the previous step.

3. Perform `step 1` for every remaining unmatched point, until all points have been tried.

### Preliminaries

```cpp
unordered_map<int, vector<int>> G;
bitset<N> vis;
int from[N];
```

### Initialization

```cpp
G.clear();
memset(from, -1, sizeof(from));
```

### DFS function

```cpp
bool dfs(int u)
{
    for (const auto &v : G[u])
    {
        if (!vis[v])
        {
            vis[v] = 1;

            if (from[v] == -1 || dfs(from[v]))
            {
                from[v] = u;
                return 1;
            }
        }
    }
    return 0;
}
```

### Computing the maximum matching

```cpp
int ans = 0;
for (R int i = 1; i <= p; i++)
{
    vis.reset();
    if (dfs(i))
    {
        ans++;
    }
}
```

### [Template](https://bafkreieqdmspjkxumecsvzibka5swq25kvrhep3nlnjemmbiygytjsv6gm.ipfs.inbrowser.link/) from [OI Wiki](https://oi-wiki.org/graph/bi-graph/)

```cpp
#include <bits/stdc++.h>
using namespace std;
const int N = 2e3 + 10;
int n, m, e;
vector<int> G[N]; //使用邻接表来储存边
int match[N], vis[N];
bool dfs(int u)
{
    int len = G[u].size();
    for (int i = 0; i < len; i++)
    { //遍历每一条边
        int v = G[u][i];
        if (vis[v])
            continue;
        vis[v] = 1;
        if (!match[v] ||
            dfs(match[v]))
        { //如果v没有匹配，或者v的匹配找到了新的匹配
            match[v] = u;
            match[u] = v; //更新匹配信息
            return 1;
        }
    }
    return 0;
}
int main()
{
    scanf("%d %d %d", &n, &m, &e);
    for (int i = 1; i <= e; i++)
    {
        int a, b;
        scanf("%d %d", &a, &b);
        if (a > n || b > m)
            continue;
        G[a].push_back(n + b);
        G[n + b].push_back(a);
    }
    int ans = 0;
    for (int i = 1; i <= n; i++)
    { //对每一个点尝试匹配
        for (int j = 1; j <= n + m; j++)
            vis[j] = 0;
        if (dfs(i))
            ans++;
    }
    printf("%d", ans);
    return 0;
}
```
