---
title: Linux Netpoll浅析
date: 2018-03-12 12:03:09
categories: Linux内核
tags:
  - Netpoll
typora-root-url: ../../../source
---

本文基于Linux kernel v3.10.105。

## 简介

网卡处理流量都几种方式：

- 中断处理：每次接受报文都会发生中断。此种方式在高速网络中会使系统性能全面下降。
- poll方式：不依靠中断，完全依靠轮询。读取特定的寄存器，条件合适时进行收发数据。
- NAPI，上述两者的结合，具体在之前的文章中已经讲解过。



由于netpoll不依靠中断，因此可以在以下场合使用：

- 系统panic之后。此时中断控制器将可能被disable掉，无论如何，此时的机器已经和外界失联了，此时可以通过netpoll对外界通告自己的死因。
- 协议栈故障。如果使用中断或者NAPI的方式，由于它上接的就是协议栈，netif_receive_skb中又没有什么HOOK点，此时使用netpoll可以改变数据包的处理路径，通过一个agent可以实现远程debug。

中断是通知机制（或被动）查询网卡状态，netpoll是轮询（或主动）方式查询网卡状态。

1. 主动调用网卡的中断处理函数，获取当前该发送数据包还是接收到一个数据包；
2. 直接hard_xmit数据包或者使用NAPI的接口去poll网卡的数据。

Linux netpoll总体图如下：

![netpoll处理方式](/images/Linux-Netpoll浅析/netpoll处理方式.jpg)



netpoll是Linux内核中的一种在协议栈不可用或者中断机制异常的情况下与外界通讯的手段，当然它也是一种绕开协议栈的方法。Netfilter是在协议栈的特殊点捕获数据包的，而netpoll却可以在网卡之上直接捕获数据包，它们甚至连协议栈的最底端都到不了。

## 代码分析

### netpoll 和 netpoll_info

netpoll结构用来描述接收和发送数据包的必要信息。

```c
struct netpoll {
	struct net_device *dev;				/*绑定的设备*/
	char dev_name[IFNAMSIZ];			/*设备名*/
	const char *name;					/*netpoll实例的名称*/
  	/*接收数据包的接口*/
	void (*rx_hook)(struct netpoll *, int, char *, int);
	/*本地、远端IP地址*/
	union inet_addr local_ip, remote_ip;
	bool ipv6;							/*ipv6支持情况*/
	u16 local_port, remote_port;		/*本地、远端port*/
	u8 remote_mac[ETH_ALEN];			/*远端 mac地址*/

	struct list_head rx; /* rx_np list element */
	struct work_struct cleanup_work;
};
```

网络设备中，当支持netpoll时，必须实现变量npinfo：

```c
struct net_device {
……
#ifdef CONFIG_NETPOLL
	struct netpoll_info __rcu	*npinfo;
#endif
……
}；
```

```c
struct netpoll_info {
	atomic_t refcnt;				/*引用计数*/
	/*接收标志，NETPOLL_RX_ENABLED 或 NETPOLL_RX_DROP*/
	unsigned long rx_flags;			
	spinlock_t rx_lock;
	struct semaphore dev_lock;
  
	struct list_head rx_np; /*注册的rx_hook的netpolls*/
	struct sk_buff_head neigh_tx; /*请求回复的邻居请求列表*/
	struct sk_buff_head txq;
	struct delayed_work tx_work;

	struct netpoll *netpoll;
	struct rcu_head rcu;
};
```

### 初始化

#### 模块初始化

```c
static struct sk_buff_head skb_pool;
……
static int __init netpoll_init(void)
{
	skb_queue_head_init(&skb_pool);
	return 0;
}
```

#### 接口结构体初始化

npinfo在函数`__netpoll_setup`中进行分配初始化，查询代码可知仅有vlan、bond和bridge类型的接口注册函数调用`__netpoll_setup`。

