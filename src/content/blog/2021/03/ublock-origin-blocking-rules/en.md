---
title: "Sharing Two uBlock Origin Filter Lists"
description: "Sharing a self-maintained uBlock Origin subscription, filter-4400e6cd, with a domain-wide blocklist and a popup/script filter list, plus how it updates and refreshes its cache."
date: "2021-03-27"
tags: ["Tools"]
translation: machine
---

> **Subscription URLs**
> [filter-4400e6cd / block](https://cdn.jsdelivr.net/gh/PetrichorA/filter-4400e6cd@main/block.txt)
> [filter-4400e6cd / filter](https://cdn.jsdelivr.net/gh/PetrichorA/filter-4400e6cd@main/filter.txt)

[`block`](https://cdn.jsdelivr.net/gh/PetrichorA/filter-4400e6cd@main/block.txt) is a domain-wide blocklist, and [`filter`](https://cdn.jsdelivr.net/gh/PetrichorA/filter-4400e6cd@main/filter.txt) is used to block popups and various oddball JavaScript / CSS / images.

[`block`](https://cdn.jsdelivr.net/gh/PetrichorA/filter-4400e6cd@main/block.txt) is synced from time to time with Peter Lowe's [blocklist](https://pgl.yoyo.org/adservers/) :backup[https://archive.is/jca7Z], plus ad and tracking domains I've come across while browsing. A *mystery script* periodically removes domains that already return `NXDOMAIN`.

The project is hosted on [GitHub](https://github.com/PetrichorA/filter-4400e6cd) :backup[https://archive.is/1kr8z]; staying *quiet and getting rich*, it has no description and no README.

Every `git push` triggers a script that automatically refreshes `jsDelivr`'s cache, so (in theory) the version jsDelivr serves is always the latest. If you run into `jsDelivr` serving a stale version, replace `cdn.jsdelivr.net` in the URLs above with `purge.jsdelivr.net` and visit it, to refresh `jsDelivr`'s cache.

![anime](https://bafkreih6naajnwy5vtc56aj47avho4efshjrxvzc665hpxda34m2sc3k6q.ipfs.dweb.link)
