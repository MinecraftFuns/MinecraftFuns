# 干掉了一个导致 DPC_WATCHDOG_VIOLATION 蓝屏的驱动

作为一名 Dell 用户，之前经常在任务管理器中注意到一个叫 `SmartByte Telemetry` 的进程。`SmartByte` 的作用是*平衡不同软件的网络带宽占用，防止在线播放内容时卡顿*，然而网络上大量的文章反应 `SmartByte` 不仅没有起到应有的作用，甚至降低了网速。

但是从我自身的使用经验来看，似乎 `SmartByte` 也没有影响到我的网络体验，放着就放着呗，万一什么时候派上用场了呢？

直到最近，连续几天，打开 Chrome 地址栏，输入若干字符后直接蓝屏，报错 `DPC_WATCHDOG_VIOLATION`，感觉不太对劲。一开始以为是 Chrome 的问题，但是今天在 Chrome 未运行的情况下依然发生了蓝屏。

这个问题已经严重干扰到我的体验了，所以开始折腾。网上的调试方法似乎都要分析 dump 出来的文件，很麻烦。直接打开 `Dell` 自带的 `SupportAssist`，查看`历史记录`，可以看到关于蓝屏错误的一些信息。

![1](https://bafkreicbrzkbtoda2xwn56eigjfwfglu56zaxwdbfpkoojba6mv2c7pony.ipfs.dweb.link)

![0](https://bafkreiawqwz2f5umysdgusas3ukgusrft5nkggms7l3nznnwy5eu2jibmq.ipfs.dweb.link)

问题直接指向了 `SmartByte Traffic Control Callout Driver`，版本是 `9.8.4.9`，路径是 `C:\WINDOWS\system32\DRIVERS\SmbCo10X64.sys`。

没什么好犹豫的了，直接卸载。

目前蓝屏问题似乎已经得到解决了。

不过这个 `SupportAssist` 的历史记录似乎也不怎么靠谱，可能是有些系统错误根本就没留下日志吧。
