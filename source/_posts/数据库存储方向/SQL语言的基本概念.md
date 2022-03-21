---
title: SQL语言的基本概念
date: 2022-02-27 19:57:52
categories: 数据库
tags:
  - DDL
  - DQL
  - DML
  - DCL
typora-root-url: ../../../source
---

## SQL语言的基本概念

SQL指**结构化查询语言**，全称是 Structured Query Language。使用 SQL 可以访问和处理关系型数据库，它是用于访问和处理数据库的标准的计算机语言。

<!--more-->

SQL语句既可以查询数据库中的数据，也可以添加、更新和删除数据库中的数据，还可以对数据库进行管理和维护操作。不同的数据库，都支持SQL，这样，我们通过学习SQL这一种语言，就可以操作各种不同的数据库。

虽然SQL已经被ANSI组织定义为标准，不幸地是，各个不同的数据库对标准的SQL支持不太一致。并且，大部分数据库都在标准的SQL上做了扩展。也就是说，如果只使用标准SQL，理论上所有数据库都可以支持，但如果使用某个特定数据库的扩展SQL，换一个数据库就不能执行了。例如，Oracle把自己扩展的SQL称为`PL/SQL`，Microsoft把自己扩展的SQL称为`T-SQL`。

现实情况是，如果我们只使用标准SQL的核心功能，那么所有数据库通常都可以执行。不常用的SQL功能，不同的数据库支持的程度都不一样。而各个数据库支持的各自扩展的功能，通常我们把它们称之为“方言”。

SQL 的特点有：

- SQL 面向数据库执行查询
- SQL 可从数据库取回数据
- SQL 可在数据库中插入新的记录
- SQL 可更新数据库中的数据
- SQL 可从数据库删除记录
- SQL 可创建新数据库
- SQL 可在数据库中创建新表
- SQL 可在数据库中创建存储过程
- SQL 可在数据库中创建视图
- SQL 可以设置表、存储过程和视图的权限

## SQL的语法特点

SQL语法的语法特点有：

- SQL 对关键字的大小写不敏感，比如SELECT 与 select 是相同的，一个关键字混合大小写也是可以的，比如 SeLect，关键字建议大写。

- 数据库名，表名，表字段一般来说都是区分大小写的，所以在使用SQL命令操作数据库表和字段时需要输入正确的名称。

- SQL语句可以以单行或者多行书写，以分行结束（某些数据库系统要求在每条 SQL 语句的末端使用分号，比如MySQL）。分号是在数据库系统中分隔每条 SQL 语句的标准方法，这样就可以在对服务器的相同请求中执行一条以上的 SQL 语句。

- SQL的注释：

  ```shell
  单行注释： -- 注释内容、# 注释内容  （在MySQL中，-- 后面一定要加一个空格，#后面可加可不加空格。单行注释建议使用 #）
  SELECT * FROM Websites;  -- 这里是注释
  SELECT * FROM Websites;  # 这里是注释
  
  多行注释： 
  /* 
  注释内容 
  注释内容
  */
  ```



## SQL语句的分类

SQL语言定义了以下四种操作数据库的能力，可分为以下四类：

### DDL（Data Definition Language）

DDL是用来操作数据库和表的，也就是创建数据库和表、删除数据库和表、修改表结构这些操作。通常，DDL由数据库管理员执行。

#### DDL操作数据库（选择和增删改查）

##### 创建数据库（Create）

可以通过 create 语句来创建一个数据库

```shell
CREATE DATABASE 数据库名;  -- 创建数据库
create database 数据库名 character set utf-8;  -- 在创建数据库时可以指定数据库的字符集
```

如果同名数据库已经存在，再创建一个会报错，提示该数据库已存在。我们可以通过判断该数据库是否已存在来避免报错：

```shell
create database if not exists basename;  -- 如果已存在则不会创建，否则新建一个数据库
create database if not exists basename character set gbk;  -- 判断同时指定字符集
```

##### 查询所有的数据库（show）

可以使用 show database; 语句来查询 MySQL 中所有的数据库。

可以通过 show create database 数据库名; 语句来查看创建某个数据的语法。

##### 修改数据库（alter）

修改数据库的字符集：

```shell
alter database 数据库名称 character set 字符集名称;
# 示例：
alter database testdb character set utf8;
```

##### 删除数据库（drop）

```shell
drop database 数据库名称;
drop database if exists 数据库名称;   # 如果该数据库不存在，直接删除会报错，我们可以先判断是否存在
```

##### 选择数据库（use）

```shell
use 数据库名称; 
```

