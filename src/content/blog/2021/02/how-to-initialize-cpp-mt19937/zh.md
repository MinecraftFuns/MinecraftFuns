---
title: "C++ | 如何安全地初始化 `std::mt19937`"
description: "分析 std::random_device 和默认 std::seed_seq 播种 std::mt19937 时存在的随机性缺陷，并给出使用 /dev/urandom 正确初始化的方法。"
date: "2021-02-21"
tags: ["C++", "Cryptography"]
---

## 背景

在看到 [C++ Seeding Surprises](https://www.pcg-random.org/posts/cpp-seeding-surprises.html) :backup[https://archive.is/g48VH] 这篇文章之前，我一直使用如下代码初始化 `std::mt19937`：

```cpp
std::mt19937 mtr(std::random_device{}());
```

## 问题

### `std::random_device` 可能根本不是随机的

旧版MinGW中的GCC将其实现为确定性的，参见 [`std::random_device` not working properly](https://sourceforge.net/p/mingw-w64/bugs/338/) :backup[https://archive.is/hIH5m]，这一问题已在 `MinGW GCC 9.2` 中修复。

### `std::random_device` 的值域不够大

`std::random_device` 的值域同 `unsigned int`，在我的环境中为 $[0,2^{32}-1]$，提供了32位的随机性。

然而，$2^{32}$ 并不是一个很大的数字。我们进行了一组[测试](https://gist.github.com/MinecraftFuns/9d05c1503dbf745d83d71995998f494e) :backup[https://archive.is/C05S1]，在 $1.75$ 秒内遍历了 $10^6$ 个数据，因此预计可以在 $2.09$ 小时内遍历完 $2^{32}$ 种情况。

众所周知，只要知道种子，就可以预测整个随机序列。因此，对于需要高安全性的用例来说，32位的种子远远不够。

> 需要高安全性的用例应当使用[密码学安全伪随机数生成器](https://zh.wikipedia.org/wiki/%E5%AF%86%E7%A0%81%E5%AD%A6%E5%AE%89%E5%85%A8%E4%BC%AA%E9%9A%8F%E6%9C%BA%E6%95%B0%E7%94%9F%E6%88%90%E5%99%A8) :backup[https://archive.is/26P3p]。

### `std::seed_seq` 的实现不靠谱

上面的代码中，我们只给 `std::mt19937` 提供了一个32位整数，但是Mersenne Twister的状态包含624个32位整数（参见[维基百科](https://zh.wikipedia.org/wiki/%E6%A2%85%E6%A3%AE%E6%97%8B%E8%BD%AC%E7%AE%97%E6%B3%95) :backup[https://archive.is/4EvcF]），因此标准库会使用 `std::seed_seq` 来扩充状态。

然而 `std::seed_seq` 的实现有问题。

在使用32位整数进行播种时，包括 $7$ 和 $13$ 在内的大约 $\frac{2^{32}}e$ 个数永远不可能作为 `std::mt19937` 生成的第一个数。如果你运行如下代码，函数 `send_detailed_tracking_info_secretly` 永远不会被调用。

```cpp
std::mt19937 mtr(std::random_device{}());
if (mtr() == 7) /* lucky seven! you get to send in a report */
{
    send_detailed_tracking_info_secretly();
}
```

## 修复

可以参考Stack Overflow上的[这个回答](https://stackoverflow.com/a/45069347) :backup[https://archive.is/XBQy9#45069347] 进行简单修复：

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

以下代码直接从 `/dev/urandom` 读取随机数：

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

### 关于熵的来源

在Linux上可以通过读取 `/dev/urandom` 获得良好的随机性，在Windows上则可以使用 [`BCryptGenRandom`](https://docs.microsoft.com/en-us/windows/win32/api/bcrypt/nf-bcrypt-bcryptgenrandom) :backup[https://archive.is/4GYJA]。

### 关于熵的大小

为了初始化 `std::seed_seq`，我从 `/dev/urandom` 中读取了2496B的数据。

## 增强

由于 `std::seed_seq` 和 `/dev/urandom` 在我的应用场景中工作良好，我选择使用它们。

如果你对 `std::seed_seq` 不满意，可以参考 [Developing a `seed_seq` Alternative](https://www.pcg-random.org/posts/developing-a-seed_seq-alternative.html) :backup[https://archive.is/9q19t]。

关于 `std::random_device` 的问题，可以参考 [Everything You Never Wanted to Know about C++'s `random_device`](https://www.pcg-random.org/posts/cpps-random_device.html) :backup[https://archive.is/LS1Lv]。

如果你想自行实现一个 `random_device`，可以参考 [Simple Portable C++ Seed Entropy](https://www.pcg-random.org/posts/simple-portable-cpp-seed-entropy.html) :backup[https://archive.is/lWYhN]。

![girl](https://bafkreie3dxyqzeabopshajhehidlxqpspdvlr5dibwhoa4vqwussrxumcy.ipfs.dweb.link)

[图片来源](https://twitter.com/i/status/1363322601846677508) :backup[https://archive.is/MNVN6]
