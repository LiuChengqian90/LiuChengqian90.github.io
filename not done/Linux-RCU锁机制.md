---
title: Linux RCU锁机制
date: 2017-12-04 18:11:53
categories: Linux内核
tags:
  - RCU
---

## 引言

本文基于kernel 3.10.105对RCU源码进行分析。

RCU(Read-Copy-Update)，顾名思义就是读-拷贝-修改。

RCU背后的基本思想是将破坏性操作分为两部分，一部分是防止任何人看到数据项被销毁，另一部分是实际销毁。这两个部分之间必须有一个“宽限期”，这个宽限期必须足够长，以至于**任何访问被删除项目的读者都已经放弃了他们的引用**。例如，从链接列表中删除一个RCU将首先从列表中删除该项目，等待宽限期过去，然后释放该元素。

在kernel中，rcu有tiny rcu和tree rcu两种实现，tiny rcu更加简洁，通常用在小型嵌入式系统中，tree rcu则被广泛使用在了server, desktop以及android系统中。

## 原理

RCU实际上是一种改进的rwlock，读者几乎没有什么同步开销，它不需要锁，不使用原子指令，因此不会导致锁竞争，内存延迟以及流水线停滞。不需要锁也使得使用更容易，因为死锁问题就不需要考虑了。

- 写者的同步开销比较大，它需要**延迟数据结构的释放，复制被修改的数据结构**，它也必须**使用某种锁机制同步并行的其它写者的修改操作**。
- 读者必须提供一个信号给写者以便写者能够确定数据可以被安全地释放或修改的时机。
- 有一个专门的**垃圾收集器**来探测读者的信号，一旦所有的读者都已经发送信号告知它们都不在使用被RCU保护的数据结构，垃圾收集器就**调用回调函数**完成最后的数据释放或修改操作。 

RCU与rwlock的不同之处是：它既允许多个读者同时访问被保护的数据，又允许多个读者和多个写者同时访问被保护的数据（注意：是否可以有多个写者并行访问取决于写者之间使用的同步机制），读者没有任何同步开销，而写者的同步开销则取决于使用的写者间同步机制。但RCU不能替代rwlock，因为如果写比较多时，对读者的性能提高不能弥补写者导致的损失。

**读者**在访问被RCU保护的共享数据期间**不能被阻塞**，这是RCU机制得以实现的一个基本前提，也就说当读者在引用被RCU保护的共享数据期间，读者所在的CPU不能发生上下文切换，spinlock和rwlock都需要这样的前提。

写者在访问被RCU保护的共享数据时不需要和读者竞争任何锁，只有在有多于一个写者的情况下需要获得某种锁以与其他写者同步。写者修改数据前首先**拷贝一个被修改元素的副本，然后在副本上进行修改，修改完毕后它向垃圾回收器注册一个回调函数以便在适当的时机执行真正的修改操作**。等待适当时机的这一时期称为宽限期（grace period），而CPU发生了上下文切换称为经历一个quiescent state，**grace period就是所有CPU都经历一次quiescent state所需要的等待的时间**。垃圾收集器就是在grace period之后调用写者注册的回调函数来完成真正的数据修改或数据释放操作的。

## 实现机制

对于读者，RCU 仅需要抢占失效，因此获得读锁和释放读锁分别定义为：

```C
static inline void rcu_read_lock(void);
static inline void rcu_read_unlock(void);
```

变种为：

```C
static inline void rcu_read_lock_bh(void);
static inline void rcu_read_unlock_bh(void);
```

这个变种只在修改是通过 `call_rcu_bh`进行的情况下使用，因为 `call_rcu_bh`将把 softirq 的执行完毕也认为是一个 quiescent state，因此如果修改是通过 `call_rcu_bh` 进行的，在进程上下文的读端临界区必须使用这一变种。

每一个 CPU 维护两个数据结构 `rcu_sched_data`，`rcu_bh_data`，它们用于保存回调函数。函数`call_rcu`和函数`call_rcu_bh`用于注册回调函数，前者把回调函数注册到`rcu_sched_data`，而后者则把回调函数注册到`rcu_bh_data`，在每一个数据结构上，回调函数被组成一个链表，先注册的排在前头，后注册的排在末尾。

时钟中断处理函数（`update_process_times`）调用函数`rcu_check_callbacks`。

函数`rcu_check_callbacks`首先检查该CPU是否经历了一个quiescent state，如果(或)：

