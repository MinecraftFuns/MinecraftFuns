---
title: "Killing Off a Driver That Was Causing DPC_WATCHDOG_VIOLATION Blue Screens"
description: "Records troubleshooting repeated DPC_WATCHDOG_VIOLATION blue screens on a Dell laptop, eventually tracing it to and uninstalling the SmartByte network driver."
date: "2021-08-25"
tags: ["Windows", "Life"]
translation: machine
---

As a Dell user, I used to often notice a process called `SmartByte Telemetry` in Task Manager. `SmartByte`'s job is to *balance network bandwidth usage across different software to prevent stuttering when streaming content*, but a lot of articles online report that `SmartByte` not only fails to do its job, but even slows down the network.

But from my own experience, `SmartByte` didn't seem to affect my network experience either, so I just left it there; who knows, maybe it would come in handy someday.

Then recently, for several days in a row, opening the Chrome address bar and typing a few characters would immediately cause a blue screen with the error `DPC_WATCHDOG_VIOLATION`, which felt off. At first I thought it was a Chrome problem, but today the blue screen happened again even while Chrome wasn't running.

This problem had already seriously disrupted my experience, so I started digging in. The debugging methods online all seem to require analyzing dump files, which is a hassle. I opened Dell's built-in `SupportAssist` directly and checked its `History`, which showed some information about the blue screen errors.

![1](https://ragnarok.joefang.org/static/x92d1tqs1ho57c5lu2ps6151eh0gms66a.webp)

![0](https://ragnarok.joefang.org/static/xia80qs5mgvn0tugnm8ga0c8ts2d30jbc.webp)

The problem pointed straight at the `SmartByte Traffic Control Callout Driver`, version `9.8.4.9`, at the path `C:\WINDOWS\system32\DRIVERS\SmbCo10X64.sys`.

No point hesitating; I just uninstalled it.

The blue screen problem seems to be resolved for now.

That said, `SupportAssist`'s history doesn't seem all that reliable either; maybe some system errors just never get logged at all.
