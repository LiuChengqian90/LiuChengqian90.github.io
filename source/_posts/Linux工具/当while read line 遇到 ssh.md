---
title: 当while read line 遇到 ssh
date: 2022-01-15 15:57:52
categories: Linux工具
tags:
  - ssh
  - while
---

在实际工作中，有时会利用while + ssh 远程到多个server执行命令的需求，但是写shell时发现，脚本只能执行一次循环

```shell
#!/bin/sh
while read line
do
    echo "${line} start"
    ssh line 'lscpu'
    echo "${line} end"
done < $1
```

**原因：** read 从stdin读取数据，'<' 将文件重定向到stdin。而不幸的是，脚本试图运行的命令(ssh)也读取stdin，因此它最终会吃掉文件的其余部分。



**解决方案**

```shell
#!/bin/sh

while read -u10 line
do
    echo "${line} start"
    ssh liuchengqian@$line 'lscpu'
    echo "${line} end"
done 10< $1
```



参考，[Using while loop to ssh to multiple servers](https://unix.stackexchange.com/questions/107800/using-while-loop-to-ssh-to-multiple-servers)
