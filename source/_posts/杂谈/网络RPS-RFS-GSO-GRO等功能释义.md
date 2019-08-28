---
title: 网络RPS/RFS/GSO/GRO等功能释义
date: 2017-12-29 16:32:38
categories: 网络优化
tags:
  - RSS
  - RPS
  - RFS
  - XPS
  - LSO
  - TSO
  - GSO
  - UFO
  - LRO
  - GRO
typora-root-url: ../../../source
---

 内核代码版本号为 3.10.105。

## 释义与代码分析

### RSS

RSS(Receive Side Scaling)是一种能够在多处理器系统下使接收报文在多个CPU之间高效分发的网卡驱动技术。

- 网卡对接收到的报文进行解析，获取IP地址、协议和端口五元组信息。
- 网卡通过配置的HASH函数根据五元组信息计算出HASH值,也可以根据二、三或四元组进行计算。
- 取HASH值的低几位(这个具体网卡可能不同)作为RETA(redirection table)的索引。
- 根据RETA中存储的值分发到对应的CPU。

基于RSS技术程序可以通过硬件在多个CPU之间来分发数据流，并且可以通过对RETA的修改来实现动态的负载均衡。

RSS需要硬件支持。网卡接收到网络数据包后，要发送一个硬件中断，通知CPU取数据包。默认配置，都是由CPU0去做。

具体可查看某个driver的函数，例如 'drivers/net/ethernet/intel/e1000e/netdev.c'中的函数 'e1000e_setup_rss_hash'。

```
当CPU可以平行收包时，就会出现不同的核收取了同一个queue的报文，这就会产生报文乱序的问题。
解决方法是将一个queue的中断绑定到唯一的一个核上去，从而避免了乱序问题。
同时如果网络流量大的时候，可以将软中断均匀的分散到各个核上，避免CPU成为瓶颈。

利用合理的中断绑定脚本 set_irq_affinity.sh(网上很多资源)。
```

如果硬件不支持RSS的话，那就可能需要下面的技术。

### RPS

RPS，即Receive Package Steering，其原理是单纯地以软件方式实现接收的报文在cpu之间平均分配，即利用报文的hash值找到匹配的cpu，然后将报文送至该cpu对应的backlog队列中进行下一步的处理。于 kernel 2.6.35 添加此特性。

报文hash值，可以是由网卡计算得到，也可以是由软件计算得到，具体的计算也因报文协议不同而有所差异，以tcp报文为例，tcp报文的hash值是根据四元组信息，即源ip、源端口、目的ip和目的端口进行hash计算得到的。

Linux通过配置文件的方式指定哪些cpu核参与到报文的分发处理，配置文件存放的路径是：'/sys/class/net/(dev)/queues/rx-(n)/rps_cpus'。例如：

```shell
# 1010101
# echo 85 > /sys/class/net/eth0/queues/rx-0/rps_cpus
```

当设置好该配置文件之后，内核就会去获取该配置文件的内容，然后根据解析的结果生成一个用于参与报文分发处理的cpu列表（实际实现是一个柔性数组），这样当收到报文之后，就可以建立起hash-cpu的映射关系了。

内核接口结构体中存在如下代码(仅列出重要部分)：

```c
struct net_device {
……
#ifdef CONFIG_RPS
	struct netdev_rx_queue	*_rx;
	/* Number of RX queues allocated at register_netdev() time */
	unsigned int		num_rx_queues;
	/* Number of RX queues currently active in device */
	unsigned int		real_num_rx_queues;

#endif
……
};
```

结构'struct netdev_rx_queue'即为RPS的主要结构体，其定义如下

```c
struct rps_map {
	unsigned int len;
	struct rcu_head rcu;
	u16 cpus[0];	//弹性数组，记录配置文件中配置的参与报文分发处理的cpu id
};
#define RPS_MAP_SIZE(_num) (sizeof(struct rps_map) + ((_num) * sizeof(u16)))

struct netdev_rx_queue {
	struct rps_map __rcu		*rps_map;
  	/*设备流表*/
	struct rps_dev_flow_table __rcu	*rps_flow_table;
	struct kobject			kobj;
	struct net_device		*dev;
} ____cacheline_aligned_in_smp;
```

如何进行存放？注册接口函数'register_netdevice'中会调用'netdev_register_kobject'，在此函数中设置内核文件相关配置，之后调用的函数如下

