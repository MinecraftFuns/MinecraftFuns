# 题解 |「LightOJ 1289」LCM from 1 to n

> [题面](https://lightoj.com/problem/lcm-from-1-to-n) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/DSCtc)

## 题意

> 求 $\operatorname{lcm}(1,2,...,n)$ ，多组测试数据

## 题解

> `MicroMaker` 神犇说是和欧拉函数有关的一些东西，但是想了半天似乎并没有什么思路  
> 于是就有了一个很暴力的想法  

先用线性筛把 $1\sim 10^8$ 的所有质数给筛出来  
然后考虑如下性质：

若 $n+1=p^k$，其中 $p$ 为质数，则 $\operatorname{lcm}(1,2,...,n+1)=\operatorname{lcm}(1,2,...,n)\times p$；  
否则，$\operatorname{lcm}(1,2,...,n+1)=\operatorname{lcm}(1,2,...,n)$。  

由于这题的时限是 $4$ 秒，有了递推式就可以 $O(n)$ 过一亿了。

> [代码](https://gist.github.com/MinecraftFuns/ad6289e286a4bddd396a3e58ad3f2e0e) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/PlTAP)

![hero.webp](https://ragnarok.joefang.org/static/xd16scumvtp5qkpclvg9adlj2bhnviu8d.webp)
