---
title: "Where the Entropy for /dev/random and /dev/urandom in WSL Comes From"
description: "Traces the entropy behind getrandom, /dev/random, and /dev/urandom in WSL to Windows' BCryptGenRandom rather than to the Linux kernel."
date: "2021-02-10"
tags: ["WSL", "Cryptography"]
translation: machine
---

Conclusion: [`BCryptGenRandom`](https://docs.microsoft.com/en-us/windows/win32/api/bcrypt/nf-bcrypt-bcryptgenrandom) :backup[https://archive.is/4GYJA]

This has already been discussed on GitHub: [Does WSL provide decent entropy?](https://github.com/microsoft/WSL/issues/1789) :backup[https://archive.is/1shmY].

WSL developer `@benhillis` gave this [reply](https://github.com/microsoft/WSL/issues/1789#issuecomment-287873135):

> `@evancox10` - Great question. We use the [BCryptGenRandom](https://docs.microsoft.com/en-us/windows/win32/api/bcrypt/nf-bcrypt-bcryptgenrandom) API in our driver to generate random bytes for the `getrandom` syscall as well as `/dev/random` and `/dev/urandom`.

So the entropy for `getrandom`, `/dev/random`, and `/dev/urandom` in WSL comes from Windows, not from what the Linux kernel collects.

[![WSL](https://ragnarok.joefang.org/static/xfag0ce5dcu8385fem152bu2r6hcvm9c2.webp)](https://aka.ms/wslstore)