```c
netdev_register_kobject ->
  register_queue_kobjects ->
  net_rx_queue_update_kobjects ->
  rx_queue_add_kobject -> 
  kobject_init_and_add ->
  error = kobject_init_and_add(kobj, &rx_queue_ktype, NULL,
	    "rx-%u", index);  
```

rx_queue_ktype 定义如下

```c
static struct kobj_type rx_queue_ktype = {
	.sysfs_ops = &rx_queue_sysfs_ops,
	.release = rx_queue_release,
	.default_attrs = rx_queue_default_attrs,	// 接口默认属性
};
-->>
static struct attribute *rx_queue_default_attrs[] = {
	&rps_cpus_attribute.attr,
	&rps_dev_flow_table_cnt_attribute.attr,
	NULL
};
-->>
static struct rx_queue_attribute rps_cpus_attribute =
	__ATTR(rps_cpus, S_IRUGO | S_IWUSR, show_rps_map, store_rps_map);
```

因此，函数 rps_cpus的读方法为'show_rps_map'，写方法为'store_rps_map'。

```c
/*仅列出主要部分，详细函数请查看源码*/
static ssize_t store_rps_map(struct netdev_rx_queue *queue,
		      struct rx_queue_attribute *attribute,
		      const char *buf, size_t len)
{
  	……
  	map = kzalloc(max_t(unsigned int,
	    RPS_MAP_SIZE(cpumask_weight(mask)), L1_CACHE_BYTES),
	    GFP_KERNEL);
	if (!map) {
		free_cpumask_var(mask);
		return -ENOMEM;
	}

	i = 0;
  	/*mask为配置的cpu bit,cpu为临时变量，cpu_online_mask为所有的cpu*/
	for_each_cpu_and(cpu, mask, cpu_online_mask)
		map->cpus[i++] = cpu;

	if (i)
		map->len = i;
	else {
		kfree(map);
		map = NULL;
	}

	spin_lock(&rps_map_lock);
	old_map = rcu_dereference_protected(queue->rps_map,
					    lockdep_is_held(&rps_map_lock));
	rcu_assign_pointer(queue->rps_map, map);
	spin_unlock(&rps_map_lock);
……
}
```

配置已完成，其使用如下

```c
int netif_rx(struct sk_buff *skb)
{
	……
#ifdef CONFIG_RPS
	if (static_key_false(&rps_needed)) {
		struct rps_dev_flow voidflow, *rflow = &voidflow;
		int cpu;

		preempt_disable();
		rcu_read_lock();
		/*获取dev的cpu，算法可进入函数查看，其中调用skb_get_rxhash 得到 skb的 rxhash*/
		cpu = get_rps_cpu(skb->dev, skb, &rflow);
		if (cpu < 0)
			cpu = smp_processor_id();
      
		ret = enqueue_to_backlog(skb, cpu, &rflow->last_qtail);
		rcu_read_unlock();
		preempt_enable();
	} else
#endif
……
}
```

RPS是接收报文的时候处理，而XPS是发送报文的时候处理器优化。

### XPS

XPS，全称为Transmit Packet Steering，是软件支持的发包时的多队列，于 kernel 2.6.38 添加此特性。

通常 RPS 和 XPS 同id的队列选择的CPU相同，这也是防止不同CPU切换时性能消耗。

Linux通过配置文件的方式指定哪些cpu核参与到报文的分发处理，配置文件存放的路径是：'/sys/class/net/(dev)/queues/tx-(n)/rps_cpus'。例如：

```shell
# 1010101
# echo 85 > /sys/class/net/eth0/queues/rx-0/xps_cpus
```

内核中有关xps最主要的函数就是 'get_xps_queue' (关于配置如何映射到内核可参考RPS)。

```c
u16 __netdev_pick_tx(struct net_device *dev, struct sk_buff *skb)
{
	struct sock *sk = skb->sk;
	int queue_index = sk_tx_queue_get(sk);
	/*发送队列的index不合法 或者 
	ooo_okay 不为0时重新获取发送队列
	*/
  	/*ooo是 out of order，
  	ooo_okay 标志表示流中没有未完成的数据包，所以发送队列可以改变而没有产生乱序数据包的风险。
    传输层负责适当地设置ooo_okay。 例如，TCP在连接的所有数据已被确认时设置标志。
    */
	if (queue_index < 0 || skb->ooo_okay ||
	    queue_index >= dev->real_num_tx_queues) {
		int new_index = get_xps_queue(dev, skb);
		if (new_index < 0)
			new_index = skb_tx_hash(dev, skb);

		if (queue_index != new_index && sk &&
		    rcu_access_pointer(sk->sk_dst_cache))
			sk_tx_queue_set(sk, new_index);

		queue_index = new_index;
	}
	return queue_index;
}
```

