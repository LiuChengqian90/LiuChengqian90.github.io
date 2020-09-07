---
title: C语言的字节对齐探究
date: 2017-10-25 17:50:46
tags:
  - C语言
  - 数据对齐
---

环境如下（下文所有涉及类型长度都是以此环境为依据）：
<!--more-->
```shell
# uname  -a
2.6.32-696.el6.i686 #1 SMP Tue Mar 21 18:53:30 UTC 2017 i686 i686 i386 GNU/Linux
# gcc -v 
…………
gcc version 4.4.7 20120313 (Red Hat 4.4.7-18) (GCC) 
```

32位类型所占字节数

| 类型     | 长度（字节） |
| ------ | ------ |
| char   | 1      |
| short  | 2      |
| int    | 3      |
| float  | 4      |
| double | 8      |

## 缺省对齐

在C语言中，结构是一种复合数据类型，其构成元素既可以是基本数据类型（如int、long、float等）的变量，也可以是一些复合数据类型（如数组、结构、联合等）的数据单元。

**在结构中，各个成员按照它们被声明的顺序在内存中顺序存储，第一个成员的地址和整个结构的地址相同。**

**结构内，编译器在默认情况下使结构成员按其类型长度对齐，即int类型成员对齐长度为4，double类型成员对齐长度为8。成员起始偏移（相对结构地址）必须是对齐长度或其倍数；不满足，则需要在前一个成员后添加空字节使其满足。**

**结构外（指作为整体单独计算或作为其他结构的成员计算），以结构内部最大成员类型长度对齐。**

先对**结构内对齐方式**进行验证，代码如下（**代码段1**）：

```c
#include <stdio.h>

#define PRINTF(intValue)     printf(#intValue" is %d \n", (intValue));
#define OFFSET_M(struct, member)  ((char *)&((struct *)0)->member - (char *)0)

typedef struct 
{
    char a;
    double b;
    short c;
}struct_a;

typedef struct 
{
    char a;
    short b;
    double c;
}struct_b;

int main(void)
{
    PRINTF(OFFSET_M(struct_a, a))
    PRINTF(OFFSET_M(struct_a, b))
    PRINTF(OFFSET_M(struct_a, c))
    PRINTF(sizeof(struct_a))

    PRINTF(OFFSET_M(struct_b, a))
    PRINTF(OFFSET_M(struct_b, b))
    PRINTF(OFFSET_M(struct_b, c))
    PRINTF(sizeof(struct_b))
    
    return 0;
}
```

编译之后运行结果如下：

```shell
# gcc  test.c ; ./a.out  
OFFSET_M(struct_a, a) is 0 
OFFSET_M(struct_a, b) is 4 
OFFSET_M(struct_a, c) is 12 
sizeof(struct_a) is 16 
OFFSET_M(struct_b, a) is 0 
OFFSET_M(struct_b, b) is 2 
OFFSET_M(struct_b, c) is 4 
sizeof(struct_b) is 12 
```

运行结果与我们预想的不一样。struct_a中b的偏移应该为8，而不应该为4！

造成此结果的原因为：gcc编译器进行了一些优化，在32位系统中默认对齐长度为4字节，64位系统中默认对齐字节为8字节，因此对验证有影响。

为了消除此影响，代码转到线上编译器上运行。

```
http://c.yxz.me/
或
http://codepad.org/
```

运行结果为：

```shell
OFFSET_M(struct_a, a) is 0 
OFFSET_M(struct_a, b) is 8 
OFFSET_M(struct_a, c) is 16 
sizeof(struct_a) is 24 
OFFSET_M(struct_b, a) is 0 
OFFSET_M(struct_b, b) is 2 
OFFSET_M(struct_b, c) is 8 
sizeof(struct_b) is 16 
```

与预期相符：

- struct_a，成员b在偏移8字节处对齐，a补齐7字节，b后跟c(2个字节)，8 + 8 + 2 = 18 ，整体以成员最大长度8字节对齐，则最后再补齐6字节，结构体共占 24 字节。
- struct_b，比较好分析，a占2字节（补齐1个），b占6字节（补齐4字节），c占用8字节，共16字节。

对**结构外对齐方式**验证，代码如下（**代码段2**）：

