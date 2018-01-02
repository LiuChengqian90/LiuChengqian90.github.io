---
title: Linux对vxlan的支持
date: 2017-12-28 15:36:16
categories: Linux内核
tags:
  - VXLAN
---

 此文基于内核 3.10.105 分析linux内核中vxlan接口流量路径。主要是对报文流程内函数进行分析，所以代码居多。

## 基本报文流程回顾

已经知道vxlan是 MAC IN UDP中的封装，因此，在解封装之前，一切按照原有流程走，在此复习一下（驱动层的数据处理这次不再解析，直接从__netif_receive_skb_core开始）：

1. __netif_receive_skb_core

   ```c
   /*type，二层封装内的协议，IP为 0x0800*/
   type = skb->protocol;
   /*获取协议注册的入口函数，ip为 ip_rcv，声明的变量为 ip_packet_type*/
   list_for_each_entry_rcu(ptype,
                           &ptype_base[ntohs(type) & PTYPE_HASH_MASK], list) {
     if (ptype->type == type &&
         (ptype->dev == null_or_dev || ptype->dev == skb->dev ||
          ptype->dev == orig_dev)) {
       if (pt_prev)
         ret = deliver_skb(skb, pt_prev, orig_dev);
       pt_prev = ptype;
     }
   }
   ```

2. ip_rcv

   此函数只是对报文进行可靠性验证，最后到 钩子函数 'NF_HOOK'。

   钩子函数中就是配置的netfilter，通过验证就会直接进入函数 'ip_rcv_finish'。

3. ip_rcv_finish

   ```c
   /*sysctl_ip_early_demux 是二进制值，该值用于对发往本地数据包的优化。
   当前仅对建立连接的套接字起作用。*/
   if (sysctl_ip_early_demux && !skb_dst(skb) && skb->sk == NULL) {
   		const struct net_protocol *ipprot;
   		int protocol = iph->protocol;

   		ipprot = rcu_dereference(inet_protos[protocol]);
   		if (ipprot && ipprot->early_demux) {
   			ipprot->early_demux(skb);
   			/* must reload iph, skb->head might have changed */
   			iph = ip_hdr(skb);
   		}
   	}
   ```

   ```c
   /*这一部分时查找路由，判断是local in还是 forwarding。本次分析按照 local in分析*/
   if (!skb_dst(skb)) {
   		int err = ip_route_input_noref(skb, iph->daddr, iph->saddr,
   					       iph->tos, skb->dev);
   		if (unlikely(err)) {
   			if (err == -EXDEV)
   				NET_INC_STATS_BH(dev_net(skb->dev),
   						 LINUX_MIB_IPRPFILTER);
   			goto drop;
   		}
   	}
   ……
   	/*按照local in分析，则此处相当于调用 ip_local_deliver
   	（可深入 查找路由函数，里面有函数指针赋值）*/
   	return dst_input(skb);
   ```

4. ip_local_deliver

   钩子函数检测，不深入，直接到最后。

5. ip_local_deliver_finish

   ```c
   ipprot = rcu_dereference(inet_protos[protocol]);
   ……
   			ret = ipprot->handler(skb);
   ……			
   ```

   到了传输层注册的入口函数。UDP入口函数为 'udp_rcv'。

6. __udp4_lib_rcv

   ```C
   /*根据源目端口号及IP查找 插口*/
   sk = __udp4_lib_lookup_skb(skb, uh->source, uh->dest, udptable);
   ……
   		/*进入udp队列收包流程*/
   		int ret = udp_queue_rcv_skb(sk, skb);
   ……
   ```

7. udp_queue_rcv_skb

   ```c
   /*插口如果是封装类型，vxlan等，则进入封装处理入口，下面开始分析vxlan部分代码*/
   encap_rcv = ACCESS_ONCE(up->encap_rcv);
   if (skb->len > sizeof(struct udphdr) && encap_rcv != NULL) {
       int ret;

       ret = encap_rcv(sk, skb);
       if (ret <= 0) {
       UDP_INC_STATS_BH(sock_net(sk),
       UDP_MIB_INDATAGRAMS,
       is_udplite);
       return -ret;
     }
   }
   ```

## vxlan 模块初始化

1. vxlan_init_module

   ```c
   rc = register_pernet_device(&vxlan_net_ops);
   ```

   ```c
   static struct pernet_operations vxlan_net_ops = {
   	.init = vxlan_init_net,
   	.exit = vxlan_exit_net,
   	.id   = &vxlan_net_id,
   	.size = sizeof(struct vxlan_net),
   };
   ```

2. register_pernet_device内部执行init函数。此处主要看收包注册函数。

   ```c
   /* Disable multicast loopback */
   inet_sk(sk)->mc_loop = 0;

   /* Mark socket as an encapsulation socket. */
   udp_sk(sk)->encap_type = 1;
   udp_sk(sk)->encap_rcv = vxlan_udp_encap_recv;
   ```


## vxlan模块收包函数

