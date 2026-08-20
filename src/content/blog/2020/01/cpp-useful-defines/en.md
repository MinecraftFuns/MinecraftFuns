---
title: "C++ | A Few Useful Preprocessor Directives"
description: "A collection of practical C++ preprocessor directives: printing a variable's name, conditional compilation by C++ version, preventing duplicate header inclusion, and compiler flags for aggressive optimization."
date: "2020-01-30"
tags: ["C++", "Performance"]
translation: machine
---

![hero.webp](https://ragnarok.joefang.org/static/x9875nc85i7v0ho2piormab0o6q6kq2sn.webp)

## `(#x)`: Viewing a variable's name

> How it works: `(#x)` can get the name of `x`; the reason is that `(#x)` tells the preprocessor to keep this content as-is and treat it as a string literal  
> Usage: `watch(x)` *you don't even need a semicolon*  

```cpp
#define watch(x) std::cout << (#x) << ": " << x << std::endl;
```

## `__cplusplus`: The C++ version number

> How it works: `__cplusplus` defines the version number, which can be compared, e.g. `#if __cplusplus > 201403L`  
> Usage: combined with `#if`, this can avoid `CE` caused by some ~~crappy~~ OJs ~~like POJ~~ having too low a C++ version, as well as the `WARNING` caused by C++17 deprecating the `register` keyword  

* Avoiding a `WARNING` when the version is too high

```cpp
#if __cplusplus > 201403L
#define r
#else
#define r register
#endif
```

* Avoiding a `CE` when the version is too low

```cpp
#if __cplusplus >= 201103L
template <typename T, typename... Args>
void read(T &x, Args &... args)
{
    read(x);
    read(args...);
}
#endif
```

## `#ifndef` to avoid the `CE` caused by including the same header multiple times

> How it works: conditional compilation, `#ifndef` meaning "if not defined"  
> Usage: you can refer to any header in the `STL`; here is an example from the `<algorithm>` header on my computer  

```cpp
// 这里删除了一些版权声明

#ifndef _GLIBCXX_ALGORITHM
#define _GLIBCXX_ALGORITHM 1

#pragma GCC system_header

#include <utility> // UK-300.
#include <bits/stl_algobase.h>
#include <bits/stl_algo.h>

#ifdef _GLIBCXX_PARALLEL
# include <parallel/algorithm>
#endif

#endif
```

## `#pragma GCC optimize(2)`: forcing extra oxygen

> How it works: a compiler directive that forces extra "oxygen" (aggressive optimization)  
> Usage: `#pragma GCC optimize(whatever level of oxygen you want)`. Through experimentation, stacking `O2`, `O3`, and `Ofast` together has a curious effect.  

* Example

```cpp
#pragma GCC optimize(2) // 氧气
#pragma GCC optimize(3) // 臭氧
#pragma GCC optimize("Ofast,no-stack-protector,unroll-loops,fast-math") // 极端优化
```

* Everyday 卡常 (constant-factor squeezing)

```cpp
#pragma GCC optimize(2)
#pragma GCC optimize(3)
#pragma GCC optimize("Ofast,no-stack-protector,unroll-loops,fast-math")
#pragma GCC target("sse,sse2,sse3,ssse3,sse4.1,sse4.2,avx,avx2,popcnt,tune=native")
```

* The "locomotive" (a well-known combo of all the flags at once)

```cpp
#pragma GCC optimize(3)
#pragma GCC target("avx,sse2,sse3,sse4,mmx")
#pragma GCC optimize("Ofast")
#pragma GCC optimize("inline")
#pragma GCC optimize("-fgcse")
#pragma GCC optimize("-fgcse-lm")
#pragma GCC optimize("-fipa-sra")
#pragma GCC optimize("-ftree-pre")
#pragma GCC optimize("-ftree-vrp")
#pragma GCC optimize("-fpeephole2")
#pragma GCC optimize("-ffast-math")
#pragma GCC optimize("-fsched-spec")
#pragma GCC optimize("unroll-loops")
#pragma GCC optimize("-falign-jumps")
#pragma GCC optimize("-falign-loops")
#pragma GCC optimize("-falign-labels")
#pragma GCC optimize("-fdevirtualize")
#pragma GCC optimize("-fcaller-saves")
#pragma GCC optimize("-fcrossjumping")
#pragma GCC optimize("-fthread-jumps")
#pragma GCC optimize("-funroll-loops")
#pragma GCC optimize("-fwhole-program")
#pragma GCC optimize("-freorder-blocks")
#pragma GCC optimize("-fschedule-insns")
#pragma GCC optimize("inline-functions")
#pragma GCC optimize("-ftree-tail-merge")
#pragma GCC optimize("-fschedule-insns2")
#pragma GCC optimize("-fstrict-aliasing")
#pragma GCC optimize("-fstrict-overflow")
#pragma GCC optimize("-falign-functions")
#pragma GCC optimize("-fcse-skip-blocks")
#pragma GCC optimize("-fcse-follow-jumps")
#pragma GCC optimize("-fsched-interblock")
#pragma GCC optimize("-fpartial-inlining")
#pragma GCC optimize("no-stack-protector")
#pragma GCC optimize("-freorder-functions")
#pragma GCC optimize("-findirect-inlining")
#pragma GCC optimize("-fhoist-adjacent-loads")
#pragma GCC optimize("-frerun-cse-after-loop")
#pragma GCC optimize("inline-small-functions")
#pragma GCC optimize("-finline-small-functions")
#pragma GCC optimize("-ftree-switch-conversion")
#pragma GCC optimize("-foptimize-sibling-calls")
#pragma GCC optimize("-fexpensive-optimizations")
#pragma GCC optimize("-funsafe-loop-optimizations")
#pragma GCC optimize("inline-functions-called-once")
#pragma GCC optimize("-fdelete-null-pointer-checks")
```
