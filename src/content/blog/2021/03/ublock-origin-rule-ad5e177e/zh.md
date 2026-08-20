---
title: "分享两个 uBlock Origin 屏蔽规则"
description: "分享自维护的 uBlock Origin 订阅列表 filter-4400e6cd，包括基于域名的全站屏蔽规则与弹窗 / 脚本过滤规则，并说明其更新与缓存刷新机制。"
date: "2021-03-27"
tags: ["Tools"]
---

> **订阅地址**  
> [filter-4400e6cd / block](https://cdn.jsdelivr.net/gh/PetrichorA/filter-4400e6cd@main/block.txt)  
> [filter-4400e6cd / filter](https://cdn.jsdelivr.net/gh/PetrichorA/filter-4400e6cd@main/filter.txt)

[`block`](https://cdn.jsdelivr.net/gh/PetrichorA/filter-4400e6cd@main/block.txt) 是基于域名的全站屏蔽，[`filter`](https://cdn.jsdelivr.net/gh/PetrichorA/filter-4400e6cd@main/filter.txt) 用来屏蔽弹窗和一些奇奇怪怪的 JavaScript / CSS / 图片。

[`block`](https://cdn.jsdelivr.net/gh/PetrichorA/filter-4400e6cd@main/block.txt) 会和 Peter Lowe 的[屏蔽规则](https://pgl.yoyo.org/adservers/) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/jca7Z) 不定期同步，并且加入了我浏览网页时碰到的广告域名 / 跟踪域名。不定期使用*神秘脚本*去除已经 `NXDOMAIN` 的域名。

项目托管在 [GitHub](https://github.com/PetrichorA/filter-4400e6cd) [ᴮᵃᶜᵏᵘᵖ](https://archive.is/1kr8z) 上，为了*闷声发大财*，没有写简介，也没有写 README。

每次 `git push` 时，脚本都会自动刷新 `jsDelivr` 的缓存，所以（理论上来说）jsDelivr 分发的版本就是最新版本。如果你碰到 `jsDelivr` 分发过时版本的情况，请将上述网址中的 `cdn.jsdelivr.net` 更改为 `purge.jsdelivr.net` 并访问，以刷新 `jsDelivr` 的缓存。

![anime](https://bafkreih6naajnwy5vtc56aj47avho4efshjrxvzc665hpxda34m2sc3k6q.ipfs.dweb.link)