### RFS

RPS只是根据报文的hash值从分发处理报文的cpu列表中选取一个目标cpu，这样虽然负载均衡的效果很好，但是当**用户态**处理报文的cpu和内核处理报文软中断的cpu不同的时候，就会导致cpu的缓存不命中，影响性能。而RFS(Receive Flow Steering)就是用来处理这种情况的，RFS的目标是通过指派处理报文的应用程序所在的cpu来在内核态处理报文，以此来增加cpu的**缓存命中率**。所以RFS相比于RPS，主要差别就是在选取分发处理报文的目标cpu上，而**RFS还需要依靠RPS提供的机制进行报文的后续处理**。于 kernel 2.6.35 添加此特性。
　　RFS实现指派处理报文的应用程序所在的cpu来在内核态处理报文这一目标主要是依靠两个流表来实现的，其中一个是设备流表，记录的是上次在内核态处理该流中报文的cpu；另外一个是全局的socket流表，记录的是流中的报文渴望被处理的目标cpu。

#### 设备流表

```c
struct netdev_rx_queue {
	struct rps_map __rcu		*rps_map;
  	/*设备流表*/
	struct rps_dev_flow_table __rcu	*rps_flow_table;
	struct kobject			kobj;
	struct net_device		*dev;
} ____cacheline_aligned_in_smp;
-->>
struct rps_dev_flow_table {
	unsigned int mask;
	struct rcu_head rcu;
	struct rps_dev_flow flows[0];	//弹性数组
};
-->>
struct rps_dev_flow {
	u16 cpu;	/* 处理该流的cpu */
	u16 filter;
	unsigned int last_qtail;	/* sd->input_pkt_queue队列的尾部索引，即该队列长度 */
};  
```

'struct rps_dev_flow'类型弹性数组大小由配置文件' /sys/class/net/(dev)/queues/rx-(n)/rps_flow_cnt'进行指定的。指定方式可参考RPS一节。

#### 全局socket流表

rps_sock_flow_table是一个全局的数据流表，这个表中包含了数据流渴望被处理的CPU。这个CPU是当前处理流中报文的应用程序所在的CPU。全局socket流表会在调recvmsg，sendmsg (特别是inet_accept(), inet_recvmsg(), inet_sendmsg(), inet_sendpage() and tcp_splice_read())，被设置或者更新。
全局socket流表rps_sock_flow_table的定义如下：

```c
struct rps_sock_flow_table {
	unsigned int mask;
	u16 ents[0];
};
```

mask成员存放的就是ents这个柔性数组的大小，该值也是通过配置文件的方式指定的，相关的配置文件为 '/proc/sys/net/core/rps_sock_flow_entries'。

全局socket流表会在调用recvmsg()等函数时被更新，而在这些函数中是通过调用函数sock_rps_record_flow()来更新或者记录流表项信息的，而sock_rps_record_flow()中最终又是调用函数rps_record_sock_flow()来更新ents柔性数组的，该函数实现如下：

```c
static inline void rps_record_sock_flow(struct rps_sock_flow_table *table,
					u32 hash)
{
	if (table && hash) {
		unsigned int cpu, index = hash & table->mask;

		/* We only give a hint, preemption can change cpu under us */
      	/*当前CPU*/
		cpu = raw_smp_processor_id();
		/*ents存放当前cpu*/
		if (table->ents[index] != cpu)
			table->ents[index] = cpu;
	}
}
```

此时，再次分析函数 get_rps_cpu：

