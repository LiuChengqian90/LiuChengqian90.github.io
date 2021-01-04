---
title: DNS 服务器压测工具 queryperf
date: 2019-09-16 19:57:52
categories: Linux工具
tags:
  - dns
  - queryperf
---

在bind中，有一款自带的压力测试软件——queryperf，使用这款软件可以对DNS服务器进行简单的性能测试。

<!--more-->

## 安装

```shell
$ wget http://ftp.isc.org/isc/bind9/9.7.3/bind-9.7.3.tar.gz
$ tar xf bind-9.7.3.tar.gz
$ cd bind-9.7.3/contrib/queryperf
$ ./configure ; make
```

## 使用

queryperf格式

```shell
Usage: queryperf [-d datafile] [-s server_addr] [-p port] [-q num_queries]
                 [-b bufsize] [-t timeout] [-n] [-l limit] [-f family] [-1]
                 [-i interval] [-r arraysize] [-u unit] [-H histfile]
                 [-T qps] [-e] [-D] [-c] [-v] [-h]
  -d specifies the input data file (default: stdin)
  -s sets the server to query (default: 127.0.0.1)
  -p sets the port on which to query the server (default: 53)
  -q specifies the maximum number of queries outstanding (default: 20)
  -t specifies the timeout for query completion in seconds (default: 5)
  -n causes configuration changes to be ignored
  -l specifies how a limit for how long to run tests in seconds (no default)
  -1 run through input only once (default: multiple iff limit given)
  -b set input/output buffer size in kilobytes (default: 32 k)
  -i specifies interval of intermediate outputs in seconds (default: 0=none)
  -f specify address family of DNS transport, inet or inet6 (default: any)
  -r set RTT statistics array size (default: 50000)
  -u set RTT statistics time unit in usec (default: 100)
  -H specifies RTT histogram data file (default: none)
  -T specify the target qps (default: 0=unspecified)
  -e enable EDNS 0
  -D set the DNSSEC OK bit (implies EDNS)
  -c print the number of packets with each rcode
  -v verbose: report the RCODE of each response on stdout
  -h print this usage
```

常用参数：

- -d , 解析文件，文件的内容是用户对DNS的请求，可以copy千万级解析进行测试。
- -s , DNS服务器地址。
- -p , DNS服务器进行DNS解析的四层PORT，默认为53。
- -t , 超时时间。



将需要压测的 DNS 资源记录放置在一个文件中

```shell
$ cat test.com
qq.com A
```

可以利用VIM命令模式进行百万级复制。

```shell
[root@instance-c9btn3kt queryperf]# ./queryperf -d test.txt -s 192.168.1.2

DNS Query Performance Testing Tool
Version: $Id: queryperf.c,v 1.12 2007-09-05 07:36:04 marka Exp $

[Status] Processing input data
[Status] Sending queries (beginning with 192.168.1.2)
[Status] Testing complete

Statistics:

  Parse input file:     once
  Ended due to:         reaching end of file

  Queries sent:         1 queries
  Queries completed:    1 queries
  Queries lost:         0 queries
  Queries delayed(?):   0 queries

  RTT max:         	0.035330 sec
  RTT min:              0.035330 sec
  RTT average:          0.035330 sec
  RTT std deviation:    0.000020 sec
  RTT out of range:     0 queries

  Percentage completed: 100.00%
  Percentage lost:        0.00%

  Started at:           Mon Sep 16 20:02:34 2019
  Finished at:          Mon Sep 16 20:02:34 2019
  Ran for:              0.035358 seconds

  Queries per second:   28.282143 qps
```

## 优秀资料

[使用queryperf对DNS服务器作压力测试](https://blog.51cto.com/wubinary/1379595)