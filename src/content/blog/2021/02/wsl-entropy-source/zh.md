---
title: "WSL 中 `/dev/random` 和 `/dev/urandom` 的熵是哪里来的"
description: "考证 WSL 中 getrandom、/dev/random 和 /dev/urandom 的熵来自 Windows 的 BCryptGenRandom，而非 Linux 内核收集。"
date: "2021-02-10"
tags: ["WSL", "Cryptography"]
---

结论：[`BCryptGenRandom`](https://docs.microsoft.com/en-us/windows/win32/api/bcrypt/nf-bcrypt-bcryptgenrandom) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/4GYJA)

GitHub 上已经讨论过这个问题：[Does WSL provide decent entropy?](https://github.com/microsoft/WSL/issues/1789) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/1shmY)。

其中 WSL 开发人员 `@benhillis` 给出[回复](https://github.com/microsoft/WSL/issues/1789#issuecomment-287873135)：

> `@evancox10` - Great question. We use the [BCryptGenRandom](https://docs.microsoft.com/en-us/windows/win32/api/bcrypt/nf-bcrypt-bcryptgenrandom) API in our driver to generate random bytes for the `getrandom` syscall as well as `/dev/random` and `/dev/urandom`.

所以 WSL 中 `getrandom`、`/dev/random` 和 `/dev/urandom` 的熵是来自 Windows 的，而不是 Linux 内核收集的。

[![WSL](https://bafkreicu4oyoh5eycbayukmcxla5bpvj4wqfyxbbu6pbkt2lj6ec25ygeq.ipfs.dweb.link)](https://aka.ms/wslstore)