```c
#include <stdio.h>

#define PRINTF(intValue)     printf(#intValue" is %d \n", (intValue));
#define OFFSET_M(struct, member)  ((char *)&((struct *)0)->member - (char *)0)

typedef struct 
{
    char a;
    double b;
    short c;
}struct_a;

typedef struct 
{
    char a;
    struct_a b;
}struct_b;

int main(void)
{
    PRINTF(sizeof(struct_a))

    PRINTF(OFFSET_M(struct_b, a))
    PRINTF(OFFSET_M(struct_b, b))
    PRINTF(sizeof(struct_b))
    
    return 0;
}
```

运行结果如下：

```
sizeof(struct_a) is 24 
OFFSET_M(struct_b, a) is 0 
OFFSET_M(struct_b, b) is 8 
sizeof(struct_b) is 32 
```

与预期相符。

## 改变缺省对齐

现有两种方式改变缺省对齐方式：

1. 使用伪指令 **#pragma pack (n)**，按照n个字节对齐。**#pragma pack ()**，取消自定义字节对齐方式。
2. __attribute((aligned (n)))，让所作用的结构成员以n字节对齐。如果结构中有成员的长度大于n，则按照最大成员的长度来对齐。

下面开始验证。修改**代码段1**为

```c
#include <stdio.h>

#define PRINTF(intValue)     printf(#intValue" is %d \n", (intValue));
#define OFFSET_M(struct, member)  ((char *)&((struct *)0)->member - (char *)0)

#pragma pack(2)

typedef struct 
{
    char a;
    double b;
    short c;
}struct_a;

typedef struct 
{
    char a;
    short b;
    double c;
}struct_b;

#pragma pack()

int main(void)
{
    PRINTF(OFFSET_M(struct_a, a))
    PRINTF(OFFSET_M(struct_a, b))
    PRINTF(OFFSET_M(struct_a, c))
    PRINTF(sizeof(struct_a))

    PRINTF(OFFSET_M(struct_b, a))
    PRINTF(OFFSET_M(struct_b, b))
    PRINTF(OFFSET_M(struct_b, c))
    PRINTF(sizeof(struct_b))
    
    return 0;
}
```

通过以上方式，分别改为2、4、8、16字节对齐，运行结果为：

```shell
#2字节对齐
OFFSET_M(struct_a, a) is 0 
OFFSET_M(struct_a, b) is 2 
OFFSET_M(struct_a, c) is 10 
sizeof(struct_a) is 12 
OFFSET_M(struct_b, a) is 0 
OFFSET_M(struct_b, b) is 2 
OFFSET_M(struct_b, c) is 4 
sizeof(struct_b) is 12 

#4字节对齐
OFFSET_M(struct_a, a) is 0 
OFFSET_M(struct_a, b) is 4 
OFFSET_M(struct_a, c) is 12 
sizeof(struct_a) is 16 
OFFSET_M(struct_b, a) is 0 
OFFSET_M(struct_b, b) is 2 
OFFSET_M(struct_b, c) is 4 
sizeof(struct_b) is 12 

#8字节对齐
OFFSET_M(struct_a, a) is 0 
OFFSET_M(struct_a, b) is 8 
OFFSET_M(struct_a, c) is 16 
sizeof(struct_a) is 24 
OFFSET_M(struct_b, a) is 0 
OFFSET_M(struct_b, b) is 2 
OFFSET_M(struct_b, c) is 8 
sizeof(struct_b) is 16 

#16字节对齐
OFFSET_M(struct_a, a) is 0 
OFFSET_M(struct_a, b) is 8 
OFFSET_M(struct_a, c) is 16 
sizeof(struct_a) is 24 
OFFSET_M(struct_b, a) is 0 
OFFSET_M(struct_b, b) is 2 
OFFSET_M(struct_b, c) is 8 
sizeof(struct_b) is 16 
```

分析运行结果，可得以下结论

- 内部，配置对齐字节与成员缺省对齐字节相比，选择较小的。配置大于内部成员缺省最大对齐字节无意义。
- 外部（或整体），配置对齐字节与内部成员缺省最大对齐字节，也选择较小的。

**GCC编译代码（无自定义对齐）也可得相同结论。**

**三者同时存在时，也是按照“最小规则”处理。**

## 参考资料

[C语言中的数据对齐](http://www.cnblogs.com/sirlipeng/p/4792062.html)

[C语言的字节对齐及#pragma pack的使用](http://www.cnblogs.com/dabiao/archive/2010/04/15/1712458.html)

[内存对界](http://www.cnblogs.com/chinaxmly/archive/2012/09/30/2709189.html)