---
title: "模板 | 匈牙利算法"
description: "匈牙利算法求二分图最大匹配的模板笔记，附自定义实现和 OI Wiki 参考实现。"
date: "2020-02-05"
tags: ["Algorithms", "Graph Theory"]
---

![hero.webp](https://ragnarok.joefang.org/static/xuesnij4mlhi6qvrusurnqoe366f2fgvk.webp)

## 二分图

### 定义

二分图，又称二部图，英文名叫 *Bipartite graph*。  
二分图是**节点由两个集合组成**，且两个集合**内部没有边**的图。  
> 换言之，**存在一种方案**，将节点划分成满足以上性质的两个集合。  

![二分图](https://ragnarok.joefang.org/static/x32jo8pnpjv44a7f0eh7tuiobd8orts26.png)

### 性质

* 如果两个集合中的点分别染成**黑色**和**白色**，可以发现二分图中的**每一条边**都一定是连接**一个黑色点**和**一个白色点**。
* 二分图**不存在**长度为**奇数**的**环**，`因为每一条边都是从一个集合走到另一个集合，只有走偶数次才可能回到同一个集合。`

### 判定

* 是否可以将图中的顶点分成两个满足条件的集合。
* 可以使用DFS或者BFS来遍历这张图。如果发现了奇环，那么就不是二分图，否则是。

## 模板

> 寻找二分图边数最大的匹配称为最大匹配问题。

对此，有解决此问题的 **匈牙利算法** ，时间复杂度为 $O(N\cdot M)$。

算法步骤大致如下：

1. 首先从任意一个未配对的点 `u` 开始，选择其任意一条边 `u - v`，如此时 `v` 还未配对，则配对成功，`配对数++`，若 `v` 已经配对，则尝试寻找 `v 的配对` 的另一个配对（该步骤可能会被递归的被执行多次），若该尝试成功，则配对成功，`配对数++`。

2. 如果上一步配对不成功，那么重新选择一条未被选择过的边，重复上一步。

3. 对剩下每一个没有被配对的点执行 `步骤1`，直到所有的点都尝试完毕。

### 预先定义

```cpp
unordered_map<int, vector<int>> G;
bitset<N> vis;
int from[N];
```

### 初始化

```cpp
G.clear();
memset(from, -1, sizeof(from));
```

### DFS函数

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

### 求最大匹配

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

### 来自 [OI Wiki](https://oi-wiki.org/graph/bi-graph/) 的 [模板](https://ragnarok.joefang.org/static/xodao0jd2psc2g314dk6s05c4u6csav0p.cpp)

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
