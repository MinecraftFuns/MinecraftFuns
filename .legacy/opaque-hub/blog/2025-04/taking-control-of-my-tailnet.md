# Taking Control of My Tailnet: How I Use Tailscale ACLs and Tags to Organize My Devices

When I started using [Tailscale](https://tailscale.com/), it was great to link all my machines—laptops, servers, Raspberry Pis, containers, and exit nodes—into one private network. As the number of devices grew, I needed a simple way to keep things secure and easy to manage. That’s why I turned to Tailscale’s [Access Control Lists](https://tailscale.com/kb/1018/acls) (ACLs) and [tags](https://tailscale.com/kb/1068/tags).

## Why I Use ACLs and Tags

By default, Tailscale lets any node talk to any other node. That works for a few devices, but when I added services and shared with others, I wanted:

- **Deny by default.** Only allow the connections I really need, which significantly reduces security risks from unauthorized access or misconfigured services.
- **Easy-to-read policies.** JSON format is simple to understand and allows easy version control through Git, enabling clear audit trails and rollback capability if changes go wrong.
- **Device IDs.** Treating servers and services similarly to users means access is controlled granularly, improving security by avoiding overly permissive defaults.

Tags let me label devices—`server`, `container`, `exit-node`, `rdp-client`, and so on—so each machine has a clear role. Then ACLs use those tags to allow only the right traffic. This makes it easy to understand exactly what each device is allowed to do, simplifying troubleshooting and improving security auditing.

## ACL File Structure

My [policy file](https://gist.github.com/MinecraftFuns/c01d9abb6a4dc621e0c6e3ef3371dbca) lives in a private Git repository. At the top, I set up my admin group, tag owners, and host names:

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

## How I Tag My Devices

1. **Core Servers**  
   - Tag: `tag:server`  
   - These machines host critical infrastructure like databases or APIs. Clearly tagging them helps me quickly verify and protect critical endpoints.

2. **Containers & Labs**  
   - Tags: `tag:container`, `tag:arklab`  
   - Containers frequently change, so tagging helps rapidly apply appropriate ACLs without reconfiguring permissions each time a container restarts or scales.

3. **Remote Desktop**  
   - Tags: `tag:rdp-client`, `tag:rdp-server`  
   - Tagging both clients and servers ensures only my authorized Windows machines can initiate RDP connections, reducing the attack surface for potential intruders.

4. **Exit Nodes & DNS**  
   - Tags: `tag:exit-node`, `tag:dns-server`, `tag:dns-client`, `tag:doh-client`, `tag:dot-client`  
   - Tagging exit nodes separately allows tight control over internet traffic flow. Using tags for DNS-related roles further secures my DNS setup, clearly defining which devices handle DNS queries and ensuring encrypted protocols (DoH, DoT) are correctly routed.

When I add a new device, I tag it immediately—either via the admin console or an auth key that tags devices automatically. This reduces the risk of misconfiguration and ensures consistent security policies.

## My ACL Rules

Here’s the core of my [ACL setup](https://gist.github.com/MinecraftFuns/a5632e078cb31acfd3706c049d667f8d):

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

- **Admins & Servers** can do everything—great for management and backups.  
- **RDP Clients** only reach RDP servers on port 3389—no extra access.  
- **Specific Host** (`arklab.perch-map.ts.net`) has a special RDP rule for my Windows laptop.  
- **Exit Nodes Users** can route internet traffic via exit nodes.
- **DNS over 53** clients only talk to my DNS servers over port 53 (still encrypted since Tailscale encrypts all the traffic end-to-end).  
- **Encrypted DNS** clients only talk to my DNS servers over encrypted ports designated by each protocol.

Each rule clearly defines allowed interactions. By explicitly stating ports and allowed sources, I can quickly identify unnecessary permissions or diagnose connectivity issues. This granular control minimizes potential vulnerabilities due to overly permissive access.

## Securing SSH with Tailscale SSH

I use Tailscale SSH instead of manually managing SSH keys. Here’s my SSH setup:

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

Now running `ssh ubuntu@arklab-wsl.perch-map.ts.net` just works—Tailscale checks the policy, lets me in, and there is no need for manually configuring a list of `authorized_keys` anymore, as the burden of authentication and authorization falls to Tailscale.

Using tags and ACLs has made my tailnet safe and easy to manage. Give it a try—you’ll save time and avoid surprises when you add new devices or share access with others.
