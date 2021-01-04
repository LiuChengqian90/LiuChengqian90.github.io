---
title: nsenter命令
date: 2021-01-04 09:57:52
categories: Linux工具
tags:
  - nsenter
---



[nsenter](https://man7.org/linux/man-pages/man1/nsenter.1.html)命令是一个可以在指定进程的命令空间下运行指定程序的命令，它位于util-linux包中。

一般可以用于在容器外 debug 容器中运行的程序。

<!--more-->

其命令行格式

```shell
nsenter [options] [program [arguments]]

options:
-t, --target pid：指定被进入命名空间的目标进程的pid
-m, --mount[=file]：进入mount命令空间。如果指定了file，则进入file的命令空间
-u, --uts[=file]：进入uts命令空间。如果指定了file，则进入file的命令空间
-i, --ipc[=file]：进入ipc命令空间。如果指定了file，则进入file的命令空间
-n, --net[=file]：进入net命令空间。如果指定了file，则进入file的命令空间
-p, --pid[=file]：进入pid命令空间。如果指定了file，则进入file的命令空间
-U, --user[=file]：进入user命令空间。如果指定了file，则进入file的命令空间
-G, --setgid gid：设置运行程序的gid
-S, --setuid uid：设置运行程序的uid
-r, --root[=directory]：设置根目录
-w, --wd[=directory]：设置工作目录

如果没有给出program，则默认执行$SHELL。
```



查询容器的PID

```shell
# docker inspect --format {{.State.Pid}} <container_name_or_ID>

# nsenter -m -u -i -n -p -t $PID hostname
```



或者可以直接进入容器network ns，例如

```shell
# nsenter --net=/var/run/docker/netns/1-7fe9ew67wh ip a
```



其原理基本就是[Linux Namespace](http://chengqian90.com/Linux%E5%86%85%E6%A0%B8/Linux-Namespace%E7%AE%80%E4%BB%8B.html)。



