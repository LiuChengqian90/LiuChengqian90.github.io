---
title: Linux内核编译详解
date: 2017-10-17 16:41:24
categories: Linux内核
tags:
  - 内核
  - 编译
---

内核主要通过Makefile把整个内核里的文件联系起来进行编译，最后得到内核镜像文件vmlinux。顶层Makefile文件多达1500行，本文仅分析其中比较重要的代码以概括内核编译流程。

```makefile
include $(srctree)/arch/$(SRCARCH)/Makefile
…………
init-y		:= init/
drivers-y	:= drivers/ sound/ firmware/
net-y		:= net/
libs-y		:= lib/
core-y		:= usr/
…………
core-y		+= kernel/ mm/ fs/ ipc/ security/ crypto/ block/
```

类似init-y形式，是编译过程的核心，告知顶层Makefile哪些目录需要编译。之后进入相应目录进行编译，完成之后，再链接为built-in.o目标文件。例如，init-y编译完成后会在init目录下形成built-in.o文件。

include \$(srctree)/arch/\$(SRCARCH)/Makefile 表明需要把目录  \$(srctree)/arch/\$(SRCARCH)/ 编译进内核。如果在编译前，配置顶层Makefile的ARCH=arm，表明把arch/arm目录纳入内核编译。可根据需要调整编译架构。

一言概之，顶层Makefile指定需要编译的目录。

以x86架构为例，进入arch/x86目录后编译器就要依靠Makefile编译。

```makefile
…………
head-y := arch/x86/kernel/head_$(BITS).o
head-y += arch/x86/kernel/head$(BITS).o
head-y += arch/x86/kernel/head.o
head-y += arch/x86/kernel/init_task.o

libs-y  += arch/x86/lib/

# See arch/x86/Kbuild for content of core part of the kernel
core-y += arch/x86/

# drivers-y are linked after core-y
drivers-$(CONFIG_MATH_EMULATION) += arch/x86/math-emu/
drivers-$(CONFIG_PCI)            += arch/x86/pci/
…………
```

\$(*\*)形式，根据.config是否有配该选项生效来决定用y或者n或者m代替$(\*\*)。y或n表示是否编译进内核，而m表示以模块形式进行编译。

最后会继续回到根目录进行编译：

```makefile
init-y		:= $(patsubst %/, %/built-in.o, $(init-y))
core-y		:= $(patsubst %/, %/built-in.o, $(core-y))
drivers-y	:= $(patsubst %/, %/built-in.o, $(drivers-y))
net-y		:= $(patsubst %/, %/built-in.o, $(net-y))
libs-y1		:= $(patsubst %/, %/lib.a, $(libs-y))
libs-y2		:= $(patsubst %/, %/built-in.o, $(libs-y))
libs-y		:= $(libs-y1) $(libs-y2)
…………
vmlinux-init := $(head-y) $(init-y)
vmlinux-main := $(core-y) $(libs-y) $(drivers-y) $(net-y)
vmlinux-all  := $(vmlinux-init) $(vmlinux-main)
vmlinux-lds  := arch/$(SRCARCH)/kernel/vmlinux.lds
…………
# vmlinux image - including updated kernel symbols
vmlinux: $(vmlinux-lds) $(vmlinux-init) $(vmlinux-main) vmlinux.o
```

init-y := \$(patsubst %/, %/built-in.o, $(init-y)) 形式是把init-y变为 /init/built-in.o形式。vmlinux-*为vmlinux构成文件，所列出的最后一行会将这些文件链接为vmlinux镜像文件。