执行以上命令后，就会选择某个数据库，后续的操作都会在该数据库中执行，比如对数据表的操作等等。

查询目前正在使用的数据库：

```shell
select database();  # 当没有选择数据库时，会提示 null
```

#### DDL操作数据表（增删改查）

##### 创建数据表（create）

创建MySQL数据表需要以下信息：表名、表字段名、定义每个表字段。

以下为创建MySQL数据表的SQL通用语法：

```shell
CREATE TABLE table_name (column_name column_type);
# 示例创建数据表runoob_tbl：
CREATE TABLE IF NOT EXISTS `runoob_tbl`(
   `runoob_id` INT UNSIGNED AUTO_INCREMENT,   # AUTO_INCREMENT定义列为自增的属性，一般用于主键，数值会自动加1
   `runoob_title` VARCHAR(100) NOT NULL,      # 如果你不想字段为 NULL 可以设置字段的属性为 NOT NULL，在操作数据库时如果输入该字段的数据为NULL，就会报错。
   `submission_date` DATE,
   PRIMARY KEY ( `runoob_id` )                # PRIMARY KEY关键字用于定义列为主键，可以使用多列来定义主键，列间以逗号分隔。建表语句的最后一列不要加逗号，否则报错
)ENGINE=InnoDB DEFAULT CHARSET=utf8;          # ENGINE 设置存储引擎，CHARSET 设置编码
```

对于一个关系表，除了定义每一列的名称外，还需要定义每一列的数据类型。

##### 删除数据表（drop）

在进行删除表操作时要非常小心，因为执行删除命令后所有数据都会消失。

以下为删除MySQL数据表的通用语法：

```shell
DROP TABLE table_name;
DROP TABLE if exists table_name;  # 判断是否存在，存在再删除
```

##### 修改表

**对表的整体进行修改**

修改表名：

```shell
alter table 表名 rename to 新表名;
```

修改表的字符集：

```shell
alter table 表名 character set 字符集名称;
# 示例：
alter table testtable character set utf8;  # utf-8字符集写成utf8，否则报错
```

**修改表结构**

添加一列：

```shell
alter table 表名 add 列名 数据类型;
# 示例：
alter table testtable add name varchar(10);  # varchar(10)表示最多有10个字符
```

修改列名、数据类型：

```shell
alter table 表名 modify 列名 新数据类型;  # 修改列的数据类型
alter table 表名 change 列名 新列名 新数据类型;  # 同时修改列名和数据类型
```

删除列：

```shell
alter table 表名 drop 列名; 
```

##### 查询

**查询数据库中的所有表**

```shell
show tables;
```

**查询表结构**

```shell
desc 表名;
```



### DQL（Data Query Language）

DQL就是用来查询表中的数据的，为用户提供查询数据的能力，这也是通常最频繁的数据库日常操作。

#### 基本查询（select）

要查询数据库表的数据，我们使用如下的SQL语句：

```shell
SELECT * FROM <表名>;
# 示例：
SELECT * FROM students;  # 查询students表的所有数据
```

查询结果也是一个二维表，它包含列名和每一行的数据。

`SELECT`语句其实并不要求一定要有`FROM`子句：

```shell
SELECT 100+200;
```

上述查询会直接计算出表达式的结果。虽然`SELECT`可以用作计算，但它并不是SQL的强项。但是，不带`FROM`子句的`SELECT`语句有一个有用的用途，就是用来判断当前到数据库的连接是否有效。许多检测工具会执行一条`SELECT 1;`来**测试数据库连接**。

#### 起别名（AS或者空格）

当我们想给查询出来的字段另起一个名字时，可以用 AS 关键字或者直接在该字段后面加空格然后加别名的方式来给查询出的字段重新命名：

```shell
SELECT name as my_name from websites;    -- as 关键字起别名
 
SELECT name my_name from websites;  -- 直接用空格添加别名也行
```

#### 条件查询（where、AND、OR、NOT、<>）

条件查询语法：

```shell
SELECT * FROM <表名> WHERE <条件表达式>
# 示例：
SELECT * FROM students WHERE score >= 80;
```

常用的条件表达式有：

=、>、>=、<、<=、<>（不等于，在 SQL 的一些版本中，不等于可被写成 !=）、like（相似）

#### AND（并且）

条件表达式可以用`<条件1> AND <条件2>`表达满足条件1并且满足条件2，代码示例：

```shell
SELECT * FROM students WHERE score >= 80 AND gender = 'M';  # 假设gender列存储的是字符串，那就需要用单引号括起来
```

#### OR（或者）

