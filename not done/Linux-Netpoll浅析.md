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
	struct net_device *dev;				/**/
	char dev_name[IFNAMSIZ];			/**/
	const char *name;					/**/
  	/**/
	void (*rx_hook)(struct netpoll *, int, char *, int);
	/**/
	union inet_addr local_ip, remote_ip;
	bool ipv6;							/**/
	u16 local_port, remote_port;		/**/
	u8 remote_mac[ETH_ALEN];			/**/

	struct list_head rx; /* rx_np list element */
	struct work_struct cleanup_work;
};
```







netconsole netpoll



## 优秀资料

