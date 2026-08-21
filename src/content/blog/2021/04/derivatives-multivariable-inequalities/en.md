---
title: "Derivatives: Handling Multi-Variable Always-True Inequalities"
description: "High school math notes on derivatives, using an example inequality involving e^x to demonstrate three methods: parameter separation, Taylor expansion, and derivatives, for handling multi-variable always-true problems."
date: "2021-04-03"
tags: ["Mathematics", "Notes"]
translation: machine
---

![girl](https://ragnarok.joefang.org/static/xdbobp37n5i4r90tjegcn19sf2334ic7h.webp)

## Approach

1. Separation (full separation / partial separation)
1. Case analysis (use special points to narrow the range)
1. Special value $\rightarrow$ necessity $\rightarrow$ sufficiency
1. Use bounding $\rightarrow$ sufficiency $\rightarrow$ necessity (proof by contradiction)

## A Good Problem

> Let $f(x)=e^x-1-x-ax^2$.  
> (I) If $a=0$, find the monotonic intervals of $f(x)$.  

Monotonically decreasing on $(-\infty,0)$, monotonically increasing on $(0,+\infty)$; steps omitted.

> (II) If $f(x)\ge 0$ for $x\ge 0$, find the range of values for $a$.

### Method 1

$f(x)\ge 0$ is equivalent to $e^x-1-x\ge ax^2$

(1) $x=0$: holds

(2) $x\gt 0$: $a\le\frac{e^x-x-1}{x^2}$

Let $g(x)=\frac{e^x-x-1}{x^2}$, then $g'(x)=\frac{(x-2)e^x+x+2}{x^3}$

Let $t(x)=(x-2)e^x+x+2$, then $t'(x)=(x-1)e^x+1$, $t''(x)=xe^x$

$\because t''(x)=xe^x\gt 0$  
$\therefore t'(x)$ is monotonically increasing, $t'(x)\gt t'(0)=0$  
$\therefore t(x)$ is monotonically increasing, $t(x)\gt t(0)=0$, $g'(x)\gt 0$  
$\therefore g(x)\gt\lim_{x\to 0}g(x)$  

$$\lim_{x\to 0}g(x)=\lim_{x\to 0}\frac{e^x-x-1}{x^2}$$

By [L'Hopital's rule](https://zh.wikipedia.org/wiki/%E6%B4%9B%E5%BF%85%E8%BE%BE%E6%B3%95%E5%88%99) :backup[https://archive.is/Oy8QT]  

$$=\lim_{x\to 0}\frac{e^x-1}{2x}$$

$$=\lim_{x\to 0}\frac{e^x}2$$

$$=\frac 1 2$$

$$\therefore a\le\frac 1 2$$

### Method 2

Taylor expansion (background)

> Idea

$$\because e^x=1+x+\frac{x^2}{2!}+\frac{x^3}{3!}+...$$

$$\therefore e^x\ge 1+x+ax^2\Rightarrow a\le \frac 1 2$$

> Execution

We can prove $e^x\ge 1+x+\frac 1 2 x^2$; sufficiency is obvious, but necessity is hard to establish this way.

### Method 3

Derivatives

> Idea

$f(x)\ge f(0)=0$; intuitively, $f'(x)$ should be greater than or equal to $0$ near $x=0$.

$f'(x)=e^x-2ax-1$, $f'(0)=0$, so $f''(x)$ should be greater than or equal to $0$ near $x=0$.

$f''(x)=e^x-2a$, so $f''(0)\ge 0$, i.e. $a\le\frac 1 2$ (necessary)

> Execution

Suppose $a\gt\frac 1 2$, then $f''(0)\lt 0$, so there exists an interval near $x=0$ where $f''(x)\lt 0$; call it $[0,x_0)$.

$\because f''(x)\lt 0,x\in[0,x_0)$  
$\therefore f'(x)$ is monotonically decreasing on $x\in(0,x_0)$, so $f'(x_0)\lt f'(0)=0$, and $f'(x)\lt 0,x\in(0,x_0)$  
$\because f'(x)\lt 0,x\in(0,x_0)$  
$\therefore f(x)$ is monotonically decreasing on $x\in[0,x_0)$, so $f(x_0)\lt f(0)=0$, which contradicts the problem's requirement  
$\therefore a\le\frac 1 2$ (necessary)

Combining Method 2 and Method 3 proves the necessary-and-sufficient condition.

### Method 4

![0](https://ragnarok.joefang.org/static/xd2bbph53llnqmcnj29h84h7fgg6fjaaq.jpg)

## Handout

* [Original file (page 1)](https://ragnarok.joefang.org/static/x5jb5iapnkonss5o0q96ftuhbu278v6nq.jpg)
* [Original file (page 2)](https://ragnarok.joefang.org/static/xi9l0b58amsagt3atm26osi0g8tvbadl8.jpg)
* [Original file (page 3)](https://ragnarok.joefang.org/static/xaboqbsnl45nsu9gr4utsi3ofjpjolvk0.jpg)
* [Original file (page 4)](https://ragnarok.joefang.org/static/xlci3jgf4jus55sdub9a5lfllqfa9ngf8.jpg)
