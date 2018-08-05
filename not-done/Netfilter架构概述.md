---
title: Netfilter架构概述
date: 2018-08-05 22:48:31
categories: Linux内核
tags:
  - iptables
  - netfilter
---

## Netfilter

Netfilter是Linux 2.4.x引入的一个子系统，提供一整套的hook函数的管理机制，使得诸如数据包过滤、网络地址转换(NAT)和基于协议类型的连接跟踪成为了可能。

Netfilter的核心就是在整个网络流程的若干位置放置了一些检测点（HOOK），而在每个检测点上登记了一些处理函数进行处理。

### 从第一个钩子说起

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

继续看一下此函数的定义：

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
*/  --->>>
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
*/ --->>>
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

#### 核心数据结构

nf_hooks

nf_hook_ops

#### Netfilter Protocol

#### Netfilter Hooknum

#### Netfilter Action

关系图

## Iptables

iptables 和 netfilter 的关系

iptables 代码逻辑 -> 内核逻辑



## 优秀资料

[iptables详解（1）：iptables概念](http://www.zsythink.net/archives/1199)

[Linux 防火墙在内核中的实现](https://www.ibm.com/developerworks/cn/linux/network/l-netip/index.html)

[netfilter/iptables 简介](netfilter/iptables 简介)