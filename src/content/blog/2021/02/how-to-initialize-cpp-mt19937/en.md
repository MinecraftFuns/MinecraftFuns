---
title: "C++ | How to Safely Initialize std::mt19937"
description: "Analyzes the randomness weaknesses of seeding std::mt19937 with std::random_device and the default std::seed_seq, and shows how to initialize it correctly using /dev/urandom."
date: "2021-02-21"
tags: ["C++", "Cryptography"]
translation: machine
---

## Background

Before I read [C++ Seeding Surprises](https://www.pcg-random.org/posts/cpp-seeding-surprises.html) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/g48VH), I always used the following code to initialize `std::mt19937`:

```cpp
std::mt19937 mtr(std::random_device{}());
```

## The problems

### `std::random_device` might not be random at all

Older versions of MinGW's GCC implemented it deterministically; see [`std::random_device` not working properly](https://sourceforge.net/p/mingw-w64/bugs/338/) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/hIH5m). This has since been fixed in `MinGW GCC 9.2`.

### `std::random_device`'s range is not large enough

The range of `std::random_device` is the same as `unsigned int`, which in my environment is $[0,2^{32}-1]$, providing 32 bits of randomness.

However, $2^{32}$ is not a very large number. We ran a [test](https://gist.github.com/MinecraftFuns/9d05c1503dbf745d83d71995998f494e) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/C05S1) that iterated over $10^6$ values in $1.75$ seconds, so we would expect to be able to iterate over all $2^{32}$ cases in $2.09$ hours.

As is well known, knowing the seed lets you predict the entire random sequence. So a 32-bit seed is far from sufficient for use cases that need high security.

> Use cases that need high security should use a [cryptographically secure pseudorandom number generator](https://zh.wikipedia.org/wiki/%E5%AF%86%E7%A0%81%E5%AD%A6%E5%AE%89%E5%85%A8%E4%BC%AA%E9%9A%8F%E6%9C%BA%E6%95%B0%E7%94%9F%E6%88%90%E5%99%A8) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/26P3p).

### `std::seed_seq`'s implementation is not trustworthy

In the code above, we only give `std::mt19937` a single 32-bit integer, but the state of a Mersenne Twister contains 624 32-bit integers (see [Wikipedia](https://zh.wikipedia.org/wiki/%E6%A2%85%E6%A3%AE%E6%97%8B%E8%BD%AC%E7%AE%97%E6%B3%95) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/4EvcF)), so the standard library uses `std::seed_seq` to expand the state.

However, `std::seed_seq`'s implementation has a problem.

When seeding with a 32-bit integer, roughly $\frac{2^{32}}e$ numbers, including $7$ and $13$, can never occur as the first number produced by `std::mt19937`. If you run the code below, the function `send_detailed_tracking_info_secretly` will never be called.

```cpp
std::mt19937 mtr(std::random_device{}());
if (mtr() == 7) /* lucky seven! you get to send in a report */
{
    send_detailed_tracking_info_secretly();
}
```

## The fix

You can do a simple fix by referring to [this answer](https://stackoverflow.com/a/45069347) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/XBQy9#45069347) on Stack Overflow:

```cpp
using Generator = std::mt19937;

Generator mtr = ([]() {
    static std::array<Generator::result_type, Generator::state_size> data;
    static std::random_device rd;

    std::generate(std::begin(data), std::end(data), std::ref(rd));

    static std::seed_seq seq(std::begin(data), std::end(data));
    static Generator mtr{seq};

    return mtr;
})();
```

The following code reads random numbers directly from `/dev/urandom`:

```cpp
using Generator = std::mt19937_64;

Generator mtr = ([]() -> Generator {
    using iv_type = Generator::result_type;
    constexpr size_t iv_length = Generator::state_size;
    constexpr size_t iv_size = sizeof(iv_type) * iv_length;

    iv_type *iv = (iv_type *)std::malloc(iv_size);

    std::FILE *fin = std::fopen("/dev/urandom", "rb");
    [[maybe_unused]] size_t unused = std::fread(iv, 1, iv_size, fin);
    std::fclose(fin);

    std::seed_seq seq = std::seed_seq(iv, iv + iv_length);
    std::free(iv);
    return Generator{seq};
})();
```

### On the source of entropy

On Linux, good randomness can be obtained by reading `/dev/urandom`; on Windows you can use [`BCryptGenRandom`](https://docs.microsoft.com/en-us/windows/win32/api/bcrypt/nf-bcrypt-bcryptgenrandom) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/4GYJA) instead.

### On the amount of entropy

To initialize `std::seed_seq`, I read 2496B of data from `/dev/urandom`.

## Improvements

Since `std::seed_seq` and `/dev/urandom` work well for my use case, I chose to use them.

If you are not satisfied with `std::seed_seq`, see [Developing a `seed_seq` Alternative](https://www.pcg-random.org/posts/developing-a-seed_seq-alternative.html) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/9q19t).

For issues with `std::random_device`, see [Everything You Never Wanted to Know about C++'s `random_device`](https://www.pcg-random.org/posts/cpps-random_device.html) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/LS1Lv).

If you want to implement your own `random_device`, see [Simple Portable C++ Seed Entropy](https://www.pcg-random.org/posts/simple-portable-cpp-seed-entropy.html) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/lWYhN).

![girl](https://bafkreie3dxyqzeabopshajhehidlxqpspdvlr5dibwhoa4vqwussrxumcy.ipfs.dweb.link)

[Image source](https://twitter.com/i/status/1363322601846677508) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/MNVN6)
