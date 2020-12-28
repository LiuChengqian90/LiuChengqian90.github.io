---
title: NetworkManager编译
date: 2020-12-23 19:57:52
categories:
tags:
  - tag
---

<!--more-->



## 环境

```shell
# cat /etc/redhat-release
CentOS Linux release 8.2.2004 (Core)
# uname -sr
Linux 4.18.0-193.28.1.el8_2.x86_64
```



## 源码

```sh
# git clone https://gitlab.freedesktop.org/NetworkManager/NetworkManager.git
```



## 遇到的问题

1. **gtkdocize: command not found**

   从[rpmfind](https://rpmfind.net/linux/rpm2html/search.php?query=gtk-doc)下载gtk-doc rpm 安装

   ```shell
   # rpm -i gtk-doc-1.28-2.el8.x86_64.rpm --force --nodeps
   ```

   或者直接yum install (此种方式我未成功，提示找不到资源)

   ```shell
   # yum install -y gtk-doc-tools
   ```

2. **autopoint: command not found**

   ```shell
   # yum install -y gettext-devel
   ```

3. **Can't exec "intltoolize": No such file or directory at /usr/share/autoconf/Autom4te/FileUtils.pm line 345.**

   ```shell
   # yum install -y intltool
   ```

4. **Libtool library used but 'LIBTOOL' is undefined**

   ```shell
   # yum install -y libtool
   ```

5. **introspection enabled but can't be used**

   ```shell
   # ./autogen.sh --enable-introspection=no
   ```

6.  **Package requirements (libudev >= 175) were not met**

   ```shell
   # yum install -y libudev-devel
   ```

7. **Package nss was not found in the pkg-config search path.**

   ```shell
   # yum install -y nss-devel
   ```

8. **couldn't find pppd.h. pppd development headers are required**

   ```shell
   # rpm -i ppp-devel-2.4.7-26.el8_1.x86_64.rpm --force --nodeps
   ```

