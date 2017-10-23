---
title: ELF文件简述
date: 2017-10-23 11:16:53
tags:
  - ELF
---

ELF(Executable and Linkable Format)是一种用于二进制文件、可执行文件、目标代码、共享库和核心转储的格式文件，是UNIX系统实验室（USL）作为应用程序二进制接口（Application Binary Interface，ABI）而开发和发布的，也是Linux的主要可执行文件格式。

ELF 格式的文件可归为如下4类：

| ELF文件类型                     | 说明                                       | 实例                                 |
| --------------------------- | ---------------------------------------- | ---------------------------------- |
| 可重定位文件 (Relocatable File)   | 这类文件包含了代码和数据，可以被用来链接成可执行文件或共享目标文件，静态链接库也可以归为这一类。 | Linux的.o文件和.ko（内核）文件；Windows的.obj。 |
| 可执行文件 (Executable File)     | 这类文件包含了可以直接执行的程序，一般无扩展名。                 | Linux的/bin/bash；Windows的.exe。      |
| 共享目标文件 (Shared Object File) | 这种文件包含了代码和数据，可以在以下两种情况下使用。一种是**链接器**可以使用这种文件跟其他的可重定位文件和共享目标文件链接，产生新的目标文件。第二种是**动态链接器**可以将几个这种共享目标文件与可执行文件结合，作为进程映像的一部分来运行。 | Linux的.so；Windows的.dll。            |
| 核心转储文件 (Core Dump File)     | 当进程意外终止时，系统可以将该进程的地址空间内容及终止时的一些其他信息转储到核心转储文件。 | Linux的core dump                    |

第四种类型可以忽略。可以用'file'命令来查看文件类型。

```shell
# file 8021q.ko 
8021q.ko: ELF 32-bit LSB relocatable, Intel 80386, version 1 (SYSV), not stripped
# file /bin/mv
/bin/mv: ELF 32-bit LSB executable, Intel 80386, version 1 (SYSV), dynamically linked (uses shared libs), for GNU/Linux 2.6.18, stripped
file /lib/libc-2.12.so 
/lib/libc-2.12.so: ELF 32-bit LSB shared object, Intel 80386, version 1 (GNU/Linux), dynamically linked (uses shared libs), for GNU/Linux 2.6.18, not stripped
```



目标文件既要参与程序链接又要参与程序执行。出于方便性和效率考虑，目标文件格式提供了两种并行视图，分别反映了这些活动的不同需求。