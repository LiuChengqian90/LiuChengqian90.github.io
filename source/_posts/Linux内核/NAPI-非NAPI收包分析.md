---
title: NAPI/非NAPI收包分析
date: 2018-01-07 21:48:00
categories: Linux内核
tags:
  - NAPI
typora-root-url: ../../../source
---

基于 kernel 3.10.105 分析。

## softnet_data

每个CPU都有队列，用来接收进来的帧。因为每个CPU都有其数据结构用来处理入口和出口流量，因此，不同CPU之间没必要使用上锁机制。此队列的数据结构softnet_data定义在`include/linux/netdevice.h`中，如下所示：

```C
struct softnet_data {  	
	struct Qdisc		*output_queue;			/*出口规则队列*/
	struct Qdisc		**output_queue_tailp;
	struct list_head	poll_list;				/*双向列表，其中是设备有数据要传输*/
	struct sk_buff		*completion_queue;		/*缓冲区列表，其中的缓冲已成功传输，因此可以释放掉*/
	struct sk_buff_head	process_queue;			/*要处理的包(skb)*/

	/* stats */
	unsigned int		processed;				/*已处理的包(skb)*/
  	/*如果`ksoftirq`进程在cpu-time启动之前无法处理网络设备环形缓冲区中所有可用的数据包，则会更新`time_squeeze`*/
	unsigned int		time_squeeze;			
	unsigned int		cpu_collision;			/*发送数据时，发包队列被其他CPU占用则更新此字段*/
	unsigned int		received_rps;			/*RPS收到的包*/

#ifdef CONFIG_RPS
	struct softnet_data	*rps_ipi_list;			/*本地RPS队列*/
	
	struct call_single_data	csd ____cacheline_aligned_in_smp;
  	/*下一个要处理的 data，和rps_ipi_list 主要应用于rps_ipi_queued函数 和 	net_rps_action_and_irq_enable 函数。*/
	struct softnet_data	*rps_ipi_next;			
	unsigned int		cpu;					/*字段所属cpu*/
  	/*RPS队列头尾计数*/
	unsigned int		input_queue_head;
	unsigned int		input_queue_tail;
#endif
	unsigned int		dropped;				/*丢包计数*/
	struct sk_buff_head	input_pkt_queue;		/*保存进来的帧*/
	struct napi_struct	backlog;				/*虚拟的NAPI设备*/
};
```

### 初始化

初始化在文件`net/core/dev.c`的函数`net_dev_init`中：

```C
static int __init net_dev_init(void)
{
  	……
	for_each_possible_cpu(i) {
		struct softnet_data *sd = &per_cpu(softnet_data, i);

		memset(sd, 0, sizeof(*sd));
		skb_queue_head_init(&sd->input_pkt_queue);
		skb_queue_head_init(&sd->process_queue);
		sd->completion_queue = NULL;
		INIT_LIST_HEAD(&sd->poll_list);
		sd->output_queue = NULL;
		sd->output_queue_tailp = &sd->output_queue;
      	/*RPS相关*/
#ifdef CONFIG_RPS
		sd->csd.func = rps_trigger_softirq;
		sd->csd.info = sd;
		sd->csd.flags = 0;
		sd->cpu = i;
#endif
		sd->backlog.poll = process_backlog;
		sd->backlog.weight = weight_p;
		sd->backlog.gro_list = NULL;
		sd->backlog.gro_count = 0;
	}
	……
}
```

## 非NAPI

以`vortex_rx`为例。

`vortex_interrupt`为中断处理函数，收包调用`vortex_rx`。

### vortex_rx

```c
static int vortex_rx(struct net_device *dev)
{
	struct vortex_private *vp = netdev_priv(dev);
	void __iomem *ioaddr = vp->ioaddr;
	int i;
	short rx_status;
		……
			/* The packet length: up to 4.5K!. */
			int pkt_len = rx_status & 0x1fff;
			struct sk_buff *skb;
			/*skb空间分配*/
			skb = netdev_alloc_skb(dev, pkt_len + 5);
			……
              	……
				skb->protocol = eth_type_trans(skb, dev);
				netif_rx(skb);
				dev->stats.rx_packets++;
          ……
}
```

### netif_rx

非NAPI处理报文上半部函数为`netif_rx`，代码如下：

