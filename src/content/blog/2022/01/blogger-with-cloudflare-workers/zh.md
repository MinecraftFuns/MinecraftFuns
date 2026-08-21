---
title: "Blogger × Cloudflare Workers：轻松解决 Blogger 在国内的连接问题"
description: "分享一段用 Cloudflare Workers 反向代理 Blogger 博客及其图片域名的代码，解决 Blogger 在中国大陆的直连和图片加载问题，并解析其网页处理与图片缓存逻辑。"
date: "2022-01-24"
tags: ["Blogger", "Cloudflare", "Guide"]
---

<picture>
    <source srcset="https://ragnarok.joefang.org/static/x9ttvpc55fh0rgn7iqcm33qprrdk0rmi6.svg"
            type="image/svg+xml">
    <img src="https://ragnarok.joefang.org/static/xide2bm7ugt4b0ug5og0dumbmd7l1ammh.webp" alt="Cloudflare Workers logo" />
</picture>

## 问题

当初因为[编程随想的博客](https://program-think.blogspot.com/)托管在Blogger上，说明这个平台的安全性和性能值得信赖，于是我把自己的博客也搬过来了。然而，使用Google服务不得不面对的是GFW的最高级封锁——IP黑洞。

为了让自己用得舒服一点（分享文章 / 在临时设备上查看博客），需要解决Blogger在国内的连接问题。虽然时不时能找到Blogger直连IP，但这种猫捉老鼠的游戏相当无聊——也很低效。

如果你折腾过这个问题，也许还会发现Blogger使用 `lh*.googleusercontent.com` 这组域名来代理并缓存图片。即使解决了博客的连接问题，图片无法加载这一点也让人头疼。网络上提供的解决方法往往十分复杂，而且前端性能也大受影响。

与其浪费时间扫描Google的IP段，不如直接起一个国内能直连的反代服务。

## 解决方案

于是，使用Cloudflare Workers代理便成为非常理想的解决方案。[Workers免费版每天10万次请求](https://developers.cloudflare.com/workers/platform/pricing)可以轻松满足个人博客的需求，并且得益于Cloudflare的全球网络，理论上网站的前端性能也不会受到太大影响。

我在2021年寒假时写了下面这段代码：

```js
/**
 * URL:
 * https://26aac706-ae46c7e8.qt.workers.dev/
 */

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
})

const blogHost = '𝚝𝚠𝚘-𝚙𝚕𝚞𝚜-𝚝𝚠𝚘-𝚖𝚊𝚔𝚎-𝚏𝚘𝚞𝚛.𝚋𝚕𝚘𝚐𝚜𝚙𝚘𝚝.𝚌𝚘𝚖'

/**
 * @param {Map} error
 * @param {Number} status
 * @param {Boolean} cacheable
 */
function handleInvalidRequest(error, status, cacheable) {
    const response = new Response(JSON.stringify(error), {
        status: status,
        statusText: 'Invalid Request',
        headers: {
            'strict-transport-security': 'max-age=31536000; includeSubDomains; preload',
            'timing-allow-origin': '*',
            'x-server': 'blog-proxy-2cff9aba',
            'x-xss-protection': '1; mode=block'
        }
    })
    if (cacheable) {
        response.headers.set('cache-control', 'public, max-age=29030400, immutable')
    }
    return response
}

/**
 * @param {String} url
 */
async function fromCache(url) {
    const cache = caches.default
    const matched = await cache.match(url)
    if (matched) {
        return matched
    }
    const resp = await fetch(url)
    if (resp.status >= 200 && resp.status < 300) {
        const response = new Response(resp.body, {
            status: resp.status,
            statusText: resp.statusText,
            headers: resp.headers
        })
        response.headers.delete('expires')
        response.headers.delete('vary')
        response.headers.delete('access-control-allow-origin')
        response.headers.set('cache-control', 'public, max-age=29030400, immutable')
        response.headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains; preload')
        response.headers.set('timing-allow-origin', '*')
        response.headers.set('x-mirrored-url', url)
        response.headers.set('x-server', 'blog-proxy-2cff9aba')
        response.headers.set('x-xss-protection', '1; mode=block')
        await cache.put(url, response.clone())
        return response
    }
    return handleInvalidRequest({
        msg: 'status_error',
        url: url,
    }, resp.status, false)
}

/**
 * @param {URL} url
 */
async function proxy(url) {
    const proxyHost = url.hostname
    url.hostname = blogHost
    const urlStr = url.href
    const resp = await fetch(urlStr)
    if (resp.status >= 200 && resp.status < 400) {
        let body
        const type = resp.headers.get('content-type')
        if (type && type.startsWith('text/')) {
            body = await resp.text()
            body = body.replaceAll(blogHost, proxyHost)
            body = body.replace(new RegExp(`<link href='(.*?)${proxyHost}/(.*?)' rel='canonical'/>`), `<link href='$1${blogHost}/$2' rel='canonical'/>`)
            body = body.replace(/lh\w*?.googleusercontent.com/g, proxyHost + '/_image')
        } else {
            body = resp.body
        }
        const response = new Response(body, {
            status: resp.status,
            statusText: resp.statusText,
            headers: resp.headers
        })
        response.headers.delete('vary')
        response.headers.delete('access-control-allow-origin')
        response.headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains; preload')
        response.headers.set('timing-allow-origin', '*')
        response.headers.set('x-mirrored-url', urlStr)
        response.headers.set('x-server', 'blog-proxy-2cff9aba')
        response.headers.set('x-xss-protection', '1; mode=block')
        return response
    }
    return handleInvalidRequest({
        msg: 'status_error',
        url: urlStr,
    }, resp.status, false)
}

/**
 * @param {Request} request
 */
async function handleRequest(request) {
    let url
    try {
        url = new URL(request.url)
    } catch {
        return handleInvalidRequest({ msg: 'url_parse_error', url: request.url }, 400, true)
    }
    if (url.pathname.startsWith('/_image/')) {
        url.hostname = '𝚕𝚑𝟹.𝚐𝚘𝚘𝚐𝚕𝚎𝚞𝚜𝚎𝚛𝚌𝚘𝚗𝚝𝚎𝚗𝚝.𝚌𝚘𝚖'
        url.pathname = url.pathname.substring(7)
        return await fromCache(url)
    }
    return await proxy(url)
}
```

对于小白用户，把代码中的 `const blogHost = '𝚝𝚠𝚘-𝚙𝚕𝚞𝚜-𝚝𝚠𝚘-𝚖𝚊𝚔𝚎-𝚏𝚘𝚞𝚛.𝚋𝚕𝚘𝚐𝚜𝚙𝚘𝚝.𝚌𝚘𝚖'` 替换成你自己的Blogger域名，比如 `const blogHost = 'example.blogspot.com'`，就可以拿来用了（你可能还需要手打一遍 `𝚕𝚑𝟹.𝚐𝚘𝚘𝚐𝚕𝚎𝚞𝚜𝚎𝚛𝚌𝚘𝚗𝚝𝚎𝚗𝚝.𝚌𝚘𝚖` 这25个字符）。

本来是想闷声发大财的，2021年暑假时看到 [@SophonCI](https://t.me/SophonCI) 也在折腾这个问题，于是把这个方案分享给他了。代码里放了一个字符串 `blog-proxy-2cff9aba`，本来是这个项目的名字，然后我Google了一下，发现[这位同学博客写得挺勤快的](https://www.cnblogs.com/Helium-Air/p/15646483.html) 😀，把我的代码放出来了：

![屏幕截图](https://ragnarok.joefang.org/static/xn8a0b2f9kmfl4t5pe46m6mgptpcsr973.png)

于是我也来水一篇博客 😂。

## 技术分析

如果只是为了放一遍代码，我就没有必要写这篇文章了，下面还有更加有趣的东西。

### 网页处理

> 这部分代码在 `proxy` 函数中

首先把所有 `blogspot.com` 域名替换成自己的域名。

```js
body = body.replaceAll(blogHost, proxyHost)
```

再把 `rel=canonical` 标记中的域名换掉（我的情况比较特殊，我希望Google收录 `blogspot.com` 中的网页，而不是 `workers.dev` 中的网页；如果你希望搜索引擎收录自己域名底下的网页，就不需要修改 `rel=canonical` 标记了），以方便搜索引擎的收录（⚠ 请务必将其用在自己的博客上，而不是镜像别人的博客）。

```js
body = body.replace(new RegExp(`<link href='(.*?)${proxyHost}/(.*?)' rel='canonical'/>`), `<link href='$1${blogHost}/$2' rel='canonical'/>`)
```

再做一个正则表达式替换，把 `lh*.googleusercontent.com` 全部换到我们的域名底下的 `/_image/` 路径。

```js
body = body.replace(/lh\w*?.googleusercontent.com/g, proxyHost + '/_image')
```

### 图片访问

前文提到Blogger使用 `lh*.googleusercontent.com` 这组域名来代理并缓存图片，我们需要反代这组域名，并且最好还能把图片内容缓存下来。

出于负载均衡之类的原因，Blogger后端在渲染网页时会使用多个不同的域名加载图片。

![屏幕截图](https://ragnarok.joefang.org/static/xqsfej4jui5t429k7qev8aafemq8oj7tj.webp)

这组域名是等价的。我们希望能提高缓存的命中率，所以在Workers中统一使用 `𝚕𝚑𝟹.𝚐𝚘𝚘𝚐𝚕𝚎𝚞𝚜𝚎𝚛𝚌𝚘𝚗𝚝𝚎𝚗𝚝.𝚌𝚘𝚖` 来获取资源并缓存。

```js
if (url.pathname.startsWith('/_image/')) {
    url.hostname = '𝚕𝚑𝟹.𝚐𝚘𝚘𝚐𝚕𝚎𝚞𝚜𝚎𝚛𝚌𝚘𝚗𝚝𝚎𝚗𝚝.𝚌𝚘𝚖'
    url.pathname = url.pathname.substring(7)
    return await fromCache(url)
}
```

接下来进入 `fromCache` 函数。Cloudflare Workers文档中对如何使用 `caches.default` 有说明（和前端的 `CacheStorage` 不完全一样），可以自行搜索并参考。

先尝试 `cache.match(url)`，如果匹配到就直接响应，否则去 `𝚕𝚑𝟹.𝚐𝚘𝚘𝚐𝚕𝚎𝚞𝚜𝚎𝚛𝚌𝚘𝚗𝚝𝚎𝚗𝚝.𝚌𝚘𝚖` 中 `fetch` 图片，并修改响应头，添加到 `cache`。

这份代码提供了一个很有意思的思路，但代码本身只是「勉强能用」而已，有许多地方还可以再琢磨。也欢迎更好的代码来实现这个思路。

也许你还需要对你的模板进行一些修改，不过如果你能看到这里，应该可以自己动手了。

## 尾记

你应该已经发现了这篇博客中 `𝚝𝚠𝚘-𝚙𝚕𝚞𝚜-𝚝𝚠𝚘-𝚖𝚊𝚔𝚎-𝚏𝚘𝚞𝚛.𝚋𝚕𝚘𝚐𝚜𝚙𝚘𝚝.𝚌𝚘𝚖` 和 `𝚕𝚑𝟹.𝚐𝚘𝚘𝚐𝚕𝚎𝚞𝚜𝚎𝚛𝚌𝚘𝚗𝚝𝚎𝚗𝚝.𝚌𝚘𝚖` 的字体似乎不太对劲儿。如果你仔细查看了代码，应该能知道为什么会发生这种事情。这个锅我还没想好怎么解决，等有空的时候试着修复一下。

## 链接

* [编程随想的博客 | program-think.blogspot.com](https://program-think.blogspot.com/) [$^\mathrm{Backup}$](https://ragnarok.joefang.org/static/x15mmgcksrdjg00otno48pn92athaqd4e)
* [Pricing · Cloudflare Workers文档 | developers.cloudflare.com](https://developers.cloudflare.com/workers/platform/pricing) [$^\mathrm{Backup}$](https://ragnarok.joefang.org/static/x5p4vu3gpbane8pe983ouvnhggul3hpn1)
* [Contact @SophonCI | t.me](https://t.me/SophonCI) [$^\mathrm{Backup}$](https://ragnarok.joefang.org/static/xm4lu3lkr3g30is1sgq7trksfah0rvnrc)
* [用Cloudflare Workers反代Blogger | cnblogs.com](https://www.cnblogs.com/Helium-Air/p/15646483.html) [$^\mathrm{Backup}$](https://ragnarok.joefang.org/static/xgjdonhj6t4ftb6t17s5vl6gn77vn3r8f)
