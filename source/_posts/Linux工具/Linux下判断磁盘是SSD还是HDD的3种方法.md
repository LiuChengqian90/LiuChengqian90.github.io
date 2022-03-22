---
title: Linux下判断磁盘是SSD还是HDD的3种方法
date: 2022-01-12 15:57:52
categories: Linux工具
tags:
  - SSD
  - HDD
---

## 方法一

判断cat /sys/block/\*/queue/rotational的返回值（其中\*为你的硬盘设备名称，例如sda等等）

如果返回1 则表示磁盘可旋转，那么就是HDD了；如果返回0，则表示磁盘不可以旋转，那么就是SSD了。

<!--more-->

```shell
[pythontab@pythontab.com ~]$ cat /sys/block/sda/queue/rotational
0
[pythontab@pythontab.com ~]$ grep ^ /sys/block/*/queue/rotational
/sys/block/ram0/queue/rotational:1
/sys/block/sda/queue/rotational:0
/sys/block/sdb/queue/rotational:0
/sys/block/sdc/queue/rotational:0
/sys/block/sdd/queue/rotational:0
```

这种方法有个问题，那就是/sys/block/下面不只有硬盘，还可能有别的块设备，它们都在干扰你的判断。

## 方法二

使用lsblk命令进行判断，参数-d表示显示设备名称，参数-o表示仅显示特定的列。

```shell
[pythontab@pyhontab.com ~]$ lsblk -d -o name,rota
NAME ROTA
sda     0
sdb     0
sdc     0
sdd     0
```

这种方法的优势在于它只列出了你要看的内容，结果比较简洁明了。还是那个规则，ROTA是1的表示可以旋转，反之则不能旋转。

## 方法三

可以通过fdisk命令查看，参数-l表示列出磁盘详情。在输出结果中，以Disk开头的行表示磁盘简介，下面是一些详细参数，我们可以试着在这些参数中寻找一些HDD特有的关键字，比如：”heads”（磁头），”track”（磁道）和”cylinders”（柱面）。



下面分别是HDD和SSD的输出结果

```shell
Disk /dev/sda: 120.0 GB, 120034123776 bytes
255 heads, 63 sectors/track, 14593 cylinders
Units = cylinders of 16065 * 512 = 8225280 bytes
Sector size (logical/physical): 512 bytes / 512 bytes
I/O size (minimum/optimal): 512 bytes / 512 bytes
Disk identifier: 0x00074f7d

[pythontab@pyhontab.com ~]$ sudo fdisk -l
Disk /dev/nvme0n1: 238.5 GiB, 256060514304 bytes, 500118192 sectors
Units: sectors of 1 * 512 = 512 bytes
Sector size (logical/physical): 512 bytes / 512 bytes
I/O size (minimum/optimal): 512 bytes / 512 bytes
Disklabel type: dos
Disk identifier: 0xad91c214
......
```



也可以使用第三方工具判断，比如smartctl，这些工具的结果展示比较直观，但是需要单独安装。



原文：[Linux下判断磁盘是SSD还是HDD的3种方法](https://www.pythontab.com/html/2018/linuxkaiyuan_0507/1288.html)
