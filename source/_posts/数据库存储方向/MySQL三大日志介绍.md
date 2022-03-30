---
title: MySQL三大日志介绍
date: 2021-07-13 19:57:52
categories: 数据库
tags:
  - redolog
  - binlog
  - undolog
  - 主从复制
typora-root-url: ../../../source
---

## MySQL介绍

在关系型数据库中，MySQL可以说是其中的王者。它是目前最流行的数据库之一，由瑞典 MySQL AB 公司开发，目前属于 Oracle 公司。

<!--more-->

### 逻辑架构

MySQL的逻辑架构可分为四层，包括连接层、服务层、引擎层和存储层，各层的接口交互及作用如下图所示。需要注意的是，由于本文将主要讲解事务的实现原理，因此下文针对的都是InnoDB引擎下的情况。

- **连接层：** 负责处理客户端的连接以及权限的认证。
- **服务层：** 定义有许多不同的模块，包括权限判断，SQL接口，SQL解析，SQL分析优化， 缓存查询的处理以及部分内置函数执行等。MySQL的查询语句在服务层内进行解析、优化、缓存以及内置函数的实现和存储。
- **引擎层：** 负责MySQL中数据的存储和提取。MySQL中的服务器层不管理事务，事务是由存储引擎实现的。其中使用最为广泛的存储引擎为InnoDB，其它的引擎都不支持事务。
- **存储层：** 负责将数据存储与设备的文件系统中。

![mysql-arch](/images/数据库存储/mysql-arch.png)

## MySQL日志系统

MySQL日志系统是数据库的重要组件，用于记录数据库的更新和修改。若数据库发生故障，可通过不同日志记录恢复数据库的原来数据。因此实际上日志系统直接决定着MySQL运行的鲁棒性和稳健性。

MySQL的日志有很多种，如二进制日志（binlog）、错误日志、查询日志、慢查询日志等，此外InnoDB存储引擎还提供了两种日志：redo log（重做日志）和undo log（回滚日志）。这里将重点针对InnoDB引擎，对重做日志、回滚日志和二进制日志这三种进行分析。

### 重做日志（redo log）

重做日志（redo log）是InnoDB**引擎层**的日志，用来记录事务操作引起数据的变化，**记录的是数据页的物理修改**。

为什么不在每次事务提交的时候，将该事务涉及修改的数据页全部刷新到磁盘中？这么做会有严重的性能问题，主要体现在两个方面：

1. 因为`Innodb`是以`页`为单位进行磁盘交互的，而一个事务很可能只修改一个数据页里面的几个字节，这个时候将完整的数据页刷到磁盘的话，太浪费资源了！
2. 一个事务可能涉及修改多个数据页，并且这些数据页在物理上并不连续，使用随机IO写入性能太差！

因此`mysql`设计了`redo log`，**具体来说就是只记录事务对数据页做了哪些修改**，这样就能完美地解决性能问题了(相对而言文件更小并且是顺序IO)。



#### redo log基本概念

`redo log`包括两部分：一个是内存中的日志缓冲(`redo log buffer`)，另一个是磁盘上的日志文件(`redo log file`)。

`mysql`每执行一条`DML`语句，先将记录写入`redo log buffer`，后续某个时间点再一次性将多个操作记录写到`redo log file`。这种**先写日志，再写磁盘**的技术就是`MySQL`里经常说到的`WAL(Write-Ahead Logging)` 技术。

在计算机操作系统中，用户空间(`user space`)下的缓冲区数据一般情况下是无法直接写入磁盘的，中间必须经过操作系统内核空间(`kernel space`)缓冲区(`OS Buffer`)。因此，`redo log buffer`写入`redo log file`实际上是先写入`OS Buffer`，然后再通过系统调用`fsync()`将其刷到`redo log file`中，过程如下

![redo-log-2](/images/数据库存储/redo-log-2.png)



`mysql`支持三种将`redo log buffer`写入`redo log file`的时机，可以通过`innodb_flush_log_at_trx_commit`参数配置，各参数值含义如下：

