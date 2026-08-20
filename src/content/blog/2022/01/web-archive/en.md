---
title: "My Web Archiving Technique"
description: "A personal web archiving method: capturing pages with SingleFile and storing them on decentralized services like IPFS, with a comparison of public archive services such as the Wayback Machine and archive.today."
date: "2022-01-13"
tags: ["Tools", "Guide"]
translation: machine
---

![eric.webp](https://ragnarok.joefang.org/static/x8co60u01bpfd6aq6r7u4h5ge6onik2g8.webp)

> A "permalink" on the internet may not be quite so permanent.

Many bloggers have been through things like forgetting to renew a server or having a blogging platform ban their account, and migrating platforms can leave a pile of dead links behind. While tidying up my bookmarks a while ago, I found that many algorithm articles I'd saved back when I was an OIer are now 404, and only a year has passed `/(ㄒoㄒ)/~~`. Your country's ubiquitous internet censorship only speeds up the process by which pages go 404. For a reader, having a favorite article vanish for no clear reason is genuinely frustrating. So web archiving is, without question, a practical skill.

## Public web archiving services

The [Wayback Machine](https://web.archive.org/), run by the [Internet Archive](https://archive.org/), is quite good. Its crawler visits target pages using Chrome to simulate a real visit, so dynamic content on the page gets captured too. And since the Wayback Machine is one of the best-known web archiving services, it carries a great deal of credibility. If you want to prove to someone that a page really did exist, the Wayback Machine is the archive service of choice. That said, to prevent abuse, it limits how many times and how often each page can be archived. You can work around the limit by adding query parameters, but it's never a smooth experience.

[archive.today](https://archive.today/) has several domains, including [archive.is](https://archive.is/), [archive.ph](https://archive.ph/), [archive.vn](https://archive.vn/), and others. As you can see, most of the pages this blog links to are archived with archive.today. Compared to the Wayback Machine, archive.today strips out all JavaScript from a page once it finishes loading, and blocks a number of ads (whether it blocks anything else, I don't know); its operators also make no promise not to modify archives, so it likely can't be used as evidence. That said, this also means archive.today's pages are cleaner and won't carry any malicious scripts that might be present on the original page. If you connect to archive.today from a datacenter egress IP (say, while using a VPN), it will likely serve you a reCAPTCHA, which isn't a great experience.

## My archiving technique

For most tasks, the two services above are "good enough," just not "convenient." Say you want to write a script to quickly archive thousands of pages: a public archive service can't easily meet that kind of custom need (other visitors need the service too), and doing this is quite likely to get your IP added to the service's blocklist.

It helps to split archiving a page into two steps, "fetching the page" and "storing the content," since there are then plenty of ready-made tools for each.

For "fetching the page," the browser extension [SingleFile](https://github.com/gildas-lormeau/SingleFile) can come close to "perfectly turning a page into a single HTML file." I saved an article, "Fighting Link Rot," and you can look at the [example](https://bafkreieowjptq7z5h6bju46jopd3nijqpa3aoeuregy55y325clju23lje.ipfs.inbrowser.link/) to see what the extension produces. SingleFile is available on [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/single-file), the [Chrome Web Store](https://chrome.google.com/webstore/detail/singlefile/mpiodijhokgodhhofbcjdecpffjipkle), and [Microsoft Edge Addons](https://microsoftedge.microsoft.com/addons/detail/singlefile/efnbkdcfmcmnhlkaijjjmhjjgladedno).

For "storing the content," there's no shortage of options. GitHub and GitLab offer free public/private repositories, and Cloudflare Pages offers free static-site hosting (GitHub Pages is thoroughly blocked in your country `￣へ￣`), so you can quickly cobble together a usable free storage-plus-sharing setup. AWS, Google Cloud, Alibaba Cloud, and Tencent Cloud all offer object storage (AWS/Google Cloud connections can be unreliable during certain periods, and Alibaba Cloud/Tencent Cloud review content for political sensitivity), but the cost of storing a handful of pages is negligible.

However, none of these services are **permanent**. Even a giant like Amazon or Google could go under in a large-scale economic crisis. If you only want to keep something for five or ten years, a centralized storage service is probably fine, but over a longer time horizon you need something more reliable.

[Arweave](https://www.arweave.org/) might be one solution; it claims to offer "permanent" storage. The idea behind "permanent" is that storage costs fall exponentially, so total lifetime storage cost converges to a constant. When you store content on this decentralized network, Arweave collects that one-time fee up front.

My choice is [IPFS](https://ipfs.io/). [Protocol Labs](https://protocol.ai/)'s [Web3 Storage](https://web3.storage/) gives users 1 TiB of storage for free, requiring only an email address you can receive mail at for verification. And on the IPFS network, it's easy to replicate content across multiple providers. Even if Protocol Labs shuts down one day, you can migrate that content to another provider or to a local IPFS node, so there's no vendor lock-in. IPFS also solves the content-integrity problem: you can verify a file hasn't been tampered with since it was published. And many trustworthy community members run IPFS gateways, so an ordinary browser can easily access content on IPFS. This post's header image is itself stored on IPFS, with CID `bafybeibiioe6ptf4j7llvgxs3kes3kulzj5eow3nf627si7nn3qb4beava`, reachable through the gateways [ipfs.io](https://ipfs.io/ipfs/bafybeibiioe6ptf4j7llvgxs3kes3kulzj5eow3nf627si7nn3qb4beava), [dweb.link](https://bafybeibiioe6ptf4j7llvgxs3kes3kulzj5eow3nf627si7nn3qb4beava.ipfs.dweb.link/), and [inbrowser.link](https://bafybeibiioe6ptf4j7llvgxs3kes3kulzj5eow3nf627si7nn3qb4beava.ipfs.inbrowser.link/).

So, a reasonably convenient web archiving setup comes together. Here are a few examples:

* [Live Not By Lies | Aleksandr Solzhenitsyn | www.orthodoxytoday.org](https://bafkreignhtl7ueljxzpv6w3ojkvr2x22javfbcsx7tm34g5w7rqrxfghfu.ipfs.inbrowser.link/)
* [How Was a CIA Agent Discovered by Beijing? | iyouport.substack.com](https://bafybeidmvcvhmjk4wlatzxnbytixxq3hdojocan3w26o36m5pjo4jsztmi.ipfs.inbrowser.link/)
* [Distributed Consensus and Decentralization | 1byte.io](https://bafkreid3vycse7u6m6vhjbsmgyep3zcsi4u7qk242hlcoaq7ph4nlvmeve.ipfs.inbrowser.link/)

## Update

Blogger's platform stated:

> Your content violates our spam policy. For more information, please visit the community guidelines page linked in this email.

I have not received any direct or indirect financial benefit from any of `Internet Archive`, `archive.today`, `SingleFile`, `Arweave`, or `Protocol Labs`. I've used all of the services above, and had a good experience with them, which is why I wrote a post to share it. The combination of `SingleFile` and `IPFS` is a relatively convenient and free approach to web archiving, which is why I emphasized recommending it; does sharing a personal preference really count as "spam content"?
