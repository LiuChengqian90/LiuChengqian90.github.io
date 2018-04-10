---
title: 进程监控之daemontools
date: 2018-04-08 10:24:29
categories: Linux工具
tags:
  - supervise
  - svscan
---

## 简介

supervise是一种进程监控工具，其功能是当监控的指定进程消亡时，重启进程。

supervise在Daemontools工具包中。Daemontools是一个包含了很多管理Unix服务的工具的软件包，supervise是其中的核心工具。

启用supervise监控服务比较容易，只需要添加一个被监控的服务的**目录**，在该目录中添加启动服务器的名字为run的脚本文件即可。supervise调用这个脚本，并监控管理该脚本中运行的程序。 

```shell
#supervise Path
```

supervisor是所有监控项目的父进程。

Daemontools工具包中有一个svscan工具，此工具是为指定的工作目录(缺省是/service/目录)下的所有子目录中的每一个子目录都启动一个supervise进程，最多可以启动多达1000个supervise进程(也就是工作目录下可以有多达1000个子目录)。其中每个子目录下都会有一个名为run的用来启动对应服务的脚本程序。Supervise会监控该服务，在服务消亡时使用run脚本来自动启动该服务。若svscan的工作目录下的子目录的sticky位被置位，则svscan将为该子目录启动两个supervise进程，一个监控子目录中的run对应的服务，另外一个监控子目录下的log子目录的记录服务，两者之间通过管道来相互联系。

Svscan每5秒钟检测一次子目录，若出现新的目录则为该目录启动supervise，若某个老的子目录对应的supervise退出，则重新启动它。

## 安装

参考[官网教程](https://cr.yp.to/daemontools/install.html)。

```shell
# mkdir -p /package
# chmod 1755 /package		//设置粘贴位
# cd /package
# wget  https://cr.yp.to/daemontools/daemontools-0.76.tar.gz
# tar zxvf daemontools-0.76.tar.gz
# cd admin/daemontools-0.76/
# package/install
```

若上一步出错，错误信息如下：

```shell
Linking ./src/* into ./compile...
Compiling everything in ./compile...
./load envdir unix.a byte.a 
/usr/bin/ld: errno: TLS definition in /lib64/libc.so.6 section .tbss mismatches non-TLS reference in envdir.o
/lib64/libc.so.6: error adding symbols: Bad value
collect2: error: ld returned 1 exit status
make: *** [envdir] Error 1
```

则编辑src/conf-cc, 加gcc加上`-include /usr/include/errno.h` 使用标准错误即可。

验证安装：

```shell
# cat /etc/inittab 	//查看是否有svscanboot
```

![initab文件](/images/进程监控之daemontools/initab文件.png)

## supervise

1. 测试程序

   ```c
   #include <stdio.h>
   #include <stdlib.h>
   int main()
   {
           while(1)
           {
               printf("in process\n");
               sleep(1);
           }
           return 0;
   }
   ```

   将以上代码进行编译

   ```shell
   # gcc -o test test.c
   ```

2. 在test目录下编写脚本`run`，并设置可执行权限。启动

   ```shell
   # cat run
   #!/bin/sh
   echo "start test!"
   exec ./test
   ```

3. 启动

   ```shell
   # supervise test 
   ```

   查看程序是否正常运行，如果错误信息类似

   ```shell
   # supervise: fatal: unable to start test/run: exec format error
   ```

   其原因为 `未在run文件中加入"#!/bin/sh"或格式不对`。

   一般服务器运行的程序会将其挂起，如下

   ```shell
   # nohup supervise test/  > /dev/null 2>&1 & //nohup,no hang up
   ```

4. 检查`test`运行情况并kill掉，重新检查。

   ![reboottest](/images/进程监控之daemontools/reboottest.png)




文件详情 （lock、status、svcontrol），

http://wiki.baidu.com/pages/viewpage.action?pageId=333843536

http://wiki.baidu.com/pages/viewpage.action?pageId=106396753

## svscan



   ## 优秀资料

[supervise进程管理利器](https://blog.csdn.net/u012373815/article/details/70217030)

[进程的守护神 - daemontools](http://linbo.github.io/2013/02/24/daemontools)

[用Daemontools监控Linux服务](http://naixwf.github.io/2015/07/21/2014-11-19-daemontools/)

https://untroubled.org/daemontools-encore/svscan.8.html#toc