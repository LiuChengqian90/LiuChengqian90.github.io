---
title: Linux定时任务
date: 2018-08-11 17:59:05
categories: Linux工具
tags:
  - crontab
---

Linux系统中，非常多的时候我们需要执行定时任务，比如备份等。而提到“定时”，`crontab`是 Linux系统中的“定时”神器。

## 环境
<!--more-->
系统中一般已经安装了crontab。如果没有安装，则

```shell
# yum -y install crontabs
# (Centos 6.x)
# service crond start
# (Centos 7.x)
# systemctl start crond
```

设置开机启动

### Centos 6.x

```shell
# chkconfig –-level 35 crond on
```

**Notice：**系统开机时，会顺序执行`/etc/rc[0-6].d`文件，数字即代表level。“--level 35”代表"level 3"和"level 5"。

chkconfig命令行的形式设置是否开机自启动或者查询某个服务6个开机级别的运行情况。

查看各个开机级别的crond服务运行情况 

```shell
# chkconfig --list crond
crond          	0:off	1:off	2:on	3:on	4:on	5:on	6:off
```

能够看到2、3、4、5级别开机会自己主动启动crond服务 

取消开机自己主动启动crond服务: 

```shell
# chkconfig crond off
```



### Centos 7.x

```shell
# systemctl enable crond
```

## 脚本

### 系统任务

直接编辑/etc/crontab 文件，加入对应的任务。

空文件如下：

```
SHELL=/bin/bash
PATH=/sbin:/bin:/usr/sbin:/usr/bin
MAILTO=root
HOME=/

# For details see man 4 crontabs

# Example of job definition:
# .---------------- minute (0 - 59)
# |  .------------- hour (0 - 23)
# |  |  .---------- day of month (1 - 31)
# |  |  |  .------- month (1 - 12) OR jan,feb,mar,apr ...
# |  |  |  |  .---- day of week (0 - 6) (Sunday=0 or 7) OR sun,mon,tue,wed,thu,fri,sat
# |  |  |  |  |
# *  *  *  *  * user-name command to be executed
```

文件解释如下

- 星号，“\*”：代表全部可能的值。比如month字段假设是星号。则表示在满足其他字段的制约条件后每月都运行该命令操作。
- 逗号，“,”：能够用逗号隔开的值指定一个列表范围，比如“1,2,5,7,8,9”
- 中杠，“-”：能够用整数之间的中杠表示一个整数范围，比如“2-6”表示“2,3,4,5,6”
- 正斜线，“/”：能够用正斜线指定时间的间隔频率，比如“0-23/2”表示每两小时运行一次。同一时候正斜线能够和星号一起使用。比如*/10，假设用在minute字段，表示每十分钟运行一次。

一些实例如下

```json
5      *       *           *     *     ls         指定每小时的第5分钟运行一次ls命令
30     5       *           *     *     ls         指定每天的 5:30 运行ls命令
30     7       8           *     *     ls         指定每月8号的7：30分运行ls命令
30     5       8           6     *     ls         指定每年的6月8日5：30运行ls命令
30     5       8           6     *     ls         指定每年的6月8日5：30运行ls命令
30     6       *           *     0     ls         指定每星期日的6:30运行ls命令
30     3     10,20         *     *     ls         每月10号及20号的3：30运行ls命令
25     8-11    *           *     *     ls         每天8-11点的第25分钟运行ls命令
*/15   *       *           *     *     ls         每15分钟运行一次ls命令
30     6     */10          *     *     ls         每一个月中。每隔10天6:30运行一次ls命令
22     4       *           *     *     root     run-parts     /etc/cron.daily
#每天4：22以root身份运行/etc/cron.daily文件夹中的全部可运行文件，run-parts參数表示。运行后面文件夹中的全部可运行文件。
```

### 用户任务

利用`crontab -e`可设置当前用户的私人定时任务，由于知道当前用户，因此文件中不设置user一项。格式类似系统任务

```json
30 21 * * * /usr/local/etc/rc.d/lighttpd restart	每晚的21:30 重新启动apache
0 23-7/1 * * * /usr/local/etc/rc.d/lighttpd restart	晚上11点到早上7点之间，每隔一小时重新启动apache
```

## 优秀资料

[Linux---CentOS 定时执行脚本配置](https://www.cnblogs.com/yjbjingcha/p/7006983.html)







