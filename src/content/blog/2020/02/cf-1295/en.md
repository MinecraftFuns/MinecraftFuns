---
title: "Editorial | CF1295 / Educational Codeforces Round 81 (Div. 2)"
description: "Editorial for Educational Codeforces Round 81 (Div. 2) problems A through F, covering contest-time approach, notes on the official tutorial, and reference code."
date: "2020-02-03"
tags: ["Codeforces", "Editorial"]
translation: machine
---

* [Link](https://codeforces.com/contest/1295) :backup[https://archive.is/QE7IG]
* [Reference code](https://example.com/#%E6%AD%A4%E4%BB%A3%E7%A0%81%E5%B7%B2%E9%81%97%E5%A4%B1%EF%BC%8C%E8%BF%99%E7%A7%8D%E9%9A%BE%E5%BA%A6%E7%9A%84%E9%A2%98%E5%B0%B1%E4%B8%8D%E7%94%A8%E5%8F%82%E8%80%83%E4%BB%A3%E7%A0%81%E4%BA%86%E5%90%A7) :backup[https://archive.is/s0vXt]

![hero.webp](https://ragnarok.joefang.org/static/x21jvkmpvu9pdp6h8i4faalh86ai10503.webp)

> [Contest link](https://codeforces.com/contest/1295)  
> Only solved A, B, C, D during the contest, and B even FSTed; ~~ugh I'm so bad~~  
> Upsolved E and F afterward with the [Tutorial](https://codeforces.com/blog/entry/73467), the ones I ~~couldn't actually do~~ didn't have time for  

The official Tutorial is really a great resource; ~~the following is purely a translation~~ actually I wrote some of it myself

## A

Nothing much to say: if `n` is even, output all 1s; if `n` is odd, output 7 in the highest digit and 1 everywhere else

Code:

```cpp
int T;
int n;

int main()
{
    io::read(T);
    for (int _ = 0; _ < T; _++)
    {
        io::read(n);
        if (n % 2 == 0)
        {
            for (int i = 0; i < n / 2; i++)
            {
                putchar('1');
            }
            putchar('\n');
        }
        else
        {
            putchar('7');
            for (int i = 1; i < n / 2; i++)
            {
                putchar('1');
            }
            putchar('\n');
        }
    }
}
```

## B

Let `pref(i)` denote the prefix of length `i`. Note that when `k = ⌊i / n⌋`, each `pref(i) = k ⋅ pref(n) + pref(i mod n)` (here `+` means concatenation). Then `bal(i)`, for the prefix of length `i`, equals `k ⋅ bal(n) + bal(i mod n)`.

There are now two cases: whether `bal(n)` equals `0` or not. If `bal(n) = 0`, then if there exists `j (0 ≤ j < n)` such that `bal(j) = x`, then `bal(j + kn) = x` for every `k ≥ 0`, and the answer is `-1`.

Otherwise, for each such `j` there can be at most one `k`, since the equation `bal(j) + k ⋅ bal(n) = x` has zero or one solution. This solution exists if and only if `x - bal(j) ≡ 0 (mod bal(n))` and `k = x - bal(j) / bal(n) ≥ 0`. So it suffices to precompute `bal(n)` and check the equation for each `0 ≤ j < n`.

Code:

```cpp
int T;
int n, x;

constexpr int N = 1e5 + 5;

int one[N], zero[N];
vector<int> vec;

inline void init()
{
    one[0] = 0;
    zero[0] = 0;
    vec.clear();
}

int main()
{
    io::read(T);
    for (int _ = 0; _ < T; _++)
    {
        init();

        io::read(n, x);

        for (int i = 1, u; i <= n; i++)
        {
            scanf("%1d", &u);
            if (u == 1)
            {
                one[i] = one[i - 1] + 1;
                zero[i] = zero[i - 1];
            }
            else
            {
                one[i] = one[i - 1];
                zero[i] = zero[i - 1] + 1;
            }
        }

        int tmp = zero[n] - one[n];

        if (x == 0)
        {
            int cnt = 1;

            for (int i = 1; i <= n; i++)
            {
                if (one[i] == zero[i])
                {
                    cnt++;
                }
            }

            if (tmp == 0)
            {
                io::writeln(-1);
            }
            else
            {
                io::writeln(cnt);
            }
        }
        else
        {
            for (int i = 1; i <= n; i++)
            {
                if (tmp == 0)
                {
                    if (x == zero[i] - one[i])
                    {
                        vec.emplace_back(i);
                    }
                }
                else if (tmp < 0)
                {
                    if (x - (zero[i] - one[i]) < 0 && (zero[i] - one[i] - x) % (one[n] - zero[n]) == 0)
                    {
                        vec.emplace_back(i);
                    }
                }
                else if ((x - (zero[i] - one[i])) % tmp == 0 && x - (zero[i] - one[i]) >= 0)
                {
                    vec.emplace_back(i);
                }
            }

            int _cache = vec.size();

            if (one[n] == zero[n] && _cache)
            {
                io::writeln(-1);
            }
            else
            {
                io::writeln(_cache);
            }
        }
    }
}
```

## C

If `t` contains a character that does not appear in `s`, output `−1`

Otherwise, precompute an array `nxt[i][j] = the smallest index x in [i, |s|) such that s[x] = j`; if none exists, `nxt[i][j] = INF`.

Then apply a simple greedy strategy. Suppose we are currently at `z = t[0]t[1]……t[i − 1]`, having processed up to position `pos`. There are two cases:

* If `nxt[pos][i] ≠ INF`, then `i++, pos = nxt[pos + 1][i]`
* If `nxt[pos][i] = INF`, then `pos = 0, ans++` (`ans` starts at `0`)

Code:

```cpp
constexpr int N = 1e5 + 5;
constexpr int CHARSET_SIZE = 26;

namespace sol
{
char s[N], t[N];

int bucket[CHARSET_SIZE];
vector<int> v[CHARSET_SIZE];

inline void init()
{
    for (int i = 0; i < 26; i++)
    {
        v[i].clear();
    }

    mem(bucket);
}

inline int main()
{
    init();

    scanf("%s %s", s, t);

    int len_s = strlen(s), len_t = strlen(t);

    for (int i = 0; i < len_s; i++)
    {
        bucket[s[i] - 'a']++;
    }

    for (int i = 0; i < len_t; i++)
    {
        if (!bucket[t[i] - 'a'])
        {
            return -1;
        }
    }

    for (int i = 0; i < len_s; i++)
    {
        v[s[i] - 'a'].emplace_back(i + 1);
    }

    int pos = 0, now = 0, res = 1;

    while (pos != len_t)
    {
        int _cache = t[pos] - 'a';
        int _t = upper_bound(v[_cache].begin(), v[_cache].end(), now) - v[_cache].begin();

        if (_t == v[_cache].size())
        {
            res++;
            now = 0;
        }
        else
        {
            now = v[_cache][_t];
            pos++;
        }
    }

    return res;
}
} // namespace sol

int T;

int main()
{
    io::read(T);
    for (int _ = 0; _ < T; _++)
    {
        io::writeln(sol::main());
    }
}
```

## D

Let `g = gcd(a, m)`, `m' = m / g`  
It can be shown that the result is exactly Euler's totient `φ(m')`  

Proof:  
For `gcd(a, m) = gcd(a + x, m) = g` to hold, `x` must first be a multiple of `g`, and second `x / g` must be coprime with `m'`  
Let `a' = a / g`, `x' = x / g`; the original problem becomes counting the numbers in `[a', a' + m')` that are coprime with `m'`  
By the correctness of the Euclidean algorithm, this is exactly `φ(m')`  

But ~~my teammate~~ I'm just bad, missed these properties during the contest, and brute-forced it with inclusion-exclusion instead  
~~which left no time to go breeze through E~~

Code:

```cpp
constexpr int N = 100005;
constexpr int U = 100000;

ll prime[N], prime_cnt;
bitset<N> is_prime;

inline void check()
{
    for (int i = 2; i <= U; i++)
    {
        if (!is_prime[i])
        {
            prime[++prime_cnt] = i;
        }
        for (int j = 1; j <= prime_cnt; j++)
        {
            if (i * prime[j] >= U)
            {
                break;
            }

            is_prime[i * prime[j]] = 1;

            if (i % prime[j] == 0)
            {
                break;
            }
        }
    }
}
vector<ll> vec, bucket[15];

void dfs(ll dep, ll sum, ll cnt, bool flag)
{
    if (!flag)
    {
        bucket[sum].emplace_back(cnt);
    }
    if (dep == vec.size())
    {
        return;
    }

    dfs(dep + 1, sum + 1, cnt * vec[dep], 0);
    dfs(dep + 1, sum, cnt, 1);
}

int T;
ll x, y;

inline void init()
{
    for (int i = 0; i < 15; i++)
    {
        bucket[i].clear();
    }
    vec.clear();
}

int main()
{
    check();

    io::read(T);

    for (int _ = 0; _ < T; _++)
    {
        init();

        io::read(x, y);
        ll GCD = _f::gcd(x, y);

        y /= GCD;

        ll xr = x / GCD + y, xl = x / GCD;
        ll ans1 = xl, ans2 = xr;

        for (int i = 1; i <= prime_cnt && y != 1; i++)
        {
            if (y % prime[i] == 0)
            {
                vec.emplace_back(prime[i]);

                do
                {
                    y /= prime[i];
                } while (y % prime[i] == 0);
            }
        }

        if (y != 1)
        {
            vec.emplace_back(y);
        }

        dfs(0, 0, 1, 0);

        for (auto i = 1; i <= vec.size(); i++)
        {
            for (const auto &it : bucket[i])
            {
                if (i & 1)
                {
                    ans1 -= xl / it;
                    ans2 -= xr / it;
                }
                else
                {
                    ans1 += xl / it;
                    ans2 += xr / it;
                }
            }
        }

        io::writeln(ans2 - ans1);
    }
}
```

## E

Just maintain it with a segment tree

Code:

```cpp
C int N = 2e5 + 5;
C ll INF = 1e18;

int n;
ll ans = INF;

namespace SegTree
{
C int TREE_SIZE = N * 4;
struct Tree
{
    ll min_v, tag;
} tree[TREE_SIZE];

#define lson(x) ((x) << 1)
#define rson(x) ((x) << 1 | 1)
#define ls lson(rt)
#define rs rson(rt)

inline void push_up(int rt)
{
    tree[rt].min_v = std::min(tree[ls].min_v, tree[rs].min_v);
}

inline void push_down(int rt, int l, int r)
{
    if (tree[rt].tag)
    {
        tree[ls].min_v += tree[rt].tag;
        tree[ls].tag += tree[rt].tag;
        tree[rs].min_v += tree[rt].tag;
        tree[rs].tag += tree[rt].tag;
        tree[rt].tag = 0;
    }
}

inline void modify(int rt, int l, int r, ll ml, ll mr, ll k)
{
    if (ml <= l && r <= mr)
    {
        tree[rt].min_v += k;
        tree[rt].tag += k;
        return;
    }

    push_down(rt, l, r);

    int mid = (l + r) >> 1;
    if (ml <= mid)
    {
        modify(ls, l, mid, ml, mr, k);
    }
    if (mid < mr)
    {
        modify(rs, mid + 1, r, ml, mr, k);
    }

    push_up(rt);
}

inline ll query_min()
{
    return tree[1].min_v;
}

#undef ls
#undef rs
#undef lson
#undef rson
} // namespace SegTree

ll a[N], p[N];

int main()
{
    io::read(n);
    io::readln(p + 1, p + n + 1);
    io::readln(a + 1, a + n + 1);

    for (R int i = 1; i <= n; i++)
    {
        SegTree::modify(1, 0, n, p[i], n, a[i]);
    }

    for (R int i = 1; i < n; i++)
    {
        SegTree::modify(1, 0, n, p[i], n, -a[i]);
        SegTree::modify(1, 0, n, 0, p[i] - 1, a[i]);
        ans = std::min(ans, SegTree::query_min());
    }

    io::writeln(ans);
}
```

## F

Flaked on this one entirely; all I know is there's some genius combinatorics solution out there, and the setter's own intended solution got destroyed by it

Code:

```cpp
C int MOD = 998244353;

inline int cal(int n, ll m)
{
    int res = 1;

    for (R int i = 1; i <= n; i++)
    {
        res = (ll)res * (n + m - i) % MOD * _f::pow(i, MOD - 2, MOD) % MOD;
    }

    return res;
}

C int N = 50 + 5;

int n;
int l[N], r[N];
int s[N * 2];
int a[N * 2][N * 2];

int main()
{
    io::read(n);
    int sz = 1;

    for (R int i = 1; i <= n; i++)
    {
        io::read(l[i], r[i]);
        s[(i << 1) - 1] = l[i];
        s[i << 1] = ++r[i];
        sz = (ll)sz * (r[i] - l[i]) % MOD;
    }

    sort(s + 1, s + n * 2 + 1);
    int tot = unique(s + 1, s + n * 2 + 1) - (s + 1);

    for (R int i = 1; i <= n; i++)
    {
        l[i] = lower_bound(s + 1, s + tot + 1, l[i]) - s;
        r[i] = lower_bound(s + 1, s + tot + 1, r[i]) - s;
    }

    for (R int i = 1; i <= tot + 1; i++)
    {
        a[0][i] = 1;
    }

    for (R int i = 1; i <= n; i++)
    {
        for (R int j = l[i]; j <= r[i] - 1; j++)
        {
            for (R int k = i - 1; k >= 0; k--)
            {
                a[i][j] = (a[i][j] + (ll)a[k][j + 1] * cal(i - k, s[j + 1] - s[j])) % MOD;

                if (l[k] > j || r[k] <= j)
                {
                    break;
                }
            }
        }

        for (R int j = tot; j >= 1; j--)
        {
            a[i][j] = (a[i][j] + a[i][j + 1]) % MOD;
        }
    }

    io::writeln((ll)a[n][1] * _f::pow(sz, MOD - 2, MOD) % MOD);
}
```

## Common Header

> (I made some small adjustments to the common header these past few days; below is the new version. Using it with old code may occasionally cause CE or similar issues, no guarantees.)

```cpp
#pragma GCC optimize(2)
#pragma GCC optimize(3)
#pragma GCC optimize("Ofast,no-stack-protector,unroll-loops,fast-math")
#pragma GCC target("sse,sse2,sse3,ssse3,sse4.1,sse4.2,avx,avx2,popcnt,tune=native")

#include "bits/stdc++.h"

#define mem(x) memset((x), 0, sizeof((x)))
#define il __attribute__((always_inline))

using namespace std;

typedef long long ll;
typedef long double ld;
typedef unsigned long long ull;

#if __cplusplus > 201403L
#define R
#else
#define R register
#endif

#if __cplusplus >= 201103L
#define C constexpr
#else
#define C const
#endif

namespace _c
{
C double pi = 3.141592653589793;
namespace min
{
C int i8 = -128;
C int i16 = -32768;
C int i = -2147483647 - 1;
C ll l = -9223372036854775807LL - 1;
} // namespace min
namespace max
{
C int i8 = 127;
C int i16 = 32767;
C int i = 2147483647;
C ll l = 9223372036854775807LL;
} // namespace max
} // namespace _c

namespace _f
{
template <typename Tp>
inline Tp gcd(Tp x, Tp y)
{
    while (y != 0)
    {
        Tp t = x % y;
        x = y;
        y = t;
    }
    return x;
}
template <typename Tp>
inline Tp abs(const Tp &a)
{
    return a > 0 ? a : -a;
}
template <typename Bp, typename Ep>
inline Bp pow(Bp a, Ep b)
{
    R Bp res = 1;
    while (b > 0)
    {
        if (b & 1)
        {
            res *= a;
        }
        a *= a;
        b >>= 1;
    }
    return res;
}
template <typename Bp, typename Ep, typename Mp>
inline Mp pow(Bp a, Ep b, const Mp &m)
{
    a %= m;
    R Mp res = 1;
    while (b > 0)
    {
        if (b & 1)
        {
            res = ((ll)res * a) % m;
        }
        a = ((ll)a * a) % m;
        b >>= 1;
    }
    return res % m;
}
} // namespace _f

namespace io
{
template <typename Tp>
inline void read(Tp &x)
{
    static bool neg;
    static char c;
    x = 0, neg = 0, c = getchar();
    for (; !isdigit(c); c = getchar())
    {
        if (c == '-')
        {
            neg = 1;
        }
    }
    for (; isdigit(c); c = getchar())
    {
        x = x * 10 + c - '0';
    }
    if (neg)
    {
        x = -x;
    }
}
template <typename Tp>
inline Tp read()
{
    R Tp res;
    read(res);
    return res;
}
template <typename Tp>
inline void readln(const Tp first, const Tp last)
{
    for (R Tp it = first; it != last; it++)
    {
        read(*it);
    }
}
template <typename Tp>
inline void _write(Tp x)
{
    if (x < 0)
    {
        putchar('-');
        x = -x;
    }
    if (x > 9)
    {
        _write(x / 10);
    }
    putchar(x % 10 + '0');
}
template <typename Tp>
inline void write(const Tp &x, const char &sep = ' ')
{
    _write(x);
    putchar(sep);
}
template <typename Tp>
inline void writeln(const Tp &x)
{
    write(x, '\n');
}
template <typename Tp>
inline void writeln(const Tp first, const Tp last, const char &sep = ' ', const char &ends = '\n')
{
    for (R Tp it = first; it != last; it++)
    {
        write(*it, sep);
    }
    putchar(ends);
}
#if __cplusplus >= 201103L
template <typename Tp, typename... Args>
inline void read(Tp &x, Args &... args)
{
    read(x);
    read(args...);
}
#endif
} // namespace io
```