| 参数值              | 含义                                                         |
| ------------------- | ------------------------------------------------------------ |
| 0（延迟写）         | 事务提交时不会将`redo log buffer`中日志写入到`os buffer`，而是每秒写入`os buffer`并调用`fsync()`写入到`redo log file`中。也就是说设置为0时是(大约)每秒刷新写入到磁盘中的，当系统崩溃，会丢失1秒钟的数据。 |
| 1（实时写，实时刷） | 事务每次提交都会将`redo log buffer`中的日志写入`os buffer`并调用`fsync()`刷到`redo log file`中。这种方式即使系统崩溃也不会丢失任何数据，但是因为每次提交都写入磁盘，IO的性能较差。 |
| 2（实时写，延迟刷） | 每次提交都仅写入到`os buffer`，然后是每秒调用`fsync()`将`os buffer`中的日志写入到`redo log file`。 |

![redo-log-3](/images/数据库存储/redo-log-3.png)

> **fsync函数**：包含在UNIX系统头文件#include <unistd.h>中，用于同步内存中所有已修改的文件数据到储存设备。



#### redo log记录形式

redo log日志的大小是固定的，为了能够持续不断的对更新记录进行写入，在redo log日志中设置了两个标志位置，checkpoint和write_pos，分别表示记录擦除的位置和记录写入的位置。redo log日志的数据写入示意图可见下图。

![redo-log-0](/images/数据库存储/redo-log-0.png)

当`write_pos`标志到了日志结尾时，会从结尾跳至日志头部进行重新循环写入。所以redo log的逻辑结构并不是线性的，而是可看作一个圆周运动。`write_pos`与`checkpoint`中间的空间可用于写入新数据，写入和擦除都是往后推移，循环往复的。

![redo-log-1](/images/数据库存储/redo-log-1.png)

**在innodb中，既有`redo log`需要刷盘，还有`数据页`也需要刷盘，`redo log`存在的意义主要就是降低对`数据页`刷盘的要求**。在上图中，`write pos`表示`redo log`当前记录的`LSN`(逻辑序列号)位置，`check point`表示**数据页更改记录**刷盘后对应`redo log`所处的`LSN`(逻辑序列号)位置。`write pos`到`check point`之间的部分是`redo log`空着的部分，用于记录新的记录；`check point`到`write pos`之间是`redo log`待落盘的数据页更改记录。当`write pos`追上`check point`时，会先推动`check point`向前移动，空出位置再记录新的日志。



启动`innodb`的时候，不管上次是正常关闭还是异常关闭，总是会进行恢复操作。因为`redo log`记录的是数据页的物理变化，因此恢复的时候速度比逻辑日志(如`binlog`)要快很多。 重启`innodb`时，首先会检查磁盘中数据页的`LSN`，如果数据页的`LSN`小于日志中的`LSN`，则会从`checkpoint`开始恢复。 还有一种情况，在宕机前正处于`checkpoint`的刷盘过程，且数据页的刷盘进度超过了日志页的刷盘进度，此时会出现数据页中记录的`LSN`大于日志中的`LSN`，这时超出日志进度的部分将不会重做，因为这本身就表示已经做过的事情，无需再重做。



### 二进制日志（binlog）

二进制日志binlog是**服务层**的日志，还被称为归档日志。binlog主要**记录数据库的变化情况，内容包括数据库所有的更新操作**。所有涉及数据变动的操作，都要记录进二进制日志中。因此有了binlog可以很方便的对数据进行复制和备份，因而也**常用作主从库的同步**。



这里binlog所存储的内容看起来似乎与redo log很相似，但是其实不然。**redo log是一种物理日志**，记录的是实际上对某个数据进行了怎么样的修改；而**binlog是逻辑日志**，记录的是SQL语句的原始逻辑，比如”给ID=2这一行的a字段加1 “。binlog日志中的内容是二进制的，根据日记格式参数的不同，可能基于SQL语句、基于数据本身或者二者的混合。一般常用记录的都是SQL语句。

> 物理的日志可看作是实际数据库中数据页上的变化信息，只看重结果，而不在乎是通过“何种途径”导致了这种结果；
>
> 逻辑的日志可看作是通过了某一种方法或者操作手段导致数据发生了变化，存储的是逻辑性的操作。



