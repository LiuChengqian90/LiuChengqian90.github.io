---
title: Netfilter架构概述
date: 2018-08-05 22:48:31
categories: Linux内核
tags:
  - iptables
  - netfilter
---

阅读本文最好有内核网络源码基础。

本文源码基于Linxu 3.10。

# Netfilter

Netfilter是Linux 2.4.x引入的一个子系统，提供一整套的hook函数的管理机制，使得诸如数据包过滤、网络地址转换(NAT)和基于协议类型的连接跟踪成为了可能。

网络层作为ISO 7层协议（网络关系图可参考 http://www.52im.net/thread-180-1-1.html ）的第三层，其代表协议为IP（Internet Protocol）协议，协议号为 0x0800。协议处理流程大致如下：

![基本包处理流程](/images/Netfilter架构概述/基本包处理流程.png)

而Netfilter的核心就是在整个网络流程的若干位置放置了一些检测点（HOOK），而在每个检测点上登记了一些处理函数进行处理。

## NF_HOOK实现

一个普通的系统（无桥、vlan等配置）中，流量在IPv4的处理函数`ip_rcv`最后会走到Netfilter架构的第一个钩子点：

```c
int ip_rcv(struct sk_buff *skb, struct net_device *dev, struct packet_type *pt, struct net_device *orig_dev)
{
	……
	return NF_HOOK(NFPROTO_IPV4, NF_INET_PRE_ROUTING, skb, dev, NULL,
		       ip_rcv_finish);
    ……
}
```

在网络层处理协议中，此种形式的钩子点如图所示：

![网络层NF_HOOK](/images/Netfilter架构概述/网络层NF_HOOK.png)

上图即为Netfilter经典的五个处理点。

**深入到`NF_HOOK`的内部可发现最重要的结构为内核全局变量nf_hooks：**

```c
//netfilter.h	include\linux
static inline int
NF_HOOK(uint8_t pf, unsigned int hook, struct sk_buff *skb,
	struct net_device *in, struct net_device *out,
	int (*okfn)(struct sk_buff *))
{
	return NF_HOOK_THRESH(pf, hook, skb, in, out, okfn, INT_MIN);
}
/*
pf		: Netfilter Protocol
hook		: Netfilter Hooknum
skb		: 要处理的Packet
in		: 入接口
out		: 出接口
okfn	: 规则通过后要调用的函数
*/
--->>>
static inline int
NF_HOOK_THRESH(uint8_t pf, unsigned int hook, struct sk_buff *skb,
	       struct net_device *in, struct net_device *out,
	       int (*okfn)(struct sk_buff *), int thresh)
{
	int ret = nf_hook_thresh(pf, hook, skb, in, out, okfn, thresh);
	if (ret == 1)
		ret = okfn(skb);
	return ret;
}
/*
thresh		： 优先级相关
*/
--->>>
static inline int nf_hook_thresh(u_int8_t pf, unsigned int hook,
				 struct sk_buff *skb,
				 struct net_device *indev,
				 struct net_device *outdev,
				 int (*okfn)(struct sk_buff *), int thresh)
{
	if (nf_hooks_active(pf, hook))
		return nf_hook_slow(pf, hook, skb, indev, outdev, okfn, thresh);
	return 1;
}
/*
nf_hooks_active		：判断是否注册了钩子函数
nf_hook_slow		: 主要处理函数
*/
```

