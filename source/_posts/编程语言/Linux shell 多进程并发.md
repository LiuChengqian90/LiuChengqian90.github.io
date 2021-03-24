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

```
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



```

```





## 并发数量

```

```



```

```



## 参考资料

[shell脚本实现多进程并发](https://linux-sh.cn/archives/319/)

[shell脚本实现多进程](https://blog.csdn.net/yuefei169/article/details/83340480)

[shell脚本中的多进程并发处理](https://zhuanlan.zhihu.com/p/41871325)

