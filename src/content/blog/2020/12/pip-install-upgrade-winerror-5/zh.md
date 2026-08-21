---
title: "运行 `pip install --upgrade` 时出现 `[WinError 5]` 报错的可能原因"
description: "记录一次 pip install --upgrade cffi 时出现 WinError 5 拒绝访问的排查过程，根因是有 Python 脚本正占用待更新的文件。"
date: "2020-12-25"
tags: ["Python", "Windows"]
---

> 检查正在运行的Python解释器是否 **正在使用（占用）** 要更新的文件

![0.webp](https://ragnarok.joefang.org/static/xnve44kj8o7sepk60h63ohc7rau92ad5s.webp)

在运行 `pip install --upgrade cffi` 后，出现报错

```bash
ERROR: Could not install packages due to an EnvironmentError: [WinError 5] 拒绝访问。: '{path_to_python}\\python38\\lib\\site-packages\\_cffi_backend.cp38-win_amd64.pyd'
Consider using the `--user` option or check the permissions.
```

直接根据提示，在命令后加上 `--user` 固然可行，但并没有解决根本问题。

Google了一下，发现可能和文件权限有关，`以管理员身份运行`命令行后仍然报错。

突然发现有几个正在运行的Python脚本，终止脚本后 [cffi](https://pypi.org/project/cffi/) 可以正常安装。于是水篇文章，记录一下。
