---
title: sshpass-非交互式密码验证
date: 2018-07-18 23:13:24
categories: Linux工具
tags:
  - sshpass
---

远程登陆用到的最多的命令应该就是“ssh”，但是“ssh”有些不足的地方，最显著的就是，ssh 需要交互，即：设备有密码时会让你输入密码登陆（除非设key）。这让一些以ssh为基础的命令用起来显得不那么方便，比如：

- Mac中利用 shuttle + iterm2 远程登陆某主机。
- Linux系统中scp-远程拷贝。

sshpass 是携带密码的一种工具，完全可解决上述问题。

## 安装

```shell
# yum install -y sshpass  //以 centos 为例
```

## 参数

```
# sshpass -h 
Usage: sshpass [-f|-d|-p|-e] [-hV] command parameters
   -f filename   从文件中获取密码
   -d number     使用number作为获取密码的文件描述符
   -p password   密码作为参数传入 (安全不保证--毕竟密码明文传入)
   -e            密码从环境变量 "SSHPASS" 传入
   没有以上参数时，类似ssh，交互式输入
```

## 使用

### ssh

```shell
# sshpass -p "mypassword" ssh user@remote_host_name
```

### scp

```shell
# sshpass -p "mypassword" scp my_file user@remote_host_name
```

## 不生效？

第一次时，为啥不生效？！这就是sshpass的著名的第一次问题。

当第一次进行ssh远程时，会有一个交互询问，信息大致如下：

```
…………
Are you sure you want to continue connecting (yes/no)?
```

因此需要通过增加参数来让ssh自动添加到已知主机文件中以避免询问。

增加参数后格式如下

```shell
# ssh -o StrictHostKeyChecking=no user@127.0.0.1
```

scp 这种咋办呢？

直接更改ssh配置文件——在`/etc/ssh/ssh_config` 中增加 `StrictHostKeyChecking no`。