# C++ | 一些有用的预处理指令

![hero.webp](https://ragnarok.joefang.org/static/x9875nc85i7v0ho2piormab0o6q6kq2sn.webp)

## `(#x)`: 查看一个变量的名字

> 原理: `(#x)` 可以获得 `x` 的变量名，原因是 `(#x)` 指示预处理器将这块内容原样保留并视作字符串常量  
> 用法: `watch(x)` *你甚至不需要加分号*  

```cpp
#define watch(x) std::cout << (#x) << ": " << x << std::endl;
```

## `__cplusplus`: C++ 的版本号

> 原理: __cplusplus 定义了版本号，可以进行大小比较，如 `#if __cplusplus > 201403L`  
> 用法: 搭配 `#if`，可以避免部分 ~~辣鸡~~ OJ ~~如 POJ~~ C++ 版本过低导致的 `CE`，以及 C++ 17 弃用 `register` 关键字导致的 `WARNING`  

* 避免版本过高爆 `WARNING`

```cpp
#if __cplusplus > 201403L
#define r
#else
#define r register
#endif
```

* 避免版本过低爆 `CE`

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

## `#ifndef` 避免多次 `#include` 同一个头文件导致的 `CE`

> 原理: 条件编译 `#ifndef` 即 `if not define`  
> 用法: 可以参考任意在 `STL` 中的头文件，这里举例我电脑上的 `<algorithm>` 库  

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

## `#pragma GCC optimize(2)` 强行吸氧

> 原理: 编译指令强行吸氧  
> 用法: `#pragma GCC optimize(你要吸什么氧)`，经试验，`O2`、`O3`、`Ofast` 一起上会有奇效  

* 示例

```cpp
#pragma GCC optimize(2) // 氧气
#pragma GCC optimize(3) // 臭氧
#pragma GCC optimize("Ofast,no-stack-protector,unroll-loops,fast-math") // 极端优化
```

* 日常卡常

```cpp
#pragma GCC optimize(2)
#pragma GCC optimize(3)
#pragma GCC optimize("Ofast,no-stack-protector,unroll-loops,fast-math")
#pragma GCC target("sse,sse2,sse3,ssse3,sse4.1,sse4.2,avx,avx2,popcnt,tune=native")
```

* 火车头

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
