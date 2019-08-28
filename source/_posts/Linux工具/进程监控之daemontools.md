---
title: 进程监控之daemontools
date: 2018-04-08 10:24:29
categories: Linux工具
tags:
  - supervise
  - svscan
typora-root-url: ../../../source
---

## 简介

Daemontools是svscanboot，svscan，supervise，svc，svok，svstat等一系列工具的合集。其中，`supervise`是其中的核心工具。

对于使用Daemontools的优点可以参考[Service creation](http://cr.yp.to/daemontools/faq/create.html#why)。

## 安装

参考[官网教程](https://cr.yp.to/daemontools.html) 及 [Linux命令帮助](https://linux.cn/man/man8/svscanboot.8.html)。

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

则编辑src/conf-cc，加gcc加上`-include /usr/include/errno.h` 使用标准错误即可。

验证安装：

```shell
# cat /etc/inittab 	//查看是否有svscanboot，需重启以启动svscan
```

![initab文件](/images/进程监控之daemontools/initab文件.png)

## svscanboot

`svscanboot`是`svscan`的开机启动程序。

有几种不同的方式来运行`svscanboot`命令，启动`svscan`。unix / linux发行版继续使用它们的启动系统，打破了与现有启动脚本的兼容性。

### /etc/rc.local

将下行加入文件`/etc/rc.local`。

```shell
csh -cf '/command/svscanboot &'
```

这是传统的方法。

### /etc/inittab

将下行加入文件`/etc/inittab`。

```shell
SV:12345:respawn:/command/svscanboot
```

这是传统的System V方法，并且几乎在Linux系统中得到普遍支持多年，但被Ubuntu 6.10所破坏。

### /etc/event.d version 1

将以下几行加入文件`/etc/event.d/svscan`。

```shell
start on runlevel-1
start on runlevel-2
start on runlevel-3
start on runlevel-4
start on runlevel-5
respawn /command/svscanboot
```

Ubuntu 6.10以下版本可用。

### /etc/event.d version 2

将以下几行加入文件`/etc/event.d/svscan`。

```shell
start on runlevel 1
start on runlevel 2
start on runlevel 3
start on runlevel 4
start on runlevel 5
respawn
exec /command/svscanboot
```

Ubuntu 7.04 到 9.04 可用。

### /etc/init

将以下几行加入文件`/etc/init/svscan.conf`。

```shell
start on runlevel [12345]
stop on runlevel [^12345]
respawn
exec /command/svscanboot
```

Ubuntu 9.10 到 (至少) 11.10 之间可用。

## svscan

`svscan`启动并监视一组服务。

`svscan`为当前目录的每个子目录启动一个监控进程，最多可达1000个子目录。`svscan`跳过以点开始的子目录名称。监控必须在`svscan`的path上。

每个子目录下都会有一个名为`run`的用来启动对应服务的脚本程序。`supervise`会监控该服务，在服务消亡时使用`run`脚本来自动启动该服务。

`svscan`可以选择启动**一对**监控进程，一个用于子目录`s`，一个用于`s/log`，并在它们之间建立一个管道。如果`s`最长为255个字节并且`s/log`存在，它会执行此操作。（在版本0.70和更低版本中，如果粘滞位（sticky bit）被置位，它会执行此操作。）`svscan`的每个管道需要两个空闲的文件描述符。

每隔5秒钟，`svscan`再次检查子目录。如果它看到一个新的子目录，它会启动一个新的监控过程。如果它看到监控进程退出的旧子目录，则重新启动监控进程。在日志情况下，它重新使用相同的管道，以避免数据丢失。

`svscan`被设计为永远运行。如果在创建管道或运行监督时遇到困难，则会向stderr发送消息;它会在五秒钟后再试一次。

如果`svscan`被赋予一个命令行参数，它将在启动时切换到该目录。

### 测试

1. 目录创建

   ```shell
   # cd /root
   # mkdir services;
   # cd services;
   # mkdir test1 test2;
   ```

2. 程序创建

   ```shell
   # cd test1;
   ```

   创建`test1.c`文件，代码如下：

   ```c
   #include <stdio.h>
   #include <stdlib.h>
   int main()
   {
           while(1)
           {
               printf("in process test 1\n");
               sleep(1);
           }
           return 0;
   }
   ```

   编译

   ```shell
   # gcc -o test1 test1.c
   ```

3. 创建**可执行**文件`run`（chmod +x run）

   ```shell
   #!/bin/sh
   echo "start test 1 !"
   exec ./test1
   ```

4. test2中文件类似test1中创建。

5. `svscan`运行。

   ```shell
   # svscan /root/services
   ```

## supervise

`supervise`是一种进程监控工具，其功能是当监控的指定进程消亡时，重启进程。

启用`supervise`监控服务比较容易，只需要添加一个被监控的服务的**目录**，在该目录中添加启动服务器的名字为run的脚本文件即可。`supervise`调用这个脚本，并监控管理该脚本中运行的程序。 

```shell
#supervise s
```

`supervisor`是所有监控项目的父进程。

监控切换到名为`s`的目录并启动`./run`。如果`./run`退出，它会重新启动`./run`。它在启动`./run`后暂停一秒，以便在`./run`立即退出时不会太快地循环。

如果文件`s/down`存在，则监督不会立即开始`./run`。你可以使用`svc`来启动`./run`并提供其他命令来监控。

监控维护目录`s/supervise`中的二进制格式的状态信息，该目录必须是可写的，以便监控。状态信息可以通过`svstat`读取。

如果启动后监控无法找到它需要的文件，或者监控的另一个副本已经在`s`中运行，它可能立即退出。一旦监控成功运行，它不会退出，除非它被杀死或被特别要求退出。

**可以使用`svok`来检查监督是否成功运行。也可以使用`svscan`来可靠地启动一系列监控进程。**

### 工具原理

`supervise`启动的时候fork一个子进程，子进程执行execvp系统调用，将自己替换成执行的模块。

模块变成`supervise`的子进程运行，而`supervise`则死循环运行，并通过waitpid或者wait3系统调用选择非阻塞的方式去侦听子进程的运行情况。同时也会读取pipe文件svcontrol的命令，然后根据命令去执行不同的动作。

如果子进程因某种原因导致退出，则`supervise`通过waitpid或者wait3获知，并继续启动模块，如果模块异常导致无法启动，则会使`supervise`陷入死循环，不断的启动模块。

### 测试（直接使用svscan测试程序）

可直接使用`svscan`测试程序。

```shell
# supervise test1 
```

`test1`为目录。一般服务器运行的程序会将其挂起，如下

```shell
# nohup supervise test/  > /dev/null 2>&1 & //nohup,no hang up
```

### 使用的文件

`supervise`会在服务目录下创建名为`supervise`的目录，同时`supervise`目录下会有4个文件，分别为`control  lock  ok  status`，对应的功能和我们可以从中获取的信息如下

- control

  - 可以理解为一个控制接口，supervise读取这个管道的信息，进而根据管道的信息去控制子进程，而通过控制子进程的方式实际上就是给子进程发信号。
  - 可以利用的信息：直接写命令到该文件中，如echo 'd' > svcontorl，让supervise去控制子进程，比较常用的命令如下
    - d: **停掉子进程**，并且不启动。
    - u: 相对于d，**启动子进程**。
    - k: 发送一个kill信号，因kill之后supervise马上又**重启**，因此可以认为是一个重启的动作。
    - x: 标志supervise退出。

- lock

  - supervise的文件锁，通过该文件锁去控制并发，防止同一个status目录下启动多个进程，造成混乱。
  - 可以通过/sbin/fuser这个命令去获取lock文件的使用信息，如果fuser返回值为0，表示supervise已经启动,同时fuser返回了**supervise的进程pid**。

- ok

  - 通过此文件判断supervise进程状态。

- status

  - supervise用来记录一些信息之用，可以简单的理解为 char status[20]，其中status[16]记录了supervise所启动的子进程的pid，status[17]-status[19] 是子进程pid别右移8位，而status[0]-status[11] 没有用，status[12]-status[14] 是标志位，一般没啥用,status[15] 直接为0。

  - 可以直接通过od命令去读取该文件,一般有用的就是od -An -j16 -N2 -tu2 status可以直接拿到 supervise所负责的子进程的pid。

    如果用 od -d status 或  od -t u2 status 读取 2 字节，无符号短整型，最大值是 65535。如果 cat /proc/sys/kernel/pid_max 大于这个数。od -d status 读出来的 pid 就有可能是错的。每次右移 8 位，是想把 pid 保存成 4 字节。即从 16 - 19 共 4 个字节。正确的读取应该是 od -t u4 status，按 4 字节无符号整形读取就不会有问题了。


## svc

`svc`控制由`supervise`监控的服务。

```shell
svc opts services
```

`opts`是一系列`getopt`样式的选项。`sercies`由任意数量的参数组成，每个参数命名一个由`supervise`使用的目录。

`svc`依次将所有选项应用于每个服务。这里是选项：

- `-u`: Up。如果服务未运行，则启动。如果服务已停止，则重启。
- `-d`: Down。服务已运行，向服务发送`TERM`和`CONT`信号。停止之后，不在重启。
- `-o`: Once。服务未运行，启动。停止之后，不在重启。
- `-p`: Pause。向服务发送`STOP`信号。
- `-c`: Continue。向服务发送`CONT`信号。
- `-h`: Hangup。向服务发送`HUP`信号。
- `-a`: Alarm。向服务发送`ALRM`信号。
- `-i`: Interrupt。向服务发送`INT`信号。
- `-t`: Terminate。向服务发送`TERM`信号。
- `-k`: Kill。向服务发送`KILL`信号。
- `-x`: Exit。一旦服务关闭，`supervise`将立即退出。如果在一个稳定的系统上使用这个选项，监控可能永远运行。

### 测试

接`svscan`测试。

1. `-d` 

   ```shell
   # svc -d /root/services/test1
   ```

   `test1`停止，仅`test2`打印程序。`supervise test1`未停止。

2. `-u`

   ```shell
   # svc -u /root/services/test1
   ```

   `test1`重启。

3. `-k`

   ```shell
   # svc -k /root/services/test1
   ```

   `test1`重启。`test1`被kill之后，`supervise`会将其重启，可查看其进程号以确定。

4. `-dx`

   ```shell
   # svc -dx /root/services/test1
   ```

   退出`test1` 及 `supervise test1`进程。`svscan`监听时会将`supervise test1`重新启动。

## svok

`svok`检测`supervise`是否在运行。

```shell
# svok service
```

`svok`检查`supervise`是否在名为`service`的目录中成功运行。如果`supervise`成功运行，它将以`0`为返回值退出。如果`supervise`没有成功运行，它将以`100`为返回值退出。

## svstat

`svstat`打印由`supervise`监控的服务状态。

```shell
# svstat services
```

`services`由任意数量的参数（目录）组成。`svstat`为每个目录打印一条可视化的行，说明`supervise`是否在该目录中成功运行，并报告由`supervise`维护的状态信息。

### 测试

```shell
# svstat services/test1
services/test1: up (pid 12587) 129 seconds
# svc -d services/test1 
# svstat services/test1
services/test1: down 8 seconds, normally up
```

## fghack

`fghack`是一个`anti-backgrounding`的工具。

```shell
fghack child
```

`fghack`运行有许多额外描述符写入管道的子进程。`fghack`读取并丢弃任何写入管道的数据。在子进程退出且管道关闭后，`fghack`退出。

## pgrphack

`pgrphack`会在一个单独的进程组中运行一个程序。

```shell
pgrphack child
```




   ## 优秀资料

[supervise进程管理利器](https://blog.csdn.net/u012373815/article/details/70217030)

[进程的守护神 - daemontools](http://linbo.github.io/2013/02/24/daemontools)

[用Daemontools监控Linux服务](http://naixwf.github.io/2015/07/21/2014-11-19-daemontools/)