也可以用`<条件1> OR <条件2>来`表示满足条件1或者满足条件2，代码示例：

```shell
SELECT * FROM students WHERE score >= 80 OR gender = 'M';
```

#### <>、NOT（不等于）

`还有NOT <条件>`，表示“不符合该条件”的记录。`NOT`条件其实等价于**`<>`**，因此，`NOT`查询不是很常用。代码示例：

```shell
SELECT * FROM students WHERE NOT class_id = 2;
# 等价于：
SELECT * FROM students WHERE class_id <> 2;
```

#### 小括号() 

要组合三个或者更多的条件，就需要用小括号**`()`**表示如何进行条件运算。例如，编写一个复杂的条件：分数在80以下或者90以上，并且是男生：

```shell
SELECT * FROM students WHERE (score < 80 OR score > 90) AND gender = 'M';
```

如果不加括号，条件运算按照 **NOT > AND > OR** 的优先级进行，即 NOT 优先级最高，其次是 AND，最后是 OR。加上括号可以改变优先级。

#### between...and...（查询在某个区间的值）

between and 可以查询在某个区间之间的值：

```shell
Select * from access_log where count between 10 and 100;
```

#### in（查询属于某个集合内的值）

可以用 in 列出一个集合，查询字段的值属于该集合内的行：

```shell
SELECT * FROM access_log WHERE count IN (45, 10);
```

#### exists（过滤符合条件的数据）

exists 关键字该语法可以理解为：将主查询的数据，放到子查询中做条件验证，根据验证结果（TRUE或FALSE）来决定主查询的数据结果是否得以保留。

比如查询为：

```shell
SELECT a,b FROM table1
WHERE EXISTS(
    SELECT c FROM table2 WHERE table1.id=table2.id
) 
```

这里面的EXISTS是如何运作呢？子查询返回的是 c 字段，可是外面的查询要找的是 a 和 b 字段，这两个字段肯定不在 c 里面啊，这是如何匹配的呢？

实际上 EXISTS 用于指定一个子查询，在该子查询里面过滤外面表的符合条件的数据，该**子查询实际上并不返回任何数据，而是返回值True或False**。也就是说，实际上是在子查询里面过滤外面的表里属于 true 的数据，而子查询返回什么并不重要，比如可以是 select *、select 1、select 'xxx'，官方说法是实际执行时会忽略 select 返回的值，因此返回什么并无区别。

exists 语句的特点：

- EXISTS(subquey)只返回TRUE或FALSE，因此子查询中的SELECT * 也可以是 SELECT 1 或select ‘X’，官方说法是实际执行时会忽略SELECT清单，因此没有区别。
- EXISTS子查询的实际执行过程可能经过了优化而不是我们理解上的逐条对比，如果担忧效率问题，可进行实际检验以确定是否有效率问题。
- EXISTS子查询往往也**可以用条件表达式，其他子查询或者JOIN来替代**，何种最优需要具体问题具体分析。

#### LIKE（模糊查询）

可以使用 LIKE 进行模糊查询，比如：LIKE '%abc%'、LIKE '_abc_'，其中占位符 **_ 表示任意单个字符，% 表示任意多个（即0或者多个）字符**。

```shell
SELECT * FROM apps WHERE url LIKE '%qq%';
```

#### 去除重复（SELECT DISTINCT）

在表中，一个列可能会包含多个重复值，我们可以使用 SELECT DISTINCT 语句来去除重复值，返回某个字段的所有唯一值。

比如查询 website 表中 country 字段的所有值并去除重复：

```shell
SELECT DISTINCT country FROM Websites;
```

 当用 distinct 来查询多列时，是**查询多列组合起来没有重复的**，如果指定的列当中有一列不一样，则认为不是重复，也会查询出来。比如：

```shell
SELECT DISTINCT country,name FROM Websites;
```

此时认为只有当 country 和 name 字段的值都一样才认为是重复，否则不认为是重复。

#### 排序查询（ORDER BY）

可以用 ORDER BY 关键字来对查询出来的结果集进行排序，可以对一个列或者多个列进行排序。ORDER BY 关键字默认按照升序（ASC）对记录进行排序，如果需要降序，可以使用 DESC 关键字。

如果对多个字段进行排序时，先比较字段1，如果字段1的值一样就会比较字段2的值，以此类推。

语法：

```shell
ORDER BY 字段1 排序方式1, 字段2 排序方式2...
-- 示例
SELECT * FROM access_log ORDER BY count ASC;
```

#### 聚合函数（COUNT、MAX、MIN、SUM、AVG）

SQL 提供的聚合函数：

