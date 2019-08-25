---
title: Crudini:配置文件编译利器
date: 2019-08-16 07:55:19
categories:
tags:
  - crudini
---



crud ini是一个实用程序，用于简化从shell脚本读取和更新ini文件的过程，因此命名为提供crud功能。

## 工具安装

```
$ sudo yum install crudini -y
```

除此之外，也可以利用RPM包进行安装。centos 6.x 和 centos 7.x的RPM包链接：

[crudini-0.9-1.el6.noarch.rpm](https://centos.pkgs.org/6/epel-i386/crudini-0.9-1.el6.noarch.rpm.html)

[crudini-0.9-1.el7.noarch.rpm](https://centos.pkgs.org/7/epel-x86_64/crudini-0.9-1.el7.noarch.rpm.html)



## 用法

```shell
One of --set|--del|--get|--merge must be specified
A utility for manipulating ini files

Usage: crudini --set [OPTION]...   config_file section   [param] [value]
  or:  crudini --get [OPTION]...   config_file [section] [param]
  or:  crudini --del [OPTION]...   config_file section   [param] [list value]
  or:  crudini --merge [OPTION]... config_file [section]

Options:

  --existing[=WHAT]  For --set, --del and --merge, fail if item is missing,
                       where WHAT is 'file', 'section', or 'param', or if
                       not specified; all specified items.
  --format=FMT       For --get, select the output FMT.
                       Formats are sh,ini,lines
  --inplace          Lock and write files in place.
                       This is not atomic but has less restrictions
                       than the default replacement method.
  --list             For --set and --del, update a list (set) of values
  --list-sep=STR     Delimit list values with "STR" instead of " ,"
  --output=FILE      Write output to FILE instead. '-' means stdout
  --verbose          Indicate on stderr if changes were made
  --help             Write this help to stdout
  --version          Write version to stdout
```



对于配置文件 `test.ini`

```
[DEFAULT]
user = testname
passwd = testpasswd

[WEBURL]
ip = 192.168.5.66
port = 8080
```



`config_file`为要修改配置的文件名。例如 `test.ini`。  

`section`为要修改的某个参数所在的域。例如 `DEFAULT`或`WEBURL`。

`param`为要修改的参数名称。例如`user`或`ip`。

`value`即为要设置参数的值。

### 添加

```shell
$ crudini --set config_file section parameter value
```



### 更新

```shell
$ crudini --set [--existing] config_file section parameter value
```



### 删除

删除某个参数

```shell
$ crudini --del config_file section parameter
```

如果该标量不在某一个section里面，则section用一个空字符表示：

```shell
$ crudini --del config_file '' parameter
```

删除整个域

```shell
$ crudini --del config_file section
```



### 合并

`merge`可以将某个文件的参数合并到另一个文件。

```
$ crudini --merge config_file < another.ini
```

将another.ini配置文件合并到config_file中。



### 获取

```
crudini --get [OPTION]...   config_file [section] [param]
```

仅指定文件，会返回文件中所有域。

指定`section`，会返回此域中的所有参数（值不返回）。

指定`param`，会返回此参数的值。



## 优秀资料

[crudini](http://www.pixelbeat.org/programs/crudini/)

