---
title: "Using the `<template>` Tag to Hide Content Blogger Inserts"
description: "A method that wraps a fake `</body>` marker in a `<template>` tag to get around Blogger's block on nested comments, hiding its auto-inserted content."
date: "2020-12-27"
tags: ["Blogger", "Guide"]
translation: machine
---

> TL;DR: just wrap the content you want to hide in `<template></template>`.

![0.webp](https://ragnarok.joefang.org/static/x95mb8sob6hfjcf4569peokelj7iqvqr5.webp)

While hacking up a theme following the article [Notes on accessing Blogger from mainland China](https://blog.iljw.me/2016/09/blogger.html), I found that the method it offers,

> Replace `</body>` with
> `&lt;!--</body>--&gt;&lt;/body&gt;`

no longer works.

Let me briefly explain how the original method worked. When Blogger inserts the content we want to get rid of, it *probably* just does a simple string replacement: `str.replace(r'</body>', target + r'</body>', 1)`. But we rig up a fake `</body>` and comment it out, so the content Blogger inserts also ends up inside the comment.

The reason the original approach stopped working is that Blogger's own code added a comment of its own, and HTML apparently can't nest comments (this is somewhat uncertain).

~~Stack-Overflow-driven development~~ After some digging, I found this: [Are nested HTML comments possible?](https://stackoverflow.com/questions/442786/are-nested-html-comments-possible). It mentions several ways to hide content; I went with wrapping a fake `</body>` in a `<template>` tag.

Just replace `</head>` with

```xml
&lt;template&gt;</head>&lt;/template&gt;
&lt;/head&gt;
```

and replace `</body>` with

```xml
&lt;template&gt;</body>&lt;/template&gt;
&lt;/body&gt;
```

and that's it.