```c
static int get_rps_cpu(struct net_device *dev, struct sk_buff *skb,
		       struct rps_dev_flow **rflowp)
{
	struct netdev_rx_queue *rxqueue;
	struct rps_map *map;
	struct rps_dev_flow_table *flow_table;
	struct rps_sock_flow_table *sock_flow_table;
	int cpu = -1;
	u16 tcpu;
	/*queue_mapping 表示是哪个 queue发送的skb，0为默认*/
	if (skb_rx_queue_recorded(skb)) {
		u16 index = skb_get_rx_queue(skb);
		if (unlikely(index >= dev->real_num_rx_queues)) {
			WARN_ONCE(dev->real_num_rx_queues > 1,
				  "%s received packet on queue %u, but number "
				  "of RX queues is %u\n",
				  dev->name, index, dev->real_num_rx_queues);
			goto done;
		}
      	/*找到对应的RPS收包队列指针*/
		rxqueue = dev->_rx + index;
	} else
		rxqueue = dev->_rx;
	
  	/*没有配置 map 并且也没有 flow table,直接退出；
  	map只有一个CPU且此CPU在线，则目标CPU即是此CPU*/
	map = rcu_dereference(rxqueue->rps_map);
	if (map) {
		if (map->len == 1 &&
		    !rcu_access_pointer(rxqueue->rps_flow_table)) {
			tcpu = map->cpus[0];
			if (cpu_online(tcpu))
				cpu = tcpu;
			goto done;
		}
	} else if (!rcu_access_pointer(rxqueue->rps_flow_table)) {
		goto done;
	}
	/*获取 skb->rxhash*/
	skb_reset_network_header(skb);
	if (!skb_get_rxhash(skb))
		goto done;

	flow_table = rcu_dereference(rxqueue->rps_flow_table);
	sock_flow_table = rcu_dereference(rps_sock_flow_table);
	if (flow_table && sock_flow_table) {
		u16 next_cpu;
		struct rps_dev_flow *rflow;
		/*此条流希望所在的CPU*/
		rflow = &flow_table->flows[skb->rxhash & flow_table->mask];
		tcpu = rflow->cpu;
		/*上次处理报文所在流的cpu*/
		next_cpu = sock_flow_table->ents[skb->rxhash &
		    sock_flow_table->mask];

		/*
		 两个cpu不一样时，在一下情况下进行切换：
		 - 当前CPU未设置(RPS_NO_CPU)
		 - 当前CPU处于脱机状态
		 - 当前CPU处理的数据包超出了最后一个使用这个表项入队的数据包。
		   这保证了流的所有以前的数据包已经被出队，从而保持了交付的顺序，不会乱序。
         */
		if (unlikely(tcpu != next_cpu) &&
		    (tcpu == RPS_NO_CPU || !cpu_online(tcpu) ||
		     ((int)(per_cpu(softnet_data, tcpu).input_queue_head -
		      rflow->last_qtail)) >= 0)) {
			tcpu = next_cpu;
          	/*更改rflow CPU*/
			rflow = set_rps_cpu(dev, skb, rflow, next_cpu);
		}

		if (tcpu != RPS_NO_CPU && cpu_online(tcpu)) {
			*rflowp = rflow;
			cpu = tcpu;
			goto done;
		}
	}

	if (map) {
		tcpu = map->cpus[((u64) skb->rxhash * map->len) >> 32];

		if (cpu_online(tcpu)) {
			cpu = tcpu;
			goto done;
		}
	}

done:
	return cpu;
}
```

### LSO、TSO 和 GSO

计算机网络上传输的数据基本单位是离散的网包，既然是网包，就有大小限制，这个限制就是 MTU（Maximum Transmission Unit）的大小，（以太网）一般是1500字节（这里的MTU所指的是无需分段的情况下，可以传输的最大IP报文（包含IP头部，但不包含协议栈更下层的头部））。比如我们想发送很多数据出去，经过os协议栈的时候，会自动帮你拆分成几个不超过MTU的网包。然而，这个拆分是比较费计算资源的（比如很多时候还要计算分别的checksum），由 CPU 来做的话，往往会造成使用率过高。那可不可以把这些简单重复的操作 offload 到网卡上呢？

于是就有了 **LSO**(Large Segment Offload )，在发送数据超过 MTU 限制的时候（太容易发生了），OS 只需要提交一次传输请求给网卡，网卡会自动的把数据拿过来，然后进行切片，并封包发出，发出的网包不超过 MTU 限制。

而且现在基本上用不到 LSO，已经有更好的替代。

**TSO**(TCP Segmentation Offload): 是一种利用网卡来对大数据包进行自动分段，降低CPU负载的技术。 其主要是延迟分段。

**GSO**(Generic Segmentation Offload): GSO是协议栈是否推迟分段，在发送到网卡之前判断网卡是否支持TSO，如果网卡支持TSO则让网卡分段，否则协议栈分完段再交给驱动。 **如果TSO开启，GSO会自动开启。**

以下是TSO和GSO的组合关系：

- GSO开启， TSO开启：协议栈推迟分段，并直接传递大数据包到网卡，让网卡自动分段。
- GSO开启， TSO关闭：协议栈推迟分段，在最后发送到网卡前才执行分段。
- GSO关闭， TSO开启：同GSO开启， TSO开启。
- GSO关闭， TSO关闭：不推迟分段，在tcp_sendmsg中直接发送MSS大小的数据包。