```C
int netif_rx(struct sk_buff *skb)
{
	int ret;
  
	if (netpoll_rx(skb))
		return NET_RX_DROP;
	/*检查时间戳*/
	net_timestamp_check(netdev_tstamp_prequeue, skb);
	trace_netif_rx(skb);
#ifdef CONFIG_RPS
	if (static_key_false(&rps_needed)) {
		struct rps_dev_flow voidflow, *rflow = &voidflow;
		int cpu;

		preempt_disable();
		rcu_read_lock();

		cpu = get_rps_cpu(skb->dev, skb, &rflow);
		if (cpu < 0)
			cpu = smp_processor_id();
		ret = enqueue_to_backlog(skb, cpu, &rflow->last_qtail);
		rcu_read_unlock();
		preempt_enable();
	} else
#endif
	{
		unsigned int qtail;
      	/*入队*/
      	/*get_cpu 禁止抢占--返回当前cpu id*/
		ret = enqueue_to_backlog(skb, get_cpu(), &qtail);
		put_cpu();
	}
	return ret;
}
```

```C
static int enqueue_to_backlog(struct sk_buff *skb, int cpu,
			      unsigned int *qtail)
{
	struct softnet_data *sd;
	unsigned long flags;

	sd = &per_cpu(softnet_data, cpu);
	local_irq_save(flags);

	rps_lock(sd);
  	/*空间充足*/
	if (skb_queue_len(&sd->input_pkt_queue) <= netdev_max_backlog) {
      	/*不为0，说明设备已得到调度，skb入队*/
		if (skb_queue_len(&sd->input_pkt_queue)) {
enqueue:
			__skb_queue_tail(&sd->input_pkt_queue, skb);
			input_queue_tail_incr_save(sd, qtail);
			rps_unlock(sd);
			local_irq_restore(flags);
			return NET_RX_SUCCESS;
		}
		/*本CPU默认的NAPI加入要处理的poll_list队列；
		之后触发软中断，但是由于处于硬中断中，所以软中断暂时失效，所以继续 enqueue
		*/
		if (!__test_and_set_bit(NAPI_STATE_SCHED, &sd->backlog.state)) {
			if (!rps_ipi_queued(sd))
				____napi_schedule(sd, &sd->backlog);
		}
		goto enqueue;
	}

	sd->dropped++;
	rps_unlock(sd);

	local_irq_restore(flags);

	atomic_long_inc(&skb->dev->rx_dropped);
	kfree_skb(skb);
	return NET_RX_DROP;
}
```

在下半部处理函数 `net_rx_action`中，

```C
if (test_bit(NAPI_STATE_SCHED, &n->state)) {
			work = n->poll(n, weight);
			trace_napi_poll(n);
		}
```

会调用CPU默认处理函数`process_backlog`。

### process_backlog

```C
/*quota为本次要处理的包个数*/
static int process_backlog(struct napi_struct *napi, int quota)
{
	int work = 0;
	struct softnet_data *sd = container_of(napi, struct softnet_data, backlog);

#ifdef CONFIG_RPS
	/* Check if we have pending ipi, its better to send them now,
	 * not waiting net_rx_action() end.
	 */
	if (sd->rps_ipi_list) {
		local_irq_disable();
		net_rps_action_and_irq_enable(sd);
	}
#endif
  	/*weight_p 为全局变量，默认为64*/
	napi->weight = weight_p;
	local_irq_disable();
  	/*已处理的小于请求处理，则继续循环*/
	while (work < quota) {
		struct sk_buff *skb;
		unsigned int qlen;
		/*处理队列不为空，则继续；第一次为空*/
         /*数据包到来时首先填充input_pkt_queue，而在处理时从process_queue中取，
         因此首次处理process_queue必定为空。
         如果input_pkt_queue不为空，则把其中的数据包迁移到process_queue中，然后继续处理，减少锁冲突。
         */
		while ((skb = __skb_dequeue(&sd->process_queue))) {
			rcu_read_lock();
			local_irq_enable();
          	/*每个包循环上送协议栈*/
			__netif_receive_skb(skb);
			rcu_read_unlock();
			local_irq_disable();
          	/*增加处理head计数*/
			input_queue_head_incr(sd);
			if (++work >= quota) {
				local_irq_enable();
				return work;
			}
		}
      	/*获取接收队列包数量并将其插入process_queue队列*/
		rps_lock(sd);
		qlen = skb_queue_len(&sd->input_pkt_queue);
		if (qlen)
			skb_queue_splice_tail_init(&sd->input_pkt_queue,
						   &sd->process_queue);
		/*为真说明本次处理肯定能处理完成，因此直接del队列即可*/
		if (qlen < quota - work) {
			list_del(&napi->poll_list);
			napi->state = 0;
			quota = work + qlen;
		}
		rps_unlock(sd);
	}
	local_irq_enable();

	return work;
}
```

