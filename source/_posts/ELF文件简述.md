---
title: ELF文件简述
date: 2017-10-23 11:16:53
tags:
  - ELF
---

ELF(Executable and Linkable Format)是一种用于二进制文件、可执行文件、目标代码、共享库和核心转储的格式文件，是UNIX系统实验室（USL）作为应用程序二进制接口（Application Binary Interface，ABI）而开发和发布的，也是Linux的主要可执行文件格式。

## ELF文件类型

ELF 格式的文件可归为如下4类：

| ELF文件类型                     | 说明                                       | 实例                                 |
| --------------------------- | ---------------------------------------- | ---------------------------------- |
| 可重定位文件 (Relocatable File)   | 这类文件包含了代码和数据，可以被用来链接成可执行文件或共享目标文件，静态链接库也可以归为这一类。 | Linux的.o文件和.ko（内核）文件；Windows的.obj。 |
| 可执行文件 (Executable File)     | 这类文件包含了可以直接执行的程序，一般无扩展名。                 | Linux的/bin/bash；Windows的.exe。      |
| 共享目标文件 (Shared Object File) | 这种文件包含了代码和数据，可以在以下两种情况下使用。一种是**链接器**可以使用这种文件跟其他的可重定位文件和共享目标文件链接，产生新的目标文件。第二种是**动态链接器**可以将几个这种共享目标文件与可执行文件结合，作为进程映像的一部分来运行。 | Linux的.so；Windows的.dll。            |
| 核心转储文件 (Core Dump File)     | 当进程意外终止时，系统可以将该进程的地址空间内容及终止时的一些其他信息转储到核心转储文件。 | Linux的core dump                    |

第四种类型可以忽略。可以用'file'命令来查看文件类型。

```shell
# file 8021q.ko 
8021q.ko: ELF 32-bit LSB relocatable, Intel 80386, version 1 (SYSV), not stripped
# file /bin/mv
/bin/mv: ELF 32-bit LSB executable, Intel 80386, version 1 (SYSV), dynamically linked (uses shared libs), for GNU/Linux 2.6.18, stripped
# file /lib/libc-2.12.so 
/lib/libc-2.12.so: ELF 32-bit LSB shared object, Intel 80386, version 1 (GNU/Linux), dynamically linked (uses shared libs), for GNU/Linux 2.6.18, not stripped
```



## ELF文件结构

可以用“readelf”命令来查看ELF文件的信息。

```shell
# readelf -a test
ELF Header:
  Magic:   7f 45 4c 46 01 01 01 00 00 00 00 00 00 00 00 00 
  Class:                             ELF32
  Data:                              2's complement, little endian
  Version:                           1 (current)
  OS/ABI:                            UNIX - System V
  ABI Version:                       0
  Type:                              EXEC (Executable file)
  Machine:                           Intel 80386
  Version:                           0x1
  Entry point address:               0x8048300
  Start of program headers:          52 (bytes into file)
  Start of section headers:          1920 (bytes into file)
  Flags:                             0x0
  Size of this header:               52 (bytes)
  Size of program headers:           32 (bytes)
  Number of program headers:         8
  Size of section headers:           40 (bytes)
  Number of section headers:         30
  Section header string table index: 27

Section Headers:
  [Nr] Name              Type            Addr     Off    Size   ES Flg Lk Inf Al
  [ 0]                   NULL            00000000 000000 000000 00      0   0  0
  [ 1] .interp           PROGBITS        08048134 000134 000013 00   A  0   0  1
  [ 2] .note.ABI-tag     NOTE            08048148 000148 000020 00   A  0   0  4
  [ 3] .note.gnu.build-i NOTE            08048168 000168 000024 00   A  0   0  4
  [ 4] .gnu.hash         GNU_HASH        0804818c 00018c 000020 04   A  5   0  4
  [ 5] .dynsym           DYNSYM          080481ac 0001ac 000050 10   A  6   1  4
  [ 6] .dynstr           STRTAB          080481fc 0001fc 00004a 00   A  0   0  1
  …………
  …………
```

![](https://github.com/LiuChengqian90/LiuChengqian90.github.io/blob/hexo/source/_posts/image_quoted/ELF/ELF%E7%BB%93%E6%9E%84.png)

ELF目标文件格式的最前部是ELF头部（ELF Header），这是确定的。由于目标文件既要参与程序链接又要参与程序执行。出于方便性和效率考虑，目标文件格式提供了两种并行视图，分别反映了这些活动的不同需求。

![不同视图ELF格式.png](https://github.com/LiuChengqian90/LiuChengqian90.github.io/blob/hexo/source/_posts/image_quoted/ELF/%E4%B8%8D%E5%90%8C%E8%A7%86%E5%9B%BEELF%E6%A0%BC%E5%BC%8F.png?raw=true)

- ELF头部（ELF Header）

  包含了描述整个文件的基本属性，比如ELF文件版本、目标机器型号、程序入口地址等。

- 节区头部（Section Headers）

  可选。包含描述文件节区的信息，每个节区在表中都有一项，每一项给出诸如节区名称、节区大小这类信息。用于链接的目标文件必须包含节区头部。

- 程序头部（Program Headers）

  也称作segments，可选，告诉系统如何创建进程映像。 用来构造进程映像的目标文件必须具有程序头部表，可重定位文件不需要这个表。

**section和segment的区别：**

- section称为节，是指在汇编源码中经由关键字section或segment修饰、逻辑划分的指令或数据区域。
- segment称为段，是根据目标文件中属性相同的多个section合并后的section集合，这个集合称为segment。我们平时所说的可执行程序内存空间中的代码段和数据段就是指的segment。
- section主要提供给Linker使用， 而segment提供给Loader用。Linker需要关心.text、.rel.text、.data、.rodata等，因为Linker需要做relocation，而Loader只需要知道Read/Write/Execute的属性
- executable的ELF文件可以没有section，但必须有segment。ELF文件中间部分是共用的（也就是代码段、数据段等），如shared objects就可以同时拥有Program header table和Section Header Table，这样load完后还可以relocate。
- 这样设定之后，使得Loader需要做的工作大大减少了，一定程度上提高了程序加载的效率。

（摘自[Section和Segment的区别](http://book.51cto.com/art/201604/509540.htm) 和 [ELF文件中section与segment的区别](http://blog.csdn.net/joker0910/article/details/7655606)）

在大多数情况下，这两者都被混为一谈。

除了 ELF 头部表以外， 其他节区和段都没有规定的顺序。

### ELF数据表示

### ELF Hearder

结构体（在 /usr/include/elf.h 中定义）

### 程序头部（Program Header）

### 节区（Sections）

### 字符串表（String Table）

### 符号表（Symbol Table）

### 重定位信息





## 参考资料

[可执行文件（ELF）格式的理解](http://www.cnblogs.com/xmphoenix/archive/2011/10/23/2221879.html)

[linux第三次实践：ELF文件格式分析](http://www.cnblogs.com/cdcode/p/5551649.html)

[ELF文件格式分析](https://segmentfault.com/a/1190000007103522)

[ELF文件标准](https://zhuanlan.zhihu.com/p/25072514)

