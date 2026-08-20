---
title: "使用 `wget` 镜像一个网页"
description: "介绍如何用一条 `wget` 命令镜像静态网页，并逐一解释 `--mirror`、`--convert-links`、`--adjust-extension`、`--page-requisites`、`--no-parent` 等参数的作用。"
date: "2021-08-06"
tags: ["Tools", "Guide"]
---

![wget](https://bafkreih2tw2lciw3qim2o6eqzxjmeu6xueqlstaauuliorfnedvn2o4ewq.ipfs.dweb.link)

有时候我们需要把一个网页保存下来，可能是想离线浏览，也可能是存档 / 备份。

对于动态网页，你可能需要分析一下数据的来源；但是，对于简单的静态网页，一行 `wget` 命令就可以解决。

```bash
wget --mirror --convert-links --adjust-extension --page-requisites --no-parent https://example.com/something.html
```

## 几个参数的意思

`--mirror`

> 递归下载。

`--convert-links`

> 转换链接（包括 `css` 中的链接）。`wget` 会将网页中的图片 / `js` / `css` / 字体之类的资源全部下载到本地。  
> 通过 `--convert-links` 可以将原先的绝对引用转换成相对引用，这样浏览时页面就不容易出错。

`--adjust-extension`

> 根据 `headers` 中的 `Content-Type` 修复 `html` 和 `css` 文件的扩展名（注意：不会修复 `js` 的扩展名）。  
> 例如，网页中原先引用的一个 `css` 文件名为 `FunUI.css?15552165`。这样的文件名先不论是否符合 [NTFS](https://zh.wikipedia.org/wiki/NTFS) 的命名规范，从本地加载时，由于扩展名不是 `.css`，浏览器并不会将其当作样式表来加载。添加了 `--adjust-extension` 后，`wget` 将把文件名转换为 `FunUI.css@15552165.css`，浏览器就可以正确识别了。  

`--page-requisites`

> 下载 `css` / 图片等内容，以便让网页正常显示。

`--no-parent`

> 加了这个参数，`wget` 就不会在递归时访问上级目录。由于我们只想保存当前网页，需要加上这个参数。

上述命令也可写作

```bash
wget -mkEpnp https://example.com/something.html
```

其中 `np` 是 `--no-parent` 的简写。

## 你知道吗

`wget` 在 Windows 下有一个单文件版本，非常适合放在 U 盘上随身携带，这里也一并放出来：[wget.exe](https://bafybmidj6zl4ellqyzhso63o3jvlfasjtzqnqij323ulvdwolf62z5kq2a.ipfs.inbrowser.link/?filename=wget.exe)。

## 另请参阅

* [Make Offline Mirror of a Site using `wget`](https://www.guyrutenberg.com/2014/05/02/make-offline-mirror-of-a-site-using-wget/) [ᴮᵃᶜᵏᵘᵖ](https://arweave.net/XBKigRYDTxEJkelD3LlekBlX4w1dngY6UKWoRXUKb_w)
* [NTFS - 维基百科，自由的百科全书](https://zh.wikipedia.org/wiki/NTFS) [ᴮᵃᶜᵏᵘᵖ](https://arweave.net/bAjaNG3xyUrE11HXzrdduGzcLM1sYhV75dqHjg7mURs)
* [wget.exe for Windows](https://bafybmidj6zl4ellqyzhso63o3jvlfasjtzqnqij323ulvdwolf62z5kq2a.ipfs.inbrowser.link/?filename=wget.exe) [ᴮᵃᶜᵏᵘᵖ](https://arweave.net/BrFz4svx6e9sw8n2NNZGSWJ_ftrEPcKxJPXglH2eaaE)