- COUNT：计算个数
- MAX：计算最大值
- MIN：计算最小值
- SUM：计算和
- AVG：计算平均值

聚合函数的查询结果仍然是一个二维表，只是这个二维表只有一行一列，并且列名是 关键字(字段名)，类似于 SUM(num)``

注意，**聚合函数的计算不会把 null 值计算在内**。比如某个表有3条记录，但某个记录的 name 字段的值为 null，则用 count(name) 计算列数时不会把这条记录计算进去，即得出的结果只有 2 条记录。

```shell
SELECT count(id) FROM websites;
SELECT MAX(count) FROM access_log;
SELECT MIN(count) FROM access_log;
SELECT SUM(count) FROM access_log;
SELECT AVG(count) FROM access_log;
```

#### 分组查询（GROUP BY）

我们可以用 group by 关键字来进行分组查询。分组查询可以理解为分类。

```shell
SELECT gender, AVG(score) FROM students GROUP BY gender;
```

在进行分组后，select 查询的字段一般会是分组字段、聚合函数，或者是 where 查询条件里面的字段，或者是跟这些字段有强关联的字段，比如用字段 id 进行分组，每个 id 对应着唯一的 name，则此时也可以查询 name 字段的值。

除了上述一些字段，使用 group by 时查询其他的字段意义不大。比如上面如果此时查询 id 字段，虽然 SQL 不会报错，但只会查询出第一个有分组字段的记录，没有什么实际意义，有时还有可能会查询出错误的数据。

##### 对多个字段进行分组

GROUP BY x1, x2 意思是只有当 x1 和 x2 都相同才认为是同一个组，否则都会认为是另一个不同的组。对多个字段进行分组时，实际上是对筛选为同一个组多加了限制条件。

示例：

```shell
SELECT count(1),class_id,gender FROM `students` GROUP BY class_id,gender;
```

> 一般情况下，Select Count (*)和Select Count(1)两着返回结果是一样的
>
> 假如表沒有主键(Primary key), 那么count(1)比count(*)快
>
> 如果有主键的話，那主键作为count的条件时候count(主键)最快
>
> 如果你的表只有一个字段的话那count(*)就是最快的
>
> count(*) 跟 count(1) 的结果一样，都包括对NULL的统计，而count(column) 是不包括NULL的统计

#### HAVING（对分组之后的数据进行过滤）

在 SQL 中增加 HAVING 子句原因是，WHERE 关键字无法与聚合函数一起使用。通过 having 关键字就可以将聚合函数放在作为筛选条件来过滤查询记录，HAVING 子句可以让我们筛选分组后的各组数据。

```shell
SELECT name, gender, AVG(score) FROM students WHERE score > 50 GROUP BY gender HAVING count(id) >= 5;   -- 先筛选score大于50的数据。筛选完之后，得到分组数据，然后只保留分组之后的所有的记录数量大于等于5的分组数据
```

where 在分组之前对数据进行过滤，如果不满足条件将不会参与分组。而 having 是对分组之后得到的数据进行过滤，如果不满足则不会被查询出来。

#### 分页查询（limit）

当数据量过大时，一般我们会采用分页查询，即每次只查询固定数量的记录。

比如，MySQL 的分页语句是：

```shell
select * from students limit 开始索引, 一页查询的数量;
```

其中 开始的索引 = （当前页码-1）* 每页的数量

示例，每次查询 3 条记录：

```shell
SELECT * FROM students LIMIT 0,3;   -- 第一页，查询第1~第3条记录
 
SELECT * FROM students LIMIT 3,3;   -- 第二页，查询第4~第6条记录
```



### DML（Data Manipulation Language）

DML就是用来增删改表中的数据的，为用户提供添加、删除、更新数据的能力，这些是应用程序对数据库的日常操作。

#### 添加数据（insert）

INSERT INTO 语句用于向表中插入新记录。添加数据的语法：

**插入一条数据：**

```shell
INSERT INTO table_name (column1,column2,column3,...) VALUES (value1,value2,value3,...);    -- 指定列名及被插入的值。此时列名和值的数量和数据类型都要一一对应，否则会报错。

INSERT INTO table_name VALUES (value1,value2,value3,...);    -- 无需指定要插入数据的列名，只需提供被插入的值即可。此时默认要给所有的列都添加值，如果值数量少了会报错。如果有自增主键，可以赋值为 null，数据库会自动处理
```

字段顺序不必和数据库表的字段顺序一致，但值的顺序必须和字段顺序一致。

**除了数字类型，其他类型的值都需要用引号（单引号或者双引号都可以）引起来。**