### 小结

非NAPI是一次中断一次上送，流量突增时，则中断增多，CPU处理时间变少。

## NAPI

NAPI混合了中断事件和轮询，而不使用纯粹的中断事件驱动模型。如果接收到新帧时，内核还没完成处理前几个帧的工作，驱动程序就没必要产生其他中断事件：让内核一直处理设备输入队列中的数据会比较简单（该设备中断功能关闭），然后当队列为空时，再重新开启中断功能。

### net_device内相关结构

```C
struct list_head	napi_list;
```

初始化函数为

```c
struct net_device *alloc_netdev_mqs(int sizeof_priv, const char *name,
		void (*setup)(struct net_device *),
		unsigned int txqs, unsigned int rxqs)
{
  ……
  INIT_LIST_HEAD(&dev->napi_list);
  ……
}
```

在`netif_napi_add`中更改

```C
void netif_napi_add(struct net_device *dev, struct napi_struct *napi,
		    int (*poll)(struct napi_struct *, int), int weight)
{
  	/*初始化napi信息*/
	INIT_LIST_HEAD(&napi->poll_list);
	napi->gro_count = 0;
	napi->gro_list = NULL;
	napi->skb = NULL;
  	/*poll为napi处理函数，一般由驱动而定*/
	napi->poll = poll;
	if (weight > NAPI_POLL_WEIGHT)
		pr_err_once("netif_napi_add() called with weight %d on device %s\n",
			    weight, dev->name);
  	/*处理包数量*/
	napi->weight = weight;
  	/*dev_list 插入 dev->napi_list链表*/
	list_add(&napi->dev_list, &dev->napi_list);
	napi->dev = dev;
#ifdef CONFIG_NETPOLL
	spin_lock_init(&napi->poll_lock);
	napi->poll_owner = -1;
#endif
	set_bit(NAPI_STATE_SCHED, &napi->state);
}
```

 而`netif_napi_add`一般在驱动函数中调用，这里以`ixgb`为例：

```c
/*设备初始化例程*/
static int
ixgb_probe(struct pci_dev *pdev, const struct pci_device_id *ent)
{
	……
    /*net_device结构分配*/
	netdev = alloc_etherdev(sizeof(struct ixgb_adapter));
  	/*adapter为设备私有数据（适配器）*/
  	netdev->netdev_ops = &ixgb_netdev_ops;
	ixgb_set_ethtool_ops(netdev);
	netdev->watchdog_timeo = 5 * HZ;
	adapter = netdev_priv(netdev);
  	……
    /*adapter->napi 初始化并加入设备napi_list链表*/
    /*weight 为 64*/
	netif_napi_add(netdev, &adapter->napi, ixgb_clean, 64);
  	……
}
```

### ixgb_netdev_ops

```C
static const struct net_device_ops ixgb_netdev_ops = {
	.ndo_open 		= ixgb_open,
	.ndo_stop		= ixgb_close,
	.ndo_start_xmit		= ixgb_xmit_frame,
	.ndo_get_stats		= ixgb_get_stats,
	.ndo_set_rx_mode	= ixgb_set_multi,
	.ndo_validate_addr	= eth_validate_addr,
	.ndo_set_mac_address	= ixgb_set_mac,
	.ndo_change_mtu		= ixgb_change_mtu,
	.ndo_tx_timeout		= ixgb_tx_timeout,
	.ndo_vlan_rx_add_vid	= ixgb_vlan_rx_add_vid,
	.ndo_vlan_rx_kill_vid	= ixgb_vlan_rx_kill_vid,
#ifdef CONFIG_NET_POLL_CONTROLLER
	.ndo_poll_controller	= ixgb_netpoll,
#endif
	.ndo_fix_features       = ixgb_fix_features,
	.ndo_set_features       = ixgb_set_features,
};
```

其中，驱动open函数为 `ixgb_open`。

### ixgb_open

