---
title: MySQL慢日志介绍
date: 2021-07-13 19:57:52
categories: 数据库
tags:
  - 慢日志
typora-root-url: ../../../source
---

MySQL 慢查询日志是用来记录 MySQL 在执行命令中，响应时间超过预设阈值的 SQL 语句。

<!--more-->

记录这些执行缓慢的 SQL 语句是优化 MySQL 数据库效率的第一步。

默认情况下，慢查询日志功能是关闭的，需要我们手动打开。当然，如果不是调优需求的话，一般也不建议长期启动这个功能，因为开启慢查询多少会对数据库的性能带来一些影响。慢查询日志支持将记录写入文件，当然也可以直接写入数据库的表中。



## 开启慢查询日志

### 临时开启慢查询功能

在 MySQL Server 中，默认情况慢查询功能是关闭的，我们可以通过查看此功能的状态

```bash
show variables like 'slow_query_log'; 
```

可以使用以下命令开启并配置慢查询日志功能，**在 mysql 中执行以下命令**：

```bash
SET GLOBAL slow_query_log = 'ON';
SET GLOBAL slow_query_log_file = '/var/log/mysql/mysql-slow.log';
SET GLOBAL log_queries_not_using_indexes = 'ON';
SET SESSION long_query_time = 1;
SET SESSION min_examined_row_limit = 100;
```

`SET GLOBAL slow_query_log` ：全局开启慢查询功能。

`SET GLOBAL slow_query_log_file` ：指定慢查询日志存储文件的地址和文件名。

`SET GLOBAL log_queries_not_using_indexes`：无论是否超时，未被索引的记录也会记录下来。

`SET SESSION long_query_time`：慢查询阈值（秒），SQL 执行超过这个阈值将被记录在日志中。

`SET SESSION min_examined_row_limit`：慢查询仅记录扫描行数大于此参数的 SQL。

**特别注意：**在实践中常常会碰到无论慢查询阈值调到多小，日志就是不被记录。这个问题很有可能是 `min_examined_row_limit` 行数过大，导致没有被记录。`min_examined_row_limit` 在配置中常被忽略，这里要特别注意。

接着我们来执行查询语句，看看配置。（在 MySQL Server 中执行）

```bash
show variables like 'slow_query_log%';
show variables like 'log_queries_not_using_indexes';
show variables like 'long_query_time';
show variables like 'min_examined_row_limit';
```



以上修改 MySQL 慢查询配置的方法是用在**临时监测数据库运行状态**的场景下，当 MySQL Server 重启时，以上修改全部失效并恢复原状。

