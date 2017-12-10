---
title: Linux 内核同步方式及原理
date: 2017-12-04 18:32:14
categories: Linux内核
tags:
  - 锁
  - 完成变量
  - 信号量
  - 互斥体
---

本文基于 linux kernel 2.6.35。

## 原子操作

原子操作是其他同步方法的基石。原子操作，可以保证指令以原子的方式执行——执行过程不被打断。

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

1. "\_\_builtin_return_address" 接收一个称为 `level` 的参数。这个参数定义希望获取返回地址的调用堆栈级别。例如，如果指定 `level` 为 `0`，那么就是请求当前函数的返回地址。如果指定 `level` 为 `1`，那么就是请求进行调用的函数的返回地址，依此类推。使用 "\_\_builtin_return_address"捕捉返回地址，以便在以后进行跟踪时使用这个地址。
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

### 读写信号量

## 互斥体

## 完成变量

## 大内核锁（BKL）

## 顺序锁

## 禁止抢占

## 顺序和屏障





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

