---
title: "Taking control of my tailnet: Tailscale ACLs and tags"
description: "Tailscale puts every machine you own on one flat network where everything reaches everything. The policy file that narrows that back down: role tags instead of machine names, three tags to make Android debugging work, and the two places Taildrive keeps its permissions."
date: "2025-04-28"
tags: ["Tailscale", "Networking", "Security"]
---

[Tailscale](https://tailscale.com/) is very good at the thing it advertises.
Every machine I own (laptops, servers, Raspberry Pis, containers, exit nodes)
turns up on one flat private network and can reach every other one. That is the
whole appeal, and it is also the problem: past a handful of devices, "anything
can reach anything" stopped being a convenience and became a thing I could no
longer hold in my head.

So I wrote a policy file, using Tailscale's [Access Control
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
`container`, `exit-node`, `rdp-client`) and the rules talk about labels, so
the policy tells you what a device may do without you needing to know which
device it is.

One thing worth knowing before you start: once a device is tagged, it belongs
to the tag rather than to your user account, and its key stops expiring. That
is usually what you want for a server and rarely what you want for your laptop.

## The shape of the file

My [policy file](https://gist.github.com/MinecraftFuns/c01d9abb6a4dc621e0c6e3ef3371dbca)
lives in a private Git repository. The top declares who the identities are, who
owns which tags, and a few static hostnames.

```json
{
  "groups": {
    "group:root":       [ /* my own account */ ],
    "group:dns-server": [ /* a service account, not a person */ ],
  },

  "tagOwners": {
    /* machine roles */
    "tag:server":    ["group:root"],
    "tag:device":    ["group:root"],
    "tag:container": ["group:root"],

    /* service roles, almost all of them in client/server pairs */
    "tag:rdp-server": ["group:root"],
    "tag:rdp-client": ["group:root"],
    "tag:adb-daemon": ["group:root"],
    "tag:adb-server": ["group:root"],
    "tag:adb-client": ["group:root"],
    /* taildrive, nextcloud, seafile, tailscale-ssh, dns, funnel, exit nodes */
  },

  "hosts": {
    "arkg15.perch-map.ts.net":     "fd7a:115c:a1e0::cafe:babe",
    "arklab.perch-map.ts.net":     "fd7a:115c:a1e0::dead:beef",
    "arklab-wsl.perch-map.ts.net": "fd7a:115c:a1e0::face:feed"
  },

  "acls":      [ /* who may reach what, on which ports */ ],
  "ssh":       [ /* Tailscale SSH rules */ ],
  "nodeAttrs": [ /* which nodes may use Taildrive and Funnel at all */ ],
  "grants":    [ /* and what they may do with them */ ]
}
```

Three details in there are worth more than they seem.

The first is that both identities authenticate with passkeys rather than
through an SSO provider, so there is no third party in the login path for a
network whose entire purpose is not having third parties in the path.

The second is that every address in `hosts` is IPv6. Tailscale hands out a
100.x address and a ULA in `fd7a:115c:a1e0::/48` for every node, and pinning
the names to the latter means the rules keep working on the machines here that
have no IPv4 at all.

The third is `group:dns-server`. Almost everything on this tailnet is a tag,
but the DNS servers are a *group*, which means they log in as a dedicated
service account and stay user-owned devices rather than becoming tag-owned
ones. The ACL rules below name `group:dns-server` as a destination for exactly
the same reason a rule would name a tag: it is a role, and it happens to be one
that suits an identity better than a label.

## How I tag my devices

1. **Core servers** (`tag:server`) are the machines I would notice going down:
   databases, APIs, the boxes other things point at.

2. **Containers and labs** (`tag:container`, `tag:arklab`) come and go. A
   rebuilt container joins with the tag already applied, so it arrives with the
   right permissions instead of getting them afterwards.

3. **Remote desktop** (`tag:rdp-client`, `tag:rdp-server`) is tagged at both
   ends, which turns RDP into a rule between two roles rather than a port left
   open on a machine.

4. **Exit nodes and DNS** (`tag:exit-node`, `tag:exit-node-user`,
   `tag:dns-client`, `tag:doh-client`, `tag:dot-client`) get a tag per
   protocol. "May talk to my resolver" and "may talk to my resolver over DoT"
   are different permissions, and I would rather see the difference written
   down than infer it from a port number.

5. **Application roles** (`tag:nextcloud-*`, `tag:seafile-*`, `tag:adb-*`,
   `tag:taildrive-*`, `tag:funnel-server`) follow the same client-and-server
   shape. Each service is a pair of tags, and the single rule between them is
   the complete statement of what may reach it.

New devices get tagged as they join, with a pre-tagged auth key where possible,
so there is never a window in which something is sitting on the network as an
untagged personal machine.

## The rules themselves

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
   "dst":    ["group:dns-server:53"],
  },

  {
   "action": "accept",
   "src":    ["group:root", "tag:doh-client"],
   "dst":    ["group:dns-server:443", "group:dns-server:60443"],
  },

  {
   "action": "accept",
   "src":    ["group:root", "tag:dot-client"],
   "dst":    ["group:dns-server:853", "group:dns-server:60853"],
  },
]
```

- **Admins** reach everything. This is a one-person tailnet and `group:root` is
  me, so deny-by-default is a promise made to the tagged devices, not to me.
- **RDP clients** reach RDP servers on 3389 and nothing else.
- **One host rule** names `arklab.perch-map.ts.net` directly rather than a tag,
  for my Windows laptop.
- **Exit node users** reach `autogroup:internet` through an exit node.
- **DNS clients** reach the resolver on 53. Plaintext DNS, but only in the
  sense that the payload is not itself encrypted: Tailscale is carrying it
  inside WireGuard either way.
- **DoH and DoT clients** reach the resolver on the ports their own protocol
  uses, including the high-numbered alternates I run alongside 443 and 853.

Nextcloud and Seafile get one rule each in the same shape, though theirs are
`tag:*-server:*`: scoped by role, not by port.

The trailing commas are legal: the policy file is HuJSON, whatever your
editor's JSON linter thinks about it.

## Android debugging, split across three tags

This is the rule pair I like most.

```json
{
 "action": "accept",
 "src":    ["group:root", "tag:adb-server"],
 "dst":    ["tag:adb-daemon:5500-5600", "tag:adb-daemon:30000-50000"],
},