1. vxlan_udp_encap_recv

    ```c
       static int vxlan_udp_encap_recv(struct sock *sk, struct sk_buff *skb)
       {
    	struct iphdr *oip;
    	struct vxlanhdr *vxh;
    	struct vxlan_dev *vxlan;
    	struct pcpu_tstats *stats;
    	__u32 vni;
    	int err;

    	/*去掉UDP头*/
    	__skb_pull(skb, sizeof(struct udphdr));

    	/* 判断是否有 vxlan 头*/
    	if (!pskb_may_pull(skb, sizeof(struct vxlanhdr)))
    		goto error;

    	/*如果flag不是vxlan flag表示不是vxlan 封装
    	或
    	vx_vni后8位有值，也表示错误，因为之后会 右移8位，所以低8位完全没有意义*/
    	vxh = (struct vxlanhdr *) skb->data;
    	if (vxh->vx_flags != htonl(VXLAN_FLAGS) ||
    	    (vxh->vx_vni & htonl(0xff))) {
    		netdev_dbg(skb->dev, "invalid vxlan flags=%#x vni=%#x\n",
    			   ntohl(vxh->vx_flags), ntohl(vxh->vx_vni));
    		goto error;
    	}

     	/*去掉vxlan 头*/
    	__skb_pull(skb, sizeof(struct vxlanhdr));

    	/* 本地 未定义 vni 则丢包*/
    	vni = ntohl(vxh->vx_vni) >> 8;
    	vxlan = vxlan_find_vni(sock_net(sk), vni);
    	if (!vxlan) {
    		netdev_dbg(skb->dev, "unknown vni %d\n", vni);
    		goto drop;
    	}

     	/*解析original l2 frame，没有l2头则丢包*/
    	if (!pskb_may_pull(skb, ETH_HLEN)) {
    		vxlan->dev->stats.rx_length_errors++;
    		vxlan->dev->stats.rx_errors++;
    		goto drop;
    	}
    	/*重置skb mac数据，因为解包了*/
    	skb_reset_mac_header(skb);

    	/* Re-examine inner Ethernet packet */
    	oip = ip_hdr(skb);
    	skb->protocol = eth_type_trans(skb, vxlan->dev);
    	
    	if (compare_ether_addr(eth_hdr(skb)->h_source,
    			       vxlan->dev->dev_addr) == 0)
    		goto drop;

     	/*学习报文记录到本地 vxlan fdb表*/
    	if ((vxlan->flags & VXLAN_F_LEARN) &&
    	    vxlan_snoop(skb->dev, oip->saddr, eth_hdr(skb)->h_source))
    		goto drop;

     	/*更改skb收包接口*/
    	__skb_tunnel_rx(skb, vxlan->dev);
    	skb_reset_network_header(skb);

    	if (skb->ip_summed != CHECKSUM_UNNECESSARY || !skb->encapsulation ||
    	    !(vxlan->dev->features & NETIF_F_RXCSUM))
    		skb->ip_summed = CHECKSUM_NONE;

    	skb->encapsulation = 0;

    	err = IP_ECN_decapsulate(oip, skb);
    	if (unlikely(err)) {
    		if (log_ecn_error)
    			net_info_ratelimited("non-ECT from %pI4 with TOS=%#x\n",
    					     &oip->saddr, oip->tos);
    		if (err > 1) {
    			++vxlan->dev->stats.rx_frame_errors;
    			++vxlan->dev->stats.rx_errors;
    			goto drop;
    		}
    	}

    	stats = this_cpu_ptr(vxlan->dev->tstats);
    	u64_stats_update_begin(&stats->syncp);
    	stats->rx_packets++;
    	stats->rx_bytes += skb->len;
    	u64_stats_update_end(&stats->syncp);

     	/*skb处理完成，进入主要函数*/
    	netif_rx(skb);

    	return 0;
       error:
    	/* Put UDP header back */
    	__skb_push(skb, sizeof(struct udphdr));

    	return 1;
       drop:
    	/* Consume bad packet */
    	kfree_skb(skb);
    	return 0;
       }
    ```

2. netif_rx

    ```c
    int netif_rx(struct sk_buff *skb)
    {
    	int ret;

    	/* netpoll开启，走netpoll流程*/
    	if (netpoll_rx(skb))
    		return NET_RX_DROP;
    	/*时间戳检查*/
    	net_timestamp_check(netdev_tstamp_prequeue, skb);

    	trace_netif_rx(skb);
      	/*内核开启了RPS则进入此流程，关于RPS，以后写文章详细介绍*/
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
          	/*将包挂到某个cpu的处理列表中*/
    		ret = enqueue_to_backlog(skb, get_cpu(), &qtail);
    		put_cpu();
    	}
    	return ret;
    }
    ```

    那么，每个CPU在什么地方进行处理呢？

    在网络子系统的初始化函数中'net_dev_init'有一段代码，如下

    ```c
    for_each_possible_cpu(i) {
    		struct softnet_data *sd = &per_cpu(softnet_data, i);

    		memset(sd, 0, sizeof(*sd));
    		skb_queue_head_init(&sd->input_pkt_queue);
    		skb_queue_head_init(&sd->process_queue);
    		sd->completion_queue = NULL;
    		INIT_LIST_HEAD(&sd->poll_list);
    		sd->output_queue = NULL;
    		sd->output_queue_tailp = &sd->output_queue;
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
    ```

    可以看到，其处理函数为 process_backlog。