`binlog`是通过追加的方式进行写入的，可以通过`max_binlog_size`参数设置每个`binlog`文件的大小，当文件大小达到给定值之后，会生成新的文件来保存日志。



#### binlog使用场景

在实际应用中，`binlog`的主要使用场景有两个，分别是**主从复制**和**数据恢复**。

1. **主从复制**：在`Master`端开启`binlog`，然后将`binlog`发送到各个`Slave`端，`Slave`端重放`binlog`从而达到主从数据一致。
2. **数据恢复**：通过使用`mysqlbinlog`工具来恢复数据。

#### binlog刷盘时机

对于`InnoDB`存储引擎而言，只有在事务提交时才会记录`binlog`，此时记录还在内存中，那么`biglog`是什么时候刷到磁盘中的呢？`mysql`通过`sync-binlog`参数控制`biglog`的刷盘时机，取值范围是`0-N`：

- 0：不去强制要求，由系统自行判断何时写入磁盘；
- 1：每次`commit`的时候都要将`binlog`写入磁盘；
- N：每N个事务，才会将`binlog`写入磁盘。

从上面可以看出，`sync_binlog`最安全的是设置是`1`，这也是`MySQL 5.7.7`之后版本的默认值。但是设置一个大一些的值可以提升数据库性能，因此实际情况下也可以将值适当调大，牺牲一定的一致性来获取更好的性能。

#### binlog日志格式

`binlog`日志有三种格式，分别为`STATMENT`、`ROW`和`MIXED`。

> 在 `MySQL 5.7.7`之前，默认的格式是`STATEMENT`，`MySQL 5.7.7`之后，默认值是`ROW`。日志格式通过`binlog-format`指定。

- `STATMENT` **基于`SQL`语句的复制(`statement-based replication, SBR`)，每一条会修改数据的sql语句会记录到`binlog`中**。 优点：**不需要记录每一行的变化，减少了`binlog`日志量，节约了`IO`, 从而提高了性能**； 缺点：**在某些情况下会导致主从数据不一致，比如执行`sysdate()`、`slepp()`等**。
- `ROW` **基于行的复制(`row-based replication, RBR`)，不记录每条sql语句的上下文信息，仅需记录哪条数据被修改了**。 优点：**不会出现某些特定情况下的存储过程、或function、或trigger的调用和触发无法被正确复制的问题**； 缺点：**会产生大量的日志，尤其是`alter table`的时候会让日志暴涨**
- `MIXED` **基于`STATMENT`和`ROW`两种模式的混合复制(`mixed-based replication, MBR`)，一般的复制使用`STATEMENT`模式保存`binlog`，对于`STATEMENT`模式无法复制的操作使用`ROW`模式保存`binlog`**



事实上最开始MySQL是没有redo log日志的。因为起先MySQL是没有InnoDB引擎的，自带的引擎是MyISAM。binlog是服务层的日志，因此所有引擎都能够使用。但是光靠binlog日志只能提供归档的作用，无法提供`crash-safe`能力，所以InnoDB引擎就采用了学自于Oracle的技术，也就是redo log，这才拥有了`crash-safe`能力。这里对redo log日志和binlog日志的特点分别进行了对比：

<img src="/images/数据库存储/redo-vs-bin.jpeg" alt="redo-vs-bin" style="zoom:80%;" />



在MySQL执行更新语句时，都会涉及到redo log日志和binlog日志的读写。一条更新语句的执行过程如下：

![update-flow](/images/数据库存储/update-flow.png)

从上图可以看出，MySQL在执行更新语句的时候，**在服务层进行语句的解析和执行，在引擎层进行数据的提取和存储**；同时在服务层对binlog进行写入，在InnoDB内进行redo log的写入。

不仅如此，在对redo log写入时有两个阶段的提交，一是binlog写入之前`prepare`状态的写入，二是binlog写入之后`commit`状态的写入。

之所以要安排这么一个两阶段提交，自然是有它的道理的。现在我们可以假设不采用两阶段提交的方式，而是采用“单阶段”进行提交，即要么先写入redo log，后写入binlog；要么先写入binlog，后写入redo log。这两种方式的提交都会导致原先数据库的状态和被恢复后的数据库的状态不一致。

