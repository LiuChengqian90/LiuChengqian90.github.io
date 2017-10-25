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
# readelf -a SimpleSection.o
ELF Header:
  Magic:   7f 45 4c 46 01 01 01 00 00 00 00 00 00 00 00 00 
  Class:                             ELF32
  Data:                              2's complement, little endian
  Version:                           1 (current)
  OS/ABI:                            UNIX - System V
  ABI Version:                       0
  Type:                              REL (Relocatable file)
  Machine:                           Intel 80386
  Version:                           0x1
  Entry point address:               0x0
  Start of program headers:          0 (bytes into file)
  Start of section headers:          272 (bytes into file)
  Flags:                             0x0
  Size of this header:               52 (bytes)
  Size of program headers:           0 (bytes)
  Number of program headers:         0
  Size of section headers:           40 (bytes)
  Number of section headers:         11
  Section header string table index: 8

Section Headers:
  [Nr] Name              Type            Addr     Off    Size   ES Flg Lk Inf Al
  [ 0]                   NULL            00000000 000000 000000 00      0   0  0
  [ 1] .text             PROGBITS        00000000 000034 000050 00  AX  0   0  4
  [ 2] .rel.text         REL             00000000 000420 000028 08      9   1  4
  [ 3] .data             PROGBITS        00000000 000084 000008 00  WA  0   0  4
  [ 4] .bss              NOBITS          00000000 00008c 000004 00  WA  0   0  4
  [ 5] .rodata           PROGBITS        00000000 00008c 000004 00   A  0   0  1
  [ 6] .comment          PROGBITS        00000000 000090 00002e 01  MS  0   0  1
  [ 7] .note.GNU-stack   PROGBITS        00000000 0000be 000000 00      0   0  1
  [ 8] .shstrtab         STRTAB          00000000 0000be 000051 00      0   0  1
  [ 9] .symtab           SYMTAB          00000000 0002c8 0000f0 10     10  10  4
  [10] .strtab           STRTAB          00000000 0003b8 000066 00      0   0  1
Key to Flags:
  W (write), A (alloc), X (execute), M (merge), S (strings)
  I (info), L (link order), G (group), x (unknown)
  O (extra OS processing required) o (OS specific), p (processor specific)

There are no section groups in this file.

There are no program headers in this file.

Relocation section '.rel.text' at offset 0x420 contains 5 entries:
 Offset     Info    Type            Sym.Value  Sym. Name
00000010  00000501 R_386_32          00000000   .rodata
00000015  00000d02 R_386_PC32        00000000   printf
0000002e  00000301 R_386_32          00000000   .data
00000033  00000401 R_386_32          00000000   .bss
00000046  00000c02 R_386_PC32        00000000   func1

There are no unwind sections in this file.

Symbol table '.symtab' contains 15 entries:
   Num:    Value  Size Type    Bind   Vis      Ndx Name
     0: 00000000     0 NOTYPE  LOCAL  DEFAULT  UND 
     1: 00000000     0 FILE    LOCAL  DEFAULT  ABS SimpleSection.c
     2: 00000000     0 SECTION LOCAL  DEFAULT    1 
     3: 00000000     0 SECTION LOCAL  DEFAULT    3 
     4: 00000000     0 SECTION LOCAL  DEFAULT    4 
     5: 00000000     0 SECTION LOCAL  DEFAULT    5 
     6: 00000004     4 OBJECT  LOCAL  DEFAULT    3 static_var.1243
     7: 00000000     4 OBJECT  LOCAL  DEFAULT    4 static_var2.1244
     8: 00000000     0 SECTION LOCAL  DEFAULT    7 
     9: 00000000     0 SECTION LOCAL  DEFAULT    6 
    10: 00000000     4 OBJECT  GLOBAL DEFAULT    3 global_init_var
    11: 00000004     4 OBJECT  GLOBAL DEFAULT  COM global_uninit_var
    12: 00000000    27 FUNC    GLOBAL DEFAULT    1 func1
    13: 00000000     0 NOTYPE  GLOBAL DEFAULT  UND printf
    14: 0000001b    53 FUNC    GLOBAL DEFAULT    1 main
