---
title: Linux 内核同步方式及原理
date: 2017-12-04 18:32:14
categories: Linux内核
tags:
  - 锁
  - 完成变量
  - 信号量
  - 互斥体
  - 完成变量
  - 顺序锁
  - 内核屏障
---

本文基于 linux kernel 3.10.105。

## 原子操作

原子操作是其他同步方法的基石。原子操作，可以保证指令以原子的方式执行——执行过程不被打断。
<!--more-->
内核提供了两组原子操作接口——一组针对整数，一组针对单独的位。在Linux支持的所有体系结构上都实现了这两组接口。

### 原子整数操作

针对整数的原子操作只能对atomic_t类型的数据进行处理。引入特殊数据类型，主要是出于以下原因：

- 让原子函数只接收atomic_t类型的操作数，可以确保原子操作只与这种特殊类型数据一起使用。同时，这也保证了该类型的数据不会被传递给任何非原子函数。
- 使用atomic_t类型确保编译器不对相应的值进行访问优化——这点使得原子操作最终接收到正确的内存地址，而不只是一个别名（关于这一点，之前atomic_t定义是 volatile int counter，利用volatile读写时从内存取值。而现在定义只是 int counter，是在外部进行操作时指定volatile）。

最后，在不同体系结构上实现原子操作的时候，使用atomic_t可以屏蔽其间的差异。atomic_t类型定义如下：

```c
typedef struct {
	int counter;
} atomic_t;
```

```shell
Tips：
由于历史原因，Linux支持的所有机器上atomic_t只能使用该类型数据的高24位，这个限制是因为SPARC体系结构上，Sparc32缺少“比较和交换”类型的指令，因此它使用低8位作为自旋锁以保证SMP安全。不过现在，32位的Sparc已经被转移到了“自旋锁散列表”的方案中，允许完整的32位计数器被实现。
本质上，自旋锁阵列基于被操作的atomic_t的地址被索引，并且该锁保护原子操作。 Parisc使用相同的方案。
```

使用原子整形操作需要的声明都在<asm/atomic.h&gt;中。

原子整数操作最常见的用途就是实现计数器。原子操作通常是内联函数，往往是通过内联汇编指令来实现。如果某个函数本来就是原子的，那么它往往被定义成一个宏。 例如，在大部分体系结构上，读取一个字本身就是一种原子操作，也就是说，在对有个字进行写入操作期间不可能完成对该字的读取。所以，atomic_read()只需返回atomic_t类型的整数值就可以了。

```
Tips：
32/64位CPU是指CPU一次能够处理32/64位数据或指令。
字 ：CPU进行数据处理时，一次存取、加工和传送的数据长度称为字（word）。一个字通常由一个或多个（一般是字节的整数位）字节构成。
字长：一个字的长度。CPU在单位时间内(同一时间)能一次处理的二进制数的位数叫字长。
```

```c
/**
 * atomic_read - read atomic variable
 * @v: pointer of type atomic_t
 *
 * Atomically reads the value of @v.
 */
static inline int atomic_read(const atomic_t *v)
{
	return (*(volatile int *)&(v)->counter);
}
```

下面分析几个函数的实现（x86架构）：

#### atomic_add

```c
#define LOCK_PREFIX_HERE \
		".section .smp_locks,\"a\"\n"	\
		".balign 4\n"			\
		".long 671f - .\n" /* offset */	\
		".previous\n"			\
		"671:"

#define LOCK_PREFIX LOCK_PREFIX_HERE "\n\tlock; "

static inline void atomic_add(int i, atomic_t *v)
{
	asm volatile(LOCK_PREFIX "addl %1,%0"
		     : "+m" (v->counter)
		     : "ir" (i));
}

asm可翻译为 ： 

.section .smp_locks,"a"
.balign 4
.long 671f - .
.previous
671:
	lock;
	addl %1,%0 : "+m" (v->counter) : "ir" (i)
```

两步分析

