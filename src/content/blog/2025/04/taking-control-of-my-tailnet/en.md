---
title: "Taking control of my tailnet: Tailscale ACLs and tags"
description: How I use Tailscale access control lists and device tags to keep a growing private network deny-by-default and legible.
date: "2025-04-28"
tags: ["Tailscale", "Networking", "Security"]
---

[Tailscale](https://tailscale.com/) is very good at the thing it advertises.
Every machine I own (laptops, servers, Raspberry Pis, containers, exit nodes)
turns up on one flat private network and can reach every other one. That is the
whole appeal, and it is also the problem: past a handful of devices, "anything
can reach anything" stopped being a convenience and became a thing I could no
longer hold in my head.

So I sat down and wrote a policy file, using Tailscale's [Access Control
Lists](https://tailscale.com/kb/1018/acls) (ACLs) and
[tags](https://tailscale.com/kb/1068/tags).

## Why ACLs and tags

Tailscale is allow-all by default. That is the right default for two laptops
and the wrong one the moment you are running services on the network or sharing
a node with somebody else. What I wanted instead:

- **Deny by default.** If I did not write a rule for it, it does not connect.
- **A policy I can read.** It is one file, it lives in Git, and a bad change is
  one `git revert` away.
- **Roles instead of machines.** A container that gets rebuilt every week
  should not need a new rule each time. It needs to be a `container`.

Tags handle that last part. Each device is labeled by what it is (`server`,
`container`, `exit-node`, `rdp-client`) and the rules talk about labels rather
than machines. The useful side effect is that reading the policy tells you what
a device may do without knowing anything about the device.

One thing worth knowing before you start: once a device is tagged, it belongs
to the tag rather than to your user account, and its key stops expiring. That
is usually what you want for a server and rarely what you want for your laptop.

## ACL file structure

My [policy file](https://gist.github.com/MinecraftFuns/c01d9abb6a4dc621e0c6e3ef3371dbca)
lives in a private Git repository. The top of it declares my admin group, who
owns which tags, and a few static hostnames:

```json
{
  "groups": {
    "group:root": [ /* Admin group with full access */ ]
  },

  "tagOwners": {
    /* All device role tags are owned and assigned by the admin group */
  },

  "hosts": {
    /* Static hostnames mapped to internal Tailscale IP addresses */
    "arkg15.perch-map.ts.net":     "fd7a:115c:a1e0::cafe:babe",
    "arklab.perch-map.ts.net":     "fd7a:115c:a1e0::dead:beef",
    "arklab-wsl.perch-map.ts.net": "fd7a:115c:a1e0::face:feed"
  },

  "acls": [ /* Access control rules defined below */ ],

  "ssh":  [ /* SSH access rules using Tailscale SSH */ ],

  "nodeAttrs": [
    /* Node attributes like Taildrive and Funnel capabilities */
  ],

  "grants": [
    /* Permissions for Web UI and Drive access */
  ]
}
```

## How I tag my devices

1. **Core servers** (`tag:server`) are the machines I would notice going down:
   databases, APIs, the boxes other things point at.

2. **Containers and labs** (`tag:container`, `tag:arklab`) come and go. A
   rebuilt container joins with the tag already applied, so it arrives with the
   right permissions instead of getting them afterwards.

3. **Remote desktop** (`tag:rdp-client`, `tag:rdp-server`) is tagged at both
   ends, which turns RDP into a rule between two roles rather than a port left
   open on a machine.

4. **Exit nodes and DNS** (`tag:exit-node`, `tag:dns-server`,
   `tag:dns-client`, `tag:doh-client`, `tag:dot-client`) get a tag per
   protocol. "May talk to my resolver" and "may talk to my resolver over DoT"
   are different permissions, and I would rather see the difference written
   down than infer it from a port number.

New devices get tagged as they join, with a pre-tagged auth key where possible,
so there is never a window in which something is sitting on the network as an
untagged personal machine.

## My ACL rules

Here is the core of my
[ACL setup](https://gist.github.com/MinecraftFuns/a5632e078cb31acfd3706c049d667f8d):

```json
"acls": [
  {
   "action": "accept",
   "src":    ["group:root"],
   "dst":    ["*:*"],
  },

  {
   "action": "accept",
   "src":    ["group:root", "tag:rdp-client"],
   "dst":    ["tag:rdp-server:3389"],
  },

  {
   "action": "accept",
   "src":    ["arklab.perch-map.ts.net"],
   "dst":    ["arkg15.perch-map.ts.net:3389"],
  },

  {
   "action": "accept",
   "src":    ["group:root", "tag:exit-node-user"],
   "dst":    ["autogroup:internet:*"],
  },

  {
   "action": "accept",
   "src":    ["group:root", "tag:dns-client"],
   "dst":    ["tag:dns-server:53"],
  },

  {
   "action": "accept",
   "src":    ["group:root", "tag:doh-client"],
   "dst":    ["tag:dns-server:443", "tag:dns-server:60443"],
  },

  {
   "action": "accept",
   "src":    ["group:root", "tag:dot-client"],
   "dst":    ["tag:dns-server:853", "tag:dns-server:60853"],
  },
]
```

- **Admins** reach everything. This is a one-person tailnet, so `group:root` is
  me.
- **RDP clients** reach RDP servers on 3389 and nothing else.
- **One host rule** names `arklab.perch-map.ts.net` directly rather than a tag,
  for my Windows laptop.
- **Exit node users** reach `autogroup:internet` through an exit node.
- **DNS clients** reach the resolver on 53. Plaintext DNS, but only in the
  sense that the payload is not itself encrypted: Tailscale is carrying it
  inside WireGuard either way.
- **DoH and DoT clients** reach the resolver on the ports their own protocol
  uses.

If the trailing commas above look like a mistake, they are not. Tailscale's
policy file is HuJSON, so comments and trailing commas are both legal, whatever
your editor's JSON linter thinks about it.

## SSH without keys

Tailscale SSH means I am not maintaining `authorized_keys` by hand anywhere:

```json
"ssh": [
  {
   "action":      "check",
   "src":         ["group:root"],
   "dst":         ["autogroup:self"],
   "users":       ["autogroup:nonroot", "root"],
   "checkPeriod": "72h",
  },

  {
   "action": "accept",
   "src":    ["group:root"],
   "dst":    ["tag:device", "tag:server", "tag:container"],
   "users":  ["autogroup:nonroot"],
  },

  {
   "action":      "check",
   "src":         ["group:root"],
   "dst":         ["tag:device", "tag:server", "tag:container"],
   "users":       ["root"],
   "checkPeriod": "72h",
  },

  {
   "action": "accept",
   "src":    ["group:root", "tag:tailscale-ssh-client"],
   "dst":    ["tag:tailscale-ssh-server"],
   "users":  ["autogroup:nonroot", "root"],
  },
]
```

The part worth pointing out is `check`. It does not simply allow the
connection; it makes me re-authenticate in a browser first, and `checkPeriod`
sets how long that lasts. Root on anything, and any access at all to my own
devices, goes through a three-day check. Ordinary non-root logins on tagged
servers are a plain `accept`, because I do those constantly and a prompt every
time would only teach me to click through it.

So `ssh ubuntu@arklab-wsl.perch-map.ts.net` now just works, with no key
material on the client at all. Authentication and authorization both moved into
the policy file, which is where every other decision about this network already
lived.

The tradeoff is that the file is now the thing I have to keep honest. Every
stale rule in it is a permission I am still handing out for something I may not
still run.