```

SimpleSection.o为gcc编译（未链接）的一个可执行文件，源码为

```
/*
*  SimpleSection.c
* Linux:
*   gcc -c SimpleSection.c
*/

int printf(const char* format, ...);
int global_init_var = 84;
int global_uninit_var;

void func1(int i)
{
    printf("%d\n", i);
}

int main(void)
{
    static int static_var = 85;
    static int static_var2;
    int a = 1;
    int b;
    func1(static_var + static_var2 + a + b);
    return a;
}
```

![ELF结构.png](https://github.com/LiuChengqian90/LiuChengqian90.github.io/blob/hexo/source/_posts/image_quoted/ELF/ELF%E7%BB%93%E6%9E%84.png?raw=true)

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

ELF数据应用自定义的一组数据类型。根据不同的体系结构选择不同的类型。

ELF文件有关的数据结构都在/usr/include/elf.h 中定义（也可以在内核代码中搜索 elf.h 文件，然后根据不同的架构进行选择）。下表列出的仅是x86架构。

| 自定义类型         | 原始类型       | 长度（字节） |
| ------------- | ---------- | ------ |
| Elf32_Half    | uint16_t   | 2      |
| Elf32_Word    | uint32_t   | 4      |
| Elf32_Sword   | int32_t    | 4      |
| Elf32_Xword   | uint64_t   | 8      |
| Elf32_Sxword  | int64_t    | 8      |
| Elf32_Addr    | uint32_t   | 4      |
| Elf32_Off     | uint32_t   | 4      |
| Elf32_Section | uint16_t   | 2      |
| Elf32_Versym  | Elf32_Half | 2      |

64位体系结构有对应的自定义类型。

### ELF Hearder

包含整个文件的基本属性信息。这些信息独立于处理器，也独立于文件中的其余内容。用以下的数据结构表示：

```c
#define EI_NIDENT (16)

typedef struct
{  
  unsigned char	e_ident[EI_NIDENT];	/* 魔数及其他信息 */	
  Elf32_Half	e_type;			/* ELF文件类型 */
  Elf32_Half	e_machine;		/* ELF文件的CPU属性（架构） */
  Elf32_Word	e_version;		/* ELF文件版本号 */
  Elf32_Addr	e_entry;		/* 入口点（虚拟地址） */
  Elf32_Off	e_phoff;		/* 程序头表的偏移地址 */
  Elf32_Off	e_shoff;		/* 节区头表的偏移地址 */
  Elf32_Word	e_flags;		/* ELF标志位 */
  Elf32_Half	e_ehsize;		/* ELF文件头本身的大小 */
  Elf32_Half	e_phentsize;		/* 程序头表中的每一项大小 */
  Elf32_Half	e_phnum;		/* 程序头表中的项目数 */
  Elf32_Half	e_shentsize;		/* 节区头表中的每一项大小 */
  Elf32_Half	e_shnum;		/* 节区头表的项目数 */
  Elf32_Half	e_shstrndx;		/* 字符串表所在节区头表的位置下标 */
} Elf32_Ehdr;
```

下面对主要字段的含义进行解读：

**e_ident**

```shell
ELF Header:
  Magic:   7f 45 4c 46 01 01 01 00 00 00 00 00 00 00 00 00 
  Class:                             ELF32
  Data:                              2's complement, little endian
  Version:                           1 (current)
  OS/ABI:                            UNIX - System V
  ABI Version:                       0