```c
int nf_hook_slow(u_int8_t pf, unsigned int hook, struct sk_buff *skb,
		 struct net_device *indev,
		 struct net_device *outdev,
		 int (*okfn)(struct sk_buff *),
		 int hook_thresh)
{
	struct nf_hook_ops *elem;
	unsigned int verdict;
	int ret = 0;
	/* We may already have this, but read-locks nest anyway */
	rcu_read_lock();
    /*
    struct list_head nf_hooks[NFPROTO_NUMPROTO][NF_MAX_HOOKS];
    nf_hooks 是一个二维链表头：
    	第一维代表支持的协议；
    	第二维代表注册的hooknum。
    经过 nf_hooks_active ，此钩子点必然已注册。
    */
	elem = list_entry_rcu(&nf_hooks[pf][hook], struct nf_hook_ops, list);
next_hook:
	verdict = nf_iterate(&nf_hooks[pf][hook], skb, hook, indev,
			     outdev, &elem, okfn, hook_thresh);
    /*根据返回值执行不同的动作：接收、丢包或继续check*/
    …………
	if (verdict == NF_ACCEPT || verdict == NF_STOP) {
		ret = 1;
	} else if ((verdict & NF_VERDICT_MASK) == NF_DROP) {
		kfree_skb(skb);
		ret = NF_DROP_GETERR(verdict);
		if (ret == 0)
			ret = -EPERM;
	} else if ((verdict & NF_VERDICT_MASK) == NF_QUEUE) {
		int err = nf_queue(skb, elem, pf, hook, indev, outdev, okfn,
						verdict >> NF_VERDICT_QBITS);
		if (err < 0) {
			if (err == -ECANCELED)
				goto next_hook;
			if (err == -ESRCH &&
			   (verdict & NF_VERDICT_FLAG_QUEUE_BYPASS))
				goto next_hook;
			kfree_skb(skb);
		}
	}
	rcu_read_unlock();
	return ret;
}
```

其中函数`nf_iterate`的定义如下：

```c
unsigned int nf_iterate(struct list_head *head,
			struct sk_buff *skb,
			unsigned int hook,
			const struct net_device *indev,
			const struct net_device *outdev,
			struct nf_hook_ops **elemp,
			int (*okfn)(struct sk_buff *),
			int hook_thresh)
{
	unsigned int verdict;
	//由于存在删钩子的风险，因此加rcu锁	 
	list_for_each_entry_continue_rcu((*elemp), head, list) {
        //过滤优先级低的调用
		if (hook_thresh > (*elemp)->priority)
			continue;
repeat:
        //调用注册的函数，并根据返回值判断下一步动作
		verdict = (*elemp)->hook(hook, skb, indev, outdev, okfn);
		if (verdict != NF_ACCEPT) {
#ifdef CONFIG_NETFILTER_DEBUG
			if (unlikely((verdict & NF_VERDICT_MASK)
							> NF_MAX_VERDICT)) {
				NFDEBUG("Evil return from %p(%u).\n",
					(*elemp)->hook, hook);
				continue;
			}
#endif
			if (verdict != NF_REPEAT)
				return verdict;
			goto repeat;
		}
	}
	return NF_ACCEPT;
}
```

## 核心数据结构

Netfilter中有两个数据比较主要： **`nf_hooks**`和`**nf_hook_ops`**。

本质上，`nf_hooks`是一个二维hash头。

```c
extern struct list_head nf_hooks[NFPROTO_NUMPROTO][NF_MAX_HOOKS];
```

支持的Netfilter Protocol定义如下：

```c
enum {
	NFPROTO_UNSPEC =  0,
	NFPROTO_IPV4   =  2,
	NFPROTO_ARP    =  3,
	NFPROTO_BRIDGE =  7,
	NFPROTO_IPV6   = 10,
	NFPROTO_DECNET = 12,
	NFPROTO_NUMPROTO,
};
```

Protocol中最大Hook数量为：

```c
#define NF_MAX_HOOKS 8
```

`nf_hook_ops`的相关定义如下

```c
typedef unsigned int nf_hookfn(unsigned int hooknum,
			       struct sk_buff *skb,
			       const struct net_device *in,
			       const struct net_device *out,
			       int (*okfn)(struct sk_buff *));

struct nf_hook_ops {
	struct list_head list;
	/* 函数指针 */
	nf_hookfn *hook;
    /* 所属的模块 */
	struct module *owner;
    /* netfilter protocol */
	u_int8_t pf;
    /* netfilter hooknum */
	unsigned int hooknum;
	/* 优先级，以升序排列 */
	int priority;
};
```

网络层优先级的枚举如下：

```c
enum nf_ip_hook_priorities {
	NF_IP_PRI_FIRST = INT_MIN,
	NF_IP_PRI_CONNTRACK_DEFRAG = -400,
	NF_IP_PRI_RAW = -300,
	NF_IP_PRI_SELINUX_FIRST = -225,
	NF_IP_PRI_CONNTRACK = -200,
	NF_IP_PRI_MANGLE = -150,
	NF_IP_PRI_NAT_DST = -100,
	NF_IP_PRI_FILTER = 0,
	NF_IP_PRI_SECURITY = 50,
	NF_IP_PRI_NAT_SRC = 100,
	NF_IP_PRI_SELINUX_LAST = 225,
	NF_IP_PRI_CONNTRACK_HELPER = 300,
	NF_IP_PRI_CONNTRACK_CONFIRM = INT_MAX,
	NF_IP_PRI_LAST = INT_MAX,
};
```

