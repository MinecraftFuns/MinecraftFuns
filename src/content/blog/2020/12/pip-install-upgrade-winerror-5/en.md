---
title: "A Possible Cause of the [WinError 5] Error When Running pip install --upgrade"
description: "Records a debugging session for a WinError 5 access-denied error during pip install --upgrade cffi, traced to a running Python script holding the file being updated."
date: "2020-12-25"
tags: ["Python", "Windows"]
translation: machine
---

> Check whether a running Python interpreter is **using (holding)** the file being updated

![0.webp](https://bafkreicnacyi2kzjv5jzyj2islipt2l7hzedp5hnluhx7mvyarlhx62ks4.ipfs.dweb.link)

After running `pip install --upgrade cffi`, I got this error:

```bash
ERROR: Could not install packages due to an EnvironmentError: [WinError 5] 拒绝访问。: '{path_to_python}\\python38\\lib\\site-packages\\_cffi_backend.cp38-win_amd64.pyd'
Consider using the `--user` option or check the permissions.
```

Following the hint and adding `--user` after the command does work, but it doesn't fix the underlying problem.

After Googling it, I found this might be related to file permissions, but running the command line `as Administrator` still produced the error.

Then I suddenly noticed a few Python scripts were running; after terminating them, [cffi](https://pypi.org/project/cffi/) installed normally. So here's a low-effort post just to note it down.