```c
/*
此函数在设备active时调用(系统 IFF_UP标志)；
分配发送和接收资源；
分配中断号；
设置watchdog timer等
*/
static int
ixgb_open(struct net_device *netdev)
{
	struct ixgb_adapter *adapter = netdev_priv(netdev);
	int err;
	err = ixgb_setup_tx_resources(adapter);
	if (err)
		goto err_setup_tx;
	netif_carrier_off(netdev);
	err = ixgb_setup_rx_resources(adapter);
	if (err)
		goto err_setup_rx;

	err = ixgb_up(adapter);
	if (err)
		goto err_up;
	netif_start_queue(netdev);
	return 0;
  	……
}
```

#### ixgb_setup_rx_resources

函数`ixgb_setup_rx_resources`是为收包分配资源的函数。

主要数据结构为 

```C
/*封装一个指向套接字缓冲区的指针，所以一个DMA句柄可以和缓冲区一起存储*/
struct ixgb_buffer {
	struct sk_buff *skb;
	dma_addr_t dma;
	unsigned long time_stamp;
	u16 length;
	u16 next_to_watch;
	u16 mapped_as_page;
};
struct ixgb_desc_ring {
	void *desc;							/* 指向描述符ring的指针 */
	dma_addr_t dma;						/* 描述符环的物理地址；dna_addr_t 32位系统为u32 */
	unsigned int size;					/* 描述符ring的长度，以字节为单位 */
	unsigned int count;					/* ring之后描述符的数量 */
	unsigned int next_to_use;			/* 下一个关联缓冲区的描述符 */
	unsigned int next_to_clean;			/* 下一个要处理的描述符，需要检查DD状态位 */	
	struct ixgb_buffer *buffer_info;	/* 缓冲区信息结构数组 */
};
/*单个接收描述符的布局。 控制器假定这个结构被打包成16个字节，对大多数编译器来说这是一个安全的假设。 
但是，一些编译器可能会在字段之间插入填充，在这种情况下，必须以某种特定于编译器的方式打包结构。
*/
struct ixgb_rx_desc {
	__le64 buff_addr;
	__le16 length;
	__le16 reserved;
	u8 status;
	u8 errors;
	__le16 special;
};
```

```C
int
ixgb_setup_rx_resources(struct ixgb_adapter *adapter)
{
	struct ixgb_desc_ring *rxdr = &adapter->rx_ring;
	struct pci_dev *pdev = adapter->pdev;
	int size;
	/*一次缓存的buffer个数*/
	size = sizeof(struct ixgb_buffer) * rxdr->count;
  	/*vzalloc 虚拟连续，物理可以不连续*/
	rxdr->buffer_info = vzalloc(size);
	if (!rxdr->buffer_info)
		return -ENOMEM;
	/*ixgb_rx_desc 描述符分配，4K对齐*/
	rxdr->size = rxdr->count * sizeof(struct ixgb_rx_desc);
	rxdr->size = ALIGN(rxdr->size, 4096);
  	/*desc为分配的虚拟地址，rxdr->size为大小，而rxdr->dma为其物理地址！*/
	rxdr->desc = dma_alloc_coherent(&pdev->dev, rxdr->size, &rxdr->dma,
					GFP_KERNEL);

	if (!rxdr->desc) {
		vfree(rxdr->buffer_info);
		return -ENOMEM;
	}
  	/*初始化*/
	memset(rxdr->desc, 0, rxdr->size);
	rxdr->next_to_clean = 0;
	rxdr->next_to_use = 0;
	return 0;
}
```

完成之后的内存如下：

![ixgb_desc_ring](/images/NAPI-非NAPI收包分析/ixgb_desc_ring.png)

在`ixgb_alloc_rx_buffers`中完成skb到DMA的流式映射。

`ixgb_setup_tx_resources`与`ixgb_setup_tx_resources`类似。

### ixgb_up

