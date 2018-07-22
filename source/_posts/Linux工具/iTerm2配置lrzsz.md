---
title: iTerm2配置lrzsz
date: 2018-07-22 20:37:41
categories: Linux工具
tags:
  - lrzsz
  - iTerm2
---

Mac原生的终端支持的操作太少，应该不少人都换成了iTerm2，关于iTerm2的好处，请点击[这里](https://www.zhihu.com/question/27447370)。

但是，利用iTerm2远程设备，需要与本机传输文件时，如果不配置`lrzsz`，即使远程设备安装了`lrzsz`，此功能也无法使用。

## 安装

1. homebrew

   brew 是Mac中比较好用的包管理工具（类似Centos中的yum）。

   ```shell
   # ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"
   ```

2. lrzsz

   ```shell
   # brew install lrzsz
   ```

## 配置

1. 正确的位置

   ```shell
   # cd ／usr/loal/bin
   ```

2. 需要的文件

   此处用到两个脚本 `iterm2-recv-zmodem.sh`和`iterm2-send-zmodem.sh`。

   - 比较方便的办法是借用github下载单个文件的[工具](https://minhaskamal.github.io/DownGit/#/home)直接从[github](https://github.com/mmastrac/iterm2-zmodem)下载。
   - 自己创建两个文件，把内容贴过去。

3. 给文件添加权限

   ```shell
   # chmod +x *zmodem.sh
   ```

4. 打开iTerm2 -> Preferences -> Profiles -> Advanced -> Triggers ，点击 Edit，并进行如下配置

   ![Mac_trigger](/images/others/Mac_trigger.png)

   ```shell
   Regular expression: \*\*B0100
   Action: Run Silent Coprocess
   Parameters: /usr/local/bin/iterm2-send-zmodem.sh
   
   Regular expression: \*\*B00000000000000
   Action: Run Silent Coprocess
   Parameters: /usr/local/bin/iterm2-recv-zmodem.sh
   ```

   至此，配置完成（可重启iTerm2使用）。