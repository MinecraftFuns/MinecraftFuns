---
title: "Blogger × Cloudflare Workers: Easily Solving Blogger's Connectivity Problems in China"
description: "Sharing a Cloudflare Workers script that reverse-proxies a Blogger blog and its image domains, fixing direct-connection and image-loading issues for Blogger in mainland China, with a breakdown of its page-rewriting and image-caching logic."
date: "2022-01-24"
tags: ["Blogger", "Cloudflare", "Guide"]
translation: machine
---

<picture>
    <source srcset="https://ragnarok.joefang.org/static/x9ttvpc55fh0rgn7iqcm33qprrdk0rmi6.svg"
            type="image/svg+xml">
    <img src="https://ragnarok.joefang.org/static/xide2bm7ugt4b0ug5og0dumbmd7l1ammh.webp" alt="Cloudflare Workers logo" />
</picture>

## The problem

Originally, seeing that [Program-Think's blog](https://program-think.blogspot.com/) was hosted on Blogger told me the platform's security and performance were trustworthy, so I moved my own blog there too. However, using a Google service means facing the GFW's highest tier of blocking: an IP black hole.

To make things a bit more comfortable for myself (sharing articles, checking the blog on a borrowed device), I needed to solve Blogger's connectivity problem in mainland China. You can occasionally find an IP that connects to Blogger directly, but that cat-and-mouse game gets old fast, and it's also quite inefficient.

If you've fought with this problem before, you may also have noticed that Blogger uses the `lh*.googleusercontent.com` family of domains to proxy and cache images. Even after solving the blog's connectivity problem, images failing to load remains a headache. The solutions floating around online tend to be quite complex, and they hurt front-end performance significantly too.

Rather than waste time scanning Google's IP ranges, it's simpler to just stand up a reverse proxy service that's directly reachable from within China.

## The solution

So, proxying through Cloudflare Workers turns out to be a great solution. The [Workers free tier's 100,000 requests per day](https://developers.cloudflare.com/workers/platform/pricing) easily covers a personal blog's needs, and thanks to Cloudflare's global network, the site's front-end performance shouldn't take much of a hit in theory either.

I wrote the following code during winter break in 2021:

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

For less technical readers: replace `const blogHost = '𝚝𝚠𝚘-𝚙𝚕𝚞𝚜-𝚝𝚠𝚘-𝚖𝚊𝚔𝚎-𝚏𝚘𝚞𝚛.𝚋𝚕𝚘𝚐𝚜𝚙𝚘𝚝.𝚌𝚘𝚖'` in the code with your own Blogger domain, for example `const blogHost = 'example.blogspot.com'`, and it's ready to use (you may also need to type out `𝚕𝚑𝟹.𝚐𝚘𝚘𝚐𝚕𝚎𝚞𝚜𝚎𝚛𝚌𝚘𝚗𝚝𝚎𝚗𝚝.𝚌𝚘𝚖` by hand, all 25 characters of it).

I originally meant to stay quiet and get rich off this, but during summer break in 2021 I saw [@SophonCI](https://t.me/SophonCI) wrestling with the same problem, so I shared this solution with him. There's a string in the code, `blog-proxy-2cff9aba`, which was originally this project's name; I Googled it and found that [this person blogs pretty diligently](https://www.cnblogs.com/Helium-Air/p/15646483.html) 😀 and had put my code out there:

![Screenshot](https://ragnarok.joefang.org/static/xn8a0b2f9kmfl4t5pe46m6mgptpcsr973.png)

So I figured I'd ~~pad out~~ write a post about it too 😂.

## Technical breakdown

If this post were just for dropping the code somewhere, I wouldn't have needed to write it; there's more interesting stuff below.

### Page rewriting

> This part of the code lives in the `proxy` function

First, replace every `blogspot.com` domain with your own domain.

```js
body = body.replaceAll(blogHost, proxyHost)
```

Then swap out the domain in the `rel=canonical` tag (my case is a bit special: I want Google to index pages under `blogspot.com` rather than under `workers.dev`; if you want search engines to index pages under your own domain, you don't need to modify the `rel=canonical` tag), to help with search engine indexing (warning: make sure you only use this on your own blog, not to mirror someone else's).

```js
body = body.replace(new RegExp(`<link href='(.*?)${proxyHost}/(.*?)' rel='canonical'/>`), `<link href='$1${blogHost}/$2' rel='canonical'/>`)
```

Then a regex replacement swaps every `lh*.googleusercontent.com` over to the `/_image/` path under our own domain.

```js
body = body.replace(/lh\w*?.googleusercontent.com/g, proxyHost + '/_image')
```

### Image access

As mentioned above, Blogger uses the `lh*.googleusercontent.com` family of domains to proxy and cache images, so we need to reverse-proxy this domain group, and ideally cache the image content as well.

For load-balancing and similar reasons, Blogger's backend loads images from several different domains when rendering a page.

![Screenshot](https://ragnarok.joefang.org/static/xqsfej4jui5t429k7qev8aafemq8oj7tj.webp)

These domains are equivalent to one another. To improve the cache hit rate, we consistently use `𝚕𝚑𝟹.𝚐𝚘𝚘𝚐𝚕𝚎𝚞𝚜𝚎𝚛𝚌𝚘𝚗𝚝𝚎𝚗𝚝.𝚌𝚘𝚖` inside the Worker to fetch and cache the resource.

```js
if (url.pathname.startsWith('/_image/')) {
    url.hostname = '𝚕𝚑𝟹.𝚐𝚘𝚘𝚐𝚕𝚎𝚞𝚜𝚎𝚛𝚌𝚘𝚗𝚝𝚎𝚗𝚝.𝚌𝚘𝚖'
    url.pathname = url.pathname.substring(7)
    return await fromCache(url)
}
```

Next comes the `fromCache` function. The Cloudflare Workers documentation explains how to use `caches.default` (it isn't quite the same as the front-end `CacheStorage`), which you can look up and read yourself.

It first tries `cache.match(url)`; if that hits, it responds directly, otherwise it goes and `fetch`es the image from `𝚕𝚑𝟹.𝚐𝚘𝚘𝚐𝚕𝚎𝚞𝚜𝚎𝚛𝚌𝚘𝚗𝚝𝚎𝚗𝚝.𝚌𝚘𝚖`, modifies the response headers, and adds it to the `cache`.

This code offers an interesting approach, but the code itself is only "just barely usable"; there's plenty here that could still use more thought. Better code implementing this same idea is welcome too.

You'll probably also need to make some changes to your template, but if you've read this far, you should be able to handle that yourself.

## Closing note

You've probably already noticed that the font used for `𝚝𝚠𝚘-𝚙𝚕𝚞𝚜-𝚝𝚠𝚘-𝚖𝚊𝚔𝚎-𝚏𝚘𝚞𝚛.𝚋𝚕𝚘𝚐𝚜𝚙𝚘𝚝.𝚌𝚘𝚖` and `𝚕𝚑𝟹.𝚐𝚘𝚘𝚐𝚕𝚎𝚞𝚜𝚎𝚛𝚌𝚘𝚗𝚝𝚎𝚗𝚝.𝚌𝚘𝚖` in this post looks a bit off. If you looked closely at the code, you should know why that happens. I haven't figured out how to fix this yet; I'll give it a try sometime when I have a spare moment.

## Links

* [Program-Think's blog | program-think.blogspot.com](https://program-think.blogspot.com/) [$^\mathrm{Backup}$](https://ragnarok.joefang.org/static/x15mmgcksrdjg00otno48pn92athaqd4e)
* [Pricing · Cloudflare Workers docs | developers.cloudflare.com](https://developers.cloudflare.com/workers/platform/pricing) [$^\mathrm{Backup}$](https://ragnarok.joefang.org/static/x5p4vu3gpbane8pe983ouvnhggul3hpn1)
* [Contact @SophonCI | t.me](https://t.me/SophonCI) [$^\mathrm{Backup}$](https://ragnarok.joefang.org/static/xm4lu3lkr3g30is1sgq7trksfah0rvnrc)
* [Reverse-proxying Blogger with Cloudflare Workers | cnblogs.com](https://www.cnblogs.com/Helium-Air/p/15646483.html) [$^\mathrm{Backup}$](https://ragnarok.joefang.org/static/xgjdonhj6t4ftb6t17s5vl6gn77vn3r8f)