定义的`hook`函数指针所指向的函数中，其返回值的枚举如下

```c
/* Responses from hook functions. */
#define NF_DROP 0
#define NF_ACCEPT 1
#define NF_STOLEN 2
#define NF_QUEUE 3
#define NF_REPEAT 4
#define NF_STOP 5
#define NF_MAX_VERDICT NF_STOP
```

## 注册

Netfilter架构利用函数`nf_register_hooks`向`nf_hooks`注册各模块定义的`nf_hook_ops`数组。

```c
int nf_register_hooks(struct nf_hook_ops *reg, unsigned int n)
{
	unsigned int i;
	int err = 0;
	/* reg为模块定义的nf_hook_ips数组 */
	for (i = 0; i < n; i++) {
		err = nf_register_hook(&reg[i]);
		if (err)
			goto err;
	}
	return err;
    ……
}
--->>>
int nf_register_hook(struct nf_hook_ops *reg)
{
	struct nf_hook_ops *elem;
	int err;
	/* 利用互斥锁来保证原子性 */
	err = mutex_lock_interruptible(&nf_hook_mutex);
	if (err < 0)
		return err;
    /* 按优先级升序排列(优先级小的在前) */
	list_for_each_entry(elem, &nf_hooks[reg->pf][reg->hooknum], list) {
		if (reg->priority < elem->priority)
			break;
	}
	list_add_rcu(&reg->list, elem->list.prev);
	mutex_unlock(&nf_hook_mutex);
#if defined(CONFIG_JUMP_LABEL)
	static_key_slow_inc(&nf_hooks_needed[reg->pf][reg->hooknum]);
#endif
	return 0;
}
```

以`bridge`模块举例：

```c
static struct nf_hook_ops br_nf_ops[] __read_mostly = {
	{
		.hook = br_nf_pre_routing,
		.owner = THIS_MODULE,
		.pf = NFPROTO_BRIDGE,
		.hooknum = NF_BR_PRE_ROUTING,
		.priority = NF_BR_PRI_BRNF,
	},
	{
		.hook = br_nf_local_in,
		.owner = THIS_MODULE,
		.pf = NFPROTO_BRIDGE,
		.hooknum = NF_BR_LOCAL_IN,
		.priority = NF_BR_PRI_BRNF,
	},
    …………
};
```

由其定义可看出：

1. 模块中一般定义一个nf_hook_ops结构的弹性数组。
2. 本模块可定义其他模块pf。
3. pf-hooknum-priority，三者保证唯一性。

```c
//br_netfilter_init
ret = nf_register_hooks(br_nf_ops, ARRAY_SIZE(br_nf_ops));
```

# Iptables

Netfilter是内核的一种网络架构，而`iptables`是`netfilter`的用户态配置程序。

既然是一种配置程序，那么下刷的数据最终是要配置到`netfilter`架构——`nf_hooks`中生效。因此，按照上面的步骤继续分析。

对于开启了iptables功能的系统

![ip_tables_module](/images/Netfilter架构概述/ip_tables_module.png)

可见`iptables`作为模块存于kernel中，而模块`ip_tables`作为基础模块由其他五个模块（kernel version不同，可能缺少`iptable_security`，模块命名方式：iptables_表名）引用。

其中**模块`ip_tabls`为承接模块，承接user/kernel的信息交互**。而其他五个模块主要提供不同的（iptables 表）类型到`nf_hooks`的映射。

## 模块间的交互

以`iptable_filter`为例，分析一下配置下刷到`nf_hooks`。

从模块初始化函数分析：

```c
static int __init iptable_filter_init(void)
{
	int ret;

	ret = register_pernet_subsys(&iptable_filter_net_ops);
	if (ret < 0)
		return ret;
	/* Register hooks */
	filter_ops = xt_hook_link(&packet_filter, iptable_filter_hook);
	if (IS_ERR(filter_ops)) {
		ret = PTR_ERR(filter_ops);
		unregister_pernet_subsys(&iptable_filter_net_ops);
	}
	return ret;
}
```