扩展阅读：[六类 MySQL 触发器使用教程及应用场景实战案例](https://kalacloud.com/blog/how-to-manage-and-use-mysql-database-triggers/)



### 永久开启慢查询功能

虽然我们可以在命令行中对慢查询进行动态设置，但动态设置会随着重启服务而失效。如果想长期开启慢查询功能，需要把慢查询的设置**写入 MySQL 配置文件**中，这样无论是重启服务器，还是重启 MySQL ，慢查询的设置都会保持不变。

MySQL conf 配置文件通常在 `/etc` 或 `/usr` 中。我们可以使用 `find` 命令找到配置文件具体的存放位置。

```bash
sudo find /etc -name my.cnf
```

找到位置后，使用 `nano` 编辑 `my.cnf` 将慢查询设置写入配置文件。

```bash
sudo nano /etc/mysql/my.cnf
[mysqld]
slow-query-log = 1
slow-query-log-file = /var/log/mysql/localhost-slow.log
long_query_time = 1
log-queries-not-using-indexes
```

使用 `nano` 打开配置文件，把上面的的代码写在 `[mysqld]` 的下面即可。 `ctrl+X` 保存退出。

```bash
sudo systemctl restart mysql
```

重启 MySQL Server 服务，使刚刚修改的配置文件生效。

**特别注意：**直接在命令行中设置的慢查询动态变量与直接写入 my.cnf 配置文件的语法有所不同。

举例：动态变量是`slow_query_log`，写入配置文件是`slow-query-log`。这里要特别注意。

更多 MySQL 8.0 动态变量语法可查看 [MySQL 官方文档](https://dev.mysql.com/doc/refman/8.0/en/dynamic-system-variables.html)。

## 使用慢查询功能记录日志

登录 MySQL Server，创建一个数据库，写入一组示例数据。

```shell
CREATE DATABASE mysql_slow_demo;
USE mysql_slow_demo;
CREATE TABLE users ( id TINYINT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(255) );
INSERT INTO users (name) VALUES ('Jack Ma'),('Lei Jun'),('Wang Xing'),('Pony Ma'),('Zhang YiMing'),('Ding Lei'),('Robin Li'),('Xu Yong'),('Huang Zheng'),('Richard Liu');
```

设置慢查询参数

```shell
SET GLOBAL slow_query_log = 1;
SET GLOBAL slow_query_log_file = '/home/mysql/mysql/log/slow.log';
SET GLOBAL log_queries_not_using_indexes = 1;
SET long_query_time = 10;
SET min_examined_row_limit = 0;
```



对于一个空的slow log ，文件内容可能是下面的样式

```shell
/home/mysql/mysql/libexec/mysqld, Version: 5.7.17-baidu-rds-3.0.0.1-log (Source distribution). started with:
Tcp port: 3306  Unix socket: /home/mysql/mysql/tmp/mysql.sock
Time                 Id Command    Argument
```



利用主键进行查询，速度非常快，慢日志不会新增记录，比如下面的语句

```shell
SELECT * FROM users WHERE id = 1;
```

但是利用非索引列，可能会有慢日志记录

```shell
SELECT * FROM users WHERE name = 'Wang Xing';
```



日志文件如下：

```shell
/home/mysql/mysql/libexec/mysqld, Version: 5.7.17-baidu-rds-3.0.0.1-log (Source distribution). started with:
Tcp port: 3306  Unix socket: /home/mysql/mysql/tmp/mysql.sock
Time                 Id Command    Argument
# Time: 2022-04-02T03:29:32.108849Z
# User@Host: _root[_root] @ localhost []  Id: 75342
# Query_time: 0.000203  Lock_time: 0.000108 Rows_sent: 1  Rows_examined: 10
use mysql_slow_demo;
SET timestamp=1648870172;
SELECT * FROM users WHERE name = 'Wang Xing';
```

- `Time` ：被日志记录的代码在服务器上的运行时间。
- `User@Host`：谁执行的这段代码。
- `Query_time`：这段代码运行时长。
- `Lock_time`：执行这段代码时，锁定了多久。
- `Rows_sent`：慢查询返回的记录。
- `Rows_examined`：慢查询扫描过的行数。

## mysqldumpslow 分析慢查询日志

实际工作中，慢查询日志可不像上文描述的那样，仅仅有几行记录。现实中慢查询日志会记录大量慢查询信息，写入也非常频繁。日志记录的内容会越来越长，分析数据也变的困难。 好在 MySQL 内置了 `mysqldumpslow` 工具，它可以把相同的 SQL 归为一类，并统计出归类项的执行次数和每次执行的耗时等一系列对应的情况。

我们先来执行几行代码让慢查询日志记录下来，然后再用 `mysqldumpslow` 进行分析。

```bash
SELECT * FROM users WHERE name = 'Wang Xing';
SELECT * FROM users WHERE name = 'Huang Zheng';
SELECT * FROM users WHERE name = 'Zhang YiMing';
```

这三条查询都会被记录在慢日志当中。

```shell
mysqldumpslow -s at /home/mysql/mysql/log/slow.log
```

不同版本的mysql，有的会对语句进行归类显示，而有的直接全部展示

```shell
mysqldumpslow -s at /home/mysql/mysql/log/slow.log

Reading mysql slow query log from /home/mysql/mysql/log/slow.log
Count: 1  Time=0.00s (0s)  Lock=0.00s (0s)  Rows=0.0 (0), 0users@0hosts
  # Time: N-N-02T03:N:N.108849Z
  # User@Host: _root[_root] @ localhost []  Id: N
  # Query_time: N.N  Lock_time: N.N Rows_sent: N  Rows_examined: N
  use mysql_slow_demo;
  SET timestamp=N;
  SELECT * FROM users WHERE name = 'S'

Count: 1  Time=0.00s (0s)  Lock=0.00s (0s)  Rows=0.0 (0), 0users@0hosts
  Time: N-N-02T03:N:N.733748Z
  # User@Host: _root[_root] @ localhost []  Id: N
  # Query_time: N.N  Lock_time: N.N Rows_sent: N  Rows_examined: N
  SET timestamp=N;
  SELECT * FROM users WHERE name = 'S'

Count: 1  Time=0.00s (0s)  Lock=0.00s (0s)  Rows=0.0 (0), 0users@0hosts
  Time: N-N-02T03:N:N.582417Z
  # User@Host: _root[_root] @ localhost []  Id: N
  # Query_time: N.N  Lock_time: N.N Rows_sent: N  Rows_examined: N
  SET timestamp=N;
  SELECT * FROM users WHERE name = 'S'

Count: 1  Time=0.00s (0s)  Lock=0.00s (0s)  Rows=0.0 (0), 0users@0hosts
  Time: N-N-02T03:N:N.486535Z
  # User@Host: _root[_root] @ localhost []  Id: N
  # Query_time: N.N  Lock_time: N.N Rows_sent: N  Rows_examined: N
  SET timestamp=N;
  SELECT * FROM users WHERE name = 'S'
```



**常见的** `mysqldumpslow` **命令** 平时大家也可以根据自己的常用需求来总结，存好这些脚本备用。

- `mysqldumpslow -s at -t 10 kalacloud-slow.log`：平均执行时长最长的前 10 条 SQL 代码。
- `mysqldumpslow -s al -t 10 kalacloud-slow.log`：平均锁定时间最长的前10条 SQL 代码。
- `mysqldumpslow -s c -t 10 kalacloud-slow.log`：执行次数最多的前10条 SQL 代码。
- `mysqldumpslow -a -g 'user' kalacloud-slow.log`：显示所有 `user` 表相关的 SQL 代码的具体值
- `mysqldumpslow -a kalacloud-slow.log`：直接显示 SQL 代码的情况。

`mysqldumpslow` 的参数命令

```bash
Usage: mysqldumpslow [ OPTS... ] [ LOGS... ]

Parse and summarize the MySQL slow query log. Options are

  --verbose    verbose
  --debug      debug
  --help       write this text to standard output
  -v           verbose
  -d           debug
  -s ORDER     what to sort by (al, at, ar, c, l, r, t), 'at' is default
                al: average lock time
                ar: average rows sent
                at: average query time
                 c: count
                 l: lock time
                 r: rows sent
                 t: query time
  -r           reverse the sort order (largest last instead of first)
  -t NUM       just show the top n queries
  -a           don't abstract all numbers to N and strings to 'S'
  -n NUM       abstract numbers with at least n digits within names
  -g PATTERN   grep: only consider stmts that include this string
  -h HOSTNAME  hostname of db server for *-slow.log filename (can be wildcard),
               default is '*', i.e. match all
  -i NAME      name of server instance (if using mysql.server startup script)
  -l           don't subtract lock time from total time
```

常用的参数讲解：

```
-s
```

- al：平均锁定时间
- at：平均查询时间 [默认]
- ar：平均返回记录时间
- c：count 总执行次数
- l：锁定时间
- r：返回记录
- t：查询时间

`-t`：返回前 N 条的数据

`-g`：可写正则表达，类似于 grep 命令，过滤出需要的信息。如，只查询 X 表的慢查询记录。

`-r`：rows sent 总返回行数。

`mysqldumpslow` 日志查询工具好用就好用在它特别灵活，又可以合并同类项式的分析慢查询日志。我们在日常工作的使用中，就能够体会 `mysqldumpslow` 的好用之处。



另外 `mysqldumpslow` 的使用参数也可在 [MySQL 8.0 使用手册](https://dev.mysql.com/doc/refman/8.0/en/mysqldumpslow.html) 中找到。

扩展阅读：[如何查看 MySQL 数据库、表、索引容量大小](https://kalacloud.com/blog/how-to-get-the-sizes-of-the-tables-of-a-mysql-database/)？找到占用空间最大的表

## Profilling - MySQL 性能分析工具

为了更精准的定位一条 SQL 语句的性能问题，我们需要拆分这条语句运行时到底在什么地方消耗了多少资源。 我们可以使用 Profilling 工具来进行这类细致的分析。我们可通过 Profilling 工具获取一条 SQL 语句在执行过程中对各种资源消耗的细节。

进入 MySQL Server 后，执行以下代码，启动 Profilling

```bash
SET SESSION profiling = 1; 
```

检查 profiling 的状态

```bash
SELECT @@profiling;
```

返回数据： 0 表示未开启，1 表示已开启。



执行需要定位问题的 SQL 语句。

```bash
SELECT * FROM users WHERE name = 'Jack Ma';
```

查看 SQL 语句状态。

```text
SHOW PROFILES;
```

打开 profiling 后，`SHOW PROFILES;` 会显示一个将 `Query_ID` 链接到 SQL 语句的表。

执行以下 SQL 代码，将 `[# Query_ID]` 替换为我们要分析的 SQL 代码`Query_ID`的编号。

```text
SHOW PROFILE CPU, BLOCK IO FOR QUERY [# Query_ID];
```



## 参考

[如何使用 MySQL 慢查询日志进行性能优化](https://kalacloud.com/blog/how-to-use-mysql-slow-query-log-profiling-mysqldumpslow/)

[MySQL慢查询日志总结](https://www.cnblogs.com/kerrycode/p/5593204.html)

[MySQL慢日志全解析](https://segmentfault.com/a/1190000040017360)



