---
title: Linux Netpoll浅析
date: 2018-03-12 12:03:09
categories: Linux内核
tags:
  - Netpoll
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

npinfo在函数`\_\_netpoll_setup`中进行分配初始化，查询代码可知仅有vlan、bond和bridge类型的接口注册函数调用`\_\_netpoll_setup`。

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



netif_napi_add

接口信息注册->接口的类型

### rx

netpoll_receive_skb

### tx

netpoll_send_skb

netconsole netpoll



## 优秀资料

[netpoll浅析](http://blog.csdn.net/lucien_cc/article/details/11731501)

[Linux内核的netpoll框架与netconsole](http://blog.csdn.net/dog250/article/details/45788497)