```C
int __netpoll_setup(struct netpoll *np, struct net_device *ndev, gfp_t gfp)
{
	struct netpoll_info *npinfo;
	const struct net_device_ops *ops;
	unsigned long flags;
	int err;

    /*设备netpoll信息初始化，dev指针、dev_name和工作队列*/
	np->dev = ndev;
	strlcpy(np->dev_name, ndev->name, IFNAMSIZ);
	INIT_WORK(&np->cleanup_work, netpoll_async_cleanup);
	/*设备禁用*/
	if ((ndev->priv_flags & IFF_DISABLE_NETPOLL) ||
	    !ndev->netdev_ops->ndo_poll_controller) {
		np_err(np, "%s doesn't support polling, aborting\n",
		       np->dev_name);
		err = -ENOTSUPP;
		goto out;
	}

	if (!ndev->npinfo) {
		npinfo = kmalloc(sizeof(*npinfo), gfp);
		if (!npinfo) {
			err = -ENOMEM;
			goto out;
		}

		npinfo->rx_flags = 0;
		INIT_LIST_HEAD(&npinfo->rx_np);

		spin_lock_init(&npinfo->rx_lock);
		sema_init(&npinfo->dev_lock, 1);
		skb_queue_head_init(&npinfo->neigh_tx);
		skb_queue_head_init(&npinfo->txq);
		INIT_DELAYED_WORK(&npinfo->tx_work, queue_process);

		atomic_set(&npinfo->refcnt, 1);

		ops = np->dev->netdev_ops;
		if (ops->ndo_netpoll_setup) {
			err = ops->ndo_netpoll_setup(ndev, npinfo, gfp);
			if (err)
				goto free_npinfo;
		}
	} else {
		npinfo = rtnl_dereference(ndev->npinfo);
		atomic_inc(&npinfo->refcnt);
	}

	npinfo->netpoll = np;

	if (np->rx_hook) {
		spin_lock_irqsave(&npinfo->rx_lock, flags);
		npinfo->rx_flags |= NETPOLL_RX_ENABLED;
		list_add_tail(&np->rx, &npinfo->rx_np);
		spin_unlock_irqrestore(&npinfo->rx_lock, flags);
	}

	/* last thing to do is link it to the net device structure */
	rcu_assign_pointer(ndev->npinfo, npinfo);

	return 0;

free_npinfo:
	kfree(npinfo);
out:
	return err;
}
```

### 收包-rx

```c
static inline int netpoll_receive_skb(struct sk_buff *skb)
{
    //NAPI部分之前的文章已经写过，不在分析。
    //现在NETPOLL 基本在 NAPI中调用。
	if (!list_empty(&skb->dev->napi_list))
		return netpoll_rx(skb);
	return 0;
}
```

此函数仅在`__netif_receive_skb_core`开头被调用。

```c
static inline bool netpoll_rx_on(struct sk_buff *skb)
{
	struct netpoll_info *npinfo = rcu_dereference_bh(skb->dev->npinfo);
	// 或 rx_flags == NETPOLL_RX_ENABLED 
	return npinfo && (!list_empty(&npinfo->rx_np) || npinfo->rx_flags);
}

static inline bool netpoll_rx(struct sk_buff *skb)
{
	struct netpoll_info *npinfo;
	unsigned long flags;
	bool ret = false;

	local_irq_save(flags);
	//判断netpoll rx是否开启，未开启则退出。
	if (!netpoll_rx_on(skb))
		goto out;
	//接口的netpoll 信息
	npinfo = rcu_dereference_bh(skb->dev->npinfo);
	spin_lock(&npinfo->rx_lock);
	/* check rx_flags again with the lock held */
    // 进入 netpoll 主要收包函数 __netpoll_rx
	if (npinfo->rx_flags && __netpoll_rx(skb, npinfo))
		ret = true;
	spin_unlock(&npinfo->rx_lock);

out:
	local_irq_restore(flags);
	return ret;
}
```

```c
int __netpoll_rx(struct sk_buff *skb, struct netpoll_info *npinfo)
{
	int proto, len, ulen;
	int hits = 0;
	const struct iphdr *iph;
	struct udphdr *uh;
	struct netpoll *np, *tmp;

	if (list_empty(&npinfo->rx_np))
		goto out;

	if (skb->dev->type != ARPHRD_ETHER)
		goto out;

	/* 检查是否为邻居表项。ipv4 为 ARP，v6 在pkt_is_ns 处理 */
	if (skb->protocol == htons(ETH_P_ARP) && atomic_read(&trapped)) {
		skb_queue_tail(&npinfo->neigh_tx, skb);
		return 1;
	} else if (pkt_is_ns(skb) && atomic_read(&trapped)) {
		skb_queue_tail(&npinfo->neigh_tx, skb);
		return 1;
	}
	// vlan 则 去掉vlan tag
	if (skb->protocol == cpu_to_be16(ETH_P_8021Q)) {
		skb = vlan_untag(skb);
		if (unlikely(!skb))
			goto out;
	}
	//收包既不为IPV4 也不为 IPV6 ，丢包
    //其他主机包，丢包
    //已被拷贝，丢包
	proto = ntohs(eth_hdr(skb)->h_proto);
	if (proto != ETH_P_IP && proto != ETH_P_IPV6)
		goto out;
	if (skb->pkt_type == PACKET_OTHERHOST)
		goto out;
	if (skb_shared(skb))
		goto out;

	if (proto == ETH_P_IP) {
        // 进入 IPV4 处理流程
		if (!pskb_may_pull(skb, sizeof(struct iphdr)))
			goto out;
		iph = (struct iphdr *)skb->data;
        // IP 头部最小长度为20字节，20 * 8bit = 160 bit 
        // 160 / 32 = 5 
		if (iph->ihl < 5 || iph->version != 4)
			goto out;
		if (!pskb_may_pull(skb, iph->ihl*4))
			goto out;
		iph = (struct iphdr *)skb->data;
        //校验和
		if (ip_fast_csum((u8 *)iph, iph->ihl) != 0)
			goto out;

		len = ntohs(iph->tot_len);//总长度字段
		if (skb->len < len || len < iph->ihl*4)
			goto out;

		/* 传输层可能有缓冲区，进行裁剪 */
		if (pskb_trim_rcsum(skb, len))
			goto out;
		//仅处理 UDP ？
		iph = (struct iphdr *)skb->data;
		if (iph->protocol != IPPROTO_UDP)
			goto out;

		len -= iph->ihl*4;
		uh = (struct udphdr *)(((char *)iph) + iph->ihl*4);
		ulen = ntohs(uh->len);

		if (ulen != len)
			goto out;
		if (checksum_udp(skb, uh, ulen, iph->saddr, iph->daddr))
			goto out;
		list_for_each_entry_safe(np, tmp, &npinfo->rx_np, rx) {
			if (np->local_ip.ip && np->local_ip.ip != iph->daddr)
				continue;
			if (np->remote_ip.ip && np->remote_ip.ip != iph->saddr)
				continue;
			if (np->local_port && np->local_port != ntohs(uh->dest))
				continue;

			np->rx_hook(np, ntohs(uh->source),
				       (char *)(uh+1),
				       ulen - sizeof(struct udphdr));
			hits++;
		}
	} else {
#if IS_ENABLED(CONFIG_IPV6)
		//IPV6 略过
        …………
#endif
	}

	if (!hits)
		goto out;

	kfree_skb(skb);
	return 1;

out:
	if (atomic_read(&trapped)) {
		kfree_skb(skb);
		return 1;
	}

	return 0;
}
```

