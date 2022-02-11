---
title: PXE装机简介
date: 2022-01-15 15:22:33
categories:
tags:
  - pxe
  - legacy
  - uefi
typora-root-url: ../../../source
---

# 什么是PXE

PXE（ `Preboot Execution Environment`，预启动执行环境）是由Intel设计的一种网络协议，可使计算机通过网络启动安装系统，同时也是一种使用网络接口启动计算机的机制，其不依赖本地数据存储设备或本地已安装的系统。协议分为**client端和server端**，PXE client在网卡的boot ROM中启动，当计算机开机引导时，BIOS把PXE client调入内存执行，并显示出命令菜单，经用户选择需要安装的系统后，PXE client将放置在远端的操作系统通过网络下载到本地运行。

<!--more-->

- 服务器，运行 DHCP服务器、TFTP 服务器从服务器提供引导文件，同时 HTTP、FTP 或者 NFS 服务器托管安装映射。
- 客户端，要安装系统的机器。安装开始时，客户端会查询 DHCP 服务器，从 TFTP 服务器中获取引导文件，并从 HTTP、FTP 或者 NFS 服务器下载安装映象。

# PXE的模式

PXE装机有legacy、UEFI两种模式，又细分为IPV4 legacy、IPV4 UEFI、IPV6 legacy、IPV6 UEFI。

## Legacy模式

传统的引导模式，Legacy引导模式对系统的兼容性比较好，支持32位、64位系统。

Legacy模式使用MBR磁盘格式，它的特点：

- **系统只能安装在MBR格式磁盘上**；
- 只支持最多4个主分区；
- 不支持2TB以上的硬盘；
- 在单一的MBR 中只能存储一个操作系统的引导记录。

> Legacy BIOS 最早来自IBM，当时各个厂商都想用自己的标准，这也导致它封闭，神秘，充满各种坑爹预设和祖传代码，也就微软这样的大厂才能勉强统一接口，这也是Legacy将被取代的重要原因。 



## UEFI模式

目前主流的引导模式，相较于Legacy， UEFI的可编程性更好，可扩展性更好，性能更高，安全性更高。UEFI模式使用GPT磁盘格式（GUID分区表），它的特点：

- **系统只能安装在GPT格式磁盘上**；
- GPT支持最多128个分区；
- GPT突破2TB限制，支持最高18EB；
- UEFI提供安全引导功能，防止病毒在引导时加载；
- UEFI BIOS图形界面更直观，交互性更强，支持鼠标操作和多国语言；
- 开机时没有自检环节，启动速度可以快一点。



# 启动过程

以legacy引导模式为例，其启动过程需要几个文件：

- `pxelinux.0`：计算机自展引导程序(bootstrap),负责系统引导和启动，作用类似于BIOS，会调用PXE相关配置文件
- `pxelinux.cfg`：文件夹，存放PXE配置文件
-  `vmlinuz`： linux的内核文件，可以被引导程序加载，从而启动Linux系统
- `initrd.img`：boot loader initialized RAM disk的缩写，作为根文件系统加载各种模块、驱动、服务等，网卡驱动就包含在该文件中。



具体启动过程如下

1. 客户端(Client)的BIOS支持网卡启动，且网卡具有PXE `ROM`芯片
2. 服务端(PXE Server)至少有 `dhcp`，`tftp`，`nfs`服务且为开启状态；
3. BIOS通过PXE Client调入内存执行
4. 客户机向网络中请求DHCP服务器获取动态IP
5. DHCP服务器下发IP、引导文件位置、TFTP服务器地址
6. 客户端向tftp.server请求`bootstrap`文件，tftp.server收到请求向客户端发送bootstrap文件 -->`pxelinux.0`
7. 客户端收到pxelinux.0文件后执行文件
8. 根据执行文件向tftp.server请求pxelinux.0的配置文件pxelinux.cfg（tftpboot/pxelinux.cfg/default，配置文件包含vmlinux、initrd.img、ks文件位置信息）
9. 客户机读取`default`文件，等待用户选择安装系统后，客户端向tftp.server发出提供内核文件`vmlinuz`和根文件系统`initrd.img`请求
10. tftp.server收到客户端请求，提供vmlinuz和initrd.img
11. 客户端收到文件，启动内核映像文件，内核挂载initrd.img，并执行挂载各种各样的模块。



> 题外话
>
> 由于PXE仅支持tftp协议，仅支持tftp传输数据，性能差，灵活性也差，于是有了gpxe这个项目。
>
> gpxe是一种兼容pxe的实现，并且在pxe之上增加了许多特性，例如通过http/ftp等协议传输数据。
>
> gpxe原先使用的域名的拥有者突然收回了该域名的使用权，于是这些人fork出去做了ipxe，gpxe现在已经不再开发，ipxe开发非常活跃。
>
> 具体可以参考 https://groups.google.com/g/ustc_lug/c/P2jOQ5F4EKY?pli=1



# 参考

[PXE的部署过程](https://www.jianshu.com/p/6a44b0a6b87b)

[系统启动方式：Legacy、UEFI和Legacy and UEFI](https://www.bilibili.com/read/cv6107167)

[BIOS and UEFI Co-Existence](https://wiki.fogproject.org/wiki/index.php/BIOS_and_UEFI_Co-Existence)

[PXE Boot Arch Field DHCP Option 93](https://stackoverflow.com/questions/58921055/pxe-boot-arch-field-dhcp-option-93)

[How-to: Configure a DHCP switch for UEFI and non-UEFI boot](https://help.univention.com/t/how-to-configure-a-dhcp-switch-for-uefi-and-non-uefi-boot/9931)

[How to set up PXE boot for UEFI hardware](https://www.redhat.com/sysadmin/pxe-boot-uefi)

[PXE Booting with WDS for UEFI and BIOS Devices](https://gal.vin/posts/old/pxe-booting-for-uefi-bios/)

[PXEClient, dhcp options 60, 66 and 67, what are they for? Can I use PXE without it ?](https://www.experts-exchange.com/articles/2978/PXEClient-dhcp-options-60-66-and-67-what-are-they-for-Can-I-use-PXE-without-it.html)

[PXE 网络安装 CentOS 7](https://www.cxybb.com/article/Future_promise/108287038)

[原先的 PXE 引导中，两阶段的 PXELINUX 的区别，以及 iPXE 的用途？](https://groups.google.com/g/ustc_lug/c/P2jOQ5F4EKY?pli=1)
