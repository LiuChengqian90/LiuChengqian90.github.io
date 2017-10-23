---
title: GCC编译过程详解
date: 2017-10-16 17:27:11
tags:
  - GCC
  - 编译
---

## GCC简介

GCC（GNU Compiler Collection，GNU编译器套件），是由 GNU 开发的编程语言编译器。GCC原本作为GNU操作系统的官方编译器，现已被大多数类Unix操作系统（如Linux、BSD、Mac OS X等）采纳为标准的编译器，GCC同样适用于微软的Windows。GCC由自由软件基金会以GPL协议发布。

GCC 原名为 GNU C 语言编译器（GNU C Compiler），因为它原本只能处理 C语言。GCC 很快地扩展，变得可处理 C++。后来又扩展能够支持更多编程语言，如Fortran、Pascal、Objective-C、Java、Ada、Go以及各类处理器架构上的汇编语言等，所以改名GNU编译器套件（GNU Compiler Collection）。

编译器的工作是将源代码(通常使用高级语言编写)翻译成目标代码(通常是低级的目标代码或者机器语言)，在现代编译器的实现中，这个工作一般是分为两个阶段来实现：

1. 编译器的前端接受输入的源代码，经过词法、语法和语义分析等等得到源程序的某种中间表示方式。
2. 编译器的后端将前端处理生成的中间表示方式进行一些优化，并最终生成在目标机器上可运行的代码。

GCC 设计中有两个重要的目标：

- 硬件无关性：在构建支持不同硬件平台的编译器时，它的代码能够最大程度的被复用。
- 要生成高质量的可执行代码，这就需要对代码进行集中的优化。

为了实现这两个目标，GCC 内部使用了一种硬件平台无关的语言，它能对实际的体系结构做一种抽象，这个中间语言为 RTL(Register Transfer Language)。

## GCC的工作流程