- 当前进程运行在用户态；
- 当前进程为idle且当前不处在运行softirq状态，也不处在运行IRQ处理函数的状态；

那么，该CPU已经经历了一个quiescent state，因此通过调用函数`rcu_sched_qs`和`rcu_bh_qs`标记该CPU的数据结构`rcu_sched_data`和`rcu_bh_data`的标记字段`passed_quiesc`，以记录该CPU已经经历一个quiescent state。

否则，如果当前不处在运行softirq状态，那么，只标记该CPU的数据结构`rcu_bh_data`的标记字段`passed_quiesc`，以记录该CPU已经经历一个quiescent state。注意，该标记只对rcu_bh_data有效。

然后，函数rcu_check_callbacks将调用开启`RCU_SOFTIRQ`。

## 核心API

API还有许多其他的成员，但其余的可以用这五个来表示，但是大多数的实现都是用call_rcu()回调API来表示synchronize_rcu()。

### rcu_read_lock()

读者在读取由RCU保护的共享数据时使用该函数标记它进入读端临界区。

### rcu_read_unlock()

该函数与rcu_read_lock配对使用，用以标记读者退出读端临界区。夹在这两个函数之间的代码区称为"读端临界区"(read-side critical section)。读端临界区可以嵌套。

### rcu_assign_pointer()

分配给受RCU保护的指针。

将指定的值分配给指定的受RCU保护的指针，确保任何并发的RCU读取器都能看到任何先前的初始化。

将内存屏障插入到需要它们的体系结构中（其中大部分都是这样），并且还防止编译器在指针分配后重新排序初始化结构的代码。 

```c
#define rcu_assign_pointer(p, v) \
	__rcu_assign_pointer((p), (v), __rcu)
-->>
#define __rcu_assign_pointer(p, v, space) \
	do { \
		smp_wmb(); \
		(p) = (typeof(*v) __force space *)(v); \
	} while (0)
```

在一些特殊情况下，您可以使用RCU_INIT_POINTER（）而不是rcu_assign_pointer（）。 由于RCU_INIT_POINTER（）不限制CPU或编译器，因此RCU_INIT_POINTER（）速度更快。
但是，当你应该使用rcu_assign_pointer（）时，使用RCU_INIT_POINTER（）是一件非常糟糕的事情，它会导致无法诊断内存损坏。 

### rcu_dereference()

获取RCU保护的指针以取消引用。

```c
#define rcu_dereference(p) rcu_dereference_check(p, 0)
-->>
//c 为解除引用的条件
#define rcu_dereference_check(p, c) \
	__rcu_dereference_check((p), rcu_read_lock_held() || (c), __rcu)
-->>
#define __rcu_dereference_check(p, c, space) \
	({ \
		typeof(*p) *_________p1 = (typeof(*p)*__force )ACCESS_ONCE(p); \
		rcu_lockdep_assert(c, "suspicious rcu_dereference_check()" \
				      " usage"); \
		rcu_dereference_sparse(p, space); \
		smp_read_barrier_depends(); \
		((typeof(*p) __force __kernel *)(_________p1)); \
	})
```

### synchronize_rcu() / call_rcu()

synchronize_rcu()在RCU中是一个最核心的函数,它用来等待之前的读者全部退出。

在完整的宽限期结束后，即在所有当前正在执行的RCU读取端临界区完成之后，控制权会在一段时间后返回给调用者。 但是，请注意，从synchronize_rcu（）返回时，调用者可能会同时执行新的RCU读取端临界区，这些区在synchronize_rcu（）正在等待时开始。 RCU读取端临界区由rcu_read_lock（）和rcu_read_unlock（）定界，并且可以嵌套。

```c
void synchronize_rcu(void)
{
	……
    // start_kernel()->rest_init()->rcu_scheduler_starting()
	if (!rcu_scheduler_active)
		return;
    // rcupdate.c 
    // module_param(rcu_expedited, int, 0);
	if (rcu_expedited)
		synchronize_rcu_expedited();
	else
		wait_rcu_gp(call_rcu);
}
```