**先写入redo log，后写入binlog：**

在写完redo log之后，数据此时具有`crash-safe`能力，因此系统崩溃，数据会恢复成事务开始之前的状态。但是，若在redo log写完时候，binlog写入之前，系统发生了宕机。此时binlog没有对上面的更新语句进行保存，导致当使用binlog进行数据库的备份或者恢复时，就少了上述的更新语句。从而使得`id=2`这一行的数据没有被更新。

<img src="/images/数据库存储/redo-notbin.png" alt="redo-notbin" style="zoom:50%;" />

**先写入binlog，后写入redo log：**

写完binlog之后，所有的语句都被保存，所以通过binlog复制或恢复出来的数据库中id=2这一行的数据会被更新为a=1。但是如果在redo log写入之前，系统崩溃，那么redo log中记录的这个事务会无效，导致实际数据库中`id=2`这一行的数据并没有更新。

<img src="/images/数据库存储/bin-notredo.png" alt="bin-notredo" style="zoom:50%;" />

由此可见，两阶段的提交就是为了避免上述的问题，使得binlog和redo log中保存的信息是一致的。



### 回滚日志（undo log）

回滚日志同样也是InnoDB**引擎层**提供的日志，顾名思义，回滚日志的作用就是对数据进行回滚。当事务对数据库进行修改，InnoDB引擎不仅会记录redo log，还会生成对应的undo log日志；如果事务执行失败或调用了rollback，导致事务需要回滚，就可以利用undo log中的信息将数据回滚到修改之前的样子。

但是undo log不redo log不一样，它**属于逻辑日志**。它对SQL语句执行相关的信息进行记录。当发生回滚时，InnoDB引擎会根据undo log日志中的记录做与之前相反的工作。比如对于每个数据插入操作（insert），回滚时会执行数据删除操作（delete）；对于每个数据删除操作（delete），回滚时会执行数据插入操作（insert）；对于每个数据更新操作（update），回滚时会执行一个相反的数据更新操作（update），把数据改回去。**undo log由两个作用，一是提供回滚，二是实现MVCC**。

## 主从复制

主从复制的概念很简单，就是从原来的数据库复制一个完全一样的数据库，原来的数据库称作主数据库，复制的数据库称为从数据库。从数据库会与主数据库进行数据同步，保持二者的数据一致性。

主从复制的原理实际上就是**通过bin log日志实现的**。bin log日志中保存了数据库中所有SQL语句，通过对bin log日志中SQL的复制，然后再进行语句的执行即可实现从数据库与主数据库的同步。

主从复制的过程可见下图。主从复制的过程主要是**靠三个线程**进行的，一个运行在**主服务器中的发送线程**，用于发送binlog日志到从服务器。两外两个运行在从服务器上的I/O线程和SQL线程。I/O线程用于读取主服务器发送过来的binlog日志内容，并拷贝到本地的中继日志中。SQL线程用于读取中继日志中关于数据更新的SQL语句并执行，从而实现主从库的数据一致。

<img src="/images/数据库存储/主从复制.png" alt="主从复制" style="zoom:50%;" />

之所以需要实现主从复制，实际上是由实际应用场景所决定的。主从复制能够带来的好处有：

1. 通过复制实现数据的异地备份，当主数据库故障时，可切换从数据库，避免数据丢失。
2. 可实现架构的扩展，当业务量越来越大，I/O访问频率过高时，采用多库的存储，可以降低磁盘I/O访问的频率，提高单个机器的I/O性能。
3. 可实现读写分离，使数据库能支持更大的并发。
4. 实现服务器的负载均衡，通过在主服务器和从服务器之间切分处理客户查询的负荷。



## 参考

[为了让你彻底弄懂 MySQL 事务日志，我通宵肝出了这份图解！](https://www.cxyxiaowu.com/10740.html)

[必须了解的mysql三大日志-binlog、redo log和undo log](https://juejin.cn/post/6860252224930070536)

[彻底搞懂mysql日志系统binlog,redolog,undolog](https://blog.51cto.com/u_3664660/3212550)