```

第一行“Magic”的16个字节被ELF标准规定用来标识ELF文件的平台属性，每一个字节代表不同的含义。

前4个字节是所有ELF文件都必须相同的标识码，第一个字节对应ASCII字符里的DEL控制符，后面3个字节是ELF这3个字母的ASCII码。这4个字节被称为ELF文件的魔数。 .out格式最开始两个字节为0x01、0x07；PE/COFF文件最开始两个字节为0x4d、0x5a，即ASCII字符MZ。这种魔数用来确认文件的类型，操作系统加载可执行文件的时候会确认魔数是否正确，不正确会拒绝加载。

第5个字节用来标识ELF的文件类：0代表不确认；1代表是32位；2代表是64位。

第6个字节是字节序：0代表不确认；1代表小端；2代表大端。

第7个字节规定ELF文件的主版本号，一般是1，因为ELF标准自1.2版之后就再也没有更新了。

后面的9个字节ELF标准没有定义，一般填0，有些平台会使用这9个字节作为扩展标志。

```yaml
魔数的由来
UNIX早年是在PDP小型机上诞生的，当时的系统在加载一个可执行文件后直接从文件的当一个字节开始执行，一般在文件的最开始放置一条跳转（jump）指令，这条指令负责跳过接下来的7个机器字的文件头到可执行文件的真正入口。而0x01 0x07这两个字节正好是当时PDP-11的机器的跳转7个机器字的指令。为了跟以前的系统保持兼容，这条跳转指令被当做魔数被保留至今。

ELF文件标准历史
20世纪90年代，一些厂商联合成立了一个委员会，起草并发布了一个ELF文件格式标准供公开使用，并且希望所有人能够遵循这项标准并且从中获益。1993年，委员会发布了ELF文件标准。1995年，委员会发布了ELF 1.2标准，自此委员会完成了自己的使命，不就就解散了。所以ELF文件格式标准的最新版本为1.2。
```
**e_type**

ELF文件类型。系统通过这个常量判断ELF文件的类型，而不是通过文件的扩展名。相关常量以“ET_”开头。

| 常量      | 值    | 含义     |
| ------- | ---- | ------ |
| ET_REL  | 1    | 可重定位文件 |
| ET_EXEC | 2    | 可执行文件  |
| ET_DYN  | 3    | 共享目标文件 |
| ET_CORE | 4    | 转储文件   |

**e_machine**

ELF文件格式被设计成可以在多个平台下使用。但这并不表示同一个文件可以在不同的平台下使用，而是表示不同平台下的ELF文件都遵循同一套ELF标准。此字段表示该文件的平台属性。相关的常量以“EM_”开头。

| 常量       | 值    | 含义                    |
| -------- | ---- | --------------------- |
| EM_M32   | 1    | AT&T WE 32100         |
| EM_SPARC | 2    | SUN SPARC             |
| EM_386   | 3    | Intel 80386           |
| EM_68K   | 4    | Motorola m68k family  |
| EM_88K   | 5    | Motorola m88k family  |
| EM_860   | 7    | Intel 80860           |
| EM_MIPS  | 8    | MIPS R3000 big-endian |

### 节区头部表（Section Headers Table）

ELF文件中有很多各种各样的段，这个段表（Section Header Table）就是保存这些段的基本属性的结构。段表是ELF文件中除了文件头以外最重要的结构，它描述了ELF的各个段的信息，比如每个段的段名、段的长度、在文件中的偏移、读写权限及段的其他属性。也就是说，ELF文件的短结构就是由段表决定的。编译器、链接器和装载器都是依靠段表来定位和访问各个段的属性的。段表在文件中的位置由ELF文件头的“e_shoff”决定。

可用readelf工具查看ELF文件的段（objdump -h也可以查看，但是此命令只显示ELF文件中关键的段（.code、.data、.bss等），而忽略其他辅助性的段，比如：符号表、字符串表、段名字符串表、重定位表等）。

```shell
# readelf  -S SimpleSection.o 
There are 11 section headers, starting at offset 0x110:

Section Headers:
  [Nr] Name              Type            Addr     Off    Size   ES Flg Lk Inf Al
  [ 0]                   NULL            00000000 000000 000000 00      0   0  0
  [ 1] .text             PROGBITS        00000000 000034 000050 00  AX  0   0  4
  [ 2] .rel.text         REL             00000000 000420 000028 08      9   1  4
  [ 3] .data             PROGBITS        00000000 000084 000008 00  WA  0   0  4
  [ 4] .bss              NOBITS          00000000 00008c 000004 00  WA  0   0  4
  [ 5] .rodata           PROGBITS        00000000 00008c 000004 00   A  0   0  1
  [ 6] .comment          PROGBITS        00000000 000090 00002e 01  MS  0   0  1
  [ 7] .note.GNU-stack   PROGBITS        00000000 0000be 000000 00      0   0  1
  [ 8] .shstrtab         STRTAB          00000000 0000be 000051 00      0   0  1
  [ 9] .symtab           SYMTAB          00000000 0002c8 0000f0 10     10  10  4
  [10] .strtab           STRTAB          00000000 0003b8 000066 00      0   0  1