### register_pernet_subsys

对网络命名空间的数据注册。

```c
static struct pernet_operations iptable_filter_net_ops = {
	.init = iptable_filter_net_init,
	.exit = iptable_filter_net_exit,
};
ret = register_pernet_subsys(&iptable_filter_net_ops);
--->>>
/*
此函数会注册具有init和exit功能的子系统，分别创建和销毁网络命名空间时调用。
注册后，将为每个现有网络命名空间调用所有网络命名空间初始化函数。
创建新的网络命名空间时，将按照注册的顺序调用所有init方法。
销毁网络命名空间时，将按照注册顺序的相反方式调用所有exit方法。
*/
int register_pernet_subsys(struct pernet_operations *ops)
{
	int error;
	mutex_lock(&net_mutex);
	error =  register_pernet_operations(first_device, ops);
	mutex_unlock(&net_mutex);
	return error;
}
--->>>
static int register_pernet_operations(struct list_head *list,
				      struct pernet_operations *ops)
{
    /*ida相关操作直接跳过*/
	…………
	error = __register_pernet_operations(list, ops);
    …………
}
--->>>
static int __register_pernet_operations(struct list_head *list,
					struct pernet_operations *ops)
{
	struct net *net;
	int error;
	LIST_HEAD(net_exit_list);
    /*新的操作挂到全局链并在每个网络命名空间执行init函数*/
	list_add_tail(&ops->list, list);
	if (ops->init || (ops->id && ops->size)) {
		for_each_net(net) {
			error = ops_init(ops, net);
			if (error)
				goto out_undo;
			list_add_tail(&net->exit_list, &net_exit_list);
		}
	}
	return 0;
    …………
}
```

因此，再来看一下`iptables_filter`模块的init函数内部流程，不过之前需要熟悉一下其用到的数据。

```c
#define FILTER_VALID_HOOKS ((1 << NF_INET_LOCAL_IN) | \
			    (1 << NF_INET_FORWARD) | \
			    (1 << NF_INET_LOCAL_OUT))
/*
xt_table 类型实体，其中name是唯一标识。
valid_hooks 可以与上面的netfilter分析对应，表示对应的可用netfilter chain。
af则是对应netfilter 的 netfilter protocol,PF。
*/
static const struct xt_table packet_filter = {
	.name		= "filter",
	.valid_hooks	= FILTER_VALID_HOOKS,
	.me		= THIS_MODULE,
	.af		= NFPROTO_IPV4,
	.priority	= NF_IP_PRI_FILTER,
};
```

正式开始分析初始化函数

```c
static int __net_init iptable_filter_net_init(struct net *net)
{
	struct ipt_replace *repl;
	//第一步
	repl = ipt_alloc_initial_table(&packet_filter);
	if (repl == NULL)
		return -ENOMEM;
   	//第二步
	/* Entry 1 is the FORWARD hook */
	((struct ipt_standard *)repl->entries)[1].target.verdict =
		forward ? -NF_ACCEPT - 1 : -NF_DROP - 1;
	//第三步
	net->ipv4.iptable_filter =
		ipt_register_table(net, &packet_filter, repl);
	kfree(repl);
	return PTR_RET(net->ipv4.iptable_filter);
}
```

第一步：