**一次性插入多条数据：**

一次性添加多条记录只需要在`VALUES`子句中指定多个记录值，每个记录是由小括号（）包含的一组值：

```shell
INSERT INTO table_name (column1,column2,column3,...) VALUES (value1,value2,value3,...), (value4,value5,value6,...) ;
# 代码示例：
INSERT INTO students (class_id, name, gender, score) VALUES (1, '大宝', 'M', 87),(2, '二宝', 'M', 81);
```

#### 删除数据（delete）

DELETE 语句用于删除表中的记录。语法：

```shell
DELETE FROM 表名 WHERE 筛选条件;  # 不带WHERE条件的DELETE语句会删除整个表的数据。如果WHERE条件没有匹配到任何记录，DELETE语句不会报错，也不会有任何记录被删除。
#示例：
DELETE FROM students;  # 删除整个student表的数据
DELETE FROM students WHERE id=1;  
DELETE FROM students WHERE id>=5 AND id<=7;
```

如果要删除掉整个表的数据不建议使用 delete 语句，因为有多少条数据就会执行多少次 delete 语句，效率偏低。

#### 修改数据（update）

UPDATE 语句用于更新表中的记录。

```shell
UPDATE 表名 SET 列名=值,列名=值,... WHERE 条件;  # UPDATE语句可以没有WHERE条件，这时整个表的所有记录都会被更新。。如果WHERE条件没有匹配到任何记录，UPDATE语句不会报错，也不会有任何记录被更新
#示例：
UPDATE students SET score=60;  # 整个student表的所有记录都会被更新
UPDATE students SET name='大牛', score=66 WHERE id=1;
UPDATE students SET name='小牛', score=77 WHERE id>=5 AND id<=7;  # 一次更新多条数据
UPDATE students SET score=score+10 WHERE score<80;  # 在更新数据时可以使用表达式
```



### DCL（Data Control Language）

DCL是用来授权的，用来定义数据库的访问权限和安全级别，以及创建用户等。关键字：GRANT、REVOKE等。

#### 创建用户

```shell
CREATE USER '用户名'@'主机名' IDENTIFIED BY '密码';
```

- ‘用户名’，将创建的用户名
- ‘主机名’，定该用户在哪个主机上可以登陆，如果是本地用户可用 localhost，如果想让该用户可以从任意远程主机登陆，可以使用通配符%
- ‘密码’，该用户的登陆密码，密码可以为空，如果为空则该用户可以不需要密码登陆服务器

```shell
create user 'user1'@'localhost' identified by '123';

create user 'user2'@'%' identified by '123';
```

创建的用户名都在 mysql 数据库中的 user 表中可以查看到，密码经过了加密。

#### 用户授权

```shell
GRANT 权限 1, 权限 2... ON 数据库名.表名 TO '用户名'@'主机名';
```

- GRANT…ON…TO，授权关键字
- 权限，授予用户的权限，如 CREATE、ALTER、SELECT、INSERT、UPDATE 等。如果要授予所有的权限则使用 ALL
- 数据库名.表名，该用户可以操作哪个数据库的哪些表。如果要授予该用户对所有数据库和表的相应操作权限则可用表示，如.*
- ‘用户名’@‘主机名’，给哪个用户授权，注：有 2 对单引号



```shell
grant create,alter,insert,update,select on test.* to 'user1'@'localhost';
```

用户名和主机名要与上面创建的相同，要加单引号。

```shell
grant all on *.* to 'user2'@'%';
```

#### 撤销权限

```shell
REVOKE 权限 1, 权限 2... ON 数据库.表名 from  '用户名'@'主机名';
```

- REVOKE…ON…FROM	撤销授权的关键字
- 权限	用户的权限，如 CREATE、ALTER、SELECT、INSERT、UPDATE 等，所有的权限则使用 ALL
- 数据库名.表名	对哪些数据库的哪些表，如果要取消该用户对所有数据库和表的操作权限则可用表示，如.*
- ‘用户名’@‘主机名’	给哪个用户撤销

```shell
revoke all on test.* from 'user1'@'localhost';
```

#### 查看权限

```shell
SHOW GRANTS FOR '用户名'@'主机名';
```

#### 删除用户

```shell
DROP USER '用户名'@'主机名';
```

#### 修改管理员密码

```shell
mysqladmin -uroot -p password 新密码
```

#### 修改普通用户密码

```shell
set password for '用户名'@'主机名' = password('新密码');
```

## 参考

[数据库的相关概念 ](https://www.cnblogs.com/wenxuehai/p/13361629.html)
