# 题解 |「HDU 3501」Calculation 2

> [题面](http://acm.hdu.edu.cn/showproblem.php?pid=3501) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/d0rtx)

## 题意

计算小于正整数 $n$ 且与 $n$ 不互质的正整数的和

## 题解

欧拉函数入门题

结论：小于 $n$ 且与 $n$ 互质的数的和等于 $\frac{n\times\varphi(n)} 2$

> [代码](https://gist.github.com/MinecraftFuns/53a5c887560d3c4fcf47ade3e1ab15a0) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/cfBZB)

### 证明

考虑以下事实：  

> 若 $a,b$ 互质，则 $b-a,b$ 互质

把所有小于 $n$ 且与 $n$ 互质的数列出来，得到一张长度为 $\varphi(n)$ 的表 $[a_1,a_2,...,a_{\varphi(n)}]$。

接着列出一张新的表 $[n-a_1,n-a_2,...,n-a_{\varphi(n)}]$。

根据我们的推理，两张表都是小于 $n$ 且与 $n$ 互质的数，那么这两张表应该是相同的。  

两表对应项相加得 $n$，两表长度均为 $\varphi(n)$，故小于 $n$ 且与 $n$ 互质的数的和等于 $\frac{n\times\varphi(n)} 2$，命题得证。

### 关于代码习惯

个人意见是不使用 `#define` 定义常量，而是使用 `const` 或 `constexpr`。另外，代码中最好不要出现一些莫名其妙的数字，而是使用有意义的常量名来指代。

`#define int long long` 是极其糟糕的做法。出于运行效率的考虑，应该仔细思考变量的值域，使用恰当的类型（当然打 Codeforces 是另一回事，因为在 rush 代码的时候顾不上那么多细节）。

![hero.webp](https://ragnarok.joefang.org/static/xqifcrgr6lll6138ms4ckjvqrrorkfrc9.webp)