```c
void *ipt_alloc_initial_table(const struct xt_table *info)
{
	return xt_alloc_initial_table(ipt, IPT);
}
//xt_alloc_initial_table 是一个宏，原型可查看源码，对这个函数进行整理如下
########################################################
void *ipt_alloc_initial_table(const struct xt_table *info)
{
	unsigned int hook_mask = info->valid_hooks;
	//统计给定数字中值为1的bit位个数
    //比较有意思的操作，可自己分析一下其实现原理
	unsigned int nhooks = hweight32(hook_mask);
	unsigned int bytes = 0, hooknum = 0, i = 0;
    /*
	ipt_replace 定义在 include\uapi\linux\netfilter_ipv4\ip_tables.h
	ipt_standard/ipt_error 定义在 include\linux\netfilter_ipv4\ip_tables.h	
    */
	struct {
		struct ipt_replace repl;
	    struct ipt_standard entries[nhooks];
	    struct ipt_error term;
	} *tbl = kzalloc(sizeof(*tbl), GFP_KERNEL);

	if (tbl == NULL)
		return NULL;
    //唯一标识赋值
	strncpy(tbl->repl.name, info->name, sizeof(tbl->repl.name));
	tbl->term = (struct ipt_error)IPT_ERROR_INIT;
	tbl->repl.valid_hooks = hook_mask;
	tbl->repl.num_entries = nhooks + 1;
	tbl->repl.size = nhooks * sizeof(struct ipt_standard) + sizeof(struct ipt_error);
    //根据info中的hooks 对tbl进行初始化，之后return
    /*
    info valid_hooks置位了 local_in forward local_out，因此entries仅有3个下标
    且每个下标依次代表 local_in forward local_out
    */
	for (; hook_mask != 0; hook_mask >>= 1, ++hooknum) {
		if (!(hook_mask & 1))
			continue;
		tbl->repl.hook_entry[hooknum] = bytes;
		tbl->repl.underflow[hooknum]  = bytes;
		tbl->entries[i++] = (struct ipt_standard)
			IPT_STANDARD_INIT(NF_ACCEPT);
		bytes += sizeof(struct ipt_standard);
	}
	return tbl;
}
//分析一下 IPT_STANDARD_INIT 实现
--->>>
#define IPT_STANDARD_INIT(__verdict)					       \
{									       \
	.entry		= IPT_ENTRY_INIT(sizeof(struct ipt_standard)),	       \
	.target		= XT_TARGET_INIT(XT_STANDARD_TARGET,		       \
					 sizeof(struct xt_standard_target)),   \
	.target.verdict	= -(__verdict) - 1,				       \
}
/*
即 初始化 ipt_standard结构体;
#define IPT_ENTRY_INIT(__size)
{//通过 struct ipt_standard内部结构可明确为什么target_offset需要初始化为这个值
	.target_offset	= sizeof(struct ipt_entry),
	.next_offset	= (__size),
}
#define XT_TARGET_INIT(__name, __size)
{
	.target.u.user = {
		.target_size	= XT_ALIGN(__size),
		.name		= __name,
	},
}
*/
```

第二步：

```c
/* Entry 1 is the FORWARD hook */
/*forward 为全局变量，标识设备是否支持转发*/
((struct ipt_standard *)repl->entries)[1].target.verdict =
	forward ? -NF_ACCEPT - 1 : -NF_DROP - 1;
```

第三步：

可直接跳到 第四步。

```c
net->ipv4.iptable_filter =
		ipt_register_table(net, &packet_filter, repl);
--->>>
struct xt_table *ipt_register_table(struct net *net,
				    const struct xt_table *table,
				    const struct ipt_replace *repl)
{
	int ret;
	struct xt_table_info *newinfo;
	struct xt_table_info bootstrap = {0};
	void *loc_cpu_entry;
	struct xt_table *new_table;
	//第四步
	newinfo = xt_alloc_table_info(repl->size);
	if (!newinfo) {
		ret = -ENOMEM;
		goto out;
	}
	/* choose the copy on our node/cpu, but dont care about preemption */
    /* 
    初始化本地 entries，并将loc_cpu_entry作为传参调用translate_table，
    这块需要强调一下，因为translate_table内部需要。
    */
	loc_cpu_entry = newinfo->entries[raw_smp_processor_id()];
	memcpy(loc_cpu_entry, repl->entries, repl->size);
	//第五步
	ret = translate_table(net, newinfo, loc_cpu_entry, repl);
	if (ret != 0)
		goto out_free;
	//第六步
	new_table = xt_register_table(net, table, &bootstrap, newinfo);
	if (IS_ERR(new_table)) {
		ret = PTR_ERR(new_table);
		goto out_free;
	}
	return new_table;
out_free:
	xt_free_table_info(newinfo);
out:
	return ERR_PTR(ret);
}
```

第四步：

