---
title: Centos更换yum源为163源
date: 2021-03-15 11:57:52
categories: 杂谈
tags:
  - Centos
  - yum
---

此教程适用如下架构

- i386
- x86_64
- SRPMS



**使用说明**

首先备份/etc/yum.repos.d/CentOS-Base.repo

```shell
mv /etc/yum.repos.d/CentOS-Base.repo /etc/yum.repos.d/CentOS-Base.repo.backup
```



不同的系统下载不同的yum源

```shell
// centos7
wget http://mirrors.163.com/.help/CentOS7-Base-163.repo

// centos6
wget http://mirrors.163.com/.help/CentOS6-Base-163.repo

// centos5
wget http://mirrors.163.com/.help/CentOS5-Base-163.repo
```



生成缓存

```shell
yum clean all
yum makecache
```



**参考**

[CentOS镜像使用帮助](http://mirrors.163.com/.help/centos.html)
