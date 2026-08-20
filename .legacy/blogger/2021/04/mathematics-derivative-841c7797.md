# 导数专题：多元变量恒成立问题的处理 | 841c7797

![girl](https://bafkreicx7z62fzb4fne7bhc4nf2jpj7pipr4kip6rldk5653rkwn3crina.ipfs.dweb.link)

## 思路

1. 分离（全分离 / 半分离）
1. 分类讨论（利用特殊点缩小范围）
1. 特殊值 $\rightarrow$ 必要性 $\rightarrow$ 充分性
1. 用放缩 $\rightarrow$ 充分性 $\rightarrow$ 必要性（反证法）

## 好题

> 设函数 $f(x)=e^x-1-x-ax^2$  
> （Ⅰ）若 $a=0$，求 $f(x)$ 的单调区间  

$(-\infty,0)$ 单调递减，$(0,+\infty)$ 单调递增，过程略

> （Ⅱ）若当 $x\ge 0$ 时 $f(x)\ge 0$，求 $a$ 的取值范围

### （一）

$f(x)\ge 0$ 即 $e^x-1-x\ge ax^2$

（1）$x=0$，成立

（2）$x\gt 0$，$a\le\frac{e^x-x-1}{x^2}$

设 $g(x)=\frac{e^x-x-1}{x^2}$，则 $g'(x)=\frac{(x-2)e^x+x+2}{x^3}$

设 $t(x)=(x-2)e^x+x+2$，则 $t'(x)=(x-1)e^x+1$，$t''(x)=xe^x$

$\because t''(x)=xe^x\gt 0$  
$\therefore t'(x)$ 单调递增，$t'(x)\gt t'(0)=0$  
$\therefore t(x)$ 单调递增，$t(x)\gt t(0)=0$，$g'(x)\gt 0$  
$\therefore g(x)\gt\lim_{x\to 0}g(x)$  

$$\lim_{x\to 0}g(x)=\lim_{x\to 0}\frac{e^x-x-1}{x^2}$$

由[洛必达法则](https://zh.wikipedia.org/wiki/%E6%B4%9B%E5%BF%85%E8%BE%BE%E6%B3%95%E5%88%99) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/Oy8QT)  

$$=\lim_{x\to 0}\frac{e^x-1}{2x}$$

$$=\lim_{x\to 0}\frac{e^x}2$$

$$=\frac 1 2$$

$$\therefore a\le\frac 1 2$$

### （二）

泰勒展开（背景）

> 想法

$$\because e^x=1+x+\frac{x^2}{2!}+\frac{x^3}{3!}+...$$

$$\therefore e^x\ge 1+x+ax^2\Rightarrow a\le \frac 1 2$$

> 实现

可证 $e^x\ge 1+x+\frac 1 2 x^2$，充分性显然，必要性难以说明

### （三）

导数

> 想法

$f(x)\ge f(0)=0$，直观感受是 $f'(x)$ 在 $x=0$ 附近应该大于等于 $0$

$f'(x)=e^x-2ax-1$，$f'(0)=0$，则 $f''(x)$ 在 $x=0$ 附近应该大于等于 $0$

$f''(x)=e^x-2a$，则有 $f''(0)\ge 0$，即 $a\le\frac 1 2$（必要）

> 实现

假设 $a\gt\frac 1 2$，则 $f''(0)\lt 0$，则 $f''(x)$ 在 $x=0$ 附近存在小于 $0$ 的一段区间，设为 $[0,x_0)$

$\because f''(x)\lt 0,x\in[0,x_0)$  
$\therefore f'(x)$ 在 $x\in(0,x_0)$ 单调递减，则 $f'(x_0)\lt f'(0)=0$，且 $f'(x)\lt 0,x\in(0,x_0)$  
$\because f'(x)\lt 0,x\in(0,x_0)$  
$\therefore f(x)$ 在 $x\in[0,x_0)$ 单调递减，则 $f(x_0)\lt f(0)=0$，与题目要求不符，矛盾  
$\therefore a\le\frac 1 2$（必要）

将（二）和（三）结合起来，可证充要

### （四）

![0](https://bafkreiby6gzjufczz5qui3ggqdacgjbtx2ivyzqw4eivaks3tm4ukop6ji.ipfs.dweb.link)

## 讲义

* [原始文件（第 1 页）](https://bafkreiga2v67fpahktg6q5xxsl2mion3mbm5zhowhqq6zdw2kvw7t4vlma.ipfs.inbrowser.link/)
* [原始文件（第 2 页）](https://bafkreif2aeupiask2cs5xri4oerr2rtr6rwvgnvm4ovlbd67wefyanqwom.ipfs.inbrowser.link/)
* [原始文件（第 3 页）](https://bafkreihxt4zh6ok25kntbrquqqnqn6e2bcbv2l65ypftammo32gjtsdwhu.ipfs.inbrowser.link/)
* [原始文件（第 4 页）](https://bafkreiddvlnppokikgzxq2ngxfw4xoydelf6fyu3ff5pmnkfqmuiyrlrh4.ipfs.inbrowser.link/)