```C
struct xt_table_info *xt_alloc_table_info(unsigned int size)
{
	struct xt_table_info *newinfo;
	int cpu;
	/* Pedantry: prevent them from hitting BUG() in vmalloc.c --RR */
    /* size 按page对齐，偏移得到页数。2 应该为 中段栈页数。如果大于可用页，直接返回。*/
	if ((SMP_ALIGN(size) >> PAGE_SHIFT) + 2 > totalram_pages)
		return NULL;
	/*
	#define offsetof(TYPE, MEMBER) ((size_t) &((TYPE *)0)->MEMBER)
	#define XT_TABLE_INFO_SZ (offsetof(struct xt_table_info, entries) \
			  + nr_cpu_ids * sizeof(char *))
	offsetof 为结构体的某个值在结构体内的偏移。			  
	entries 在结构体内部为弹性数组指针，其长度取决于系统cpu个数。
	*/
	newinfo = kzalloc(XT_TABLE_INFO_SZ, GFP_KERNEL);
	if (!newinfo)
		return NULL;
	newinfo->size = size;
	for_each_possible_cpu(cpu) {
        //size 小于一页则直接分配物理内存，大于则分配虚拟内存。
		if (size <= PAGE_SIZE)
			newinfo->entries[cpu] = kmalloc_node(size,
							GFP_KERNEL,
							cpu_to_node(cpu));
		else
			newinfo->entries[cpu] = vmalloc_node(size,
							cpu_to_node(cpu));
		//有一个分配失败，则释放全部已经分配的内存
		if (newinfo->entries[cpu] == NULL) {
			xt_free_table_info(newinfo);
			return NULL;
		}
	}
	return newinfo;
}
```

第五步：

```C
/*entry0 为当前cpu表项*/
/*可将此函数简单理解为，entry0复制到newinfo的每个entries*/
static int
translate_table(struct net *net, struct xt_table_info *newinfo, void *entry0,
                const struct ipt_replace *repl)
{
	struct ipt_entry *iter;
	unsigned int i;
	int ret = 0;

	newinfo->size = repl->size;
	newinfo->number = repl->num_entries;
	/* Init all hooks to impossible value. */
	for (i = 0; i < NF_INET_NUMHOOKS; i++) {
		newinfo->hook_entry[i] = 0xFFFFFFFF;
		newinfo->underflow[i] = 0xFFFFFFFF;
	}
	duprintf("translate_table: size %u\n", newinfo->size);
	i = 0;
	/* Walk through entries, checking offsets. */
	xt_entry_foreach(iter, entry0, newinfo->size) {
        //检查一些内存、指针相关数据
		ret = check_entry_size_and_hooks(iter, newinfo, entry0,
						 entry0 + repl->size,
						 repl->hook_entry,
						 repl->underflow,
						 repl->valid_hooks);
		if (ret != 0)
			return ret;
		++i;
		if (strcmp(ipt_get_target(iter)->u.user.name,
		    XT_ERROR_TARGET) == 0)
			++newinfo->stacksize;
	}
	//某些表项缺失
	if (i != repl->num_entries) {
		duprintf("translate_table: %u not %u entries\n",
			 i, repl->num_entries);
		return -EINVAL;
	}
	/* Check hooks all assigned */
    /* 依据valid_hooks 进行判断，如果 hook_entry 或 underflow为初始值，则直接报错。
    这两个值 在 xt_alloc_initial_table中初始化
    */
	for (i = 0; i < NF_INET_NUMHOOKS; i++) {
		/* Only hooks which are valid */
		if (!(repl->valid_hooks & (1 << i)))
			continue;
		if (newinfo->hook_entry[i] == 0xFFFFFFFF) {
			duprintf("Invalid hook entry %u %u\n",
				 i, repl->hook_entry[i]);
			return -EINVAL;
		}
		if (newinfo->underflow[i] == 0xFFFFFFFF) {
			duprintf("Invalid underflow %u %u\n",
				 i, repl->underflow[i]);
			return -EINVAL;
		}
	}
	//TBD
	if (!mark_source_chains(newinfo, repl->valid_hooks, entry0))
		return -ELOOP;

	/* Finally, each sanity check must pass */
	i = 0;
	xt_entry_foreach(iter, entry0, newinfo->size) {
		ret = find_check_entry(iter, net, repl->name, repl->size);
		if (ret != 0)
			break;
		++i;
	}

	if (ret != 0) {
		xt_entry_foreach(iter, entry0, newinfo->size) {
			if (i-- == 0)
				break;
			cleanup_entry(iter, net);
		}
		return ret;
	}
	/* And one copy for every other CPU */
	for_each_possible_cpu(i) {
		if (newinfo->entries[i] && newinfo->entries[i] != entry0)
			memcpy(newinfo->entries[i], entry0, newinfo->size);
	}
	return ret;
}
```