GCC是一个驱动程序，它接受并解释命令行参数，根据对命令行参数分析的结果决定下一步动作，GCC提供了多种选项以达到控制GCC编译过程的目的，可以在 [GCC 手册](http://www.baidu.com/link?url=q2ZDFInBce2KYMXONmpfqPxhCRx9bKWyuEJrjLg5MzL2MpYXQM_H963t9K_coYMv)中查找这些编译选项的详细信息。

GCC的使用是比较简单的，但是要深入到其内部去了解编译流程，情况就比较复杂了。有两个比较好的方法解析GCC：

- 阅读[源码](https://gcc.gnu.org/wiki/GitMirror)，对感兴趣的函数可以跟踪过去看一看，阅读代码看起来可怕，但其实代码中会有很多注释说明它的功能，使得我们的阅读变得更简单一些，这种方法便于从整体上把握GCC。
- 调试GCC，就是使用调试器来跟踪 GCC 的编译过程，这样可以看清 GCC 编译的实际流程，也可以追踪我们感兴趣的细节部分。

## GCC的基本用法

```shell
gcc [options] infile
```

其中options就是编译器所需要的参数，infile给出相关的文件名称。

下表列出一些常用的参数说明：

| 参数      | 说明                           |
| ------- | ---------------------------- |
| -E      | 预处理后即停止，不进行编译。               |
| -S      | 编译后即停止，不进行汇编。                |
| -c      | 编译或汇编源文件，但是不作连接。             |
| -o file | 指定输出文件为file，该选项不在乎GCC产生什么输出。 |

## GCC的基本规则

gcc所遵循的部分约定规则：

- .c为后缀的文件，C语言源代码文件；
- .a为后缀的文件，是由目标文件构成的档案库文件；
- .C，.cc或.cxx 为后缀的文件，是C++源代码文件且必须要经过预处理；
- .h为后缀的文件，是程序所包含的头文件；
- .i 为后缀的文件，是C源代码文件且不应该对其执行预处理；
- .ii为后缀的文件，是C++源代码文件且不应该对其执行预处理；
- .m为后缀的文件，是Objective-C源代码文件；
- .mm为后缀的文件，是Objective-C++源代码文件；
- .o为后缀的文件，是编译后的目标文件；
- .s为后缀的文件，是汇编语言源代码文件；
- .S为后缀的文件，是经过预编译的汇编语言源代码文件。

## GCC的编译过程

GCC的编译过程可以分为以下四个阶段：**预处理、编译、汇编、链接**，如下图所示：

![GCC编译过程.jpg](https://github.com/LiuChengqian90/LiuChengqian90.github.io/blob/hexo/source/_posts/image_quoted/GCC%E7%BC%96%E8%AF%91%E8%BF%87%E7%A8%8B%E8%AF%A6%E8%A7%A3/GCC%E7%BC%96%E8%AF%91%E8%BF%87%E7%A8%8B.jpg?raw=true)

以下面代码为例：

```c
#include <stdio.h>

int main()
{
    printf("Hello World\n");
    return 0;
}
```

include两种方式：

- \#include<> 引用的是编译器的**类库路径**里面的头文件。
- \#include" " 引用的是程序目录的**相对路径**中的头文件。

### 预处理

```shell
# gcc –E test.c –o test.i
或者
# cpp -o test.i test.c
```

以下为test.i部分内容：

```c
# 1 "test.c"
# 1 "<built-in>"
# 1 "<command-line>"
# 1 "/usr/include/stdc-predef.h" 1 3 4
# 1 "<command-line>" 2
# 1 "test.c"
# 1 "/usr/include/stdio.h" 1 3 4
# 27 "/usr/include/stdio.h" 3 4
# 1 "/usr/include/features.h" 1 3 4
…………
# 2 "test.c" 2

int main()
{
    printf("Hello World\n");
    return 0;
}
```

预处理过程主要处理那些源代码中以#开始的预编译指令，主要处理规则如下：

- 将所有的#define删除，并且展开所有的宏定义；
- 处理所有条件编译指令，如#if，#ifdef等；
- 处理#include预编译指令，将被包含的文件插入到该预编译指令的位置。该过程递归进行，及被包含的文件可能还包含其他文件。
- 删除所有的注释//和 /**/；
- 添加行号和文件标识，如#2 “hello.c” 2,以便于编译时编译器产生调试用的行号信息及用于编译时产生编译错误或警告时能够显示行号信息；
- 保留所有的#pragma编译器指令，因为编译器须要使用它们；

### 编译

编译过程就是把预处理完的文件进行一系列词法分析，语法分析，语义分析及优化后生成相应的汇编代码文件。

```shell
# gcc -S test.i -o test.s
或者
# ccl -o test.s test.i
```

以下为test.s部分内容：

```asm
	.file	"test.c"
	.section	.rodata
.LC0:
	.string	"Hello World"
	.text
	.globl	main
	.type	main, @function
main:
.LFB0:
	.cfi_startproc
	pushq	%rbp
	.cfi_def_cfa_offset 16
	.cfi_offset 6, -16
	movq	%rsp, %rbp
	.cfi_def_cfa_register 6
	movl	$.LC0, %edi
	call	puts
	movl	$0, %eax
	popq	%rbp
	.cfi_def_cfa 7, 8
	ret
	.cfi_endproc
.LFE0:
	.size	main, .-main
	.ident	"GCC: (GNU) 4.8.5 20150623 (Red Hat 4.8.5-16)"
	.section	.note.GNU-stack,"",@progbits
```

### 汇编

汇编器是将汇编代码转变成机器可以执行的命令，每一个汇编语句几乎都对应一条机器指令。汇编相对于编译过程比较简单，根据汇编指令和机器指令的对照表一一翻译即可。

```shell
# gcc -c test.c  -o test.o
或者
# as -o test.o test.s
```

test.o的内容为机器码，不能以文本形式方便的呈现。利用hexdump 查看如下：

```shell
#  hexdump test.o 
0000000 457f 464c 0102 0001 0000 0000 0000 0000
0000010 0001 003e 0001 0000 0000 0000 0000 0000
0000020 0000 0000 0000 0000 0298 0000 0000 0000
0000030 0000 0000 0040 0000 0000 0040 000d 000a
0000040 4855 e589 00bf 0000 e800 0000 0000 00b8
0000050 0000 5d00 48c3 6c65 6f6c 5720 726f 646c
0000060 0000 4347 3a43 2820 4e47 2955 3420 382e
0000070 352e 3220 3130 3035 3236 2033 5228 6465
0000080 4820 7461 3420 382e 352e 312d 2936 0000
0000090 0014 0000 0000 0000 7a01 0052 7801 0110
00000a0 0c1b 0807 0190 0000 001c 0000 001c 0000
00000b0 0000 0000 0015 0000 4100 100e 0286 0d43
00000c0 5006 070c 0008 0000 2e00 7973 746d 6261
00000d0 2e00 7473 7472 6261 2e00 6873 7473 7472
00000e0 6261 2e00 6572 616c 742e 7865 0074 642e
00000f0 7461 0061 622e 7373 2e00 6f72 6164 6174
0000100 2e00 6f63 6d6d 6e65 0074 6e2e 746f 2e65
0000110 4e47 2d55 7473 6361 006b 722e 6c65 2e61
0000120 6865 665f 6172 656d 0000 0000 0000 0000
0000130 0000 0000 0000 0000 0000 0000 0000 0000
```

### 链接

链接器ld将各个目标文件组装在一起，解决符号依赖，库依赖关系，并生成可执行文件。如下形式：

```shell
ld –static crt1.o crti.o crtbeginT.o test.o –start-group –lgcc –lgcc_eh –lc-end-group crtend.o crtn.o (省略了文件的路径名)
```

```shell
# gcc -o test test.o
或者
# ld -o test test.o
```

test程序调用了printf 函数，这个函数是标准C库中的一个函数，它保存在一个名为printf.o 的文件中，这个文件必须以某种方式合并到test.o的程序中。

链接器ld负责处理这种合并。结果得到test可执行文件，可以被加载到内存中由系统执行。

### 小结

以上过程可以参考下图：

![GCC编译过程详解.png](https://github.com/LiuChengqian90/LiuChengqian90.github.io/blob/hexo/source/_posts/image_quoted/GCC%E7%BC%96%E8%AF%91%E8%BF%87%E7%A8%8B%E8%AF%A6%E8%A7%A3/GCC%E7%BC%96%E8%AF%91%E8%BF%87%E7%A8%8B%E8%AF%A6%E8%A7%A3.png?raw=true)

## 参考资料

[GCC编译过程分解](http://blog.chinaunix.net/uid-20196318-id-28797.html)

[gcc编译过程简述](http://www.cnblogs.com/dfcao/p/csapp_intr1_1-2.html)

[GCC-百度百科](https://baike.baidu.com/item/gcc/17570?fr=aladdin)

[GCC中文手册](http://www.cnblogs.com/liangxiaxu/articles/2617367.html)