1. LOCK_PREFIX

   参考 [GNU Assembler (GAS)手册](https://sourceware.org/binutils/docs-2.29/as/index.html) ，如果连接失效，可点击 [此处](https://sourceware.org/binutils/)，Documentation 部分。

   ```makefile
   .section name [, "flags"[, @type[,flag_specific_arguments]]]
   使用.section指令将以下代码组装到名为name的节中。
   flag "a" 表示 section is allocatable。
   此指令会替代当前的section（.text）。

   可以查看内核代码，以确定 smp_locks 的作用。简单来说是在单处理器中将锁变为空操作。
   ```

   ```makefile
   .balign 4		将当前section的位数计数器加到4字节对齐。
   .long 671f - .	.long（等于.int）是一个指令，告诉汇编程序在这里汇编一个32位的数量。当遇到的数据看起来不像任何已知的指令时，反汇编器通常发出这些数据。通常情况下，当存在一个文字池时就是这样，因为那些不包含机器码和数据的反汇编程序会打印它们包含的数据。.long指令对于.bss节无效。
   .previous		指令继续处理上一节。
   ```

   ```makefile
   lock指令：多处理器环境中，"LOCK#"信号确保了处理器在信号有效时独占使用任何共享存储器。在所有的 X86 CPU 上都具有锁定一个特定内存地址的能力，当这个特定内存地址被锁定后，它就可以阻止其他的系统总线读取或修改这个内存地址。这种能力是通过 LOCK 指令前缀再加上下面的汇编指令来实现的。当使用 LOCK 指令前缀时，它会使 CPU 宣告一个 "LOCK#"信号，这样就能确保在多处理器系统或多线程竞争的环境下互斥地使用这个内存地址。当指令执行完毕，这个锁定动作也就会消失。

   LOCK前缀只能作为以下指令的前缀：
   ADD，ADC，AND，BTC，BTR，BTS，CMPXCHG，CMPXCH8B，CMPXCHG16B，DEC，INC，NEG，NOT，OR，SBB，SUB，XOR，XADD和XCHG。

   如果LOCK前缀与其中一个一起使用这些指令和源操作数是内存操作数，未定义的操作码异常（"#UD"）可能产生。如果LOCK前缀不与任何指令一起使用，也会产生未定义的操作码异常。

   注意：XCHG 和 XADD (以及所有以 'X' 开头的指令)都能够保证在多处理器系统下的原子操作，它们总会宣告一个 "LOCK#" 信号，而不管有没有 LOCK 前缀。
   ```
   在X86平台上，CPU提供了在指令执行期间对总线加锁的手段。CPU上有一根引线#HLOCK pin连到北桥，如果汇编语言的程序中在一条指令前面加上前缀“LOCK”，经过汇编以后的机器代码就使CPU在执行这条指令的时候把#HLOCK pin的电位拉低，持续到这条指令结束时放开，从而把总线锁住，这样同一总线上别的CPU就暂时不能通过总线访问内存了，保证了这条指令在多处理器环境中的原子性。

2. addl指令

   ```c
   addl %1,%0 : "+m" (v->counter) : "ir" (i)
   ```

   addl指令含义为 将目的操作数和源操作数求和，并将值写到目的操作数。

   **DOS/Windows 下的汇编语言，是 Intel 风格的。但在 Unix 和 Linux 系统中，更多采用的还是 AT&T 格式。**

   **AT&T 和 Intel 格式中的源操作数和目标操作数的位置正好相反。在 Intel 汇编格式中，目标操作数在源操作数的左边；而在 AT&T 汇编格式中，目标操作数在源操作数的右边。**

   GCC中asm格式为：

   ```makefile
   asm [volatile] ( AssemblerTemplate 
                    : OutputOperands 
                    [ : InputOperands
                    [ : Clobbers ] ])

   asm [volatile] goto ( AssemblerTemplate 
                         : 
                         : InputOperands
                         : Clobbers
                         : GotoLabels)

   OutputOperands（输出约束）必须以“=”（覆盖现有值的变量）或“+”（读写时）开始。
   在前缀之后，必须有一个或多个附加约束来描述值所在的位置。常见的约束条件包括“r”表示寄存器，“m”表示内存。当列出多个可能的位置（例如，“= rm”）时，编译器将根据当前上下文选择最有效的位置。

   InputOperands（输入约束）不能以'='或'+'开头。当列出多个可能位置（例如，“irm”）时，编译器将根据当前上下文选择最有效的位置。
   ```

   %0、%1可以简单的理解为将 OutputOperands和InputOperands按顺序排列。
   "+m" 表示由内存中读取或直接写入内存。
   "i"  立即整型操作数。
   "r"  表示数据可以从寄存器读取或写入到寄存器。

   因此，代码中的语句就比较好理解了。

atomic_sub 与 atomic_add 类似。

#### atomic_sub_and_test

```c
static inline int atomic_sub_and_test(int i, atomic_t *v)
{
	unsigned char c;

	asm volatile(LOCK_PREFIX "subl %2,%0; sete %1"
		     : "+m" (v->counter), "=qm" (c)
		     : "ir" (i) : "memory");
	return c;
}

subl i, v->counter; sete c
v->counter -= i; 结果为0则设置c。
'q'的约束和'r'相同。'memory' clobber 告诉编译器，汇编代码对输入和输出操作数（例如，访问输入参数之一指向的内存）以外的项目执行内存读取或写入操作。
```

#### atomic_add_return

```c
static inline int atomic_add_return(int i, atomic_t *v)
{
	int __i;
#ifdef CONFIG_M386
	unsigned long flags;
	if (unlikely(boot_cpu_data.x86 <= 3))
		goto no_xadd;
#endif
	/* Modern 486+ processor */
	__i = i;
  /* xaddl i, v->counter
     i 与 v->counter 进行交换，之后 v->counter += i
  */
	asm volatile(LOCK_PREFIX "xaddl %0, %1"
		     : "+r" (i), "+m" (v->counter)
		     : : "memory");
	return i + __i;

#ifdef CONFIG_M386
no_xadd: /* Legacy 386 processor */
  	/*无 xaddl指令 则利用中断实现
  	  中断函数实现之后在分析  todo
  	*/
	raw_local_irq_save(flags);
	__i = atomic_read(v);
	atomic_set(v, i + __i);
	raw_local_irq_restore(flags);
	return i + __i;
#endif
}
```

### 原子位操作

内核也提供了一组针对位这一级数据进行操作的函数，定义在<asm/bitops.h&gt;中。位操作函数是对普通的内存地址进行操作的，参数是一个指针和一个位号，第0位是给定地址的最低有效位。

#### set_bit

```c
#if __GNUC__ < 4 || (__GNUC__ == 4 && __GNUC_MINOR__ < 1)
/* Technically wrong, but this avoids compilation errors on some gcc
   versions. */
#define BITOP_ADDR(x) "=m" (*(volatile long *) (x))
#else
#define BITOP_ADDR(x) "+m" (*(volatile long *) (x))
#endif

#define IS_IMMEDIATE(nr)		(__builtin_constant_p(nr))
#define CONST_MASK_ADDR(nr, addr)	BITOP_ADDR((void *)(addr) + ((nr)>>3))
#define CONST_MASK(nr)			(1 << ((nr) & 7))

static __always_inline void
set_bit(unsigned int nr, volatile unsigned long *addr)
{
	if (IS_IMMEDIATE(nr)) {
		asm volatile(LOCK_PREFIX "orb %1,%0"
			: CONST_MASK_ADDR(nr, addr)
			: "iq" ((u8)CONST_MASK(nr))
			: "memory");
	} else {
		asm volatile(LOCK_PREFIX "bts %1,%0"
			: BITOP_ADDR(addr) : "Ir" (nr) : "memory");
	}
}
```

1. GCC内置函数__builtin_constant_p用来检测值是否为常量。
2. BITOP_ADDR 是将传入的指针进行截取，只保留需要操作的字节。
3. CONST_MASK_ADDR 可理解为将 addr 以字节进行划分，根据 nr 找到需要操作的字节。
4. CONST_MASK 字节偏移量。
5. 'orb' 是 “位或”操作。'orb src, dest'，dest的第src位进行位或操作。
6. 'bts' 是 'bit test and set'，'bts src, dest'，将所选位（dest 的 src位）的值写入CF寄存器，然后将所选位 置1。
7. 约束符'I'表示值1到8的范围。可参考[此处](https://gcc.gnu.org/onlinedocs/gcc/Simple-Constraints.html#Simple-Constraints)。

**clear_bit 与 set_bit 类似，不过将'orb' 变为 'andb'(位与)，将'bts' 变为 'btr'(bit test and reset)。**

**change_bit 使用了 'xorb'(位异或)和'btc'(bit test and complement，select bit <- not (select bit))。**

#### test_and_set_bit

```c
static inline int test_and_set_bit(int nr, volatile unsigned long *addr)
{
	int oldbit;

	asm volatile(LOCK_PREFIX "bts %2,%1\n\t"
		     "sbb %0,%0" : "=r" (oldbit), ADDR : "Ir" (nr) : "memory");

	return oldbit;
}
```

1. 'bts' 第一步就是将所选位的值写入 CF 寄存器。
2. 'sbb' 含义为 （DEST ← (DEST – (SRC + CF));），源目相同时，仅是将CF寄存器的值写入目的操作数。

其他原子位操作原理基本与这两种函数类似。

为方便起见内核还提供了一组与原子位操作对应的非原子位操作（无 'LOCK_PREFIX' 锁操作）。非原子位操作函数名比原子位操作函数名前缀多两个下划线。如果已确定操作不需要原子性（已经用锁保护了自己的数据），那么这些非原子的操作可能会执行得更快些。

## 自旋锁

Linux内核中最常见的锁是自旋锁（spin lock）。自旋锁最多只能被一个可执行线程持有。如果一个执行线程试图获得一个被己经持有(即所谓的争用)的自旋锁，那么该线程就会一直进行忙循环——旋转——等待锁重新可用。要是锁未被争用，请求锁的执行线程便能立刻得到它，继续执行。在任意时间，自旋锁都可以防止多于一个的执行线程同时进入临界区。同一个锁可以用在多个位置。

一个被争用的自旋锁使得请求它的线程在等待锁重新可用时自旋(特别浪费处理器时间)，这种行为是自旋锁的要点。所以自旋锁不应该被长时间持有。事实上，这点正是使用自旋锁的初衷：在短期间内进行轻量级加锁。还可以采取另外的方式来处理对锁的争用:让请求线程睡眠，直到锁重新可用时再唤醒它。这样处理器就不必循环等待，可以去执行其他代码。这也会带来一定的开销—这里有两次明显的上下文切换，被阻塞的线程要换出和换入，与实现自旋锁的少数几行代码相比，上下文切换当然有较多的代码。因此，持有自旋锁的时间最好小于完成两次上下文切换的耗时。当然我们大多数人都不会无聊到去测量上下文切换的耗时，所以我们让持有自旋锁的时间应尽可能的短就可以。

自旋锁的实现和体系结构密切相关，代码往往通过汇编实现。与体系结构相关的代码定义在文件<asm/spinlock.h&gt;中，实际需要用到的接口定义在文件<linux/spinlock.h&gt;中。

自旋锁在同一时刻只能被一个执行线程持有，因此一个时刻只能有一个线程位于临界区内，这就为多处理器机器提供了防止并发访问所需的保护机制。注意**在单处理器机器上**，编译的时候并不会加入自旋锁。它仅仅被当做一个设置内核抢占机制是否被启用的开关。如果禁止内核抢占，那么在编译时自旋锁会被完全剔除出内核。

**警告：自旋锁是不可递归的!**    

内核实现的自旋锁是不可递归的，这点不同于自旋锁在其他操作系统中的实现。如果你试图得到一个你正持有的锁，你必须自旋，等待你自己释放这个锁。但你处于自旋忙等待中，所以你永远没有机会释放锁，于是你被自己锁死了。千万小心自旋锁!


自旋锁可以使用在中断处理程序中。在中断处理程序中使用自旋锁时，一定要在获取锁之前，首先禁止本地中断(在当前处理器上的中断请求)，否则，中断处理程序就会打断正持有锁的内核代码，有可能会试图去争用这个已经被持有的自旋锁。这样一来，中断处理程序就会自旋，等待该锁重新可用，但是锁的持有者在这个中断处理程序执行完毕前不可能运行。这正是我们在前面的内容中提到的双重请求死锁。注意，需要关闭的只是当前处理器上的中断。如果中断发生在不同的处理器上，即使中断处理程序在同一锁上自旋，也不会妨碍锁的持有者(在不同处理器上)最终释放锁。

调调试自旋锁      配置选项CONFIG_DEBUG_SPINLOCK为使用自旋锁的代码加入了许多调试检测手段。例如，激活了该选项，内核就会检查是否使用了未初始化的锁，是否在还没加锁的时候就要对锁执行开锁操作。在测试代码时，总是应该激活这个选项。如果需要进一步全程调试锁，还应该打开CONFIG_DEBUG_LOCK_ALLOC选项。

### 方法

#### spin_lock_init

```c
include/linux/spinlock.h
/*
通过返回rlock地址来检查传参是否是 spinlock_t *类型
如果不是的话，会有错误或告警
*/
static inline raw_spinlock_t *spinlock_check(spinlock_t *lock)
{
	return &lock->rlock;
}

#define spin_lock_init(_lock)				\
do {							\
	spinlock_check(_lock);				\
	raw_spin_lock_init(&(_lock)->rlock);		\
} while (0)
```

```c
include/linux/spinlock.h
/*开启自旋锁调试开关  todo*/
#ifdef CONFIG_DEBUG_SPINLOCK
  extern void __raw_spin_lock_init(raw_spinlock_t *lock, const char *name,
				   struct lock_class_key *key);
# define raw_spin_lock_init(lock)				\
do {								\
	static struct lock_class_key __key;			\
	__raw_spin_lock_init((lock), #lock, &__key);		\
} while (0)
#else	// disable DEBUG
# define raw_spin_lock_init(lock)				\
	do { *(lock) = __RAW_SPIN_LOCK_UNLOCKED(lock); } while (0)
#endif
```

```c
include/linux/spinlock_types.h

#define __RAW_SPIN_LOCK_INITIALIZER(lockname)	\
	{					\
	.raw_lock = __ARCH_SPIN_LOCK_UNLOCKED,	\
	/*todo*/
	SPIN_DEBUG_INIT(lockname)		\
	SPIN_DEP_MAP_INIT(lockname) }

#define __RAW_SPIN_LOCK_UNLOCKED(lockname)	\
	(raw_spinlock_t) __RAW_SPIN_LOCK_INITIALIZER(lockname)
```

```c
/*分析x86架构*/
arch/x86/include/asm/spinlock_types.h
typedef struct arch_spinlock {
	unsigned int slock;
} arch_spinlock_t;
#define __ARCH_SPIN_LOCK_UNLOCKED	{ 0 }
```

x86架构，初始化自旋锁，就是对最内层的lock置0。

#### spin_lock

```c
include/linux/spinlock.h
static inline void spin_lock(spinlock_t *lock)
{
	raw_spin_lock(&lock->rlock);
}
--->>>
include/linux/spinlock.h
#define raw_spin_lock(lock)	_raw_spin_lock(lock)
```

- 单处理器

  ```c
  //单处理器 UP
  include/linux/spinlock_api_up.h
  #define _raw_spin_lock(lock)			__LOCK(lock)
  ```

  ```c
  include/linux/spinlock_api_up.h
  #define __LOCK(lock) \
    do { preempt_disable(); __acquire(lock); (void)(lock); } while (0)
  ```

  ```c
  /*
  当前线程preempt_count加1
  barrier()为内存屏障，以保证数据 顺序性
  */
  #define preempt_disable() \
  do { \
  	inc_preempt_count(); \
  	barrier(); \
  } while (0)
  ```

  ```c
  /*
  Sparse 的 GCC 扩展，利用 __context__ 来对代码进行检查，参数x 的引用计数 +1
  */
  include/linux/compiler.h
  # define __acquire(x)	__context__(x,1)
  # define __release(x)	__context__(x,-1)
  ```

  单处理器时，并没有发生真正的锁定，所以内核唯一要做的就是**保持抢占计数**和irq标志，来抑制未使用的锁变量的编译器警告，并添加适当的检查器注释。

- 多处理器

  ```c
  //多处理器 SMP
  kernel/spinlock.c
  void __lockfunc _raw_spin_lock(raw_spinlock_t *lock)
  {
  	__raw_spin_lock(lock);
  }
  ```

  ```c
  include/linux/spinlock_api_smp.h
  static inline void __raw_spin_lock(raw_spinlock_t *lock)
  {
    	/*禁止内核抢占，本CPU生效*/
  	preempt_disable();
    	/*未定义锁调试时，函数为空。todo*/
  	spin_acquire(&lock->dep_map, 0, 0, _RET_IP_);  	
  	LOCK_CONTENDED(lock, do_raw_spin_trylock, do_raw_spin_lock);
  }
  ```

  ```c
  //提供锁的统计信息 todo
  #ifdef CONFIG_LOCK_STAT
  #define LOCK_CONTENDED(_lock, try, lock)			\
  do {								\
  	if (!try(_lock)) {					\
  		lock_contended(&(_lock)->dep_map, _RET_IP_);	\
  		lock(_lock);					\
  	}							\
  	lock_acquired(&(_lock)->dep_map, _RET_IP_);			\
  } while (0)
  #else /* CONFIG_LOCK_STAT */
  #define LOCK_CONTENDED(_lock, try, lock) \
  	lock(_lock)
  #endif /* CONFIG_LOCK_STAT */
  ```

  ```c
  #ifdef CONFIG_DEBUG_SPINLOCK
  /*
  设置了CONFIG_DEBUG_SPINLOCK, 引用文件 include/linux/spinlock.h 中的函数。
  */
  extern void do_raw_spin_lock(raw_spinlock_t *lock) __acquires(lock);
  #else
  /*
  不明白函数定义后加一个宏是什么意思？
  todo
  */
  static inline void do_raw_spin_lock(raw_spinlock_t *lock) __acquires(lock)
  {
  	__acquire(lock);
  	arch_spin_lock(&lock->raw_lock);
  }
  --->>>
  arch/x86/include/asm/spinlock.h	//选择x86架构分析
  static __always_inline void arch_spin_lock(arch_spinlock_t *lock)
  {
  	__ticket_spin_lock(lock);
  }
  --->>>
  arch/x86/include/asm/spinlock.h
  /*
  CPU数量
  32位环境中默认是 32
  64位环境中默认是 5120
  */
  #if (NR_CPUS < 256)
  #define TICKET_SHIFT 8
  #else
  #define TICKET_SHIFT 16
  ```

  - 32位
    ```c
    static __always_inline void __ticket_spin_lock(arch_spinlock_t *lock)
    {
    	short inc = 0x0100;
    	asm volatile (
    		LOCK_PREFIX "xaddw %w0, %1\n"
    		"1:\t"
    		"cmpb %h0, %b0\n\t"
    		"je 2f\n\t"
    		"rep ; nop\n\t"
    		"movb %1, %b0\n\t"
    		/* don't need lfence here, because loads are in-order */
    		"jmp 1b\n"
    		"2:"
    		: "+Q" (inc), "+m" (lock->slock)
    		:
    		: "memory", "cc");
    }
    ```

    1. "xaddw %w0, %1\n"

       'xaddw '指令含义为 交换后求和，'xaddw SRC , DEST'--->>> (TEMP ← SRC + DEST;SRC ← DEST;DEST ← TEMP;)，'%w0' 在 GCC 编译器中表示 ax 寄存器，'%h0' 代表 ax的高8位，即ah；  '%b0' 代表 ax的低8位，即al。

       此时， ax寄存器中的值为 inc的值，即 0x0100。

       那么，此句含义即为： xaddw %ax, lock->slock。操作之后，tmp = lock->slock + inc; inc = lock->slock;lock->slock = tmp;

       锁初始化时，值为0。经过操作之后，lock->slock = 0x0100，%ax = 0。

    2. '1:' 

       定义一个标号。

    3. "cmpb %h0, %b0\n\t"

       'cmpb' 位比较。'cmpb %ah, %al'，由于 %ax为0，源目操作数相同。

    4. "je 2f\n\t"

       如果上一步比较结果为真（相同），则跳转到标号为'2'的地方，本段中'2'表示退出。

    5. "rep ; nop\n\t"

       此条指令与'pause'指令相同，用于不支持'pause'指令的汇编程序。在不支持超线程的处理器上，就像'nop'一样不做任何事，但在支持超线程的处理器上，它被用作向处理器提示正在执行spinloop以提高性能。

    6. "movb %1, %b0\n\t"

       'movb SRC, DEST'--->>> (DEST ← SRC)，此处为 %al  ←  lock->slock。

    7. "jmp 1b\n"

       跳到标志'1'。

    8. "2:"

       定义一个标号。

    此段含义简单概括为，将锁的值赋给 ax ，然后比较 ax 的高8位和低8位，相同则跳出（锁已经有了新值，其高位已加1，但是低位没变），不同则代表锁已经执行过加锁这一步，那么进入循环，循环中是将 内存中锁的值赋给 al，然后继续比较。为什么仅赋值低8位呢 ？因为 unlock 是 低位加1。

    因此，可理解为，lock 高位加1，就是加锁，低位加1就是解锁。解锁之后不在分析。



  - 64位

    ```c
    static __always_inline void __ticket_spin_lock(arch_spinlock_t *lock)
    {
    	int inc = 0x00010000;
    	int tmp;

    	asm volatile(LOCK_PREFIX "xaddl %0, %1\n"
    		     "movzwl %w0, %2\n\t"
    		     "shrl $16, %0\n\t"
    		     "1:\t"
    		     "cmpl %0, %2\n\t"
    		     "je 2f\n\t"
    		     "rep ; nop\n\t"
    		     "movzwl %1, %2\n\t"
    		     /* don't need lfence here, because loads are in-order */
    		     "jmp 1b\n"
    		     "2:"
    		     : "+r" (inc), "+m" (lock->slock), "=&r" (tmp)
    		     :
    		     : "memory", "cc");
    }
    ```

    64位与32位原理一样，不过**32位是 高8位 和 低8位进行比较，而64位是 高16位 与 低16位 进行比较**。下面仅仅说明几个指令的含义：

    1. "movzwl %w0, %2\n\t"

       将 %w0 即 eax (64位) 的值赋值到 tmp，但是高16位用0填充，即 低16位赋给 tmp。

    2.  "shrl $16, %0\n\t"

       %0 逻辑右移 16位，即 %0 仅存 高16位。

    之后流程和32位相同。


#### spin_lock_bh

之后的函数直接分析SMP系统（x86）。

```c
include/linux/spinlock.h
#define raw_spin_lock_bh(lock)		_raw_spin_lock_bh(lock)
static inline void spin_lock_bh(spinlock_t *lock)
{
	raw_spin_lock_bh(&lock->rlock);
}
```

```c
kernel/spinlock.c
void __lockfunc _raw_spin_lock_bh(raw_spinlock_t *lock)
{
	__raw_spin_lock_bh(lock);
}
```

```c
include/linux/spinlock_api_smp.h
static inline void __raw_spin_lock_bh(raw_spinlock_t *lock)
{
	local_bh_disable();
	preempt_disable();
	spin_acquire(&lock->dep_map, 0, 0, _RET_IP_);
	LOCK_CONTENDED(lock, do_raw_spin_trylock, do_raw_spin_lock);
}
```

BH 和 非BH区别主要是增加了 函数 "local_bh_disable" ，看一下其定义：

```c
kernel/softirq.c
void local_bh_disable(void)
{
	__local_bh_disable((unsigned long)__builtin_return_address(0));
}
--->>>
static inline void __local_bh_disable(unsigned long ip)
{
	add_preempt_count(SOFTIRQ_OFFSET);
	barrier();
}
```

1. "\_\_builtin_return_address" 接收一个称为 `level` 的参数。这个参数定义希望获取返回地址的调用堆栈级别。例如，如果指定 `level` 为 `0`，那么就是请求当前函数的返回地址。如果指定 `level` 为 `1`，那么就是请求进行调用的函数的返回地址，依此类推。使用 `__builtin_return_address`捕捉返回地址，以便在以后进行跟踪时使用这个地址。
2. preempt_count 加 本地软中断偏移(SOFTIRQ_OFFSET)，之后可用 宏 'softirq_count()' 进行判断是否已禁用软中断。

#### spin_lock_irq

irq 锁是禁止了硬中断。过程代码不在赘述，直接到最后 多的 "raw_local_irq_disable()"函数：

```c
arch/x86/include/asm/irqflags.h
static inline void raw_local_irq_disable(void)
{
	native_irq_disable();
}
--->>>
static inline void native_irq_disable(void)
{
	asm volatile("cli": : :"memory");
}
```

x86架构直接调用 "CLI" 指令。大多数情况下，"CLI"会清除EFLAGS寄存器中的IF标志，并且不会影响其他标志。 清除IF标志会导致处理器**忽略**可屏蔽的外部中断。

#### spin_lock_irqsave

```c
#define spin_lock_irqsave(lock, flags)				\
do {								\
	raw_spin_lock_irqsave(spinlock_check(lock), flags);	\
} while (0)
--->>>
#define raw_spin_lock_irqsave(lock, flags)			\
	do {						\
		typecheck(unsigned long, flags);	\
		flags = _raw_spin_lock_irqsave(lock);	\
	} while (0)
```

```c
include/linux/typecheck.h
/*检查x是否为type类型*/
#define typecheck(type,x) \
({	type __dummy; \
	typeof(x) __dummy2; \
	(void)(&__dummy == &__dummy2); \
	1; \
})
```

```c
kernel/spinlock.c
unsigned long __lockfunc _raw_spin_lock_irqsave(raw_spinlock_t *lock)
{
	return __raw_spin_lock_irqsave(lock);
}
--->>>
include/linux/spinlock_api_smp.h
static inline unsigned long __raw_spin_lock_irqsave(raw_spinlock_t *lock)
{
	unsigned long flags;

	local_irq_save(flags);
	preempt_disable();
	spin_acquire(&lock->dep_map, 0, 0, _RET_IP_);
	/*
	 * On lockdep we dont want the hand-coded irq-enable of
	 * do_raw_spin_lock_flags() code, because lockdep assumes
	 * that interrupts are not re-enabled during lock-acquire:
	 */
#ifdef CONFIG_LOCKDEP
	LOCK_CONTENDED(lock, do_raw_spin_trylock, do_raw_spin_lock);
#else
	do_raw_spin_lock_flags(lock, &flags);
#endif
	return flags;
}
```

仅分析 宏'local_irq_save()' 及 函数'do_raw_spin_lock_flags()'：

- local_irq_save

  ```c
  include/linux/irqflags.h
  #define local_irq_save(flags)			\
  do {						\
  	typecheck(unsigned long, flags);	\
  	raw_local_irq_save(flags);		\
  	trace_hardirqs_off();			\
  } while (0)
  --->>>
  arch/x86/include/asm/irqflags.h
  #define raw_local_irq_save(flags)			\
  	do { (flags) = __raw_local_irq_save(); } while (0)
  --->>>
  static inline unsigned long __raw_local_irq_save(void)
  {
  	unsigned long flags = __raw_local_save_flags();
  	raw_local_irq_disable();
  	return flags;
  }
  ```

  ```c
  static inline unsigned long __raw_local_save_flags(void)
  {
  	return native_save_fl();
  }
  --->>>
  static inline unsigned long native_save_fl(void)
  {
  	unsigned long flags;
  	asm volatile("# __raw_save_flags\n\t"
  		     "pushf ; pop %0"
  		     : "=rm" (flags)
  		     : 
  		     : "memory");

  	return flags;
  }
  ```

  1. "# __raw_save_flags\n\t"

     注释。

  2. "pushf"

     将eflags寄存器的内容入栈。

  3. "pop %0"

     栈顶内容载入 目的操作数中，此处为 flags。

  ```c
  arch/x86/include/asm/irqflags.h
  static inline void raw_local_irq_disable(void)
  {
  	native_irq_disable();
  }
  --->>>
  static inline void native_irq_disable(void)
  {
    	/*CLI 指令前面已做介绍*/
  	asm volatile("cli": : :"memory");
  }
  ```

- do_raw_spin_lock_flags

  ```c
  static inline void
  do_raw_spin_lock_flags(raw_spinlock_t *lock, unsigned long *flags) __acquires(lock)
  {
  	__acquire(lock);
  	arch_spin_lock_flags(&lock->raw_lock, *flags);
  }
  ```

  ```c
  arch/x86/include/asm/spinlock.h
  static __always_inline void arch_spin_lock_flags(arch_spinlock_t *lock,
  						  unsigned long flags)
  {
  	arch_spin_lock(lock);
  }
  --->>>
  arch_spin_lock() 之前已经分析过。
  ```


这些函数的对应函数都是其逆操作。

### 自旋锁和下半部

由于下半部可以抢占进程上下文中的代码，所以当下半部和进程上下文共享数据时，必须对进程上下文中的共享数据进行保护，所以需要加锁的同时还要禁止下半部执行。同样，由于中断处理程序可以抢占下半部，所以如果中断处理程序和下半部共享数据，那么就必须在获取恰当的锁的同时还要禁止中断。

**同类的tasklet不可能同时运行**，所以对于同类tasklet中的共享数据不需要保护。但是当数据被两个不同种类的tasklet共享时，就需要在访问下半部中的数据前先获得一个普通的自旋锁。这里不需要禁止下半部，因为在**同一个处理器上绝不会有tasklet相互抢占的情况**。

对于软中断，无论是否同种类型，如果数据被软中断共享，那么它必须得到锁的保护。这是因为，即使是**同种类型的两个软中断也可以同时运行在一个系统的多个处理器上**。但是，**同一处理器上的一个软中断绝不会抢占另一个软中断**，因此，根本投必要禁止下半部。

### 读写自旋锁

有时候，锁的用途明确的分为读取和写入两个场景。当更新(写入)链表时，不能有其他代码井发地写链表或从链表中读取数据，写操作要求完全互斥。另一方面，当对其检索(读取)链表时，只要其他程序不对链表进行写操作就行了。
只要没有写操作，多个并发的读操作都是安全的。

当对某个数据结构的操作可以像这样被划分为读/写或者消费者/生产者两种类别时，类似读/写锁这样的机制就很有帮助了。为此，Linux内核提供了专门的读一写自旋锁。这种自旋锁为读和写分别提供了不同的锁。一个或多个读任务可以并发地持有读者锁;相反，用于写的锁最多只能被一个写任务持有，而且此时不能有并发的读操作。有时把读/写锁叫做共享/排斥锁，或者并发/排斥锁，因为这种锁以共亨(对读者而言)和排斥(对写者而言)的形式获得使用。

下面开始分析原理。

#### rwlock_init

```c
include/linux/rwlock.h
# define rwlock_init(lock)					\
	do { *(lock) = __RW_LOCK_UNLOCKED(lock); } while (0)
```

```c
include/linux/rwlock_types.h
#define __RW_LOCK_UNLOCKED(lockname) \
	(rwlock_t)	{	.raw_lock = __ARCH_RW_LOCK_UNLOCKED,	\
				RW_DEP_MAP_INIT(lockname) }
```

```c
#define RW_LOCK_BIAS		 0x01000000
#define __ARCH_RW_LOCK_UNLOCKED		{ RW_LOCK_BIAS }
```

初始化结果为 将 '0x01000000' 赋值给 raw_lock 。

#### read_lock

```c
include/linux/rwlock.h
#define read_lock(lock)		_raw_read_lock(lock)
--->>>
include/linux/rwlock_api_smp.h
#define _raw_read_lock(lock) __raw_read_lock(lock)
--->>>
static inline void __raw_read_lock(rwlock_t *lock)
{
	preempt_disable();
	rwlock_acquire_read(&lock->dep_map, 0, 0, _RET_IP_);
	LOCK_CONTENDED(lock, do_raw_read_trylock, do_raw_read_lock);
}
```

```c
include/linux/rwlock.h
# define do_raw_read_lock(rwlock)	\
	do {__acquire(lock); arch_read_lock(&(rwlock)->raw_lock); } while (0)
--->>>
arch/x86/include/asm/spinlock.h
static inline void arch_read_lock(arch_rwlock_t *rw)
{
	asm volatile(LOCK_PREFIX " subl $1,(%0)\n\t"
		     "jns 1f\n"
		     "call __read_lock_failed\n\t"
		     "1:\n"
		     ::LOCK_PTR_REG (rw) : "memory");
}
```

1. " subl $1,(%0)\n\t"

   目的操作数值减1。在 AT&T 汇编格式中，用 '$' 前缀表示一个立即操作数；而在 Intel 汇编格式中，立即数的表示不用带任何前缀。

2. "jns 1f\n"

   指令 JNS  表示 ：如果符号位 (SF)不为1，就跳转。

3. "call __read_lock_failed\n\t"

   调用符号 '__read_lock_failed'，此符号定义在文件"arch/x86/lib/semaphore\_32.S"。

   ```c
   ENTRY(__read_lock_failed)
   	CFI_STARTPROC
   	FRAME
   2: 	LOCK_PREFIX
   	incl	(%eax)
   1:	rep; nop
   	cmpl	$1,(%eax)
   	js	1b
   	LOCK_PREFIX
   	decl	(%eax)
   	js	2b
   	ENDFRAME
   	ret
   	CFI_ENDPROC
   	ENDPROC(__read_lock_failed)
   ```

   ```c
   arch/x86/include/asm/dwarf2.h
   #define CFI_STARTPROC             .cfi_startproc
   #define CFI_ENDPROC               .cfi_endproc

   .cfi_startproc用于每个函数的开头，这些函数应该在.eh_frame中有一个入口。 它初始化一些内部数据结构。 用.cfi_endproc关闭函数。

   除非.cfi_startproc与参数"simple"一起使用，否则它还会发出一些与体系结构有关的初始CFI指令。
   ```

   ```c
   伪代码如下：
   2:
   	incl (%eax); // eax 代表 lock ，因为之前减1没有加锁成功,所以先恢复原值。
   1:
   	if(lock - 1  < 0)	// write lock 直接减去 0x01000000, 为0,也就是说 write locked则一直循环。
         goto 1;
   	decl lock;
   	if(lock < 0)	// 如果小于0，则说明在decl 之前，又被write 把锁抢占了，那么从头开始
         goto 2;
   	return	
   ```

读锁是减1，值不为负则加锁成功，因此最多可同时有'0x01000000'个读锁，完全足够。但是按照底层代码分析，即使加了读锁，写数据也是有可能的，这就需要内核开发人员必须能够分清需要读还是写。

#### write_lock

```c
include/linux/rwlock.h
#define write_lock(lock)	_raw_write_lock(lock)
--->>>
include/linux/rwlock_api_smp.h
#define _raw_write_lock(lock) __raw_write_lock(lock)
--->>>
static inline void __raw_write_lock(rwlock_t *lock)
{
	preempt_disable();
	rwlock_acquire(&lock->dep_map, 0, 0, _RET_IP_);
	LOCK_CONTENDED(lock, do_raw_write_trylock, do_raw_write_lock);
}
```

```c
include/linux/rwlock.h
# define do_raw_write_lock(rwlock)	\
	do {__acquire(lock); arch_write_lock(&(rwlock)->raw_lock); } while (0)
--->>>
arch/x86/include/asm/spinlock.h
static inline void arch_write_lock(arch_rwlock_t *rw)
{
	asm volatile(LOCK_PREFIX " subl %1,(%0)\n\t"
		     "jz 1f\n"
		     "call __write_lock_failed\n\t"
		     "1:\n"
		     ::LOCK_PTR_REG (rw), "i" (RW_LOCK_BIAS) : "memory");
}
```

```c
伪代码如下：
if (0 != (rw->lock - 0x01000000))
  call __write_lock_failed
return
```

```c
ENTRY(__write_lock_failed)
	CFI_STARTPROC simple
	FRAME
2: 	LOCK_PREFIX
	addl	$ RW_LOCK_BIAS,(%eax)
1:	rep; nop
	cmpl	$ RW_LOCK_BIAS,(%eax)
	jne	1b
	LOCK_PREFIX
	subl	$ RW_LOCK_BIAS,(%eax)
	jnz	2b
	ENDFRAME
	ret
	CFI_ENDPROC
	ENDPROC(__write_lock_failed)
```

write_lock 伪代码和 read_lock 类似，可试着自己分析一下。

#### read_lock_bh

直接上最后的函数

```c
include/linux/rwlock_api_smp.h
static inline void __raw_read_lock_bh(rwlock_t *lock)
{
	local_bh_disable();
	preempt_disable();
	rwlock_acquire_read(&lock->dep_map, 0, 0, _RET_IP_);
	LOCK_CONTENDED(lock, do_raw_read_trylock, do_raw_read_lock);
}
```

函数 'local_bh_disable()' 和 宏 'do_raw_read_lock' 为核心，上面已经分析过。 

#### write_lock_bh

```c
include/linux/rwlock_api_smp.h
static inline void __raw_write_lock_bh(rwlock_t *lock)
{
	local_bh_disable();
	preempt_disable();
	rwlock_acquire(&lock->dep_map, 0, 0, _RET_IP_);
	LOCK_CONTENDED(lock, do_raw_write_trylock, do_raw_write_lock);
}
```

#### read_lock_irq

```c
static inline void __raw_read_lock_irq(rwlock_t *lock)
{
	local_irq_disable();
	preempt_disable();
	rwlock_acquire_read(&lock->dep_map, 0, 0, _RET_IP_);
	LOCK_CONTENDED(lock, do_raw_read_trylock, do_raw_read_lock);
}
```

#### write_lock_irq

```c
static inline void __raw_write_lock_irq(rwlock_t *lock)
{
	local_irq_disable();
	preempt_disable();
	rwlock_acquire(&lock->dep_map, 0, 0, _RET_IP_);
	LOCK_CONTENDED(lock, do_raw_write_trylock, do_raw_write_lock);
}
```

## 信号量

Linux中的信号量是一种睡眠锁。如果有一个任务试图获得一个不可用(已经被占用)的信号量时，信号且会将其推进一个等待队列，然后让其睡眠。这时处理器能重获自由，从而去执行其他代码。当持有的信号量可用(被释放)后，处于等待队列中的那个任务将被唤醒，并获得该信号量。

- 由于争用信号量的进程在等待锁重新变为可用时会睡眠，所以信号量适用于锁会被长时间持有的情况。
- 相反，锁被短时间持有时，使用信号量就不太适宜了。因为睡眠、维护等待队列以及唤醒所花费的开销可能比锁被占用的全部时间还要一长。
- 由于执行线程在锁被争用时会睡眠，所以只能在进程上下文中才能获取信号量锁，因为在中断上下文中是不能进行调度的。
- 可以在持有信号量时去睡眠(当然你也可能并不需要睡眠)，因为当其他进程试图获得同一信号量时不会因此而死锁(因为该进程也只是去睡眠而已，而你最终会继续执行的)。
- 在占用信号量的同时不能占用自旋锁。因为在你等待信号量时可能会睡眠，而在持有自旋锁时是不允许睡眠的。

以上这些结论阐明了信号量和自旋锁在使用上的差异。

信号量可以同时允许任意数量的锁持有者，而自旋锁在一个时刻最多允许一个任务持有它。信号量同时允许的持有者数量可以在声明信号量时指定。这个值称为使用者数量(usage count)或简单地叫数量(count)。通常情况下，信号量和自旋锁一样，在一个时刻仅允许有一个锁持有者。这时计数等于1，这样的信号量被称为二值信号量或互斥信号量(因为它强制进行互斥)。另一方面，初始化时也可以把数量设置为大于1的非0值。这种情况，信号量被称为计数信号童(counting semaphone)，它允许在一个时刻至多有count个锁持有者。计数信号量不能用来进行强制互斥，因为它允许多个执行线程同时访问临界区。相反，这种信号量用来对特定代码加以限制，内核中使用它的机会不多。在使用信号量时，基本上用到的都是互斥信号量(计数等于1的信号量)。

信号量支持两个原子操作P()和V()，这两个名字来自荷兰语Proberen和Vershogen。前者叫做测试操作(字面意思是探查)，后者叫做增加操作。后来的系统把两种操作分别叫做down()和up()。

down()操作通过对信号量计数减1来请求获得一个信号量。如果结果是0或大于0，获得信号量锁，任务就可以进入临界区。如果结果是负数，任务会被放入等待队列，处理器执行其他任务。相反，当临界区中的操作完成后，up()操作用来释放信号量。如果在该信号量上的等待队列不为空，那么处于队列中等待的任务在被唤醒的同时会获得该信号量。

下面开始看代码

### sema_init

```c
include/linux/semaphore.h
struct semaphore {
	raw_spinlock_t		lock;			//原始锁，保护下面的两个数据
	unsigned int		count;			//可用计数
	struct list_head	wait_list;		//等待队列
};
static inline void sema_init(struct semaphore *sem, int val)
{
	static struct lock_class_key __key;
  	/*核心函数*/
	*sem = (struct semaphore) __SEMAPHORE_INITIALIZER(*sem, val);
	lockdep_init_map(&sem->lock.dep_map, "semaphore->lock", &__key, 0);
}
--->>>
#define __SEMAPHORE_INITIALIZER(name, n)				\
{									\
	.lock		= __RAW_SPIN_LOCK_UNLOCKED((name).lock),	\
	.count		= n,						\
	.wait_list	= LIST_HEAD_INIT((name).wait_list),		\
}
--->>>
__RAW_SPIN_LOCK_UNLOCKED	//之前分析过，这个是 lock 的初始化。
```

初始化仅仅是将结构体内的3个字段进行初始。

### down

```c
kernel/semaphore.c
void down(struct semaphore *sem)
{
	unsigned long flags;
	/*加irqsave锁，防止上下文切换并保护数据*/
	raw_spin_lock_irqsave(&sem->lock, flags);
  	/*大于0说明还有可用计数，仅仅减计数即可；
  	likely-当条件成立时，可优化代码执行速度*/
	if (likely(sem->count > 0))
		sem->count--;
	else
		__down(sem);
	raw_spin_unlock_irqrestore(&sem->lock, flags);
}
--->>>
static noinline void __sched __down(struct semaphore *sem)
{
  	/*
  	#define	MAX_SCHEDULE_TIMEOUT	LONG_MAX
  	#define LONG_MAX	((long)(~0UL>>1))
  	*/
	__down_common(sem, TASK_UNINTERRUPTIBLE, MAX_SCHEDULE_TIMEOUT);
}
--->>>
struct semaphore_waiter {
	struct list_head list;
	struct task_struct *task;
	bool up;
};

static inline int __sched __down_common(struct semaphore *sem, long state,
								long timeout)
{
  	/*task为当前进程描述符*/
	struct task_struct *task = current;
	struct semaphore_waiter waiter;

	list_add_tail(&waiter.list, &sem->wait_list);
	waiter.task = task;
	waiter.up = false;

	for (;;) {
      	/*signal_pending_state分析见下面。*/
		if (signal_pending_state(state, task))
			goto interrupted;
		if (unlikely(timeout <= 0))
			goto timed_out;
      	/*将当前任务设置为TASK_UNINTERRUPTIBLE状态*/
		__set_task_state(task, state);
      	/*unlock之后进行进程切换*/
		raw_spin_unlock_irq(&sem->lock);
		timeout = schedule_timeout(timeout);
      	/*切换回来后重新加锁
      	判断切换期间是否有信号量释放，没有则继续使任务睡眠*/
		raw_spin_lock_irq(&sem->lock);
		if (waiter.up)
			return 0;
	}

 timed_out:
	list_del(&waiter.list);
	return -ETIME;

 interrupted:
	list_del(&waiter.list);
	return -EINTR;
}
--->>>
static inline int signal_pending_state(long state, struct task_struct *p)
{
  	/*函数正确返回：
  	1. 不为 (TASK_INTERRUPTIBLE | TASK_WAKEKILL)
  	2. TASK_INTERRUPTIBLE 时，没有 要处理的信号  --->>> 信号会打断状态
  	3. TASK_WAKEKILL 时，没有 未处理的 KILL 信号	--->>> 信号会打断状态
  	*/
  	/*若设置状态为 TASK_INTERRUPTIBLE | TASK_WAKEKILL(仅响应致命信号) 则继续，否则退出*/
	if (!(state & (TASK_INTERRUPTIBLE | TASK_WAKEKILL)))
		return 0;
  	/*如果有未处理的信号，则继续，否则退出*/
	if (!signal_pending(p))
		return 0;
	
  	/*若 state为 TASK_INTERRUPTIBLE
  	或 存在未处理的KILL信号，则返回 true*/
	return (state & TASK_INTERRUPTIBLE) || __fatal_signal_pending(p);
}
```

down_interruptible、down_killable、down_trylock和down_timeout，这几个函数不在分析，内部函数都分析过，只是状态或timeout重设而已。

### up

```c
void up(struct semaphore *sem)
{
	unsigned long flags;

	raw_spin_lock_irqsave(&sem->lock, flags);
  	/*等待队列为空，说明没有进程等待此信号量，则增计数即可*/
	if (likely(list_empty(&sem->wait_list)))
		sem->count++;
	else
		__up(sem);
	raw_spin_unlock_irqrestore(&sem->lock, flags);
}
--->>>
static noinline void __sched __up(struct semaphore *sem)
{
  	/*有进程等待此信号量，那么
  	1.从等待队列从找出第一个数据
  	2.从等待队列删除
  	3.将此队列up置为true-->>down 中的循环条件
  	4.唤醒函数*/
	struct semaphore_waiter *waiter = list_first_entry(&sem->wait_list,
						struct semaphore_waiter, list);
	list_del(&waiter->list);
	waiter->up = true;
	wake_up_process(waiter->task);
}
```

### 读写信号量

与自旋锁类似，信号量也可优化为读写信号量，直接开始分析代码：

#### init_rwsem

```c
/*此处定义了 两种结构体，根据是否开启RWSEM选项而用不同结构体及实现*/
#ifdef CONFIG_RWSEM_GENERIC_SPINLOCK //专用锁
#include <linux/rwsem-spinlock.h> /* use a generic implementation */
--->>>
struct rw_semaphore {
	/*
	0 为初始状态
	>0 表示有读者，数量为读者数量
	-1 表示有写者
	*/
	__s32			activity;
	raw_spinlock_t		wait_lock;
	struct list_head	wait_list;
#ifdef CONFIG_DEBUG_LOCK_ALLOC
	struct lockdep_map dep_map;
#endif
};
#else
/* All arch specific implementations share the same struct */
struct rw_semaphore {
	long			count;
	raw_spinlock_t		wait_lock;
	struct list_head	wait_list;
#ifdef CONFIG_DEBUG_LOCK_ALLOC
	struct lockdep_map	dep_map;
#endif
};

#define init_rwsem(sem)						\
do {								\
	static struct lock_class_key __key;			\
								\
	__init_rwsem((sem), #sem, &__key);			\
} while (0)
```

- rwsem.c

  ```c
  void __init_rwsem(struct rw_semaphore *sem, const char *name,
  		  struct lock_class_key *key)
  {
  #ifdef CONFIG_DEBUG_LOCK_ALLOC
  	/*
  	 * Make sure we are not reinitializing a held semaphore:
  	 */
  	debug_check_no_locks_freed((void *)sem, sizeof(*sem));
  	lockdep_init_map(&sem->dep_map, name, key, 0);
  #endif
  	sem->count = RWSEM_UNLOCKED_VALUE;
  	raw_spin_lock_init(&sem->wait_lock);
  	INIT_LIST_HEAD(&sem->wait_list);
  }
  ```

  和普通信号量相同的初始化。

- rwsem-spinlock.c

  ```C
  void __init_rwsem(struct rw_semaphore *sem, const char *name,
  		  struct lock_class_key *key)
  {
  #ifdef CONFIG_DEBUG_LOCK_ALLOC
  	/*
  	 * Make sure we are not reinitializing a held semaphore:
  	 */
  	debug_check_no_locks_freed((void *)sem, sizeof(*sem));
  	lockdep_init_map(&sem->dep_map, name, key, 0);
  #endif
  	sem->activity = 0;
  	raw_spin_lock_init(&sem->wait_lock);
  	INIT_LIST_HEAD(&sem->wait_list);
  }
  ```

#### down_read

- x86架构 普通实现

  ```c
  static inline void __down_read(struct rw_semaphore *sem)
  {
  	asm volatile("# beginning down_read\n\t"
  		     LOCK_PREFIX _ASM_INC "(%1)\n\t"
  		     /* adds 0x00000001 */
  		     "  jns        1f\n"
  		     "  call call_rwsem_down_read_failed\n"
  		     "1:\n\t"
  		     "# ending down_read\n\t"
  		     : "+m" (sem->count)
  		     : "a" (sem)
  		     : "memory", "cc");
  }
  ```

  自加 1，结果为正则退出，为负则 跳转到函数 'call_rwsem_down_read_failed'，请参考之前的查找方式自己查找其实现。

- 专用锁

  ```c
  void __sched __down_read(struct rw_semaphore *sem)
  {
  	struct rwsem_waiter waiter;
  	struct task_struct *tsk;
  	unsigned long flags;

  	raw_spin_lock_irqsave(&sem->wait_lock, flags);
  	/*初始化状态 或 仅有读者则 自加1 退出*/
  	if (sem->activity >= 0 && list_empty(&sem->wait_list)) {
  		/* granted */
  		sem->activity++;
  		raw_spin_unlock_irqrestore(&sem->wait_lock, flags);
  		goto out;
  	}

    	/*此处说明，有写者已经加锁*/
    	/*将任务设置为 TASK_UNINTERRUPTIBLE 状态*/
  	tsk = current;
  	set_task_state(tsk, TASK_UNINTERRUPTIBLE);

  	/*初始化 waiter 并将其加入 读写信号量 链表*/
  	waiter.task = tsk;
  	waiter.type = RWSEM_WAITING_FOR_READ;
    	/*增加当前进程使用计数 usage*/
  	get_task_struct(tsk);

  	list_add_tail(&waiter.list, &sem->wait_list);

  	/*解锁之后继续等待*/
  	raw_spin_unlock_irqrestore(&sem->wait_lock, flags);

  	/*循环等锁，进程切换再次判断。
  	waiter列表无任务则退出。
  	*/
  	for (;;) {
  		if (!waiter.task)
  			break;
  		schedule();
  		set_task_state(tsk, TASK_UNINTERRUPTIBLE);
  	}

  	tsk->state = TASK_RUNNING;
   out:
  	;
  }
  ```

  读者无锁应该等写者解锁：up_write。之后分析专用文件。

#### up_write

```c
enum rwsem_waiter_type {
	RWSEM_WAITING_FOR_WRITE,
	RWSEM_WAITING_FOR_READ
};
```

```c
void __up_write(struct rw_semaphore *sem)
{
	unsigned long flags;

	raw_spin_lock_irqsave(&sem->wait_lock, flags);
	/*写者解锁直接赋值为0 即可。若队列有等待进程则唤醒
	1 为是否唤醒 写者标志*/
	sem->activity = 0;
	if (!list_empty(&sem->wait_list))
		sem = __rwsem_do_wake(sem, 1);

	raw_spin_unlock_irqrestore(&sem->wait_lock, flags);
}
--->>>
static inline struct rw_semaphore *
__rwsem_do_wake(struct rw_semaphore *sem, int wakewrite)
{
	struct rwsem_waiter *waiter;
	struct task_struct *tsk;
	int woken;

  	/*等待队列中获取一个等待者*/
	waiter = list_entry(sem->wait_list.next, struct rwsem_waiter, list);

  	/*写者独占锁，则唤醒即退出*/
	if (waiter->type == RWSEM_WAITING_FOR_WRITE) {
		if (wakewrite)
			wake_up_process(waiter->task);
		goto out;
	}
  	/*唤醒全部读者 或者 仅唤醒 等待的写者之前的读者
  	  这么做的原因是保证顺序性，防止在写者之后的读者读到旧的数据
  	*/
	woken = 0;
	do {
		struct list_head *next = waiter->list.next;

		list_del(&waiter->list);
		tsk = waiter->task;
      	/*内存屏障，保证顺序性，防止 tsk为NULL*/
		smp_mb();
		waiter->task = NULL;
		wake_up_process(tsk);
      	/*读的时候 get了一下*/
		put_task_struct(tsk);
		woken++;
		if (next == &sem->wait_list)
			break;
		waiter = list_entry(next, struct rwsem_waiter, list);
	} while (waiter->type != RWSEM_WAITING_FOR_WRITE);
	/*增加唤醒的读者数量*/
	sem->activity += woken;

 out:
	return sem;
}
```

#### down_write

```c
void __sched __down_write(struct rw_semaphore *sem)
{
	__down_write_nested(sem, 0);
}
--->>>
void __sched __down_write_nested(struct rw_semaphore *sem, int subclass)
{
	struct rwsem_waiter waiter;
	struct task_struct *tsk;
	unsigned long flags;

	raw_spin_lock_irqsave(&sem->wait_lock, flags);

	/*先初始化一个结构体，不能放循环里*/
	tsk = current;
	waiter.task = tsk;
	waiter.type = RWSEM_WAITING_FOR_WRITE;
	list_add_tail(&waiter.list, &sem->wait_list);
	
	for (;;) {
		/*无人状态则加锁退出
		此循环进行等锁*/
		if (sem->activity == 0)
			break;
		set_task_state(tsk, TASK_UNINTERRUPTIBLE);
		raw_spin_unlock_irqrestore(&sem->wait_lock, flags);
		schedule();
		raw_spin_lock_irqsave(&sem->wait_lock, flags);
	}
	/* got the lock */
	sem->activity = -1;
	list_del(&waiter.list);

	raw_spin_unlock_irqrestore(&sem->wait_lock, flags);
}
```

#### up_read

```c
void __up_read(struct rw_semaphore *sem)
{
	unsigned long flags;

	raw_spin_lock_irqsave(&sem->wait_lock, flags);

	if (--sem->activity == 0 && !list_empty(&sem->wait_list))
		sem = __rwsem_wake_one_writer(sem);

	raw_spin_unlock_irqrestore(&sem->wait_lock, flags);
}
--->>>
/*读锁唤醒时，等待队列中肯定都是写进程*/
 static inline struct rw_semaphore *
 __rwsem_wake_one_writer(struct rw_semaphore *sem)
 {
 	struct rwsem_waiter *waiter;
 
 	waiter = list_entry(sem->wait_list.next, struct rwsem_waiter, list);
 	wake_up_process(waiter->task);
 
 	return sem;
 }
```

## 互斥体

多数用户使用信号量只使用计数1，把它作为一个互斥的排它锁。信号量用户通用且没多少使用限制，这使得信号量适合用于那些较复杂的、未明情况下的互斥访问，比如内核于用户空间复杂的交互行为。

但这也意味着简单的锁定而使用信号量不方便，并且信号量也缺乏强制的规则来行使任何形式的自动调试，即便受限的调试也不可能。为了找到一个更简单的睡眠锁，内核开发者们引入了互斥体（mutex）。

mutex在内核中对应数据结构体mutex，其行为和使用计数为1的信号量类似，但操作接口更简单，实现也更高效，而且使用限制更强。

```c
struct mutex {
	/* 1: unlocked, 0: locked, negative: locked, possible waiters */
	atomic_t		count;
	spinlock_t		wait_lock;
	struct list_head	wait_list;
#if defined(CONFIG_DEBUG_MUTEXES) || defined(CONFIG_SMP)
  	/*多核架构 */
	struct task_struct	*owner;
#endif
#ifdef CONFIG_MUTEX_SPIN_ON_OWNER
	void			*spin_mlock;	/* Spinner MCS lock */
#endif
#ifdef CONFIG_DEBUG_MUTEXES
	const char 		*name;
	void			*magic;
#endif
#ifdef CONFIG_DEBUG_LOCK_ALLOC
	struct lockdep_map	dep_map;
#endif
};
```

### mutex_init

```c
# define mutex_init(mutex) \
do {							\
	static struct lock_class_key __key;		\
	__mutex_init((mutex), #mutex, &__key);		\
} while (0)
--->>>
void
__mutex_init(struct mutex *lock, const char *name, struct lock_class_key *key)
{
  	/*初始化字段*/
	atomic_set(&lock->count, 1);
	spin_lock_init(&lock->wait_lock);
	INIT_LIST_HEAD(&lock->wait_list);
	mutex_clear_owner(lock);
#ifdef CONFIG_MUTEX_SPIN_ON_OWNER
	lock->spin_mlock = NULL;
#endif
	debug_mutex_init(lock, name, key);
}
```

### mutex_lock

```c
void __sched mutex_lock(struct mutex *lock)
{
  	/*不知道为什么需要睡一下*/
	might_sleep();
	__mutex_fastpath_lock(&lock->count, __mutex_lock_slowpath);
  	/*设置进程owner*/
	mutex_set_owner(lock);
}
/*__sched */
/*	Attach to any functions which should be ignored in wchan output. 
    #define __sched         __attribute__((__section__(".sched.text")))
把带有__sched的函数放到.sched.text段。
kernel有个waiting channel，如果用户空间的进程睡眠了，可以查到是停在内核空间哪个函数中等待的：
    cat "/proc/<pid>/wchan"
显然，.sched.text段的代码是会被wchan忽略的，schedule这个函数是不会出现在wchan的结果中的。
*/
```

```c
x86架构
/*
count 自减1，结果不为负（1-->0）则退出；
否则，调用fail_fn函数
*/
#define __mutex_fastpath_lock(count, fail_fn)			\
do {								\
	unsigned int dummy;					\
								\
	typecheck(atomic_t *, count);				\
	typecheck_fn(void (*)(atomic_t *), fail_fn);		\
								\
	asm volatile(LOCK_PREFIX "   decl (%%eax)\n"		\
		     "   jns 1f	\n"				\
		     "   call " #fail_fn "\n"			\
		     "1:\n"					\
		     : "=a" (dummy)				\
		     : "a" (count)				\
		     : "memory", "ecx", "edx");			\
} while (0)
```

```c
static __used noinline void __sched
__mutex_lock_slowpath(atomic_t *lock_count)
{
  	/*container_of，内核的巧妙设计，请阅读源码*/
	struct mutex *lock = container_of(lock_count, struct mutex, count);
	__mutex_lock_common(lock, TASK_UNINTERRUPTIBLE, 0, NULL, _RET_IP_);
}
/*
# define __used			__attribute__((__unused__))
告诉编译器无论 GCC 是否发现这个函数的调用实例，都要使用这个函数。这对于从汇编代码中调用 C 函数有帮助。
noinline  强制不内联
*/
```

```c
static inline int __sched
__mutex_lock_common(struct mutex *lock, long state, unsigned int subclass,
		    struct lockdep_map *nest_lock, unsigned long ip)
{
	struct task_struct *task = current;
	struct mutex_waiter waiter;
	unsigned long flags;
  	/*禁止内核抢占*/
	preempt_disable();
	mutex_acquire_nest(&lock->dep_map, subclass, 0, nest_lock, ip);

#ifdef CONFIG_MUTEX_SPIN_ON_OWNER
	/*
	当发现没有待处理的服务器并且锁所有者当前正在（不同的）CPU上运行时，尝试旋转获取（fastpath）。
	理由是，如果锁主人正在运行，很可能很快就会解锁。
	由于这需要锁所有者，而且这个互斥体实现不会在锁定字段中原子地跟踪所有者，所以需要非原子地跟踪它。
	*/
  	/*判断 进程描述符 on_cpu 位，以此判断是否在占用cpu(网上查询此标志释义不正确，可查代码自知)
  	在 cpu 上，认为会很快解锁，所以循环等待。
  	*/
	if (!mutex_can_spin_on_owner(lock))
		goto slowpath;

	for (;;) {
		struct task_struct *owner;
		struct mspin_node  node;
		/*mspin_lock 旋转等待解锁，函数分析在下面*/
		mspin_lock(MLOCK(lock), &node);
      	/*ACCESS_ONCE 保证字段是从内存获取*/
		owner = ACCESS_ONCE(lock->owner);
		if (owner && !mutex_spin_on_owner(lock, owner)) {
			mspin_unlock(MLOCK(lock), &node);
			break;
		}

		if ((atomic_read(&lock->count) == 1) &&
		    (atomic_cmpxchg(&lock->count, 1, 0) == 1)) {
			lock_acquired(&lock->dep_map, ip);
			mutex_set_owner(lock);
			mspin_unlock(MLOCK(lock), &node);
			preempt_enable();
			return 0;
		}
		mspin_unlock(MLOCK(lock), &node);

		/*
		 * When there's no owner, we might have preempted between the
		 * owner acquiring the lock and setting the owner field. If
		 * we're an RT task that will live-lock because we won't let
		 * the owner complete.
		 */
		if (!owner && (need_resched() || rt_task(task)))
			break;

		/*
		 * The cpu_relax() call is a compiler barrier which forces
		 * everything in this loop to be re-loaded. We don't need
		 * memory barriers as we'll eventually observe the right
		 * values at the cost of a few extra spins.
		 */
		arch_mutex_cpu_relax();
	}
slowpath:
#endif
	spin_lock_mutex(&lock->wait_lock, flags);

	debug_mutex_lock_common(lock, &waiter);
	debug_mutex_add_waiter(lock, &waiter, task_thread_info(task));

	/* add waiting tasks to the end of the waitqueue (FIFO): */
	list_add_tail(&waiter.list, &lock->wait_list);
	waiter.task = task;

	if (MUTEX_SHOW_NO_WAITER(lock) && (atomic_xchg(&lock->count, -1) == 1))
		goto done;

	lock_contended(&lock->dep_map, ip);

	for (;;) {
		/*
		 * Lets try to take the lock again - this is needed even if
		 * we get here for the first time (shortly after failing to
		 * acquire the lock), to make sure that we get a wakeup once
		 * it's unlocked. Later on, if we sleep, this is the
		 * operation that gives us the lock. We xchg it to -1, so
		 * that when we release the lock, we properly wake up the
		 * other waiters:
		 */
		if (MUTEX_SHOW_NO_WAITER(lock) &&
		   (atomic_xchg(&lock->count, -1) == 1))
			break;

		/*
		 * got a signal? (This code gets eliminated in the
		 * TASK_UNINTERRUPTIBLE case.)
		 */
		if (unlikely(signal_pending_state(state, task))) {
			mutex_remove_waiter(lock, &waiter,
					    task_thread_info(task));
			mutex_release(&lock->dep_map, 1, ip);
			spin_unlock_mutex(&lock->wait_lock, flags);

			debug_mutex_free_waiter(&waiter);
			preempt_enable();
			return -EINTR;
		}
		__set_task_state(task, state);

		/* didn't get the lock, go to sleep: */
		spin_unlock_mutex(&lock->wait_lock, flags);
		schedule_preempt_disabled();
		spin_lock_mutex(&lock->wait_lock, flags);
	}

done:
	lock_acquired(&lock->dep_map, ip);
	/* got the lock - rejoice! */
	mutex_remove_waiter(lock, &waiter, current_thread_info());
	mutex_set_owner(lock);

	/* set it to 0 if there are no waiters left: */
	if (likely(list_empty(&lock->wait_list)))
		atomic_set(&lock->count, 0);

	spin_unlock_mutex(&lock->wait_lock, flags);

	debug_mutex_free_waiter(&waiter);
	preempt_enable();

	return 0;
}
```

```c
static noinline
void mspin_lock(struct mspin_node **lock, struct mspin_node *node)
{
	struct mspin_node *prev;

	/* Init node */
	node->locked = 0;
	node->next   = NULL;

	prev = xchg(lock, node);
  	/*
  	可理解为 prev = lock;
  	lock = node;  node 无变化
  	*/
	if (likely(prev == NULL)) {
		/* Lock acquired */
		node->locked = 1;
		return;
	}
	ACCESS_ONCE(prev->next) = node;
	smp_wmb();
	/* 等待锁持有者放行 */
	while (!ACCESS_ONCE(node->locked))
		arch_mutex_cpu_relax();	// 执行 nop
}
--->>>
x86
#define xchg(ptr, v)	__xchg_op((ptr), (v), xchg, "")
--->>>
#define __xchg_op(ptr, arg, op, lock)					\
	({								\
		/*
		定义返回值 __ret
		arg 在刚开始就已经赋给 __ret，也就是说不对 arg进行操作
		lock 传参为""，xchg 指令有 lock 功能
		xchg 释义为：
			TEMP ← DEST;
			DEST ← SRC;
			SRC ← TEMP;
		*/
	        __typeof__ (*(ptr)) __ret = (arg);			\
		switch (sizeof(*(ptr))) {				\
		// 1
		case __X86_CASE_B:					\
			asm volatile (lock #op "b %b0, %1\n"		\
				      : "+q" (__ret), "+m" (*(ptr))	\
				      : : "memory", "cc");		\
			break;						\
		// 2
		case __X86_CASE_W:					\
			asm volatile (lock #op "w %w0, %1\n"		\
				      : "+r" (__ret), "+m" (*(ptr))	\
				      : : "memory", "cc");		\
			break;						\
		// 4
		case __X86_CASE_L:					\
			asm volatile (lock #op "l %0, %1\n"		\
				      : "+r" (__ret), "+m" (*(ptr))	\
				      : : "memory", "cc");		\
			break;						\
		// 8
		case __X86_CASE_Q:					\
			asm volatile (lock #op "q %q0, %1\n"		\
				      : "+r" (__ret), "+m" (*(ptr))	\
				      : : "memory", "cc");		\
			break;						\
		default:						\
			__ ## op ## _wrong_size();			\
		}							\
		__ret;							\
	})
```



### mutex_unlock



TODO



## 完成变量

### init_completion

```c
struct __wait_queue_head {
	spinlock_t lock;
	struct list_head task_list;
};
typedef struct __wait_queue_head wait_queue_head_t;

struct completion {
	unsigned int done;
	wait_queue_head_t wait;
};
```

```c
static inline void init_completion(struct completion *x)
{
	x->done = 0;
	init_waitqueue_head(&x->wait);
}
-->>
#define init_waitqueue_head(q)				\
	do {						\
		static struct lock_class_key __key;	\
							\
		__init_waitqueue_head((q), #q, &__key);	\
	} while (0)
-->>
//init the spinlock and the list
void __init_waitqueue_head(wait_queue_head_t *q, const char *name, struct lock_class_key *key)
{
	spin_lock_init(&q->lock);
	lockdep_set_class_and_name(&q->lock, key, name);
	INIT_LIST_HEAD(&q->task_list);
}
```

### wait_for_completion

```c
void __sched wait_for_completion(struct completion *x)
{
	wait_for_common(x, MAX_SCHEDULE_TIMEOUT, TASK_UNINTERRUPTIBLE);
}
-->>
static long __sched
wait_for_common(struct completion *x, long timeout, int state)
{
	return __wait_for_common(x, schedule_timeout, timeout, state);
}
-->>
static inline long __sched
__wait_for_common(struct completion *x,
		  long (*action)(long), long timeout, int state)
{
	might_sleep();

	spin_lock_irq(&x->wait.lock);
	timeout = do_wait_for_common(x, action, timeout, state);
	spin_unlock_irq(&x->wait.lock);
	return timeout;
}
-->>
static inline long __sched
do_wait_for_common(struct completion *x,
		   long (*action)(long), long timeout, int state)
{
	if (!x->done) {
      	/*
      	#define DECLARE_WAITQUEUE(name, tsk)					\
			wait_queue_t name = __WAITQUEUE_INITIALIZER(name, tsk)
		-->>
		#define __WAITQUEUE_INITIALIZER(name, tsk) {				\
        .private	= tsk,						\
        .func		= default_wake_function,			\
        .task_list	= { NULL, NULL } }
		-->>
		int default_wake_function(wait_queue_t *curr, unsigned mode, int wake_flags,
			  void *key)
        {
        	try_to_wake_up 改变状态成功则 return  success = 1;
            return try_to_wake_up(curr->private, mode, wake_flags);
        }
       	*/
      	/*
      	定义一个等待队列；更改flags 并加入到 完成变量的 等待队列中。
      	*/
		DECLARE_WAITQUEUE(wait, current);		
		__add_wait_queue_tail_exclusive(&x->wait, &wait);
		do {
          	/*
          	state = TASK_UNINTERRUPTIBLE;
          	signal_pending_state 前面分析过
          	*/
			if (signal_pending_state(state, current)) {
				timeout = -ERESTARTSYS;
				break;
			}
          	/*设置当前进程状态；之后解锁进行进程调度*/
			__set_current_state(state);
			spin_unlock_irq(&x->wait.lock);
			timeout = action(timeout);
			spin_lock_irq(&x->wait.lock);
		} while (!x->done && timeout);
		
		__remove_wait_queue(&x->wait, &wait);
		if (!x->done)
			return timeout;
	}
	x->done--;
	return timeout ?: 1;
}
```

可自己分析函数变体 wait_for_completion_*。

### complete

```c
void complete(struct completion *x)
{
	unsigned long flags;

	spin_lock_irqsave(&x->wait.lock, flags);
  	/*增加完成标志*/
	x->done++;
	__wake_up_common(&x->wait, TASK_NORMAL, 1, 0, NULL);
	spin_unlock_irqrestore(&x->wait.lock, flags);
}
-->>
static void __wake_up_common(wait_queue_head_t *q, unsigned int mode,
			int nr_exclusive, int wake_flags, void *key)
{
	wait_queue_t *curr, *next;
	/*循环列表中每一个 queue，第一个唤醒成功 则退出；
	唤醒之后就到了 do_wait_for_common 中继续执行代码；
	循环列表内部 条件从左至右，因此，成功 nr_exclusive个就退出*/
	list_for_each_entry_safe(curr, next, &q->task_list, task_list) {
		unsigned flags = curr->flags;
		
		if (curr->func(curr, mode, wake_flags, key) &&
				(flags & WQ_FLAG_EXCLUSIVE) && !--nr_exclusive)
			break;
	}
}
```

可以自己分析  函数变体  complete_all。

## 大内核锁（BKL）

对整个内核加锁，现在已不在使用。

## 顺序锁

顺序锁，简称seq锁，是在2.6版本内核中引入的一种新型锁。这种锁提供了一种很简单的机制，用于读写共享数据。实现这种锁主要依靠一个序列计数器。当有疑义的数据被写入时，会得到一个锁，并且序列值会增加。在读取数据之前和之后，序列号都被读取。如果读取的序列号值相同，说明在读操作进行的过程中没有被写操作打断过。此外，如果读取的值是偶数，那么久表明写操作没有发生（锁的初始值是0，写锁会使值成奇数，释放会使值变成偶数）。

### 初始化 DEFINE_SEQLOCK

seq锁的基本结构为 

```c
/*一个计数器；一个自旋锁*/
typedef struct {
	struct seqcount seqcount;
	spinlock_t lock;
} seqlock_t;
```

```c
#define DEFINE_SEQLOCK(x) \
		seqlock_t x = __SEQLOCK_UNLOCKED(x)
-->>
#define __SEQLOCK_UNLOCKED(lockname)			\
	{						\
		/*#define SEQCNT_ZERO { 0 }*/
		.seqcount = SEQCNT_ZERO,		\
		.lock =	__SPIN_LOCK_UNLOCKED(lockname)	\
	}
```

初始化即为 将计数值为0并初始化自旋锁。也可以利用宏 seqlock_init进行初始化。

### write_seqlock

``` c
static inline void write_seqlock(seqlock_t *sl)
{
  	/*先加锁，然后计数加一*/
	spin_lock(&sl->lock);
	write_seqcount_begin(&sl->seqcount);
}
-->>
static inline void write_seqcount_begin(seqcount_t *s)
{
	s->sequence++;
	smp_wmb();
}
```

### write_sequnlock

```c
static inline void write_sequnlock(seqlock_t *sl)
{
  	/*计数加一 之后 解锁*/
	write_seqcount_end(&sl->seqcount);
	spin_unlock(&sl->lock);
}
-->>
static inline void write_seqcount_end(seqcount_t *s)
{
	smp_wmb();
	s->sequence++;
}
```

写的顺序锁基本无难度，下面举例看一下read的用法。

```c

/*
 * Setup the device for a periodic tick
 */
void tick_setup_periodic(struct clock_event_device *dev, int broadcast)
{
		……
		do {
			seq = read_seqbegin(&jiffies_lock);
			next = tick_next_period;
		} while (read_seqretry(&jiffies_lock, seq));
		……
}
```

### read_seqbegin

```c
static inline unsigned read_seqbegin(const seqlock_t *sl)
{
	return read_seqcount_begin(&sl->seqcount);
}
-->>
static inline unsigned read_seqcount_begin(const seqcount_t *s)
{
	unsigned ret = __read_seqcount_begin(s);
	smp_rmb();
	return ret;
}
-->>
static inline unsigned __read_seqcount_begin(const seqcount_t *s)
{
	unsigned ret;

repeat:
	ret = ACCESS_ONCE(s->sequence);
  	/*为真表示奇数，write已加锁*/
	if (unlikely(ret & 1)) {
		cpu_relax();
		goto repeat;
	}
  	/*返回之后，write又加锁了咋办？继续看*/
	return ret;
}
```

### read_seqretry

```c
static inline unsigned read_seqretry(const seqlock_t *sl, unsigned start)
{
	return read_seqcount_retry(&sl->seqcount, start);
}
-->>
static inline int read_seqcount_retry(const seqcount_t *s, unsigned start)
{
	smp_rmb();
	return __read_seqcount_retry(s, start);
}
-->>
static inline int __read_seqcount_retry(const seqcount_t *s, unsigned start)
{
  	/*不相同表示读后又被写了，那么继续循环！*/
	return unlikely(s->sequence != start);
}
```

seq锁有助于提供一种非常轻量级和具有扩展性的外观。但是seq锁对写者更有利。seq锁在遇到如下需求时将是最理想的选择：

- 数据存在很多读者。
- 数据写者很少。
- 写者很少，但是希望写优先于读，而且不允许读者让写着饥饿。
- 数据简单，如简单结构，甚至是简单的整型——在某些场合，是不能使用原子量的。（啥场合暂时未遇到）

jiffies中利用seq锁（函数 get_jiffies_64）。

## 禁止抢占

由于内核是抢占性的，内核中的进程在任何时刻都可能停下来以便另一个具有更高优先权的进程运行。这意味着一个任务与被枪占的任务可能会在同一个临界区内运行。为了避免这种情况，内核抢占代码使用自旋锁作为非抢占区域的标记。如果一个自旋锁被持有，内核便不能进行抢占。因为内核抢占和SMP面对相同的并发问题，并且内核已经是SMP安全的（SMP-safe），所以，这种简单的变化使得内核也是抢占安全的（preempt-safe）。

实际中，某些情况并不需要自旋锁，但是仍然需要关闭内核抢占。最频繁出现的情况就是每个处理器上的数据。如果数据对每个处理器是唯一的，那么，这样的数据可能就不需要使用锁来保护，因为数据只能被一个处理器访问。如果自旋锁没有被持有，内核又是抢占式的，那么一个新调度的任务就可能访问同一个变量。

为了解决这个问题，可以通过preempt_disable()禁止内核抢占。这是一个可以嵌套调用的函数，可以调用任意次。每次调用都必须有一个相应的preempt_enable()调用。当最后一次preempt_enable()被调用后，内核抢占才重新启用。

抢占计数存放着被持有锁的数量和preempt_disable()的调用次数，如果计数是0，那么内核可以进行枪占；如果为1或更大的值，那么，内核就不会进行抢占。

preempt_disable() 和 preempt_enable()实现比较简单，此处不在分析。

## 顺序和屏障

当处理多处理器之间或硬件设备之间的同步问题时，有时需要在你的程序代码中以指定的顺序发出读内存和写内存指令。在和硬件交互时，时常需要确保一个给定的读操作发生在其他读或写操作之前。另外，在多处理器上，可能需要按写数据的顺序读数据。但是编译器和处理器为了提高效率，可能对读和写程序排序（x86处理器不会这样做）。

不过，所有可能重新排序和写的处理器提供了机器指令来确保顺序要求。同样也可以指示编译器不要对给定点周围的指令序列进行重新排序。这些确保顺序的指令称为屏障（barriers）。

rmb()方法提供了一个“读”内存屏障，它确保跨越rmb()的载入动作不会发生重排序。

wmb()方法提供了一个“写”内存屏障，功能和rmb()类似，区别仅仅是它是针对存储而非载入——它确保跨越屏障的存储不发生重排序。

mb()方法既提供了读屏障也提供了写屏障。载入和存储动作都不会跨越屏障重排序。

read_barrier_depends()是rmb()的变种，它提供了一个读屏障，但是仅仅是针对后续读操作所依靠的那些载入。因为屏障后的读操作依赖于屏障前的读操作，因此该屏障确保屏障前的读操作在屏障后的读操作之前完成。

宏smp_rmb()、smp_wmb()、smp_mb()和smp_read_barrier_depends()提供了一个有用的优化。在SMP内核中它们被定义成常用的内存屏障，而在单处理机内核中，它们被定义成编译器的屏障。

barrier()方法可以防止编译器跨屏障对载入或存储操作进行优化。编译器不会重新组织存储或载入操作，而防止改变C代码的效果和现有数据的依赖关系。但是，它不知道在当前上下文之外会发生什么事。

**注意**，对于不同的体系结构，屏障的实际效果差别很大。

## 参考资料

[GNU Assembler (GAS)手册](https://sourceware.org/binutils/docs-2.29/as/index.html)

[What .long 0xXXXXXXXX stands for in asm?](https://stackoverflow.com/questions/38695058/what-long-0xxxxxxxxx-stands-for-in-asm)

[x86 Assembly Language Reference Manual ](https://docs.oracle.com/cd/E26502_01/html/E28388/toc.html)

[lock指令](http://blog.csdn.net/zhangxinrun/article/details/5843393)

[原子操作与 x86 上的 lock 指令前缀](http://blog.csdn.net/zacklin/article/details/7445442)

[Linux 内核 LOCK_PREFIX 的含义](http://blog.csdn.net/ture010love/article/details/7663008)

[X86 Assembly/Shift and Rotate](https://en.wikibooks.org/wiki/X86_Assembly/Shift_and_Rotate)

[Linux 汇编语言开发指南](https://www.ibm.com/developerworks/cn/linux/l-assembly/index.html)

[学 Win32 汇编](http://www.cnblogs.com/del/archive/2010/04/16/1713886.html)

