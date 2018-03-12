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

## 原理

RCU实际上是一种改进的rwlock，读者几乎没有什么同步开销，它不需要锁，不使用原子指令，因此不会导致锁竞争，内存延迟以及流水线停滞。不需要锁也使得使用更容易，因为死锁问题就不需要考虑了。

- 写者的同步开销比较大，它需要**延迟数据结构的释放，复制被修改的数据结构**，它也必须**使用某种锁机制同步并行的其它写者的修改操作**。
- 读者必须提供一个信号给写者以便写者能够确定数据可以被安全地释放或修改的时机。
- 有一个专门的垃圾收集器来探测读者的信号，一旦所有的读者都已经发送信号告知它们都不在使用被RCU保护的数据结构，垃圾收集器就调用回调函数完成最后的数据释放或修改操作。 

RCU与rwlock的不同之处是：它既允许多个读者同时访问被保护的数据，又允许多个读者和多个写者同时访问被保护的数据（注意：是否可以有多个写者并行访问取决于写者之间使用的同步机制），读者没有任何同步开销，而写者的同步开销则取决于使用的写者间同步机制。但RCU不能替代rwlock，因为如果写比较多时，对读者的性能提高不能弥补写者导致的损失。

读者在访问被RCU保护的共享数据期间不能被阻塞，这是RCU机制得以实现的一个基本前提，也就说当读者在引用被RCU保护的共享数据期间，读者所在的CPU不能发生上下文切换，spinlock和rwlock都需要这样的前提。

写者在访问被RCU保护的共享数据时不需要和读者竞争任何锁，只有在有多于一个写者的情况下需要获得某种锁以与其他写者同步。写者修改数据前首先**拷贝一个被修改元素的副本，然后在副本上进行修改，修改完毕后它向垃圾回收器注册一个回调函数以便在适当的时机执行真正的修改操作**。等待适当时机的这一时期称为grace period，而CPU发生了上下文切换称为经历一个quiescent state，**grace period就是所有CPU都经历一次quiescent state所需要的等待的时间**。垃圾收集器就是在grace period之后调用写者注册的回调函数来完成真正的数据修改或数据释放操作的。

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



## 核心API

API还有许多其他的成员，但其余的可以用这五个来表示，但是大多数的实现都是用call_rcu()回调API来表示synchronize_rcu()。

### rcu_read_lock()

进入读者的临界区。

### rcu_read_unlock()

### synchronize_rcu() / call_rcu()

### rcu_assign_pointer()

### rcu_dereference()



## 示例



## 优秀资料

[深入理解 RCU 实现](http://blog.jobbole.com/106856/)

[Linux 2.6内核中新的锁机制--RCU](https://www.ibm.com/developerworks/cn/linux/l-rcu/)

[RCU synchronize原理分析](http://www.wowotech.net/kernel_synchronization/223.html)