```C
int
ixgb_up(struct ixgb_adapter *adapter)
{
	struct net_device *netdev = adapter->netdev;
	int err, irq_flags = IRQF_SHARED;
  	/*驱动层最大MTU为 netdev->mut(一般为1500) + 14(二层头)+ 4 (vlan)*/
	int max_frame = netdev->mtu + ENET_HEADER_SIZE + ENET_FCS_LENGTH;
	struct ixgb_hw *hw = &adapter->hw;
  	……
  	/*分配中断号，flags为SHARED*/
	err = request_irq(adapter->pdev->irq, ixgb_intr, irq_flags,
	                  netdev->name, netdev);
  	……
    /*开启设备；
    使能NAPI；
    使能中断*/
	clear_bit(__IXGB_DOWN, &adapter->flags);
	napi_enable(&adapter->napi);
	ixgb_irq_enable(adapter);
	netif_wake_queue(netdev);
	mod_timer(&adapter->watchdog_timer, jiffies);
	return 0;
}
```

### ixgb_intr

```c
static irqreturn_t
ixgb_intr(int irq, void *data)
{
	struct net_device *netdev = data;
	struct ixgb_adapter *adapter = netdev_priv(netdev);
	struct ixgb_hw *hw = &adapter->hw;
	u32 icr = IXGB_READ_REG(hw, ICR);
	……
    /*判断NAPI是否使能*/
	if (napi_schedule_prep(&adapter->napi)) {
		/*禁中断并处理NAPI*/
		IXGB_WRITE_REG(&adapter->hw, IMC, ~0);
		__napi_schedule(&adapter->napi);
	}
	return IRQ_HANDLED;
}
```

### __napi_schedule

```C
void __napi_schedule(struct napi_struct *n)
{
	unsigned long flags;
	local_irq_save(flags);
	____napi_schedule(&__get_cpu_var(softnet_data), n);
	local_irq_restore(flags);
}
```

```c 
static inline void ____napi_schedule(struct softnet_data *sd,
				     struct napi_struct *napi)
{
  	/*设备的poll_list加入到CPU的链表中并触发软中断*/
	list_add_tail(&napi->poll_list, &sd->poll_list);
	__raise_softirq_irqoff(NET_RX_SOFTIRQ);
}
```

### net_rx_action

```c
static void net_rx_action(struct softirq_action *h)
{
	struct softnet_data *sd = &__get_cpu_var(softnet_data);
	unsigned long time_limit = jiffies + 2;
  	/*netdev_budget 默认值为 300*/
	int budget = netdev_budget;
	void *have;

	local_irq_disable();
	while (!list_empty(&sd->poll_list)) {
		struct napi_struct *n;
		int work, weight;
		/* 窗口耗尽 或 时间过长则重新触发软中断 */
		if (unlikely(budget <= 0 || time_after_eq(jiffies, time_limit)))
			goto softnet_break;

		local_irq_enable();
		/*中断启用，此访问依然安全，
		  因为中断只能新条目加入此列表尾部，且只有在 ->poll中才能删除条目
		*/
      	/*获取第一个poll_list*/
		n = list_first_entry(&sd->poll_list, struct napi_struct, poll_list);
		have = netpoll_poll_lock(n);
		weight = n->weight;

		/* NAPI_STATE_SCHED测试是为了避免与netpoll的poll_napi()竞争。*/
		work = 0;
		if (test_bit(NAPI_STATE_SCHED, &n->state)) {
          	/*调用处理函数，继续以ixgb为例分析*/
			work = n->poll(n, weight);
			trace_napi_poll(n);
		}

		WARN_ON_ONCE(work > weight);
		budget -= work;
		local_irq_disable();

		/*已处理的与预期相符则表示包太多；
		 */
		if (unlikely(work == weight)) {
			if (unlikely(napi_disable_pending(n))) {
				local_irq_enable();
				napi_complete(n);
				local_irq_disable();
			} else {
              	/*有gro则开始flush gro的包*/
				if (n->gro_list) {
					/*If HZ < 1000, flush all packets.
					 */
					local_irq_enable();
					napi_gro_flush(n, HZ >= 1000);
					local_irq_disable();
				}
				list_move_tail(&n->poll_list, &sd->poll_list);
			}
		}

		netpoll_poll_unlock(have);
	}
out:
	net_rps_action_and_irq_enable(sd);
#ifdef CONFIG_NET_DMA
	/*
	 * There may not be any more sk_buffs coming right now, so push
	 * any pending DMA copies to hardware
	 */
	dma_issue_pending_all();
#endif

	return;

softnet_break:
	sd->time_squeeze++;
	__raise_softirq_irqoff(NET_RX_SOFTIRQ);
	goto out;
}
```

### ixgb_clean