#### 开启GSO/TSO

驱动程序在注册网卡设备的时候默认开启GSO: NETIF_F_GSO。

```c
int register_netdevice(struct net_device *dev)
{
……
  	/*
  	#define NETIF_F_SOFT_FEATURES	(NETIF_F_GSO | NETIF_F_GRO)
  	*/
	dev->hw_features |= NETIF_F_SOFT_FEATURES;
	dev->features |= NETIF_F_SOFT_FEATURES;
	dev->wanted_features = dev->features & dev->hw_features;
……
}
```

驱动程序会根据网卡硬件是否支持来设置TSO: NETIF_F_TSO。

```c
// intel e1000 网卡
static int e1000_probe(struct pci_dev *pdev, const struct pci_device_id *ent)
{
  ……
  if ((hw->mac_type >= e1000_82544) &&
	   (hw->mac_type != e1000_82547))
		netdev->hw_features |= NETIF_F_TSO;
  ……
}
```

#### 是否推迟分段

GSO/TSO是否开启是保存在dev->features中，而设备和路由关联，当我们查询到路由后就可以把配置保存在sock中。

比如在tcp_v4_connect和tcp_v4_syn_recv_sock都会调用sk_setup_caps来设置GSO/TSO配置。

需要注意的是，只要开启了GSO，即使硬件不支持TSO，也会设置NETIF_F_TSO，使得sk_can_gso(sk)在GSO开启或者TSO开启的时候都返回true。

```c

/* This will initiate an outgoing connection. */
int tcp_v4_connect(struct sock *sk, struct sockaddr *uaddr, int addr_len)
{
  ……
	/* OK, now commit destination to socket.  */
	sk->sk_gso_type = SKB_GSO_TCPV4;
	sk_setup_caps(sk, &rt->dst);
  ……
}
```

##### sk_setup_caps

```c
void sk_setup_caps(struct sock *sk, struct dst_entry *dst)
{
	__sk_dst_set(sk, dst);
	sk->sk_route_caps = dst->dev->features;
	if (sk->sk_route_caps & NETIF_F_GSO)
		sk->sk_route_caps |= NETIF_F_GSO_SOFTWARE;
	sk->sk_route_caps &= ~sk->sk_route_nocaps;
	if (sk_can_gso(sk)) {
		if (dst->header_len) {
			sk->sk_route_caps &= ~NETIF_F_GSO_MASK;
		} else {
			sk->sk_route_caps |= NETIF_F_SG | NETIF_F_HW_CSUM;
			sk->sk_gso_max_size = dst->dev->gso_max_size;
			sk->sk_gso_max_segs = dst->dev->gso_max_segs;
		}
	}
}
```

从上面可以看出，如果设备开启了GSO，sock都会将TSO标志打开，但是注意这和硬件是否开启TSO无关，硬件的TSO取决于硬件自身特性的支持。

##### sk_can_gso

```c
static inline bool sk_can_gso(const struct sock *sk)
{
  	/*对于tcp，在tcp_v4_connect中被设置：sk->sk_gso_type = SKB_GSO_TCPV4*/
	return net_gso_ok(sk->sk_route_caps, sk->sk_gso_type);
}
```

##### net_gso_ok

```c

static inline bool net_gso_ok(netdev_features_t features, int gso_type)
{
	netdev_features_t feature = gso_type << NETIF_F_GSO_SHIFT;
  	……
	return (features & feature) == feature;
}
```

由于tcp 在sk_setup_caps中sk->sk_route_caps也被设置有SKB_GSO_TCPV4，所以整个sk_can_gso成立。

#### GSO的数据包长度

对紧急数据包或GSO/TSO都不开启的情况，才不会推迟发送， 默认使用当前MSS。开启GSO后，tcp_send_mss返回mss和单个skb的GSO大小，为mss的整数倍。

##### tcp_send_mss

```c
static int tcp_send_mss(struct sock *sk, int *size_goal, int flags)
{
	int mss_now;
	/*通过ip option，SACKs及pmtu确定当前的mss*/
	mss_now = tcp_current_mss(sk);
  	/*tcp_xmit_size_goal获取发送数据报到达网络设备时数据段的最大长度，该长度用来分割数据，TCP发送报文时，	   *每个SKB的大小不能超过该值。
	 *在此传入是否标识MSG_OOB(out-of-band,比普通数据更高的优先级传送的带外数据)位，这是因为MSG_OOB是判断  		*是否支持GSO的条件之一，而紧急数据不支持GSO。
	 *在不支持GSO的情况下，size_goal就等于mss_now，而如果支持GSO，则size_goal会是MSS的整数倍。数据报发送	 *到网络设备后再由网络设备根据MSS进行分割。*/
	*size_goal = tcp_xmit_size_goal(sk, mss_now, !(flags & MSG_OOB));
	return mss_now;
}
```

