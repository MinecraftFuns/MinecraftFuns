---
title: "WSL 中 `/dev/random` 和 `/dev/urandom` 的熵是哪里来的"
description: "考证 WSL 中 getrandom、/dev/random 和 /dev/urandom 的熵来自 Windows 的 BCryptGenRandom，而非 Linux 内核收集。"
date: "2021-02-10"
tags: ["WSL", "Cryptography"]
---

结论：[`BCryptGenRandom`](https://docs.microsoft.com/en-us/windows/win32/api/bcrypt/nf-bcrypt-bcryptgenrandom) :backup[https://archive.is/4GYJA]

GitHub上已经讨论过这个问题：[Does WSL provide decent entropy?](https://github.com/microsoft/WSL/issues/1789) :backup[https://archive.is/1shmY]。

其中WSL开发人员 `@benhillis` 给出[回复](https://github.com/microsoft/WSL/issues/1789#issuecomment-287873135)：

> `@evancox10` - Great question. We use the [BCryptGenRandom](https://docs.microsoft.com/en-us/windows/win32/api/bcrypt/nf-bcrypt-bcryptgenrandom) API in our driver to generate random bytes for the `getrandom` syscall as well as `/dev/random` and `/dev/urandom`.

所以WSL中 `getrandom`、`/dev/random` 和 `/dev/urandom` 的熵是来自Windows的，而不是Linux内核收集的。

[![WSL](https://ragnarok.joefang.org/static/xfag0ce5dcu8385fem152bu2r6hcvm9c2.webp)](https://aka.ms/wslstore)
