---
title: "关于数位 DP 的一点点"
description: "数位 DP 的思路笔记，结合 LightOJ、HDU、SPOJ 上的五道例题给出代码实现。"
date: "2020-01-31"
tags: ["Competitive Programming", "Dynamic Programming"]
---

> 数位DP用于解决如下格式的问题：  
> *给定一个闭区间 $[L,R]$，让你求这个区间中满足 **某种条件** 的数的总数。*
>
> 数位DP是一个很朴素的想法，其实就是枚举每一位的情况，再加了一个公共部分的缓存。  
> 对于**多组测试数据**的题目，两组测试数据之间**不用清缓存**（因为缓存针对的是普遍情况，而边界情况是暴力统计不缓存的，所以缓存可以共用）。
>
> 个人感觉，在数位DP的实现上 `记忆化 DFS` 比 `DP` 要好写一点。  
> 数位DP的一个特点是 `dfs(x, y, z)` 在 `(x, y, z)` 这个三元组确定的情况下是可以确定的，所以可以缓存下来。但是在边界情况时缓存不具有普遍性，于是暴力统计。
>
> 数位DP干了一件这样的事情：暴力统计的枚举方式是 $\operatorname{for} i \in [l,r]$，没有公共部分，但是数位DP的统计方式是每一位确定过去，这使得它有一个优势，就是出现了大量的重复，可以进行优化。  

## 【LightOJ 1140】How Many Zeroes?

[题面](https://lightoj.com/problem/how-many-zeroes) :backup[https://archive.is/XMt5F]

> 题意

求区间 $[m,n]$ 中的数字的十进制表示中总共有多少个 $0$

> [代码](https://gist.github.com/MinecraftFuns/1b9c14c48f3b97ef0569118ab4d5b8f0) :backup[https://archive.is/Q1cKT]

## 【HDU 2089】不要62

[题面](http://acm.hdu.edu.cn/showproblem.php?pid=2089) :backup[https://archive.is/3qZ07]

> 题意

求区间 $[m,n]$ 中，十进制表示中既不包含**连续**的 $62$，也不包含 $4$ 的数的个数。

> [代码](https://gist.github.com/MinecraftFuns/7cb99fc1f7a3d49d276150e631e1cae6) :backup[https://archive.is/GhRzB]

## 【HDU 3555】Bomb

[题面](http://acm.hdu.edu.cn/showproblem.php?pid=3555) :backup[https://archive.is/s4kqt]

> 题意

求区间 $[1,N]$ 中数字的十进制表示包含连续 $49$ 的数字个数

> [代码](https://gist.github.com/MinecraftFuns/7b44a11ad2577f184308d6922679e2a1) :backup[https://archive.is/HkwAi]

可以参考注释理解

## 【SPOJ BALNUM】Balanced Numbers

[题面](https://www.spoj.com/problems/BALNUM/) :backup[https://archive.is/mcUdB]

> 题意

在下列情况下，正整数被视为**平衡数**：

1. 每个偶数数字在其十进制表示形式中出现奇数次  
1. 每个奇数数字在其十进制表示形式中出现偶数次  

~~上面的翻译比较垃圾，大概理解一下~~  

例如，$77$、$211$、$6222$ 和 $112334445555677$ 是平衡数，而 $351$、$21$ 和 $662$ 不是平衡数。

给定区间 $[A,B]$，求其中平衡数的个数。

> [代码](https://gist.github.com/MinecraftFuns/8858579de244917dc00ac2945562d9fa) :backup[https://archive.is/VbQNF]

可以参考注释理解

## 【SPOJ MYQ10】Mirror Number

[题面](https://www.spoj.com/problems/MYQ10/) :backup[https://archive.is/iMb7a]

> 题意

**镜面对称数**是仅包含 $0$、$1$ 和 $8$ 的回文数  

求 $[a,b]$ 中有几个镜面对称数

> [代码](https://gist.github.com/MinecraftFuns/8ecae1ca0531d6c867636f2cc603b547) :backup[https://archive.is/kPbc1]

数据范围是 $10^{44}$，所以要开一个字符数组来存输入  
并且特判一下 $a$ 本身是不是回文数  

---

如果需要编译运行，可以前往 [Gist](https://gist.github.com/MinecraftFuns/9eb0c738620c9b0b805dddb5b3f2a03c) :backup[https://archive.is/yGvqo] 复制公共头

如果编译器不支持C++11，请将 `constexpr` 改为 `const`

![hero.webp](https://ragnarok.joefang.org/static/x7edpe48fsn0iu41d8hi0qbjn89r78bmf.webp)