第六步：

```C
//将table挂到net下的xt.tables，并返回table
//于此处，与xt.tables建立的关系
struct xt_table *xt_register_table(struct net *net,
				   const struct xt_table *input_table,
				   struct xt_table_info *bootstrap,
				   struct xt_table_info *newinfo)
{
	int ret;
	struct xt_table_info *private;
	struct xt_table *t, *table;
	/* Don't add one object to multiple lists. */
	table = kmemdup(input_table, sizeof(struct xt_table), GFP_KERNEL);
	if (!table) {
		ret = -ENOMEM;
		goto out;
	}

	ret = mutex_lock_interruptible(&xt[table->af].mutex);
	if (ret != 0)
		goto out_free;
	/* Don't autoload: we'd eat our tail... */
	list_for_each_entry(t, &net->xt.tables[table->af], list) {
		if (strcmp(t->name, table->name) == 0) {
			ret = -EEXIST;
			goto unlock;
		}
	}
	/* Simplifies replace_table code. */
	table->private = bootstrap;

	if (!xt_replace_table(table, 0, newinfo, &ret))
		goto unlock;

	private = table->private;
	pr_debug("table->private->number = %u\n", private->number);
	/* save number of initial entries */
	private->initial_entries = private->number;

	list_add(&table->list, &net->xt.tables[table->af]);
	mutex_unlock(&xt[table->af].mutex);
	return table;

 unlock:
	mutex_unlock(&xt[table->af].mutex);
out_free:
	kfree(table);
out:
	return ERR_PTR(ret);
}
```

### xt_hook_link

iptables 和 内核数据结构进行关联

```c
filter_ops = xt_hook_link(&packet_filter, iptable_filter_hook);
-->>
/*进行必要数据初始化*/
struct nf_hook_ops *xt_hook_link(const struct xt_table *table, nf_hookfn *fn)
{
	unsigned int hook_mask = table->valid_hooks;
	uint8_t i, num_hooks = hweight32(hook_mask);
	uint8_t hooknum;
	struct nf_hook_ops *ops;
	int ret;

	ops = kmalloc(sizeof(*ops) * num_hooks, GFP_KERNEL);
	if (ops == NULL)
		return ERR_PTR(-ENOMEM);

	for (i = 0, hooknum = 0; i < num_hooks && hook_mask != 0;
	     hook_mask >>= 1, ++hooknum) {
		if (!(hook_mask & 1))
			continue;
		ops[i].hook     = fn;
		ops[i].owner    = table->me;
		ops[i].pf       = table->af;
		ops[i].hooknum  = hooknum;
		ops[i].priority = table->priority;
		++i;
	}

	ret = nf_register_hooks(ops, num_hooks);
	if (ret < 0) {
		kfree(ops);
		return ERR_PTR(ret);
	}

	return ops;
}
-->>
int nf_register_hooks(struct nf_hook_ops *reg, unsigned int n)
{
	unsigned int i;
	int err = 0;

	for (i = 0; i < n; i++) {
		err = nf_register_hook(&reg[i]);
		if (err)
			goto err;
	}
	return err;
    ……
}
-->>
int nf_register_hook(struct nf_hook_ops *reg)
{
	struct nf_hook_ops *elem;
	int err;

	err = mutex_lock_interruptible(&nf_hook_mutex);
	if (err < 0)
		return err;
    /*终于到了熟悉的 nf_hooks*/
	list_for_each_entry(elem, &nf_hooks[reg->pf][reg->hooknum], list) {
		if (reg->priority < elem->priority)
			break;
	}
	list_add_rcu(&reg->list, elem->list.prev);
	mutex_unlock(&nf_hook_mutex);
#if defined(CONFIG_JUMP_LABEL)
	static_key_slow_inc(&nf_hooks_needed[reg->pf][reg->hooknum]);
#endif
	return 0;
}
```

