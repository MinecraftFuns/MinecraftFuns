---
title: "使用 `<template>` 标签来隐藏 Blogger 添加的内容"
description: "记录一种用 `<template>` 标签包裹伪造 `</body>` 标记，从而绕过 Blogger 官方注释嵌套限制、隐藏其自动插入内容的方法。"
date: "2020-12-27"
tags: ["Blogger", "Guide"]
---

> 太长不看：把想隐藏的内容用 `<template></template>` 包起来就可以了

![0.webp](https://bafkreidosypdjxxesnrgrhspcxbopavqog3bbjzrqa6uj5yq3fgejzpr7i.ipfs.dweb.link)

在跟随 [Blogger国内访问心得](https://blog.iljw.me/2016/09/blogger.html) 这篇文章魔改主题的时候，发现原文提供的方法

> 将 `</body>` 替换为  
> `&lt;!--</body>--&gt;&lt;/body&gt;`

已经失效了。

大概解释下原先方法的原理。Blogger添加那段我们想干掉的内容时，*可能*只是做了一个简单的字符串替换 `str.replace(r'</body>', target + r'</body>', 1)`。但是我们整了个假的 `</body>`，并且把它注释掉了，导致Blogger添加的内容也位于注释中。

原先方案失效的原因是Blogger官方添加了一段注释，而HTML似乎没法嵌套注释（这点存疑）。

~~面向Stack Overflow~~ 折腾一番后，找到了这篇东西：[Are nested HTML comments possible?](https://stackoverflow.com/questions/442786/are-nested-html-comments-possible)。文中提到了若干种隐藏内容的方法，我选择的是用 `<template>` 标签把一个假的 `</body>` 包起来。

只需要将 `</head>` 替换成

```xml
&lt;template&gt;</head>&lt;/template&gt;
&lt;/head&gt;
```

将 `</body>` 替换成

```xml
&lt;template&gt;</body>&lt;/template&gt;
&lt;/body&gt;
```

即可。
