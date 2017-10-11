---
title: Centos 升级内核
date: 2017-10-04 22:20:32
tags:
  - Centos
  - 内核升级
---

Linux 只是个内核。在正常操作期间，内核负责执行两个重要任务：

1. 作为硬件和系统上运行的软件之间的接口。
2. 尽可能高效地管理系统资源。

为此，内核通过内置的驱动程序或以后可作为模块安装的驱动程序与硬件通信。

随着新的设备和技术定期出来，如果我们想充分利用它们，保持最新的内核就很重要。此外，更新内核将帮助我们利用新的内核函数，并保护自己免受先前版本中发现的漏洞的攻击。

## 包管理工具升级

### 检查已安装的内核版本

让我们安装了一个发行版，它包含了一个特定版本的内核。为了展示当前系统中已安装的版本，我们可以：

```shell
# uname -sr
```

```c
s 打印出内核名；
r 打印出内核release版本;
```

[Linux官网](https://www.kernel.org)可看到当前最新的内核版本。如果你当前使用的版本接近它的生命周期结束，那么在该日期后将不会提供更多的 bug 修复。关于更多信息，请参阅[内核发布](https://www.kernel.org/category/releases.html)页。

### 在 CentOS 中升级内核

大多数现代发行版提供了一种使用 [yum 等包管理系统](http://www.tecmint.com/20-linux-yum-yellowdog-updater-modified-commands-for-package-mangement/)和官方支持的仓库升级内核的方法。这会使内核升级到仓库中可用的最新版本，而非官网中可用的最新版本。不幸的是，Red Hat 只允许使用前者升级内核。

与 Red Hat 不同，CentOS 允许使用 ELRepo，这是一个第三方仓库，可以将内核升级到最新版本。要在 CentOS 7 上启用 ELRepo 仓库，请运行：

```shell
# rpm --import https://www.elrepo.org/RPM-GPG-KEY-elrepo.org
# rpm -Uvh http://www.elrepo.org/elrepo-release-7.0-2.el7.elrepo.noarch.rpm
```

```c
此方法基于ELRepo项目，因此需要导入此项目的KEY;
release-7.0 是指 centos7 或 RH7，具体可参考 http://www.elrepo.org。
```

仓库启用后，你可以使用下面的命令列出可用的内核相关包：

```shell
# yum --disablerepo="*" --enablerepo="elrepo-kernel" list available
```

```c
禁用ELRepo项目中所有存储库，之后使能名为“elrepo-kernel”的存储库。
其他存储库有“elrepo-extras”、“elrepo-testing”。
```

接下来，安装最新的主线稳定内核：

```shell
# yum --enablerepo=elrepo-kernel install kernel-ml
```

```c
kernel-ml 指 Linux mainline（主线）分支；
kernel-lt 指 Linux longterm（长期维护）分支；
```

最后，重启机器并选择最新内核，接着运行下面的命令检查最新内核版本：

```shell
# uname -sr
```

### 设置 GRUB 默认的内核版本

打开并编辑 /etc/default/grub 并设置 GRUB_DEFAULT=0。意思是 GRUB 初始化页面的第一个内核将作为默认内核。

```c
GRUB_TIMEOUT=5
GRUB_DISTRIBUTOR="$(sed 's, release .*$,,g' /etc/system-release)"
GRUB_DEFAULT=0
GRUB_DISABLE_SUBMENU=true
GRUB_TERMINAL_OUTPUT="console"
GRUB_CMDLINE_LINUX="crashkernel=auto rd.lvm.lv=cl/root rd.lvm.lv=cl/swap rhgb quiet"
GRUB_DISABLE_RECOVERY="true"
```

接下来运行命令来重新创建内核配置：

```shell
# grub2-mkconfig -o /boot/grub2/grub.cfg
```

重启并验证最新的内核已作为默认内核。

## 源码升级

### 检查已安装的内核版本

```shell
# uname -sr
```

### 下载内核包并解压

```shell
# wget -c http://www.kernel.org/pub/linux/kernel/v3.0/linux-3.2.2.tar.bz2
# tar jxvf  linux-3.2.2.tar.bz2
# cd linux-3.2.2
```

### 配置内核并安装

#### 清除环境变量

```shell
# make mrproper
```

删除所有的编译生成文件， 还有内核配置文件， 再加上各种备份文件。或者仅仅使用

```shell
 # make clean
```

删除大多数的编译生成文件， 但是会保留内核的配置文件.config， 还有足够的编译支持来建立扩展模块。

#### 编译配置表

配置时，以下方式选其一即可。

##### 当前系统拷贝

选取/boot/config-XXX文件，拷贝到代码目录。

```shell
# cp /boot/config-3.10.0-693.2.2.el7.x86_64  .config
```

##### defconfig命令

```shell
# make defconfig
```

获取当前系统参数并写入.config文件。之后可使用“make menuconfig”进行定制化。

##### 问答式配置

```shell
# make localmodconfig
```

可一直回车选择默认配置。

##### 命令界面配置

```shell
# make oldconfig
```

自动载入既有的.config配置文件，并且只有在遇到先前没有设定过的选项时，才会要求手动设定。

##### 交互模式

```shell
# make menuconfig
```

找到以下选中选项并选中networking support → networking options → network packet filtering framework(netfilter)

1. Core netfilter configuration
   - 勾中”Netfilter connection tracking support” -m state相关模块是依赖它的，不选则没有。
   - 将netbios name service protocal support(new) 编译成模块,不然后面升级iptables后启动时会出错。
   - 勾中“Netfilter Xtables support (required for ip_tables)”
2. IP: Netfilter Configuration
   - 将 “IPv4 connection tracking support (require for NAT)” 编译成模块。
   - 勾中IP tables support (required for filtering/masq/NAT) 。
   - 将 “Full NAT” 下的 “MASQUERADE target support” 和 “REDIRECT target support” 编译成模块
3. 其它模块可以根据自己的需要进行选择,若不懂可以参考内核配置手册。

#### 编译内核

生成内核文件

```shell
# make bzImage
```

编译模块

```shell
# make modules
```

或者直接 make 。 make = make bzImage + make modules。

安装模块

```shell
# make modules_install
```

安装内核

```shell
 # make install
```

此步会：

- 重新制作内核映像文件，mkinitramfs -o /boot/initrd.img-XXX
- 更新制作的内核映像文件，update-initramfs -c -k XXX
- 自动修改系统引导配置，产生或更新boot/grub/grub.cfg启动文件，文件中增加了新内核版本号的启动项，update-grub2

之后重启即可。

重启之后内核未改变，则编辑 /etc/grub.conf 文件，将 default=1 改为 default=0。

## 内核包(YUM)升级

### 获取源

从下面三个地址从获取想要的内核：

1. [官方源](http://elrepo.reloumirrors.net/kernel/el7/x86_64/RPMS/)
2. [香港源](http://hkg.mirror.rackspace.com/elrepo/kernel/el7/x86_64/RPMS/)
3. [scientific源](http://ftp.scientificlinux.org)，根据需要选择不同的源，例如，http://ftp.scientificlinux.org/linux/scientific/7.0/x86_64/updates/security/。

### 安装

可下载到本地或者直接在线安装：

```shell
# yum install -y http://hkg.mirror.rackspace.com/elrepo/kernel/el7/x86_64/RPMS/kernel-ml-4.5.2-1.el7.elrepo.x86_64.rpm
```

### 修改文件

升级完内核，自动按最新内核启动，修改/etc/default/grub，GRUB_DEFAULT=0。

重新编译内核启动文件，以后升级完内核也要执行一次。

```shell
# grub2-mkconfig -o /boot/grub2/grub.cfg
```

## 删除旧内核

1. 列出当前所用内核

   ```shell
   # uname -sr
   ```

2. 列出系统所有内核

   ```shell
   # rpm -qa | grep kernel
   ```

   Debian/ Ubuntu Linux 用户，使用：

   ```shell
   # dpkg --list 'linux-image*' 
   ```

3. 删除内核

   ```shell
   # rpm -e kernel-XXX
   ```

   或

   ```shell
   # yum autoremove kernel-XXX
   ```

   Debian/ Ubuntu Linux 用户，使用：

   ```shell
   # apt-get remove kernel-XXX
   ```


## 参考资料

[Debian、CentOS 升级内核至当前最新稳定版](https://blog.janfou.com/technical-documents/10485.html)

[如何在 CentOS 7 中安装或升级最新的内核](https://linux.cn/article-8310-1.html)

[CentOS Linux 升级内核步骤、方法](https://linux.cn/article-296-1-rel.html)

[安全删除linux旧内核的方法](http://blog.csdn.net/caryaliu/article/details/7038377)