Key to Flags:
  W (write), A (alloc), X (execute), M (merge), S (strings)
  I (info), L (link order), G (group), x (unknown)
  O (extra OS processing required) o (OS specific), p (processor specific)
```

段表是一个以“Elf32\_Shdr”结构体为元素的数组。元素个数等于段的个数。“Elf32_Shdr”又被称为段描述符（Section Descriptor），其结构如下

```c
typedef struct
{
  Elf32_Word	sh_name;		/* Section name (string tbl index) */
  Elf32_Word	sh_type;		/* Section type */
  Elf32_Word	sh_flags;		/* Section flags */
  Elf32_Addr	sh_addr;		/* Section virtual addr at execution */
  Elf32_Off	sh_offset;		/* Section file offset */
  Elf32_Word	sh_size;		/* Section size in bytes */
  Elf32_Word	sh_link;		/* Link to another section */
  Elf32_Word	sh_info;		/* Additional section information */
  Elf32_Word	sh_addralign;		/* Section alignment */
  Elf32_Word	sh_entsize;		/* Entry size if section holds table */
} Elf32_Shdr;
```

其各个成员含义如下：

| 成员           | 描述                                       |
| ------------ | ---------------------------------------- |
| sh_name      | Section name段名。段名是字符串类型，位于一个叫做“.shstrtab”的字符串表。sh_name是段名在“.shstrtab”中的偏移 |
| sh_type      | Section type 段的类型                        |
| sh_flags     | Section flag 段的标志位                       |
| sh_addr      | Section Address 段虚拟地址。如果该段可以被加载，则sh_addr为该段被加载后在进程地址空间中的虚拟地址 |
| sh_offset    | Section Offset 段偏移。如果该段存在于文件中，则表示该段在文件中的偏移 |
| sh_size      | Section Size 段的长度                        |
| sh_link      | Section Link and Section Information 段链接信息 |
| sh_addralign | Section Address Alignment 段地址对齐。有些段对段地址对齐有要求，假设有个段刚开始的位置包含了有个double变量，因为x86系统要求浮点数的存储地址必须是本身的整数倍，也就是说保存double变量的地址必须是8字节的整数倍。这样对一个段来说，它的sh_addr必须是8的整数倍。由于地址对齐的数量都是2的指数倍。sh_addralign表示地址对齐数量中的指数，即sh_addralign = 3表示对齐为2的3次方倍。0 或 1表示没有对齐要求。 |
| sh_entsize   | Section Entry Size 项的长度。有些段包含了一些固定大小的项，比如符号表，它包含的每个符号所占的大小是一样的。对于这种段，sh_entsize表示每个项的大小。0表示该段不包含固定大小的项 |

段的名字对于编译器、链接器是有意义的，但是对于操作系统来说并没有实质的意义，对于操作系统来说，一个段该如何处理取决于它的属性和权限，即由段的类型和段的标志位这两个成员决定。

所有段的位置及长度如下图所示

![Section Table及所有段位置和长度.jpg](https://github.com/LiuChengqian90/LiuChengqian90.github.io/blob/hexo/source/_posts/image_quoted/ELF/Section%20Table%E5%8F%8A%E6%89%80%E6%9C%89%E6%AE%B5%E4%BD%8D%E7%BD%AE%E5%92%8C%E9%95%BF%E5%BA%A6.jpg?raw=true)

由于对齐的原因，深色部分表示间隔。

**段的类型（sh_type）**  段的名字只是在链接和编译过程中有意义，但它不能真正表示段的类型。对于编译器和链接器来说，主要决定段的属性的是段的类型（sh_type）和段的标志位（sh_flags）。段的类型相关常量以SHT_开头，列举如下

| 常量           | 值    | 含义                  |
| ------------ | ---- | ------------------- |
| SHT_NULL     | 0    | 无效段                 |
| SHT_PROGBITS | 1    | 程序段、代码段、数据段都是这种类型   |
| SHT_SYMTAB   | 2    | 表示该段的内容为符号表         |
| SHT_STRTAB   | 3    | 表示该段的内容为字符串表        |
| SHT_RELA     | 4    | 重定位表。该段包含了重定位信息。    |
| SHT_HASH     | 5    | 符号表的哈希表             |
| SHT_DYNAMIC  | 6    | 动态链接信息              |
| SHT_NOTE     | 7    | 提示性信息               |
| SHT_NOBITS   | 8    | 表示该段在文件中没内容，比如.bss段 |
| SHT_REL      | 9    | 该段包含了重定位信息。         |
| SHT_SHLIB    | 10   | 保留                  |
| SHT_DYNSYM   | 11   | 动态链接的符号表。           |

**段的标志位（sh_flag）**  段的标志位表示该段在进程虚拟地址空间中的属性。相关常量以SHF_开头。

| 常量            | 值      | 含义                                       |
| ------------- | ------ | ---------------------------------------- |
| SHF_WRITE     | 1 << 0 | 表示该段在进程空间中可写                             |
| SHF_ALLOC     | 1 << 1 | 表示该段在进程空间中须要分配空间。有些包含指示或控制信息的段不需要在进程空间中被分配空间，它们一般不会有这个标志。像代码段、数据段和.bss段都会有这个标志位 |
| SHF_EXECINSTR | 1 << 2 | 表示该段在进程空间中可以被执行，一般指代码段                   |

对于系统保留段，下表列举了它们的属性。

| Name      | sh_type      | sh_flag                                  |
| --------- | ------------ | ---------------------------------------- |
| .bss      | SHT_NOBITS   | SHF_ALLOC + SHF_WRITE                    |
| .comment  | SHT_PROGBITS | NONE                                     |
| .data     | SHT_PROGBITS | SHF_ALLOC + SHF_WRITE                    |
| .data1    | SHT_PROGBITS | SHF_ALLOC + SHF_WRITE                    |
| .debug    | SHT_PROGBITS | NONE                                     |
| .dynamic  | SHT_DYNAMIC  | SHF_ALLOC + SHF_WRITE 在有些系统下.dynamic段可能是只读的，所以无SHF_WRITE标志位 |
| .hash     | SHT_HASH     | SHF_ALLOC                                |
| .line     | SHT_PROGBITS | NONE                                     |
| .note     | SHT_NOTE     | NONE                                     |
| .rodata   | SHT_PROGBITS | SHF_ALLOC                                |
| .rodata1  | SHT_PROGBITS | SHF_ALLOC                                |
| .shstrtab | SHT_STRTAB   | NONE                                     |
| .strtab   | SHT_STRTAB   | 如果该ELF文件中有可装载的段需要用到该字符串表，那么该字符串表也将被装载到进程空间，则有SHF_ALLOC标志位 |
| .symtab   | SHT_STRTAB   | 同字符串表                                    |
| .text     | SHT_PROGBITS | SHF_ALLOC + SHF_EXECINSTR                |

**段的链接信息（sh_link、sh_info）** 如果段的类型是与链接相关的（不论是动态链接或静态链接），比如重定位表、符号表等，那么sh_link和sh_info这两个成员所包含的意义如下表所示，对于其他类型的段，这两个成员没有意义。

| sh_type               | sh_link            | sh_info           |
| --------------------- | ------------------ | ----------------- |
| SHT_DYNAMIC           | 该段所使用的字符串表在段表中的下标  | 0                 |
| SHT_HASH              | 该段所使用的符号表在段表中的下标   | 0                 |
| SHT_REL、SHT_RELA      | 该段所使用的相应符号表在段表中的下标 | 该重定位表所作用的段在段表中的下标 |
| SHT_SYMTAB、SHT_DYNSYM | 操作系统相关             | 操作系统相关            |

### 程序头部表（Program Header Table）

可执行文件或者共享目标文件的程序头部是一个结构数组，每个结构描述了一个段或者系统准备程序执行所必需的其它信息。目标文件的“段”包含一个或者多个“节区”， 也就是“段内容(Segment Contents)”。程序头部仅对于可执行文件和共享目标文件 有意义。 

可执行目标文件在 ELF 头部的 e_phentsize 和 e_phnum 成员中给出其自身程序头部 的大小。程序头部的数据结构如下：

```c
typedef struct
{
  Elf32_Word	p_type;			/* Segment type */
  Elf32_Off	p_offset;		/* Segment file offset */
  Elf32_Addr	p_vaddr;		/* Segment virtual address */
  Elf32_Addr	p_paddr;		/* Segment physical address */
  Elf32_Word	p_filesz;		/* Segment size in file */
  Elf32_Word	p_memsz;		/* Segment size in memory */
  Elf32_Word	p_flags;		/* Segment flags */
  Elf32_Word	p_align;		/* Segment alignment */
} Elf32_Phdr;
```

各字段含义如下

| 成员       | 含义                                       |
| -------- | ---------------------------------------- |
| p_type   | 数组元素描述的段的类型，或者如何解释此数组元素的信息。              |
| p_flags  | 段相关的标志。                                  |
| p_offset | 从文件头到该段第一个字节的偏移。                         |
| p_vaddr  | 段的第一个字节将被放到内存中的虚拟地址。                     |
| p_paddr  | 仅用于与物理地址相关的系统中。因为 System V 忽略所有应用程序的物理地址信息，此字段对与可执行文件和共享目标文件而言具体内容是指定的。 |
| p_filesz | 段在文件映像中所占的字节数。                           |
| p_memsz  | 段在内存映像中占用的字节数。                           |
| p_align  | 可加载的进程段的 p_vaddr 和 p_offset 取值必须合适，相对于对页面大小的取模而言。此成员给出段在文件中和内存中如何 对齐。数值 0 和 1 表示不需要对齐。指数型。 |

**p_type**包括以下常量，一般以“PT_”开头

| 常量         | 值    | 描述                                       |
| ---------- | ---- | ---------------------------------------- |
| PT_NULL    | 0    | 元素未使用                                    |
| PT_LOAD    | 1    | 段可加载。段的大小由p_filesz 和 p_memsz描述。文件中的字节被映射到内存段开始处。p_memsz大于p_filesz，“剩余”的字节要清零。p_filesz不能大于p_memsz。可加载的段在程序头部表格中根据p_vaddr成员按升序排列。 |
| PT_DYNAMIC | 2    | 动态链接信息                                   |
| PT_INTERP  | 3    | 元素给出一个NULL结尾的字符串的位置和长度，该字符串将被当做解释器调用。这种段类型仅对与可执行文件有意义。在一个文件中不能出现一次以上。如果存在这种类型的段，它必须在所有可加载段项目的前面。 |
| PT_NOTE    | 4    | 元素给出附加信息的位置和大小                           |
| PT_SHLIB   | 5    | 保留                                       |
| PT_PHDR    | 6    | 元素若存在，则给出了程序头部表自身的大小和位置，既包括在文件中也包括在内存中的信息。此类型的段在文件中不能出现一次以上。并且只有程序头部表是程序的内存映像一部分时才起作用。如果存在此类型段，则必须在所有可加载段炫目的前面。 |
| PT_TLS     | 7    | 线程本地存储段                                  |

**p_flags**包括以下常量，一般以“PF_”开头

| 常量   | 值      | 描述   |
| ---- | ------ | ---- |
| PF_X | 1 << 0 | 段可执行 |
| PF_W | 1 << 1 | 段可写  |
| PF_R | 1 << 2 | 段可读  |

### 字符串表（String Table）

ELF文件中用到了很多字符串，比如段名、变量名等。因为字符串的长度往往是不定的，所以用固定的结构来表示它比较困难。一种很常见的做法是把字符串集中起来存放到一个表，然后使用字符串在表中的偏移来引用字符串。比如下面这个字符串表。

| 偏移   | +0   | +1   | +2   | +3   | +4   | +5   | +6   | +7   | +8   | +9   |
| ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| +0   | \0   | h    | e    | l    | l    | o    | w    | o    | r    | l    |
| +10  | d    | \0   | M    | y    | v    | a    | r    | i    | a    | b    |
| +20  | l    | e    | \0   |      |      |      |      |      |      |      |

那么偏移与它们对应的字符串如下表

| 偏移   | 字符串        |
| ---- | ---------- |
| 0    | 空字符串       |
| 1    | helloworld |
| 6    | world      |
| 12   | Myvariable |

通过这种方法，在ELF文件中引用字符串只须给出一个数字下标即可，不用考虑字符串长度的问题。一般字符串表在ELF文件中也以段的形式保存，常见的段名为“.strtab"或".shstrtab"。这两个字符串表分别为字符串表(String Table)和段表字符串表(Section Header String Table)。字符串表用来保存普通的字符串，比如符号的名字；段表字符串表用来保存段表中用到的字符串，最常见的就是段名(sh_name)。

ELF文件头中的“e_shstrndx”是E1f32_Ehdr的最后一个成员，它是"Section header string table index”的缩写。我们知道段表字符串表本身也是ELF文件中的一个普通的段，知道它的名字往往叫做“.shstrtab”。那么这个“e_shstrndx”就表示“.shstrtab”在段表中的下标，即段表字符串表在段表中标。可以通过“readelf -S”验证。

### 符号表（Symbol Table）

链接过程的本质就是要把多个不同的目标文件之间相互“粘”到一起。为了使不同目标文件之间能够相互粘合，这些目标文件之间必须有固定的规则才行。在链接中，目标文件之间相互粘合实际上是目标文件之间对地址的引用，即对函数和变量的地址的引用。比如目标文件B要用到了目标文件A中的函数“foo”，那么我们就称目标文件A定义(**Define**)了函数"foo"，称目标文件B引用(**Reference**)了目标文件A中的函数"foo"。这两个概念也同样适用于变量。每个函数或变量都有自已独特的名字，才能避免链接过程中不同变量和函数之间的混淆。在链接中，将函数和变量统称为符号(Symbol)，函数名或变量名就是符号名(Symbol Name)。

符号可以被看作是链接中的粘合剂，整个链接过程正是基于符号才能够完成。链接过程中很关键的一部分就是符号的管理，每一个目标文件都会有一个相应的符号表(Symbol Table)。这个表里面记录了目标文件中所用到的所有符号。每个定义的符号有一个对应的值，叫做符号值(Symbol Value)，对于变量和函数来说，符号值就是它们的地址。除了函数和变量之外，还存在其他几种不常用到的符号。将符号表中所有的符号进行分类，它们有可能是下面这些类型中的一种：

- 定义在本目标文件的全局符号，可以被其他目标文件引用。比如SimpleSection.o里面"funcl”、"main"和"global_init_var"。
- 在本目标文件引用的全局符号，却没有定义在本目标文件，这一般叫做外部符号(External SymEaol)。比如SimpleSection.o里面的"printf"。
- 段名，这种符号往往由编译器产生，它的值就是该段的起始地址。比如SimpleSection.o里面的".text". ".data"等。
- 局部符号，这类符号只在编译单元内部可见。比如5imple5ection.o里面的"static_var"和"static_var2"。调试器可以使用这些符号来分析程序或崩溃时的核心转储文件。这些局部符号对于链接过程没有作用，链接器往往也忽略它们。
- 行号信息，即目标文件指令与源代码中代码行的对应关系，它也是可选的。

最值得关注的就是全局符号，即上面分类中的第一类和第二类。因为链接过程只关心全局符号的相互“粘合”，局部符号、段名、行号等都是次要的，它们对于其他目标文件来说是“不可见”的，在链接过程也是无关紧要的。可以使用很多工共来查看ELF文件的符号表，比如readelf、objdump、nm等，比如使用"nm”来查看SimpleSection.o的符号结果如下。

```shell
# nm SimpleSection.o 
00000000 T func1
00000000 D global_init_var
00000004 C global_uninit_var
0000001b T main
         U printf
