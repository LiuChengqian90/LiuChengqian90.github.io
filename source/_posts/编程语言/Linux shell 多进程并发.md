---
title: Linux shell 多进程并发
date: 2021-03-24 11:24:08
categories: Linux
tags:
  - 多进程
  - shell
---



在实际编码中，要减少执行串行循环的耗时，自然要考虑如何用并行方式解决。

在bash中，使用后台任务来实现任务的“多进程化”。在不加控制的模式下，不管有多少任务，全部都后台执行。

<!--more-->

## 普通脚本

```shell
#!/bin/bash

for ip in 10.227.49.{1..254}
do
    sleep 1
    ping $ip -c 1 -w 1 &>/dev/null;
    if [ $? -eq 0 ]; then
        echo $ip is alive
    fi
done
```

执行结果如下：

```shell
# time bash single_process.sh
10.227.49.1 is alive
10.227.49.11 is alive
10.227.49.12 is alive
10.227.49.13 is alive
10.227.49.14 is alive
10.227.49.15 is alive
10.227.49.16 is alive
10.227.49.17 is alive
………………………………………………………
………………………………………………………
10.227.49.164 is alive
10.227.49.165 is alive
10.227.49.166 is alive
10.227.49.167 is alive
10.227.49.168 is alive
10.227.49.169 is alive
10.227.49.193 is alive

real	7m11.429s
user	0m0.191s
sys	0m0.241s
```

此脚本执行时间为 7m11.429s，按照顺序依次执行。



## 简单多并发

```shell
#!/bin/bash

for ip in 10.227.49.{1..254}
do
{
    sleep 1
    ping $ip -c 1 -w 1 &>/dev/null;
    if [ $? -eq 0 ]; then
        echo $ip is alive
    fi
} &

done
wait
echo "all of finished..."
```

执行看结果

```
# time bash mul_process.sh
10.227.49.1 is alive
10.227.49.13 is alive
10.227.49.11 is alive
10.227.49.12 is alive
10.227.49.15 is alive
10.227.49.14 is alive
10.227.49.16 is alive
10.227.49.17 is alive
………………………………………………………
………………………………………………………
10.227.49.166 is alive
10.227.49.168 is alive
10.227.49.164 is alive
10.227.49.169 is alive
10.227.49.165 is alive
10.227.49.167 is alive
10.227.49.193 is alive

real	1.5s
user	0m0.122s
sys	0m0.113s
```

可以看到，实际执行时间大大缩短，且乱序执行。

`wait`是等待前面所有后台程序执行完毕，可以去掉`wait`试一下（脚本退出，但是依旧在输出）。

一般在脚本中，可以把`{}`内的逻辑放到一个函数中。



## 并发数量

无数量限制地执行多进程，可能会把物理资源全部占用，因此，最好的方式是控制脚本执行的后台进程个数。

```shell
#!/bin/bash
                              //*感兴趣的请自行百度"文件描述符"和"管道文件",这里不做解释
fifo_file=/tmp/$$_fifofile    //*定义管道文件路径
mkfifo $fifo_file             //*创建管道文件
exec 54<> $fifo_file          //*打开这个管道文件
rm -rf $fifo_file             //*删除这个管道文件

for i in {1..10}              //*并发的数量10个,"seq 1 10"等同于"{1..10}",前者可以使用变量赋值
  do
    echo >&54                 //*向管道文件里丢数据
  done

for i in {1..65535}           //*定义任务数量
  do
    read -u 54                //*从管道文件里读取文件,读取到内容就向下走,读取不到就停留等待
    {
      tcping -t1 118.25.100.250 $i
    }&
    echo >&54                 //*由于管道文件的数据拿一个少一个,所以我们要把数据再还给管道文件
  done
wait                          //*等待所有后台任务执行完毕
exec 54<&-                    //*释放之前被删除的管道文件
echo "all of finished..."
```



## 参考资料

[shell脚本实现多进程并发](https://linux-sh.cn/archives/319/)