##### tcp_xmit_size_goal

```c
static unsigned int tcp_xmit_size_goal(struct sock *sk, u32 mss_now,
				       int large_allowed)
{
	struct tcp_sock *tp = tcp_sk(sk);
	u32 xmit_size_goal, old_size_goal;

	xmit_size_goal = mss_now;
	/*这里large_allowed表示是否是紧急数据；
	large_allowed为真表示无带外数据，可以大包发送*/
	if (large_allowed && sk_can_gso(sk)) {
		u32 gso_size, hlen;

		/* Maybe we should/could use sk->sk_prot->max_header here ? */
		hlen = inet_csk(sk)->icsk_af_ops->net_header_len +
		       inet_csk(sk)->icsk_ext_hdr_len +
		       tp->tcp_header_len;

		/* 目标是每ms发送至少一个数据包，而不是每100 ms发送一个大的TSO数据包。
		   sk_pacing_rate为 每秒的bytes。
		   这保留了ACK时钟，并且与tcp_tso_should_defer（）启发式一致。
		   sysctl_tcp_min_tso_segs 为 sysctl控制的系统变量。我的系统环境中值为2。 
		 */
		gso_size = sk->sk_pacing_rate / (2 * MSEC_PER_SEC);
		gso_size = max_t(u32, gso_size,
				 sysctl_tcp_min_tso_segs * mss_now);
		/*xmit_size_goal为
		gso最大分段大小减去tcp和ip头部长度 与
		gso_size中比较小的值
		*/
		xmit_size_goal = min_t(u32, gso_size,
				       sk->sk_gso_max_size - 1 - hlen);
		/*最多达到收到的最大rwnd窗口通告的一半*/
		xmit_size_goal = tcp_bound_to_half_wnd(tp, xmit_size_goal);

		/* We try hard to avoid divides here */
		old_size_goal = tp->xmit_size_goal_segs * mss_now;

		if (likely(old_size_goal <= xmit_size_goal &&
			   old_size_goal + mss_now > xmit_size_goal)) {
			xmit_size_goal = old_size_goal;
		} else {
			tp->xmit_size_goal_segs =
				min_t(u16, xmit_size_goal / mss_now,
				      sk->sk_gso_max_segs);
			xmit_size_goal = tp->xmit_size_goal_segs * mss_now;
		}
	}
	return max(xmit_size_goal, mss_now);
}
```

##### tcp_sendmsg

应用程序send()数据后，会在tcp_sendmsg中尝试在同一个skb，保存size_goal大小的数据，然后再通过tcp_push把这些包通过tcp_write_xmit发出去。

(代码涉及较多，以后进行分析，TBD)

最终会调用tcp_push发送skb，而tcp_push又会调用tcp_write_xmit。tcp_sendmsg已经把数据按照GSO最大的size，放到一个个的skb中， 最终调用tcp_write_xmit发送这些GSO包。tcp_write_xmit会检查当前的拥塞窗口，还有nagle测试，tsq检查来决定是否能发送整个或者部分的skb， 如果只能发送一部分，则需要调用tso_fragment做切分。最后通过tcp_transmit_skb发送， 如果发送窗口没有达到限制，skb中存放的数据将达到GSO最大值。

##### tcp_write_xmit

