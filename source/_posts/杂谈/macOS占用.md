---
title: 已被macOS使用，不能打开—解决方法
date: 2021-01-11 09:57:52
categories: 杂谈
tags:
  - MAC
---

macOS 里往 NTFS 格式的移动硬盘拷贝文件，打开时有可能会出现 ”已被macOS使用，不能打开“的问题。

<!--more-->

利用SHELL "ls -al" 查看文件发现有"@"标志（带有扩展属性）



利用 xattr 命令(`xattr -l $filename`)查看扩展属性 ，确认是否有 ”com.apple.FinderInfo“ 属性，其内容为 ”brokMACS“。有的话，利用xattr删除即可，`xattr -d $filename`。
