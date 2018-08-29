---
title: Netfilter架构概述
date: 2018-08-05 22:48:31
categories: Linux内核
tags:
  - iptables
  - netfilter
---

# Netfilter

Netfilter是Linux 2.4.x引入的一个子系统，提供一整套的hook函数的管理机制，使得诸如数据包过滤、网络地址转换(NAT)和基于协议类型的连接跟踪成为了可能。

网络层作为ISO 7层协议（网络关系图可参考 http://www.52im.net/thread-180-1-1.html）的第三层，其代表协议为IP（Internet Protocol）协议，协议号为 0x0800。协议处理流程大致如下：

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

深入`NF_HOOK`的实现：

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
hook	: Netfilter Hooknum
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

Netfilter中有两个数据比较主要： `nf_hooks`和`nf_hook_ops`。

本质上，`nf_hooks`仅仅是一个二维hash头。

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

Protocol中Hook数量为：

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

err:
	if (i > 0)
		nf_unregister_hooks(reg, i);
	return err;
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
	{
		.hook = br_nf_forward_ip,
		.owner = THIS_MODULE,
		.pf = NFPROTO_BRIDGE,
		.hooknum = NF_BR_FORWARD,
		.priority = NF_BR_PRI_BRNF - 1,
	},
	{
		.hook = br_nf_forward_arp,
		.owner = THIS_MODULE,
		.pf = NFPROTO_BRIDGE,
		.hooknum = NF_BR_FORWARD,
		.priority = NF_BR_PRI_BRNF,
	},
	{
		.hook = br_nf_post_routing,
		.owner = THIS_MODULE,
		.pf = NFPROTO_BRIDGE,
		.hooknum = NF_BR_POST_ROUTING,
		.priority = NF_BR_PRI_LAST,
	},
	{
		.hook = ip_sabotage_in,
		.owner = THIS_MODULE,
		.pf = NFPROTO_IPV4,
		.hooknum = NF_INET_PRE_ROUTING,
		.priority = NF_IP_PRI_FIRST,
	},
	{
		.hook = ip_sabotage_in,
		.owner = THIS_MODULE,
		.pf = NFPROTO_IPV6,
		.hooknum = NF_INET_PRE_ROUTING,
		.priority = NF_IP6_PRI_FIRST,
	},
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

其中模块`ip_tabls`为承接模块，承接user/kernel的信息交互。而其他五个模块主要提供不同的（iptables 表）类型到`nf_hooks`的映射。

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



```c
static int __net_init iptable_filter_net_init(struct net *net)
{
	struct ipt_replace *repl;

	repl = ipt_alloc_initial_table(&packet_filter);
	if (repl == NULL)
		return -ENOMEM;
	/* Entry 1 is the FORWARD hook */
	((struct ipt_standard *)repl->entries)[1].target.verdict =
		forward ? -NF_ACCEPT - 1 : -NF_DROP - 1;

	net->ipv4.iptable_filter =
		ipt_register_table(net, &packet_filter, repl);
	kfree(repl);
	return PTR_RET(net->ipv4.iptable_filter);
}
```







### xt_hook_link

iptables 和 内核数据结构进行关联 xt_hook_link (iptables_filter)

## 模块内的交互





iptables user - kernel交互  do_ipt_set_ctl(ip_tables.c)





# 优秀资料

[iptables详解（1）：iptables概念](http://www.zsythink.net/archives/1199)

[Linux 防火墙在内核中的实现](https://www.ibm.com/developerworks/cn/linux/network/l-netip/index.html)

[netfilter/iptables 简介](netfilter/iptables 简介)