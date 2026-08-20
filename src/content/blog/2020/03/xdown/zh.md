---
title: "Xdown：免费全能的下载工具"
description: "介绍免费下载工具 Xdown 的获取与配置方式，并从下载速度、界面和插件安装等方面与 uGet、IDM、Motrix 进行对比。"
date: "2020-03-03"
tags: ["Tools"]
---

![截图](https://bafkreiggwkt4axr6hcoftrfqimcoc5ayvqzpep6ngr4ynhgl4p6m7pia6y.ipfs.dweb.link)

> 为了方便查看，关键名词在第一次出现时会给出官网链接，以后出现均标红

之前 [![memset0's avatar](https://bafkreifoiocil7nu3vxuyszpjcj3orv64z7mrkaq3ypo5arltx3w2tqyqq.ipfs.dweb.link)](https://bafkreihlsxxh2pme5ldap7jzzimgj5wxphlg4uzsaiaec7okefercsok7a.ipfs.inbrowser.link/) [memset0](https://memset0.cn/) 大佬在自己的 [博客](https://memset0.cn/motrix-experience) 里推荐了 [Motrix](https://motrix.app/) ，我也来 ~~水一篇文章~~ 推荐一个下载工具：[Xdown](https://xdown.org/)。

## 获取

前往 [官网](https://xdown.org/) 获取最新版本。

开发者提供了对大陆地区优化的镜像。

## 体验

> 自我介绍：  
> 免费无广告的 `IDM` / `Torrent` 合成体

还是比较符合实际的。除了免费无广告以外，`Torrent` 的下载速度很优秀。内置的tracker能覆盖到常用的种子。粗略测试了一下，热门种子去掉tracker后用 `Xdown` 下载，几乎都可以成功（19 / 20）。总体成功率大约50%（和所在的网络环境有关）。

而 `uGet` 下 `Torrent` 的时候，不知道是我配置的问题还是软件的问题，速度不理想（uGet的 `Torrent` 是调用aria2来下载的，和 `Motrix` 一样）。

http的下载，感觉还是 [uGet](https://ugetdm.com/) 更香。主要是 `Xdown` 界面确实比较简陋。（当然 [![memset0's avatar](https://bafkreifoiocil7nu3vxuyszpjcj3orv64z7mrkaq3ypo5arltx3w2tqyqq.ipfs.dweb.link)](https://bafkreihlsxxh2pme5ldap7jzzimgj5wxphlg4uzsaiaec7okefercsok7a.ipfs.inbrowser.link/) [memset0](https://memset0.cn/) 大佬推荐的 `Motrix` 坠吼看了。）

小文件一般直接Chrome下载，大文件需要多线程下载的话，Xdown和 `IDM` 速度上没什么区别。`IDM` 确实是老牌下载神器了，但是 `Xdown` 也不差。考虑到 `IDM` 是付费软件，我选 `Xdown` 。

关于 `Xdown` 的浏览器插件，可以参考[官方文档](https://xdown.org/extensions/)。

在[Chrome应用商店](https://chrome.google.com/webstore/detail/xdown/eapmjcdkdlenhkbanlgacimfibbbiinc)安装。配置还是很直白的，这里搬运了一段测试方法。

> `Xdown` 打开 `设置 > 插件 ID` 里面写入当前插件的ID ，需要打开开发模式才可以看到  
> 例如：`eapmjcdkdlenhkbanlgacimfibbbiinc`  
> 看到 `Xdown` 的id后，保存并前往 [https://xdown.org/test.html](https://xdown.org/test.html)  
> 点击其中一个链接。如果弹出新建任务对话框，说明插件安装成功；如果失败，请仔细对照上面的说明。  
> 下面两个地址是演示安装视频，不懂的可以观看视频解答疑惑。
> [https://dl.xdown.org/mp4/xdown-extensions.mp4](https://dl.xdown.org/mp4/xdown-extensions.mp4)  
> [https://youtu.be/J530yCsH9Xk](https://youtu.be/J530yCsH9Xk)

## 推荐

一些实用的 ~~盗版 / 破解版~~ 软件 [http://183.91.54.237:7080/masuit/soft/tree/master](http://183.91.54.237:7080/masuit/soft/tree/master)

> [![memset0's avatar](https://bafkreifoiocil7nu3vxuyszpjcj3orv64z7mrkaq3ypo5arltx3w2tqyqq.ipfs.dweb.link)](https://bafkreihlsxxh2pme5ldap7jzzimgj5wxphlg4uzsaiaec7okefercsok7a.ipfs.inbrowser.link/) [memset0](https://memset0.cn/)：  
> 因为某名为司马马克丁的软件代理公司以打击盗版出了名，很多他们代理的软件的破解版搜索引擎基本搜不到，这个仓库里还是有一些的。