```C
static int
ixgb_clean(struct napi_struct *napi, int budget)
{
	struct ixgb_adapter *adapter = container_of(napi, struct ixgb_adapter, napi);
	int work_done = 0;
	/*传输完成后回收资源*/
	ixgb_clean_tx_irq(adapter);
  	/*向网络堆栈发送收到的数据*/
	ixgb_clean_rx_irq(adapter, &work_done, budget);
	/* 说明包已经处理完，则退出napi模式 */
	if (work_done < budget) {
		napi_complete(napi);
		if (!test_bit(__IXGB_DOWN, &adapter->flags))
          	/*开启中断，驱动继续收包*/
			ixgb_irq_enable(adapter);
	}
	return work_done;
}
```

### ixgb_clean_rx_irq

```C
static bool
ixgb_clean_rx_irq(struct ixgb_adapter *adapter, int *work_done, int work_to_do)
{
	struct ixgb_desc_ring *rx_ring = &adapter->rx_ring;
	struct net_device *netdev = adapter->netdev;
	struct pci_dev *pdev = adapter->pdev;
	struct ixgb_rx_desc *rx_desc, *next_rxd;
	struct ixgb_buffer *buffer_info, *next_buffer, *next2_buffer;
	u32 length;
	unsigned int i, j;
	int cleaned_count = 0;
	bool cleaned = false;
  	/*从上次处理的点开始处理，默认为0*/
	i = rx_ring->next_to_clean;
	rx_desc = IXGB_RX_DESC(*rx_ring, i);
	buffer_info = &rx_ring->buffer_info[i];
	/*描述符状态为IXGB_RX_DESC_STATUS_DD时处理，此状态含义还不清楚*/
	while (rx_desc->status & IXGB_RX_DESC_STATUS_DD) {
		struct sk_buff *skb;
		u8 status;
		/*已处理的包大于指定处理的包则break*/
		if (*work_done >= work_to_do)
			break;

		(*work_done)++;
		rmb();	/* read descriptor and rx_buffer_info after status DD */
      	/*status、skb取到临时变量*/
		status = rx_desc->status;
		skb = buffer_info->skb;
		buffer_info->skb = NULL;
		/*prefetch预热内存，下次读取时比较容易命中*/
		prefetch(skb->data - NET_IP_ALIGN);
		/*下次要处理的包到ring的尾则reset*/
		if (++i == rx_ring->count)
			i = 0;
		next_rxd = IXGB_RX_DESC(*rx_ring, i);
		prefetch(next_rxd);
		/*多预热一次？*/
		j = i + 1;
		if (j == rx_ring->count)
			j = 0;
		next2_buffer = &rx_ring->buffer_info[j];
		prefetch(next2_buffer);

		next_buffer = &rx_ring->buffer_info[i];

		cleaned = true;
		cleaned_count++;
		/*skb已取出，则unmap DMA*/
		dma_unmap_single(&pdev->dev,
				 buffer_info->dma,
				 buffer_info->length,
				 DMA_FROM_DEVICE);
		buffer_info->dma = 0;

		length = le16_to_cpu(rx_desc->length);
		rx_desc->length = 0;
		/*skb消耗了多个缓冲区*/
		if (unlikely(!(status & IXGB_RX_DESC_STATUS_EOP))) {
			pr_debug("Receive packet consumed multiple buffers length<%x>\n",
				 length);
			dev_kfree_skb_irq(skb);
			goto rxdesc_done;
		}
		……
        /*函数作用不太理解--组包？TBD*/
		ixgb_check_copybreak(netdev, buffer_info, length, &skb);
		/* Good Receive */
		skb_put(skb, length);
		/* Receive Checksum Offload */
		ixgb_rx_checksum(adapter, rx_desc, skb);
		/*更新协议、vlan然后上送协议栈*/
		skb->protocol = eth_type_trans(skb, netdev);
		if (status & IXGB_RX_DESC_STATUS_VP)
			__vlan_hwaccel_put_tag(skb, htons(ETH_P_8021Q),
				       le16_to_cpu(rx_desc->special));

		netif_receive_skb(skb);
      	……
}
```

### 小结

NAPI 是中断时利用__napi_schedule 将设备poll_list加到cpu的处理链表，之后唤醒下半部，下半部继续调用驱动层的处理函数poll，其中一次处理多个skb，而非传统的一个skb进行一次中断。达到了网络性能的提升。