```c
#ifdef CONFIG_RCU_BOOST

/* 基本思想是调用synchronize_sched_expedited（）将所有任务推送到 ->blkd_tasks列表并等待这个列表排空。 
这会在所有CPU上消耗大量时间，并且对实时工作负载不利，因此不建议用于任何类型的常见代码。
实际上，如果您在循环中使用synchronize_rcu_expedited（），请重构您的代码以批量更新，然后改为使用一个synchronize_rcu（）。

请注意，在保持CPU热插拔通知程序获取的任何锁定的同时调用此函数是非法的。 
从CPU-hotplug通知器调用此函数也是非法的。 不遵守这些限制将导致死锁。
*/
void synchronize_rcu_expedited(void)
{
	unsigned long flags;
	struct rcu_node *rnp;
	struct rcu_state *rsp = &rcu_preempt_state;
	unsigned long snap;
	int trycount = 0;

	smp_mb(); /* Caller's modifications seen first by other CPUs. */
	snap = ACCESS_ONCE(sync_rcu_preempt_exp_count) + 1;
	smp_mb(); /* Above access cannot bleed into critical section. */

	/*
	 * Block CPU-hotplug operations.  This means that any CPU-hotplug
	 * operation that finds an rcu_node structure with tasks in the
	 * process of being boosted will know that all tasks blocking
	 * this expedited grace period will already be in the process of
	 * being boosted.  This simplifies the process of moving tasks
	 * from leaf to root rcu_node structures.
	 */
	get_online_cpus();

	/*
	 * Acquire lock, falling back to synchronize_rcu() if too many
	 * lock-acquisition failures.  Of course, if someone does the
	 * expedited grace period for us, just leave.
	 */
	while (!mutex_trylock(&sync_rcu_preempt_exp_mutex)) {
		if (ULONG_CMP_LT(snap,
		    ACCESS_ONCE(sync_rcu_preempt_exp_count))) {
			put_online_cpus();
			goto mb_ret; /* Others did our work for us. */
		}
		if (trycount++ < 10) {
			udelay(trycount * num_online_cpus());
		} else {
			put_online_cpus();
			wait_rcu_gp(call_rcu);
			return;
		}
	}
	if (ULONG_CMP_LT(snap, ACCESS_ONCE(sync_rcu_preempt_exp_count))) {
		put_online_cpus();
		goto unlock_mb_ret; /* Others did our work for us. */
	}

	/* force all RCU readers onto ->blkd_tasks lists. */
	synchronize_sched_expedited();

	/* Initialize ->expmask for all non-leaf rcu_node structures. */
	rcu_for_each_nonleaf_node_breadth_first(rsp, rnp) {
		raw_spin_lock_irqsave(&rnp->lock, flags);
		rnp->expmask = rnp->qsmaskinit;
		raw_spin_unlock_irqrestore(&rnp->lock, flags);
	}

	/* Snapshot current state of ->blkd_tasks lists. */
	rcu_for_each_leaf_node(rsp, rnp)
		sync_rcu_preempt_exp_init(rsp, rnp);
	if (NUM_RCU_NODES > 1)
		sync_rcu_preempt_exp_init(rsp, rcu_get_root(rsp));

	put_online_cpus();

	/* Wait for snapshotted ->blkd_tasks lists to drain. */
	rnp = rcu_get_root(rsp);
	wait_event(sync_rcu_preempt_exp_wq,
		   sync_rcu_preempt_exp_done(rnp));

	/* Clean up and exit. */
	smp_mb(); /* ensure expedited GP seen before counter increment. */
	ACCESS_ONCE(sync_rcu_preempt_exp_count)++;
unlock_mb_ret:
	mutex_unlock(&sync_rcu_preempt_exp_mutex);
mb_ret:
	smp_mb(); /* ensure subsequent action seen after grace period. */
}

#else
void synchronize_rcu_expedited(void)
{
	synchronize_sched_expedited();
}
#endif
```

```c
void wait_rcu_gp(call_rcu_func_t crf)
{
	struct rcu_synchronize rcu;

	init_rcu_head_on_stack(&rcu.head);
	init_completion(&rcu.completion);
	/* Will wake me after RCU finished. */
	crf(&rcu.head, wakeme_after_rcu);
	/* Wait for it. */
	wait_for_completion(&rcu.completion);
	destroy_rcu_head_on_stack(&rcu.head);
}
```



## 示例



## 优秀资料

[深入理解 RCU 实现](http://blog.jobbole.com/106856/)

[Linux 2.6内核中新的锁机制--RCU](https://www.ibm.com/developerworks/cn/linux/l-rcu/)

[RCU synchronize原理分析](http://www.wowotech.net/kernel_synchronization/223.html)

