---
title: "Mirroring a Web Page with wget"
description: "How to mirror a static web page with a single wget command, walking through what the --mirror, --convert-links, --adjust-extension, --page-requisites, and --no-parent flags each do."
date: "2021-08-06"
tags: ["Tools", "Guide"]
translation: machine
---

![wget](https://ragnarok.joefang.org/static/xpg0nc24oqf3ssbu82kls7psisgfl7ggl.webp)

Sometimes we need to save a web page, whether to browse offline or to archive / back it up.

For a dynamic page, you may need to dig into where its data comes from; but for a simple static page, a single `wget` command will do the job.

```bash
wget --mirror --convert-links --adjust-extension --page-requisites --no-parent https://example.com/something.html
```

## What each flag does

`--mirror`

> Downloads recursively.

`--convert-links`

> Rewrites links (including links inside `css`). `wget` downloads all of a page's resources, images, `js`, `css`, fonts, and so on, to local disk.
> `--convert-links` rewrites the original absolute references into relative ones, so the page is less likely to break when you browse it locally.

`--adjust-extension`

> Fixes the extensions of `html` and `css` files based on the `Content-Type` header (note: it does not fix `js` extensions).
> For example, say a page originally references a `css` file named `FunUI.css?15552165`. Regardless of whether such a filename is even valid under [NTFS](https://zh.wikipedia.org/wiki/NTFS) naming rules, when loaded locally the browser won't treat it as a stylesheet, since its extension isn't `.css`. With `--adjust-extension` added, `wget` renames the file to `FunUI.css@15552165.css`, so the browser can recognize it correctly.

`--page-requisites`

> Downloads `css`, images, and other content needed for the page to display correctly.

`--no-parent`

> With this flag, `wget` won't ascend to parent directories while recursing. Since we only want to save the current page, this flag is needed.

The command above can also be written as

```bash
wget -mkEpnp https://example.com/something.html
```

where `np` is short for `--no-parent`.

## Did you know

`wget` has a single-file build for Windows, which is great for carrying around on a USB drive; here it is too: [wget.exe](https://ragnarok.joefang.org/static/xv9437rv91ef9dritrmo3sm8h3uihra5s.exe).

## See also

* [Make Offline Mirror of a Site using `wget`](https://www.guyrutenberg.com/2014/05/02/make-offline-mirror-of-a-site-using-wget/) :backup[https://arweave.net/XBKigRYDTxEJkelD3LlekBlX4w1dngY6UKWoRXUKb_w]
* [NTFS - Wikipedia](https://zh.wikipedia.org/wiki/NTFS) :backup[https://arweave.net/bAjaNG3xyUrE11HXzrdduGzcLM1sYhV75dqHjg7mURs]
* [wget.exe for Windows](https://ragnarok.joefang.org/static/xv9437rv91ef9dritrmo3sm8h3uihra5s.exe) :backup[https://arweave.net/BrFz4svx6e9sw8n2NNZGSWJ_ftrEPcKxJPXglH2eaaE]
