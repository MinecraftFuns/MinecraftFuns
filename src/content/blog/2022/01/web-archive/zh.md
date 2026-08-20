---
title: "我的网页存档技巧"
description: "分享个人网页存档方法：用 SingleFile 抓取网页内容，再将其存储到 IPFS 等去中心化服务上，并比较 Wayback Machine、archive.today 等公共存档服务的优劣。"
date: "2022-01-13"
tags: ["Tools", "Guide"]
---

![eric.webp](https://ragnarok.joefang.org/static/x8co60u01bpfd6aq6r7u4h5ge6onik2g8.webp)
  
> 互联网上的「永久链接」可能并没有那么「永久」。

很多博主都经历过服务器忘记续费、博客平台封号之类的事情，迁移平台的过程也可能导致一堆死链。前段时间整理收藏夹时发现，在我还是一名 OIer 时收藏的许多算法文章，现在已经 404 了，这才过去了一年的时间 `/(ㄒoㄒ)/~~`。你国无处不在的网络审查更是助推了网页 404 的进程。对于一名读者来说，喜欢的文章莫名其妙就消失了，十分伤脑筋。因此，网页存档无疑是一项实用技能。

## 公共网页存档服务

[Internet Archive](https://archive.org/) 提供的 [Wayback Machine](https://web.archive.org/) 相当良心。Wayback Machine 的爬虫会使用 Chrome 对目标网页进行模拟访问，这使得网页上的动态内容也会一并被抓取。并且，Wayback Machine 是最知名的网页存档服务之一，因此可信度极高。如果想要向他人证明一个网页确实存在过，Wayback Machine 是首选的存档服务。不过，为了防止可能的滥用，Wayback Machine 对每个网页的存档次数和频率都有限制。当然，你可以通过添加查询参数来绕过限制，但总归不太舒服。

[archive.today](https://archive.today/) 有数个域名，包括 [archive.is](https://archive.is/)、[archive.ph](https://archive.ph/)、[archive.vn](https://archive.vn/) 等。你可以看到，这个博客引用的大多数网页均使用 archive.today 进行了存档。相对于 Wayback Machine，archive.today 在网页加载完成后去掉了其中的所有 JavaScript 脚本，并且屏蔽了若干广告（不知道是否屏蔽了其它内容），其运营者也没有保证不对存档进行修改，因此很可能无法作为证据。不过，这也意味着 archive.today 的页面更加简洁，且不会包含原网页上可能存在的恶意脚本。如果你使用数据中心的出口 IP 连接到 archive.today（比如你在使用 VPN），它很可能返回一个 reCAPTCHA 验证码，这个体验不是很好。

## 我的存档技巧

对于大多数任务来说，前面两个存档服务都「够用」了，只是不够「好用」。比如，你想写一个脚本快速存档数千个网页，公共存档服务很难满足你的个性化需求——其他访客也需要存档服务——而且这样的行为很可能招致你的 IP 被加入存档服务的黑名单。

我们不妨把存档网页拆分成「获取网页」和「内容存储」两个步骤，这样就有很多现成的工具了。

说到「获取网页」，浏览器插件 [SingleFile](https://github.com/gildas-lormeau/SingleFile) 可以几乎做到「完美地将网页转换成单个 HTML」，我保存了一篇文章「对抗 link rot」，可以查看[示例](https://bafkreieowjptq7z5h6bju46jopd3nijqpa3aoeuregy55y325clju23lje.ipfs.inbrowser.link/)以了解该插件的效果。SingleFile 已在 [Firefox 扩展](https://addons.mozilla.org/firefox/addon/single-file)、[Chrome 网上应用店](https://chrome.google.com/webstore/detail/singlefile/mpiodijhokgodhhofbcjdecpffjipkle) 和 [Microsoft Edge Addons](https://microsoftedge.microsoft.com/addons/detail/singlefile/efnbkdcfmcmnhlkaijjjmhjjgladedno) 上线。

对于「内容存储」来说，可用的工具便不胜枚举了。GitHub 和 GitLab 提供免费的公共 / 私人存储库，Cloudflare Pages 提供免费的静态网页托管服务（GitHub Pages 在你国被屏蔽得彻彻底底 `￣へ￣`），你可以迅速地拼凑出一个可用的免费存储 + 分享方案。AWS / Google Cloud / 阿里云 / 腾讯云均提供对象存储服务（AWS / Google Cloud 在特殊时期可能连接不畅，阿里云 / 腾讯云会审核政治敏感的内容），存储几个网页所需的成本可以忽略。

但是，这些服务都**不是永久的**，即使是 Amazon / Google 这样的大公司，也可能在大范围的经济危机中倒闭。如果你想存个五年十年，选择中心化的存储服务也许还不成问题，但是在更长的时间跨度下，需要更靠谱的解决方案。

[Arweave](https://www.arweave.org/) 可能是解决方案之一，它宣称提供了「永久」的存储。所谓「永久」是基于存储空间的价格呈指数级下降的原理，最终总存储成本会收敛到一个常数。在你将内容存储到该去中心化网络时，Arweave 就一次性收取了这笔费用。

我的选择是 [IPFS](https://ipfs.io/)。[Protocol Labs](https://protocol.ai/) 的 [Web3 Storage](https://web3.storage/) 向用户免费提供 1 TiB 的存储空间，且仅需一个可以收信的邮箱作为验证。并且，在 IPFS 网络中，可以很容易地将内容复制多份，跨服务商存储。即使 Protocol Labs 某天倒闭了，你也可以把这些内容迁移到其它服务商 / 本地的 IPFS 节点，不存在供应商锁定的问题。IPFS 还解决了内容完整性的问题，可以验证文件自发布后未经篡改。并且，许多值得信任的社区成员正在运行 IPFS 网关，使得普通浏览器也能轻松地访问 IPFS 上的内容。这篇文章的头图就存储在 IPFS 上，CID 是 `bafybeibiioe6ptf4j7llvgxs3kes3kulzj5eow3nf627si7nn3qb4beava`，可以通过网关 [ipfs.io](https://ipfs.io/ipfs/bafybeibiioe6ptf4j7llvgxs3kes3kulzj5eow3nf627si7nn3qb4beava) / [dweb.link](https://bafybeibiioe6ptf4j7llvgxs3kes3kulzj5eow3nf627si7nn3qb4beava.ipfs.dweb.link/) / [inbrowser.link](https://bafybeibiioe6ptf4j7llvgxs3kes3kulzj5eow3nf627si7nn3qb4beava.ipfs.inbrowser.link/) 访问。

于是，一个相对好用的网页存档方案就成型了。以下是一些实例：

* [Live Not By Lies | Aleksandr Solzhenitsyn | www.orthodoxytoday.org](https://bafkreignhtl7ueljxzpv6w3ojkvr2x22javfbcsx7tm34g5w7rqrxfghfu.ipfs.inbrowser.link/)
* [中央情报局特工是如何被北京发现的？| iyouport.substack.com](https://bafybeidmvcvhmjk4wlatzxnbytixxq3hdojocan3w26o36m5pjo4jsztmi.ipfs.inbrowser.link/)
* [分布式共识与去中心化 | 1byte.io](https://bafkreid3vycse7u6m6vhjbsmgyep3zcsi4u7qk242hlcoaq7ph4nlvmeve.ipfs.inbrowser.link/)

## 更新

Blogger 平台表示：

> 您的内容违反了我们的垃圾内容政策。如需了解详情，请访问此电子邮件中关联的社区准则页面。

我没有从 `Internet Archive` / `archive.today` / `SingleFile` / `Arweave` / `Protocol Labs` 中的任何一方获取直接或间接的经济利益。以上服务我都用过，并且体验不错，所以写了一篇博客来分享。`SingleFile` + `IPFS` 的组合在网页存档方面是相对方便且自由的，所以着重做了推荐，分享个人喜好也属于「垃圾内容」吗？