### 发包-tx

```c
static inline void netpoll_send_skb(struct netpoll *np, struct sk_buff *skb)
{
	unsigned long flags;
	local_irq_save(flags);
	netpoll_send_skb_on_dev(np, skb, np->dev);
	local_irq_restore(flags);
}
```

```c
/* call with IRQ disabled */
void netpoll_send_skb_on_dev(struct netpoll *np, struct sk_buff *skb,
			     struct net_device *dev)
{
	int status = NETDEV_TX_BUSY;
	unsigned long tries;
    //接口网络操作函数集
	const struct net_device_ops *ops = dev->netdev_ops;
	/* It is up to the caller to keep npinfo alive. */
	struct netpoll_info *npinfo;

	WARN_ON_ONCE(!irqs_disabled());

	npinfo = rcu_dereference_bh(np->dev->npinfo);
	if (!npinfo || !netif_running(dev) || !netif_device_present(dev)) {
		__kfree_skb(skb);
		return;
	}

	/* 不要按顺序发送消息，也不要递归 */
	if (skb_queue_len(&npinfo->txq) == 0 && !netpoll_owner_active(dev)) {
		struct netdev_queue *txq;
		//多个发包队列的话，选择一个合适的队列
		txq = netdev_pick_tx(dev, skb);

		/* try until next clock tick */
		for (tries = jiffies_to_usecs(1)/USEC_PER_POLL;
		     tries > 0; --tries) {
            //锁队列，并将owner置为本cpu
			if (__netif_tx_trylock(txq)) {
				if (!netif_xmit_stopped(txq)) {
                    //vlan 处理部分
					if (vlan_tx_tag_present(skb) &&
					    !vlan_hw_offload_capable(netif_skb_features(skb),
								     skb->vlan_proto)) {
						skb = __vlan_put_tag(skb, skb->vlan_proto, vlan_tx_tag_get(skb));
						if (unlikely(!skb)) {
							status = NETDEV_TX_OK;
							goto unlock_txq;
						}
						skb->vlan_tci = 0;
					}
                    //接口实际发包函数发包
					status = ops->ndo_start_xmit(skb, dev);
					if (status == NETDEV_TX_OK)
						txq_trans_update(txq);
				}
			unlock_txq:
				__netif_tx_unlock(txq);

				if (status == NETDEV_TX_OK)
					break;

			}
			/* tickle device maybe there is some cleanup */
			netpoll_poll_dev(np->dev);
			udelay(USEC_PER_POLL);
		}

		WARN_ONCE(!irqs_disabled(),
			"netpoll_send_skb_on_dev(): %s enabled interrupts in poll (%pF)\n",
			dev->name, ops->ndo_start_xmit);

	}

	if (status != NETDEV_TX_OK) {
		skb_queue_tail(&npinfo->txq, skb);
		schedule_delayed_work(&npinfo->tx_work,0);
	}
}
```



## 优秀资料

[netpoll浅析](http://blog.csdn.net/lucien_cc/article/details/11731501)

[Linux内核的netpoll框架与netconsole](http://blog.csdn.net/dog250/article/details/45788497)