{
 "action": "accept",
 "src":    ["group:root", "tag:adb-client"],
 "dst":    ["tag:adb-server:5037"],
},
```

`adb` is three parts that normally share a machine: client, server, and the
daemon on the phone. Across a network they want three tags.

Clients reach the server on 5037 and need nothing else. The server reaches the
phones on two ranges: 5500 to 5600 for classic `adb tcpip`, and 30000 to 50000
for Android 11 wireless debugging, which picks a fresh high port on every start
and does not ask your opinion about which one.

The payoff is that a phone is debuggable from any machine on the tailnet while
being reachable from none of them. The phones accept only the node holding
`tag:adb-server`; every laptop points `ADB_SERVER_SOCKET` at it.

## Taildrive keeps permission in two places

[Taildrive](https://tailscale.com/kb/1369/taildrive) shares directories between
nodes, and it splits permission across two blocks. `nodeAttrs` turns the
capability on for a node:

```json
"nodeAttrs": [
  { "target": ["tag:taildrive-server"], "attr": ["drive:share"] },
  { "target": ["tag:taildrive-client"], "attr": ["drive:access"] },
  { "target": ["group:root"],           "attr": ["drive:share", "drive:access"] },
  { "target": ["tag:funnel-server"],    "attr": ["funnel"] },
]
```

`grants` then says which pairs may do what, and to which shares:

```json
"grants": [
  {
    "src": ["group:root", "tag:taildrive-client"],
    "dst": ["tag:taildrive-server"],
    "app": {
      "tailscale.com/cap/drive": [{ "shares": ["*"], "access": "rw" }],
    },
  },

  {
    "src": ["group:root"],
    "dst": ["tag:server", "tag:container", "group:dns-server"],
    "app": {
      "tailscale.com/cap/webui": [{ "canEdit": ["ssh", "subnets", "exitNodes"] }],
    },
  },
]
```

The second grant is the one worth stealing if you run headless machines.
`tailscale.com/cap/webui` opens a node's own web interface remotely, and
`canEdit` scopes it: SSH, advertised subnets, exit node status. Enabling an
exit node on a Raspberry Pi behind a television is otherwise an errand.

`tag:funnel-server` is the only attribute in the file that points *outward*.
[Funnel](https://tailscale.com/kb/1223/funnel) exposes a node to the public
internet, so it is gated behind a tag that precisely one machine holds.

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

## Tailnet lock, or who decides what counts as my device

Everything above takes the list of nodes for granted. The policy file says
`tag:rdp-client` may reach `tag:rdp-server` on 3389, and that sentence only
means anything if the machines wearing those tags are the machines I think they
are. Normally that assumption rests on Tailscale: when a node joins, the
coordination server distributes its public key to your other nodes, and they
accept it because the coordination server vouched for it.

[Tailnet lock](https://tailscale.com/kb/1226/tailnet-lock) moves that decision
onto hardware I own. With it enabled, a new node's key must be signed by a key
held by one of my existing signing nodes before any peer will talk to it. The
coordination server does not generate, store, or see that key material, so it
cannot sign a node into the tailnet by itself. Tailscale's own framing of the
guarantee is blunt: with tailnet lock on, even if Tailscale were malicious or
its infrastructure were breached, an injected node can neither send nor receive
traffic in your tailnet.

I run five signing nodes: a Windows desktop, a WSL instance, a Mac, and two iOS
devices. More than one matters, because a signing key lives on the device
holding it, which makes a lone signing node a single point of failure in both
directions: lose it and you can admit nothing new, compromise it and somebody
else can admit anything. Android devices cannot sign at all, and the ceiling is
twenty.

Three things to know before turning it on. Enabling tailnet lock switches off
device approval, because the two are mutually exclusive. Initialization hands
you ten disablement secrets, any one of which turns it back off, and losing all
ten without having left one with Tailscale support means the tailnet cannot be
recovered. And if a signing node is compromised, `tailscale lock revoke-keys`
invalidates its key, after which every node it signed needs a fresh signature.

The honest boundary is worth stating plainly, because tailnet lock is easy
to oversell. It governs node admission, not policy. The key authority
records only changes to lock state, which is trusted keys added and removed;
the policy file at the top of this post still reaches my nodes through the
coordination server. So a compromised control plane could not smuggle a new
machine onto my tailnet, but tailnet lock is not the thing that would stop
it rewriting who may reach what among the machines already there. It is also
trust on first use: you trust the coordination server once, at setup, to
bootstrap the arrangement that means you need not trust it afterwards.

## Where this file is honest and where it is not

Read the rules again and you will notice that `group:root` appears in the `src`
of nearly every one of them, on top of the opening rule that already grants it
everything. The file is deny-by-default for services and allow-everything for
me. That is a deliberate trade for a network where every user-logged-in device
is one I physically own, and it is the first thing I would change if anybody
else ever joined. It is not a property you should copy into a tailnet with
colleagues on it.

Two smaller admissions. The Nextcloud and Seafile rules end in `:*`, so they
are scoped by role but not by port, which is laziness rather than design. And
Tailscale will run policy tests on every save if you fill in the `tests` block;
mine is still the commented-out example that shipped with the file.

The tradeoff of the whole approach is that this file is now the thing I have to
keep honest. Every stale rule in it is a permission I am still handing out for
something I may no longer run.