```c
static bool tcp_write_xmit(struct sock *sk, unsigned int mss_now, int nonagle,
			   int push_one, gfp_t gfp)
{
	struct tcp_sock *tp = tcp_sk(sk);
	struct sk_buff *skb;
	unsigned int tso_segs, sent_pkts;
	int cwnd_quota;
	int result;

	sent_pkts = 0;

	if (!push_one) {
		/* Do MTU probing. */
		result = tcp_mtu_probe(sk);
		if (!result) {
			return false;
		} else if (result > 0) {
			sent_pkts = 1;
		}
	}
	/*遍历发送队列*/
	while ((skb = tcp_send_head(sk))) {
		unsigned int limit;

		tso_segs = tcp_init_tso_segs(sk, skb, mss_now);
		BUG_ON(!tso_segs);
	
		if (unlikely(tp->repair) && tp->repair_queue == TCP_SEND_QUEUE)
			goto repair; /* Skip network transmission */

		cwnd_quota = tcp_cwnd_test(tp, skb);
		if (!cwnd_quota) {
			if (push_one == 2)
				/* Force out a loss probe pkt. */
				cwnd_quota = 1;
			else
				break;
		}

		if (unlikely(!tcp_snd_wnd_test(tp, skb, mss_now)))
			break;
		/*tso_segs=1表示无需tso分段*/
		if (tso_segs == 1 || !sk->sk_gso_max_segs) {
          	/* 根据nagle算法，计算是否需要推迟发送数据 */
			if (unlikely(!tcp_nagle_test(tp, skb, mss_now,
						     (tcp_skb_is_last(sk, skb) ?
						      nonagle : TCP_NAGLE_PUSH))))
				break;
		} else {
          	/*有多个tso分段*/
          	/*push所有skb*/
          	/*如果发送窗口剩余不多，并且预计下一个ack将很快到来(意味着可用窗口会增加)，则推迟发送*/
			if (!push_one && tcp_tso_should_defer(sk, skb))
				break;
		}

		limit = max_t(unsigned int, sysctl_tcp_limit_output_bytes,
			      sk->sk_pacing_rate >> 10);

		if (atomic_read(&sk->sk_wmem_alloc) > limit) {
			set_bit(TSQ_THROTTLED, &tp->tsq_flags);
			smp_mb__after_clear_bit();
			if (atomic_read(&sk->sk_wmem_alloc) > limit)
				break;
		}

      	/*下面的逻辑是：不用推迟发送，马上发送的情况*/
		limit = mss_now;
      	/*由于tso_segs被设置为skb->len/mss_now，所以开启gso时一定大于1*/
      	/*tso分段大于1且非urg模式*/      	
		if (tso_segs > 1 && sk->sk_gso_max_segs && !tcp_urg_mode(tp))
          	/*返回当前skb中可以发送的数据大小，通过mss和cwnd*/
			limit = tcp_mss_split_point(sk, skb, mss_now,
						    min_t(unsigned int,
							  cwnd_quota,
							  sk->sk_gso_max_segs));
		/* 当skb的长度大于限制时，需要调用tso_fragment分片,如果分段失败则暂不发送 */
		/*按limit切割成多个skb*/
		if (skb->len > limit &&
		    unlikely(tso_fragment(sk, skb, limit, mss_now, gfp)))
			break;

		TCP_SKB_CB(skb)->when = tcp_time_stamp;
		/*发送，如果包被qdisc丢了，则退出循环，不继续发送了*/
		if (unlikely(tcp_transmit_skb(sk, skb, 1, gfp)))
			break;

repair:
		/*更新sk_send_head和packets_out*/
		tcp_event_new_data_sent(sk, skb);
		tcp_minshall_update(tp, mss_now, skb);
		sent_pkts += tcp_skb_pcount(skb);

		if (push_one)
			break;
	}

	if (likely(sent_pkts)) {
		if (tcp_in_cwnd_reduction(sk))
			tp->prr_out += sent_pkts;

		/* Send one loss probe per tail loss episode. */
		if (push_one != 2)
			tcp_schedule_loss_probe(sk);
		tcp_cwnd_validate(sk);
		return false;
	}
	return (push_one == 2) || (!tp->packets_out && tcp_send_head(sk));
}
```

其中tcp_init_tso_segs会设置skb的gso信息后文分析。我们看到tcp_write_xmit 会调用tso_fragment进行“tcp分段”。而分段的条件是skb->len > limit。这里的关键就是limit的值，我们看到在tso_segs > 1时，也就是开启gso的时候，limit的值是由tcp_mss_split_point得到的，也就是min(skb->len, window)，即发送窗口允许的最大值。在没有开启gso时limit就是当前的mss。

##### tcp_init_tso_segs

```c
/* Initialize TSO state of a skb.
 * This must be invoked the first time we consider transmitting
 * SKB onto the wire.
 */
static int tcp_init_tso_segs(const struct sock *sk, struct sk_buff *skb,
			     unsigned int mss_now)
{
	int tso_segs = tcp_skb_pcount(skb);

	if (!tso_segs || (tso_segs > 1 && tcp_skb_mss(skb) != mss_now)) {
		tcp_set_skb_tso_segs(sk, skb, mss_now);
		tso_segs = tcp_skb_pcount(skb);
	}
	return tso_segs;
}
```

tcp_write_xmit最后会调用ip_queue_xmit发送skb，进入ip层。

流程图如下：

