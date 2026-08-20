---
title: "Sandboxie Plus：安全易用的沙盒软件"
description: "记录使用 Sandboxie Plus 隔离国产软件（如钉钉）的动机与体验，包括其与 Tor Browser、GitHub Desktop 等软件的兼容性问题。"
date: "2021-12-10"
tags: ["Tools", "Security"]
---

![github](https://bafkreidy5a4pyicrpuoufwr4g6f6xctrsub4xetoec3bswl4ty4oqaooba.ipfs.dweb.link)

2020 年寒假时，我曾经尝试使用 Sandboxie 运行「课后网」，结果不尽如人意。随后一年多的时间里，本着「隐私至上」的原则，我没有在个人电脑中安装过国产软件。

直到最近，又一轮疫情爆发，我们又用上了网课套件。于是我被迫开始寻找一个好用的沙盒，来隔离国产软件和我的个人数据。

## 关于 Sandboxie Plus

![icon](https://bafkreieynxazoaelpsyujj3nnhscu7i35ukt75vndk5fboe5p6krrvcosq.ipfs.dweb.link)

Sandboxie 是一款基于沙盒的隔离软件，适用于 32 位和 64 位的基于 Windows NT 的操作系统。它创建了一个类似沙盒的隔离操作环境。在 Sandboxie 中可以安装并运行应用程序，而不会永久修改`本地 / 映射驱动器`和 `Windows 注册表`。

> GitHub [sandboxie-plus / Sandboxie](https://github.com/sandboxie-plus/Sandboxie)  
> 官网 [Sandboxie-Plus | Open Source sandbox-based isolation software](https://sandboxie-plus.com/)  

![introduction](https://bafkreiah5w7qqekmi7azbdrsnztz2yvgudjhh2bnjebhlkmof2k4b334ju.ipfs.dweb.link)

## 测试与体验

![sandboxie](https://bafkreibceghepw25jzpg24dcfpnasq4bqvroztcpqnql4jyujupnhx2dhm.ipfs.dweb.link)

「钉钉」在 Sandboxie Plus 中运行正常，登录、群聊等功能均可正常工作，未出现可感知的性能下降。Sandboxie 弹出错误信息：

```text
DingTalk.exe (3568)：SBIE2203 与 Sandboxie 服务的通信失败: *GUIPROXY_00000001; MsgId: 12 - DingTalk.exe [C0000024]
```

「Tor Browser」启动失败，显示缺失某 DLL 文件。

「GitHub Desktop」可正常启动，但是 Sandboxie 弹出错误信息：

```text
git.exe (19676)：SBIE2205 未实现该服务: ConsoleInit (C00000D4)
```

应该说兼容性还行，偶有小错误也是难免的，毕竟 Sandboxie 没法完全复刻 Windows 系统的某些行为（这点上 Windows Sandbox 应该能做得更好），上述软件也不会特意对 Sandboxie 进行优化。不过能把国产毒瘤软件关进去我就很满意了，Tor Browser 和 GitHub Desktop 之类的直接在裸机上跑也没什么不放心的。