00000004 d static_var.1243
00000000 b static_var2.1244
```

#### 符号表结构

ELF文件中的符号表往往是文件中的一个段，段名一般叫“.symtab”。符号表结构如下

```c
typedef struct
{
  Elf32_Word	st_name;		/* Symbol name (string tbl index) */
  Elf32_Addr	st_value;		/* Symbol value */
  Elf32_Word	st_size;		/* Symbol size */
  unsigned char	st_info;		/* Symbol type and binding */
  unsigned char	st_other;		/* Symbol visibility */
  Elf32_Section	st_shndx;		/* Section index */
} Elf32_Sym;
```

每个Elf32_Sym结构对应一个符号。数组第一个元素为“未定义”符号。结构成员解析如下

| 成员       | 描述                                   |
| -------- | ------------------------------------ |
| st_name  | 符号名。包含了该符号名在字符串表中的下标                 |
| st_value | 符号相对应的值。这个值跟符号有关，绝对值或地址，不同符号对应的值含义不同 |
| st_size  | 符号大小，对于包含数据的符号，这个值是该数据类型的大小。         |
| st_info  | 符号类型和绑定信息                            |
| st_other | 保留                                   |
| st_shndx | 符号所在的段                               |

**符号类型和绑定信息（st_info）** 低4位表示符号的类型（Symbol Type），高28位表示符号绑定信息（Symbol Binding）。

类型

| 常量          | 值    | 说明                                       |
| ----------- | ---- | ---------------------------------------- |
| STT_OBJECT  | 1    | 该符号是个数据对象，比如变量、数组等                       |
| STT_FUNC    | 2    | 该符号是个函数或其他可执行代码                          |
| STT_SECTION | 3    | 该符号表示一个段，这种符号必须是STB_LOCAL的               |
| STT_FILE    | 4    | 该符号表示文件名，一般都是该目标文件所对应的原文件名，它一定是STB_LOCAL的，并且它的st_shndx一定是SHN_ABS |

绑定信息

| 常量         | 值    | 说明   |
| ---------- | ---- | ---- |
| STB_LOCAL  | 0    | 局部符号 |
| STB_GLOBAL | 1    | 全局符号 |
| STB_WEAK   | 2    | 弱引用  |

**符号所在段（st_shndx）** 符号定义在本目标文件中，这个成员表示符号所在的段在段表中的下标；符号不在本目标文件，或对于有些特殊符号，此字段的值如下

| 宏定义        | 值      | 说明                                       |
| ---------- | ------ | ---------------------------------------- |
| SHN_ABS    | 0xfff1 | 该符号包含了一个绝对值。文件名符号属于此类型。                  |
| SHN_COMMON | 0xfff2 | 该符号是一个“COMMON块”类型的符号，一般来说，未初始化的全局符号定义就是此类型。 |
| SHN_UNDEF  | 0      | 该符号未定义。表示该符号在本目标文件被引用，但定义在其他目标文件。        |

**符号值（st_value）** 具体按照下面几种情况区别对待

- 在目标文件中，如果是符号的定义并且该符号不是“COMMON块”类型的（即st_shndx不为COMMON），则st_value表示该符号在段中的偏移。即符号所对应的函数或变量位于由st_shndx指定的段，偏移st_value的位置。也是目标文件中定义全局变量的符号的最常见的情况。
- 在目标文件中，如果是符号是“COMMON块”类型的，则st_value表示该符号的对齐属性。
- 在可执行文件中，st_value表示符号的虚拟地址。

### 重定位表

To be continued.

## 参考资料

[可执行文件（ELF）格式的理解](http://www.cnblogs.com/xmphoenix/archive/2011/10/23/2221879.html)

[ELF文件格式分析](https://segmentfault.com/a/1190000007103522)

[ELF文件标准](https://zhuanlan.zhihu.com/p/25072514)

[ELF文件格式详解](http://blog.csdn.net/tenfyguo/article/details/5631561)