```c
static unsigned int
iptable_filter_hook(unsigned int hook, struct sk_buff *skb,
		    const struct net_device *in, const struct net_device *out,
		    int (*okfn)(struct sk_buff *))
{
	const struct net *net;

	if (hook == NF_INET_LOCAL_OUT &&
	    (skb->len < sizeof(struct iphdr) ||
	     ip_hdrlen(skb) < sizeof(struct iphdr)))
		/* root is playing with raw sockets. */
		return NF_ACCEPT;

	net = dev_net((in != NULL) ? in : out);
    //重点注意 net->ipv4.iptable_filter
	return ipt_do_table(skb, hook, in, out, net->ipv4.iptable_filter);
}
```

## 模块内的交互

所有关于netfilter的user-kernel交互，注册都在iptabls模块。

```c
ret = nf_register_sockopt(&ipt_sockopts);
-->>
//其set指针为do_ipt_set_ctl
static int
do_ipt_set_ctl(struct sock *sk, int cmd, void __user *user, unsigned int len)
{
	……
	switch (cmd) {
	case IPT_SO_SET_REPLACE:
		ret = do_replace(sock_net(sk), user, len);
		break;
    …………
	}

	return ret;
}
-->>
static int
do_replace(struct net *net, const void __user *user, unsigned int len)
{
	int ret;
	struct ipt_replace tmp;
	struct xt_table_info *newinfo;
	void *loc_cpu_entry;
	struct ipt_entry *iter;
	// 从用户态栈复制数据
	if (copy_from_user(&tmp, user, sizeof(tmp)) != 0)
		return -EFAULT;

	/* overflow check */
	if (tmp.num_counters >= INT_MAX / sizeof(struct xt_counters))
		return -ENOMEM;
	if (tmp.num_counters == 0)
		return -EINVAL;

	tmp.name[sizeof(tmp.name)-1] = 0;

	newinfo = xt_alloc_table_info(tmp.size);
	if (!newinfo)
		return -ENOMEM;

	/* choose the copy that is on our node/cpu */
	loc_cpu_entry = newinfo->entries[raw_smp_processor_id()];
	if (copy_from_user(loc_cpu_entry, user + sizeof(tmp),
			   tmp.size) != 0) {
		ret = -EFAULT;
		goto free_newinfo;
	}
    //上文已经分析
	ret = translate_table(net, newinfo, loc_cpu_entry, &tmp);
	if (ret != 0)
		goto free_newinfo;

	duprintf("Translated table\n");

	ret = __do_replace(net, tmp.name, tmp.valid_hooks, newinfo,
			   tmp.num_counters, tmp.counters);
    …………
}
-->>
static int
__do_replace(struct net *net, const char *name, unsigned int valid_hooks,
	     struct xt_table_info *newinfo, unsigned int num_counters,
	     void __user *counters_ptr)
{
	int ret;
	struct xt_table *t;
	struct xt_table_info *oldinfo;
	struct xt_counters *counters;
	void *loc_cpu_old_entry;
	struct ipt_entry *iter;

	ret = 0;
	counters = vzalloc(num_counters * sizeof(struct xt_counters));
	if (!counters) {
		ret = -ENOMEM;
		goto out;
	}
	//找到本network namespace中的 xt.table
	t = try_then_request_module(xt_find_table_lock(net, AF_INET, name),
				    "iptable_%s", name);
	if (IS_ERR_OR_NULL(t)) {
		ret = t ? PTR_ERR(t) : -ENOENT;
		goto free_newinfo_counters_untrans;
	}
	/* You lied! */
	if (valid_hooks != t->valid_hooks) {
		duprintf("Valid hook crap: %08X vs %08X\n",
			 valid_hooks, t->valid_hooks);
		ret = -EINVAL;
		goto put_module;
	}
	//newinfo直接替换t->private
	oldinfo = xt_replace_table(t, num_counters, newinfo, &ret);
	if (!oldinfo)
		goto put_module;
	…………
}
```

可以简单理解为：

**内核每个命名空间注册时：nf_hooks 与 net->ipv4.iptable_filter 做关联，iptable_filter 与 xt.tables 做关联**
**用户态进行更新时：更新相应的xt.tables**

# 优秀资料

[iptables详解（1）：iptables概念](http://www.zsythink.net/archives/1199)

[Linux 防火墙在内核中的实现](https://www.ibm.com/developerworks/cn/linux/network/l-netip/index.html)

[netfilter/iptables 简介](<https://www.cnblogs.com/sparkdev/p/9328713.html>)