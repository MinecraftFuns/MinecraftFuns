---
title: "multiset / Self-Service Troubleshooting Guide for Cloudflare WARP"
description: "Diagnosing the most frequent Cloudflare WARP and Cloudflare One Agent failures, in the order the checks build on each other."
category: "Networking"
---

Welcome! This page helps **multiset** employees diagnose and resolve the most frequent problems encountered when using **Cloudflare WARP / Cloudflare One Agent**. Work through the sections in order: each builds on the previous checks. If you remain stuck, email **<nic@joefang.org>**.

***

## Registering the WARP Client

### Error: `Authentication Expired` or `Registration error. Please try again later`

1. Visit <https://time.is> on the affected device.
2. If the clock is off by >20 s, enable automatic time sync (Windows/macOS) or run `timedatectl set-ntp true` (Linux).
3. Retry sign-in immediately after the Access prompt appears.
    - Do not wait more than 1 min: JWTs expire 50 s after issuance.

***

## Content or Site Block Issues

### A site is blocked but should not be

- Submit the domain via Cloudflare’s review form.
- While waiting, Security can add a temporary *Do Not Inspect* or *Allow* rule in Gateway.

***

## Browser and API Errors

| Error | Cause | Fix |
| :-- | :-- | :-- |
| `No Access-Control-Allow-Origin header` | Missing `credentials: "same-origin"` in Fetch | Add the parameter; see Cloudflare CORS guide. |
| Browser warns of untrusted certificate everywhere | Root certificate not installed/trusted | Install Cloudflare root CA and trust it on each device. |
| Chrome `NET::ERR_CERT_AUTHORITY_INVALID` after WARP update | Browser cached old root CA | Restart the browser after certificate deployment. |

***

## TLS Inspection and Certificate Problems

### HTTP 526 (Invalid SSL)

1. Check that the origin serves a trusted cert (issuer, expiry, CN match).
2. Ensure origin supports strong ciphers or disable FIPS-only mode.
3. If origin forces HTTPS→HTTP redirects, disable them.
4. Still failing? Open a ticket with OS, browser, URL, and screenshot.

### Root CA expired on **2025-02-02**

1. Upgrade WARP to ≥ 2024.12.554.0.
2. Zero Trust → Settings → WARP Client → enable **Install CA to system certificate store**.
3. Zero Trust → Settings → Resources → Cloudflare certificates:
    - Generate → Activate new cert (5-year default).
4. Ask users to disconnect/reconnect WARP or **Reset Encryption Keys** (GUI → Preferences → Connection).
5. macOS Big Sur+: manually trust via Keychain or deploy via MDM if auto-trust fails.

***

## Gateway Analytics Missing

Check, in order:

1. Devices are sending DNS queries to the correct Gateway IPs.
2. Remove any other DNS resolvers from network settings.
3. Verify the source IPv4 address in **Gateway → DNS Locations**.
4. Wait up to 5 min; if still blank, file a support ticket.

***

## Browser Isolation Alerts

- **No Browsers Available** – file feedback via the WARP client.
- **Maximum Sessions Reached** – close all tabs in one local browser to free a session.

***

## Identity Provider and SSO Errors

| Message | Likely Root | Action |
| :-- | :-- | :-- |
| `SAML Verify: Invalid SAML response` | IdP omits signing key | Configure IdP to include the public key. |
| `Access api error auth_domain_cannot_be_updated_dash_sso` | Team domain change blocked by dashboard SSO | Contact multiset IT to revert change. |
| `Failed to fetch user/group information…` | Missing API scopes in IdP | Add required scopes in Entra/Okta per Cloudflare guide. |
| OAuth `deleted_client` 401 | Client removed in IdP | Re-create or re-authorize OAuth client. |

***

## WARP Client Connectivity Problems

### Windows shows “No Internet access”

1. Registry edit `UseGlobalDNS=1` under `NetworkConnectivityStatusIndicator`.
2. Registry edit `EnableActiveProbing=1` under `NlaSvc\Parameters\Internet`.
3. Reboot. If Microsoft 365 still fails, enable **Directly route Microsoft 365 traffic** in Zero Trust.

### Linux error `DNS connectivity check failed`

1. Add `ResolveUnicastSingleLabel=yes` in `/etc/systemd/resolved.conf`.
2. Remove any `DNS=` entries in the same file.
3. `sudo systemctl restart systemd-resolved`.

### Unstable connection / infinite “Connecting…”

1. Run `warp-cli -l status` to watch logs.
2. Uninstall or split-tunnel third-party VPNs fighting for routes.
3. Whitelist Cloudflare WARP IP ranges on perimeter firewalls.

***

## HTTP and Browser Errors

| Error | Explanation | Resolution |
| :-- | :-- | :-- |
| `502 Bad Gateway` with HTTP/2 origins | Origin requests downgrade to HTTP/1.1 which Gateway won’t honor | Disable HTTP/2 on the origin server. |
| `This site can’t provide a secure connection` for multi-level subdomain | Universal Cert doesn’t cover hostname | Order an Advanced Certificate. |
| `WebGL Rendering Error` in Browser Isolation | GPU unavailable in virtual environment | `chrome://flags/#override-software-rendering-list` → Enable, then Relaunch. |

***

## Admin Override Codes

- Codes count time in whole-hour blocks starting at generation time.
- Auto Connect overrides will still reconnect WARP unless you disable or extend the Auto Connect timeout.

***

## Miscellaneous Issues

- **SMTP on port 25 blocked** – use 587/465, or request unblock through Security.
- **WSL2 loses connectivity** – exclude WSL IP range from Split Tunnels.
- **Windows installer ends prematurely** – install .NET 4.7.2 Runtime, rerun MSI.
- **Long-lived SSH drops after 10 h** – set `ChannelTimeout 8h` on client or server.

***

## Need Help?

Email **<nic@joefang.org>** with:

- Device OS and version
- WARP client version (`warp-cli --version`)
- Exact error text or screenshot
- Diagnostic bundle (GUI → Preferences → Advanced → Download Logs)

Expect a response within **1 business day**.