![GSO-TSO流程图](/images/网络RPS-RFS-GSO-GRO等功能释义/GSO-TSO流程图.png)

### UFO

UFO(UDP fragmentation offload)，UPD的offload。

GRE 及 VXLAN接口初始化的时候，会置此位。

```c
/* Initialize the device structure. */
static void vxlan_setup(struct net_device *dev)
{
	……
	dev->features   |= NETIF_F_GSO_SOFTWARE;
	……
}
```

还有其他driver也支持，例如 macvlan、tun、virtnet等。

### LRO和GRO

当网卡收到很多碎片包的时候，LRO (Large Receive Offload)可以辅助自动组合成一段较大的数据，一次性提交给 OS处理。

GRO(Generic Receive Offload)，比 LSO更通用，自动检测网卡支持特性，支持分包则直接发给网卡，否则先分包后发给网卡。

driver macvlan支持GRO。

以上功能大多可以通过 ethtool -K 开启。查看网卡 offload功能：

```shell
# ethtool -k em1 
Features for em1:
rx-checksumming: on
tx-checksumming: on
        tx-checksum-ipv4: off [fixed]
        tx-checksum-ip-generic: on
        tx-checksum-ipv6: off [fixed]
        tx-checksum-fcoe-crc: on [fixed]
        tx-checksum-sctp: on
scatter-gather: on
        tx-scatter-gather: on
        tx-scatter-gather-fraglist: off [fixed]
tcp-segmentation-offload: on
        tx-tcp-segmentation: on
        tx-tcp-ecn-segmentation: off [fixed]
        tx-tcp6-segmentation: on
        tx-tcp-mangleid-segmentation: off
udp-fragmentation-offload: off [fixed]
generic-segmentation-offload: on
generic-receive-offload: on
large-receive-offload: off
rx-vlan-offload: on
tx-vlan-offload: on
ntuple-filters: off
receive-hashing: on
highdma: on [fixed]
rx-vlan-filter: on
vlan-challenged: off [fixed]
tx-lockless: off [fixed]
netns-local: off [fixed]
tx-gso-robust: off [fixed]
tx-fcoe-segmentation: on [fixed]
tx-gre-segmentation: on
tx-ipip-segmentation: on
tx-sit-segmentation: on
tx-udp_tnl-segmentation: on
tx-mpls-segmentation: off [fixed]
fcoe-mtu: off [fixed]
tx-nocache-copy: off
loopback: off [fixed]
rx-fcs: off [fixed]
rx-all: off
tx-vlan-stag-hw-insert: off [fixed]
rx-vlan-stag-hw-parse: off [fixed]
rx-vlan-stag-filter: off [fixed]
busy-poll: on [fixed]
tx-gre-csum-segmentation: on
tx-udp_tnl-csum-segmentation: on
tx-gso-partial: on
tx-sctp-segmentation: off [fixed]
l2-fwd-offload: off
hw-tc-offload: off [fixed]
```

网卡支持特性比较多，值得继续研究。

## 总结

**接收侧**：

**RSS**是网卡驱动支持的多队列属性，队列通过中断绑定到不同的CPU，以实现流量负载。

**RPS**是以软件形式实现流量在不同CPU之间的分发。

**RFS**是报文需要在用户态处理时，保证处理的CPU与内核相同，防止缓存miss而导致的消耗。

LRO 和 GRO，多个报文组成一个大包上送协议栈。

**发送侧**：

**XPS** 软件多队列发送。

**TSO**是利用网卡来对大数据包进行自动分段，降低CPU负载的技术。

**GSO**是协议栈分段功能。分段之前判断是否支持TSO，支持则推迟到网卡分段。 **如果TSO开启，GSO会自动开启。**

**UFO**类似TSO，不过只针对UDP报文。

## 优秀资料

[Linux多队列网卡的硬件的实现详解](http://www.qingpingshan.com/pc/fwq/235534.html)

[Linux系统中RPS/RFS介绍](http://blog.chinaunix.net/uid-20788636-id-4838269.html)

[Linux中rps/rfs的原理及实现](https://titenwang.github.io/2017/07/09/implementation-of-rps-and-rfs/)

[网卡TSO/GSO/LRO/GRO简要介绍](http://seitran.com/2015/04/13/01-gso-gro-lro/)

[Linux TCP GSO 和 TSO 实现](http://blog.jobbole.com/111668/)

[TCP发送源码学习(1)--tcp_sendmsg](http://blog.chinaunix.net/uid-9543173-id-3546189.html)