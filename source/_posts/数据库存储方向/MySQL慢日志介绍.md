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





## 参考

[如何使用 MySQL 慢查询日志进行性能优化](https://kalacloud.com/blog/how-to-use-mysql-slow-query-log-profiling-mysqldumpslow/)

[MySQL慢查询日志总结](https://www.cnblogs.com/kerrycode/p/5593204.html)

[MySQL慢日志全解析](https://segmentfault.com/a/1190000040017360)