3. process_backlog

    部分代码如下

    ```c
    while ((skb = __skb_dequeue(&sd->process_queue))) {
    			rcu_read_lock();
    			local_irq_enable();
      			/*队列内报文走一遍 __netif_receive_skb 函数；
      			对于vxlan来说，此时的报文已经是内部 original l2 frame*/
    			__netif_receive_skb(skb);
    			rcu_read_unlock();
    			local_irq_disable();
    			input_queue_head_incr(sd);
    			if (++work >= quota) {
    				local_irq_enable();
    				return work;
    			}
    		}
    ```


## vxlan模块发包函数

vxlan模块初始化函数进行了link初始化，其操作定义如下

```c
static struct rtnl_link_ops vxlan_link_ops __read_mostly = {
	.kind		= "vxlan",
	.maxtype	= IFLA_VXLAN_MAX,
	.policy		= vxlan_policy,
	.priv_size	= sizeof(struct vxlan_dev),
	.setup		= vxlan_setup,
	.validate	= vxlan_validate,
	.newlink	= vxlan_newlink,
	.dellink	= vxlan_dellink,
	.get_size	= vxlan_get_size,
	.fill_info	= vxlan_fill_info,
};
```

其内接口的setup操作函数为vxlan_setup，内部对于接口的操作初始化如下

```c
dev->netdev_ops = &vxlan_netdev_ops;
-->>
static const struct net_device_ops vxlan_netdev_ops = {
	.ndo_init		= vxlan_init,
	.ndo_open		= vxlan_open,
	.ndo_stop		= vxlan_stop,
	.ndo_start_xmit		= vxlan_xmit,
	.ndo_get_stats64	= ip_tunnel_get_stats64,
	.ndo_set_rx_mode	= vxlan_set_multicast_list,
	.ndo_change_mtu		= eth_change_mtu,
	.ndo_validate_addr	= eth_validate_addr,
	.ndo_set_mac_address	= eth_mac_addr,
	.ndo_fdb_add		= vxlan_fdb_add,
	.ndo_fdb_del		= vxlan_fdb_delete,
	.ndo_fdb_dump		= vxlan_fdb_dump,
};
```

可知发包函数为 'vxlan_xmit'。

1. vxlan_xmit

   ```c

   /* 
   此函数主要是找 远端 IP及MAC，封装包的函数为 vxlan_xmit_one
   */
   static netdev_tx_t vxlan_xmit(struct sk_buff *skb, struct net_device *dev)
   {
   	struct vxlan_dev *vxlan = netdev_priv(dev);
   	struct ethhdr *eth;
   	bool did_rsc = false;
   	struct vxlan_rdst *rdst0, *rdst;
   	struct vxlan_fdb *f;
   	int rc1, rc;

   	skb_reset_mac_header(skb);
   	eth = eth_hdr(skb);

   	if ((vxlan->flags & VXLAN_F_PROXY) && ntohs(eth->h_proto) == ETH_P_ARP)
   		return arp_reduce(dev, skb);

   	f = vxlan_find_mac(vxlan, eth->h_dest);
   	did_rsc = false;

   	if (f && (f->flags & NTF_ROUTER) && (vxlan->flags & VXLAN_F_RSC) &&
   	    ntohs(eth->h_proto) == ETH_P_IP) {
   		did_rsc = route_shortcircuit(dev, skb);
   		if (did_rsc)
   			f = vxlan_find_mac(vxlan, eth->h_dest);
   	}

   	if (f == NULL) {
   		rdst0 = &vxlan->default_dst;

   		if (rdst0->remote_ip == htonl(INADDR_ANY) &&
   		    (vxlan->flags & VXLAN_F_L2MISS) &&
   		    !is_multicast_ether_addr(eth->h_dest))
   			vxlan_fdb_miss(vxlan, eth->h_dest);
   	} else
   		rdst0 = &f->remote;

   	rc = NETDEV_TX_OK;

   	/* if there are multiple destinations, send copies */
   	for (rdst = rdst0->remote_next; rdst; rdst = rdst->remote_next) {
   		struct sk_buff *skb1;

   		skb1 = skb_clone(skb, GFP_ATOMIC);
   		if (skb1) {
   			rc1 = vxlan_xmit_one(skb1, dev, rdst, did_rsc);
   			if (rc == NETDEV_TX_OK)
   				rc = rc1;
   		}
   	}

   	rc1 = vxlan_xmit_one(skb, dev, rdst0, did_rsc);
   	if (rc == NETDEV_TX_OK)
   		rc = rc1;
   	return rc;
   }
   ```

2. vxlan_xmit_one

   封装报文，具体内容可自己分析。