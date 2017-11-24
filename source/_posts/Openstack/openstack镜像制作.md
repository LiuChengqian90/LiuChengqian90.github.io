---
title: openstack镜像制作
date: 2017-11-09 14:48:37
categories: openstack
tags:
  - openstack
  - 镜像
---

本文介绍如何将一个iso镜像制作为openstack启动镜像。iso镜像以 CentOS-6.9-i386-minimal.iso 为例，其他centos镜像可去[官网](https://www.centos.org/download/)下载。 

## 环境准备

制作环境为物理机或虚拟机，但需要需要cpu支持intel VT等硬件虚拟化功能。最好与制作镜像系统的系统，版本可不一样，这个非硬性要求，凭个人习惯。

判断是否支持虚拟化功能命令为：

```shell
# cat /proc/cpuinfo | egrep 'vmx|svm'
```

### 安装必要软件

```shell
# yum install -y libvirt qemu-kvm virt-install bridge-utils qemu-img virt-manager libguestfs
```

### 启动虚拟环境

```shell
# systemctl start libvirtd
```

## 制作镜像

### 创建虚拟机

#### 分配虚拟空间

```shell
# qemu-img create -f raw centOS-6.9.raw 10G
```

#### 启动虚拟机

```shell
# virt-install --virt-type kvm --name centos-6.9 --memory 2048 --vcpus=2 --disk centOS-6.9.raw,format=raw --graphics vnc,listen=0.0.0.0 --noautoconsole --os-type=linux --os-variant=rhel6 --cdrom=CentOS-6.9-i386-minimal.iso
```

参数可能因命令版本不同而不一致。

如果需要联网，那么需要配置网络，例如：

```shell
--network network=default
```

具体网络类型及设置请参考命令帮助。

#### 安装系统

使用vnc登入机器，按照正常的步骤安装系统。vnc的ip为宿主机的ip，端口可以ps找到，默认是5900，可以利用

```shell
# virsh vncdisplay centos-6.9
```

查询vnc id，然后利用vnc图形化软件（vncviewer）登录。镜像会自动进行初始化操作，之后会reboot，这时候需start才能再次链接到vnc图形化软件。

```shell
# virsh start centos-6.9
```

也可以使用virsh从命令行进行安装，部分操作如下：

```shell
查看当前虚机 
# virsh list [--all] 
使用virsh从console登入机器 
# virsh console centos-6.9
启动虚拟机
# virsh start centos-6.9
查看vnc端口
# virsh vncdisplay centos-6.9
```

最好使用图形化软件，命令行进入会有些问题。

注意：再次启动报错 “ERROR    Guest name 'centos-6.9' is already in use.” 时执行

```shell
# virsh undefine centos-6.9
```

```
也可以利用 qemu-system-x86_64 或 qemu-kvm 启动
/usr/libexec/qemu-kvm
```

### 虚拟机初始化

如果虚拟机可以联网，则直接使用默认软件源。

#### 安装基础包

```shell
安装NetworkManager，用于网卡的自动发现及管理
安装acpid，用于虚拟机的电源管理
安装epel-release，添加epel源
 
# yum install -y NetworkManager acpid epel-release
 
开机启动服务
# chkconfig acpid on
# chkconfig NetworkManager on
```

#### cloudinit安装

```shell
安装cloud-init，用于注入密码/密钥和主机名
安装qemu-guest-agent，用于在面板更新密码/密钥
安装cloud-utils，用于更改虚拟机根分区大小（可选安装，需要启用epel源）
 
# yum install -y cloud-init qemu-guest-agent cloud-utils
 
开机启动服务（有的linux发行版默认不开机自启这些服务，需要手动设置开机自启）
# chkconfig cloud-init on
# chkconfig cloud-init-local on
# chkconfig cloud-config on
# chkconfig cloud-final on
# chkconfig qemu-ga on    CENTOS7 为qemu-guest-agent
```

/etc/cloud/cloud-init.conf可能需要进行适当修改。

### 其他设置

- ssh开启启动并修改配置，使其可以密码登录（PermitEmptyPasswords 为 yes）及使用root登录（PermitRootLogin 为yes）。

  ```shell
  # chkconfig sshd on
  ```

- 为保证实例能够访问neutron metadata服务，需要禁用zero conf

  ```shell
  # echo "NOZEROCONF=yes" >> /etc/sysconfig/network
  ```

- 关闭开启启动服务

  ```shell
  # chkconfig iptables off
  # chkconfig iptables6 off
  # chkconfig postfix off
  ```

- 关闭selinux

  ```shell
  # sed -i 's/=enforcing/=disabled/g' /etc/selinux/config
  ```

之后关机

```shell
# proeroff
```

### 最后处理

- 清理虚拟机登陆及日志信息等

  ```shell
  # virt-sysprep -d centos-6.9
  ```

- undefine虚拟机

  ```shell
  # virsh undefine centos-6.9
  ```

- 转换和压缩镜像

  ```
  virt-sparsify --convert qcow2 --compress centos-6.9.raw centos-6.9.qcow2
  ```

之后即可上传使用。