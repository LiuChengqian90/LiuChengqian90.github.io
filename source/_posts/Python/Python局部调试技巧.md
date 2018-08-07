---
title: Python局部调试技巧
date: 2018-08-7 11:24:08
categories: Python
tags:
  - pdb
---

Python中pdb是一种比较好用的调试工具，其设置断点方法如下

```python
__import__('pdb').set_trace()
```

或

```python
import pdb
pdb.set_trace()
```

**使用这个方式有一个前提：程序不可后台运行，即必须拿到console（或tty）。**



如果程序在后台(或子程序)运行，可以用下面的方式进行调试：

```python
import pdb, socket
s = socket.socket()
s.connect(('127.0.0.1', 8888))
f = s.makefile()
pdb.Pdb(stdin=f, stdout=f).set_trace()
```

在连接到的目标端口上，提前用nc做好监听，就可以在触发断点的时候直接连接上来调试。

```shell
# nc -l 127.0.0.1 8888
```

其主要思想就是：建TCP连接，给pdb一个console。



## 优秀资料

[一种新的python局部调试手法](http://blog.shell909090.org/blog/archives/2450/)