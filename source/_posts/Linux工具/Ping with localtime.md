---
title: Ping with Localtime
date: 2018-08-11 16:59:05
categories: Linux工具
tags:
  - ping
  - localtime
---

`ping`命令是一种比较好用的网络诊断工具，常用来验证链路问题。其使用比较简单，直接`ping dst_ip`即可。

若显示`ping`的回显时间，此命令也提供了参数 `-D`来回显时间戳。

<!--more-->

```shell
# ping baidu.com -D
PING baidu.com (220.181.57.216) 56(84) bytes of data.
[1533964775.496267] 64 bytes from 220.181.57.216 (220.181.57.216): icmp_seq=1 ttl=53 time=3.69 ms
[1533964776.491553] 64 bytes from 220.181.57.216 (220.181.57.216): icmp_seq=2 ttl=53 time=3.21 ms
[1533964777.492977] 64 bytes from 220.181.57.216 (220.181.57.216): icmp_seq=3 ttl=53 time=3.32 ms
[1533964778.494446] 64 bytes from 220.181.57.216 (220.181.57.216): icmp_seq=4 ttl=53 time=3.31 ms
```

然而，时间戳可读性较差，虽然可以利用网上的一些工具（[unitxtime](http://tool.chinaz.com/Tools/unixtime.aspx)）来转化，但是比较麻烦，最好的方式时回显时就是可读性较好的时间格式。

## date

1. 数据戳转化

   `date`可以将时间戳转化为localtime。

   ```shell
   # date -d @1533965805.934353
   2018年 08月 11日 星期六 13:36:45 CST
   # date --date=@1533965805.934353
   2018年 08月 11日 星期六 13:36:45 CST
   ```

   利用`awk`进行转化，比较麻烦。

2. awk拼接

   ```shell
   # ping baidu.com | awk  ' {"date"| getline date; print date,$0 }'
   ```

   or

   ```shell
   # 时间格式可根据date自定义
   # ping baidu.com | awk -v date="$(date +"%Y-%m-%d %r")" '{ print date, $0}'
   ```

## perl

如果awk 没有 `strftime()`

```shell
# ping baidu.com | perl -nle 'print scalar(localtime), " ", $_'
```

要将其重定向到文件，请使用标准shell重定向并关闭输出缓冲：

```shell
# ping baidu.com | perl -nle 'BEGIN {$|++} print scalar(localtime), " ", $_' > outputfile
```

如果显示ISO8601时间格式

```shell
# ping baidu.com | perl -nle 'use Time::Piece; BEGIN {$|++} print localtime->datetime, " ", $_'
```

**Notice：**报错“Can't locate Time/Piece.pm in @INC”，需要执行命令“yum -y install perl-Time-Piece”来进行必要包的安装。



**以上几种方式，在（shell或crontab）文件内重定向的时候会有问题：不会将输出重定向到指定文件。**

如果在文件内需要重定向到其他文件，则可以

```shell
# ping baidu.com | while read pong; do echo "$(date): $pong"; done
```

进行改造

```shell
# ping baidu.com | while read pong; do echo "$(date): $pong">outputfile; done
```