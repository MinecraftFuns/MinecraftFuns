---
title: "Sandboxie Plus: Secure, Easy-to-Use Sandboxing Software"
description: "The motivation and experience of using Sandboxie Plus to isolate domestic Chinese software such as DingTalk, including compatibility issues with Tor Browser and GitHub Desktop."
date: "2021-12-10"
tags: ["Tools", "Security"]
translation: machine
---

![github](https://bafkreidy5a4pyicrpuoufwr4g6f6xctrsub4xetoec3bswl4ty4oqaooba.ipfs.dweb.link)

During winter break in 2020, I once tried running "Homework Help Network" with Sandboxie, and the result was less than satisfying. For over a year afterward, on the principle of "privacy first," I didn't install any domestic Chinese software on my personal computer.

Until recently, when another wave of the pandemic hit and we went back to online-class software suites. So I was forced to start looking for a good sandbox to isolate domestic software from my personal data.

## About Sandboxie Plus

![icon](https://bafkreieynxazoaelpsyujj3nnhscu7i35ukt75vndk5fboe5p6krrvcosq.ipfs.dweb.link)

Sandboxie is a sandbox-based isolation program for 32-bit and 64-bit Windows NT-based operating systems. It creates a sandbox-like isolated operating environment. Applications can be installed and run inside Sandboxie without permanently modifying `local / mapped drives` and the `Windows registry`.

> GitHub: [sandboxie-plus / Sandboxie](https://github.com/sandboxie-plus/Sandboxie)
> Official site: [Sandboxie-Plus | Open Source sandbox-based isolation software](https://sandboxie-plus.com/)

![introduction](https://bafkreiah5w7qqekmi7azbdrsnztz2yvgudjhh2bnjebhlkmof2k4b334ju.ipfs.dweb.link)

## Testing and experience

![sandboxie](https://bafkreibceghepw25jzpg24dcfpnasq4bqvroztcpqnql4jyujupnhx2dhm.ipfs.dweb.link)

"DingTalk" ran normally inside Sandboxie Plus; login, group chat, and other features all worked fine with no noticeable performance drop. Sandboxie did pop up an error message:

```text
DingTalk.exe (3568)：SBIE2203 与 Sandboxie 服务的通信失败: *GUIPROXY_00000001; MsgId: 12 - DingTalk.exe [C0000024]
```

"Tor Browser" failed to launch, reporting a missing DLL file.

"GitHub Desktop" launched normally, but Sandboxie popped up an error message:

```text
git.exe (19676)：SBIE2205 未实现该服务: ConsoleInit (C00000D4)
```

Compatibility is decent overall; the occasional small error is bound to happen, since Sandboxie can't fully replicate certain Windows behaviors (Windows Sandbox should do better on that front), and none of the software above was specifically tuned for Sandboxie either. Still, I'm quite happy just being able to lock homegrown malware-grade software inside it; running things like Tor Browser and GitHub Desktop directly on bare metal doesn't worry me much.
