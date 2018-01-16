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

## vxlan实例

实验环境：

```shell
# vm1
[root@test-1 ~]# uname -sr
Linux 3.10.0-693.el7.x86_64
[root@test-1 ~]# ip addr show dev eth0 
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1446 qdisc pfifo_fast state UP qlen 1000
    link/ether fa:16:3e:0c:e3:c6 brd ff:ff:ff:ff:ff:ff
    inet 10.10.10.11/24 brd 10.10.10.255 scope global dynamic eth0
       valid_lft 84967sec preferred_lft 84967sec
       
# vm2
[root@test-2 ~]# uname -sr
Linux 3.10.0-693.el7.x86_64
[root@test-2 ~]# ip addr show dev eth0 
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1446 qdisc pfifo_fast state UP qlen 1000
    link/ether fa:16:3e:50:61:0d brd ff:ff:ff:ff:ff:ff
    inet 10.10.10.9/24 brd 10.10.10.255 scope global dynamic eth0
       valid_lft 84929sec preferred_lft 84929sec
```

### 点对点的vxlan

完成一个最简单的vxlan网络，拓扑如下：

![规划图1](/images/Linux对vxlan的支持/规划图1.png)

开始配置

```shell
[root@test-1 ~]# ip link add vxlan1 type vxlan id 1 dstport 4789 remote 10.10.10.9 local 10.10.10.11 dev eth0 
```

- vxlan1 即为创建的接口名称 ，type 为 vxlan 类型。
- id 即为 VNI。
- dstport 指定 UDP的目的端口，IANA 为vxlan分配的目的端口是 4789。
- remote 和 local ，即远端和本地的IP地址，因为vxlan是MAC-IN-UDP，需要指定外层IP，此处即指。
- dev 本地流量接口。用于 vtep 通信的网卡设备，用来读取 IP 地址。注意这个参数和 `local`参数含义是相同的，在这里写出来是为了告诉大家有两个参数存在。

创建完成可看到

```shell
[root@test-1 ~]# ip addr show type vxlan
3: vxlan1: <BROADCAST,MULTICAST> mtu 1396 qdisc noop state DOWN qlen 1000
    link/ether 86:65:ef:3d:a1:e7 brd ff:ff:ff:ff:ff:ff
```

接口现在还没有地址，也没有开启，接下来进行如下配置

```shell
[root@test-1 ~]# ip addr add 192.168.1.3/24 dev vxlan1
[root@test-1 ~]# ip link set vxlan1 up
[root@test-1 ~]# ip addr show type vxlan
3: vxlan1: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1396 qdisc noqueue state UNKNOWN qlen 1000
    link/ether 86:65:ef:3d:a1:e7 brd ff:ff:ff:ff:ff:ff
    inet 192.168.1.3/24 scope global vxlan1
       valid_lft forever preferred_lft forever
```

`vxlan1`已经配置完成。

```
为什么vxlan1的MTU是 1396呢？
因为我的vm启在openstack云环境中，租户网络为vxlan，外网为vlan类型。
因此创建的内网网络MTU为 1446(1500 - 4(vlan) - 50(vxlan))，在vm中基于eth0又配置vxlan，因此MTU需要再减50，即 1396。
```

之后看一下路由表即vxlan 的 FDB表

```shell
#(仅列出vxlan部分)
[root@test-1 ~]# ip route 
192.168.1.0/24 dev vxlan1 proto kernel scope link src 192.168.1.3 
[root@test-1 ~]# bridge fdb
00:00:00:00:00:00 dev vxlan1 dst 10.10.10.9 via eth0 self permanent
# 即默认vxlan1 对端地址为 10.10.10.9，通过eth0进行报文交换
```

对test-2进行同样的配置，保证VNI和dstport一致。VNI一致是为了不进行vxlan隔离，dstport一致是因为IANA 为vxlan分配的目的端口是 4789。

之后在test-1上进行测试连通性

```shell
[root@test-1 ~]# ping 192.168.1.4 -c 3
PING 192.168.1.4 (192.168.1.4) 56(84) bytes of data.
64 bytes from 192.168.1.4: icmp_seq=1 ttl=64 time=0.424 ms
64 bytes from 192.168.1.4: icmp_seq=2 ttl=64 time=0.437 ms
64 bytes from 192.168.1.4: icmp_seq=3 ttl=64 time=0.404 ms

--- 192.168.1.4 ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2000ms
rtt min/avg/max/mdev = 0.404/0.421/0.437/0.027 ms
```

在对端抓取eth0报文如下

![vxlan-tcpdump](/images/Linux对vxlan的支持/vxlan-tcpdump.png)

### 组播模式vxlan

要组成同一个 vxlan 网络，vtep 必须能感知到彼此的存在。多播组本来的功能就是把网络中的某些节点组成一个虚拟的组，所以 vxlan 最初想到用多播来实现是很自然的事情。拓扑如下

![vxlan-multicast](/images/Linux对vxlan的支持/vxlan-multicast.png)

```shell
[root@test-1 ~]# ip link add vxlan1 type vxlan id 2 dstport 4789 group 224.0.0.1 dev eth0 
[root@test-1 ~]# ip addr add 192.168.1.3/24 dev vxlan1
[root@test-1 ~]# ip link set vxlan1 up
[root@test-1 ~]# ip route 
192.168.1.0/24 dev vxlan1 proto kernel scope link src 192.168.1.3 
[root@test-1 ~]# bridge fdb
00:00:00:00:00:00 dev vxlan1 dst 224.0.0.1 via eth0 self permanent
```

这里最重要的参数是 `group 224.0.0.1` （多播地址范围为224.0.0.0到239.255.255.255）表示把 vtep 加入到这个多播组。其他设备进行类似配置，确保VNI与group相同。

由于将vxlan1加入多播组，因此ARP请求这类报文不在进行广播，而是多播。

![vxlan-mul-arp](/images/Linux对vxlan的支持/vxlan-mul-arp.png)

可以与点对点形式的做对比

![vxlan-point-to-point](/images/Linux对vxlan的支持/vxlan-point-to-point.png)

ARP回应依然是单播报文。通信结束之后，查看ARP及fdb表项为

```shell
[root@test-1 ~]# ip neigh
192.168.1.4 dev vxlan1 lladdr a6:8b:d5:2d:83:3c STALE
[root@test-1 ~]# bridge fdb
00:00:00:00:00:00 dev vxlan1 dst 224.0.0.1 via eth0 self permanent
a6:8b:d5:2d:83:3c dev vxlan1 dst 10.10.10.9 self 
```

### 利用 bridge 来接入容器

此处的bridge可以是linux的bridge，也可以是ovs的bridge，为了配置简单化，此处以linux举例。

上面两种拓扑将vxlan作为三层口，在云环境中基本没什么意义。在实际的生产中，每台主机上都有几十台甚至上百台的虚拟机或者容器需要通信，因此我们需要找到一种方法能够把这些通信实体组织起来——这正是引入桥的意义。

![vxlan-bridge](/images/Linux对vxlan的支持/vxlan-bridge.png)

下面用 network namespace来模拟tap(vm接口)，进行如下配置

```shell
#创建vxlan接口
[root@test-1 ~]# ip link add vxlan1 type vxlan id 2 dstport 4789 group 224.0.0.6 dev eth0 
#创建NS
[root@test-1 ~]# ip netns add vm0
[root@test-1 ~]# ip netns exec vm0 ip link set dev lo up
#创建veth 接口，并将其中一个veth口放到 NS中
[root@test-1 ~]# ip link add veth0 type veth peer name veth1
[root@test-1 ~]# ip link set veth0 netns vm0
[root@test-1 ~]# ip netns exec vm0 ip link set veth0 name eth0
[root@test-1 ~]# ip netns exec vm0 ip addr add 192.168.1.3/24 dev eth0
[root@test-1 ~]# ip netns exec vm0 ip link set dev eth0 up
[root@test-1 ~]# ip netns exec vm0 ip addr show
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN qlen 1
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
    inet6 ::1/128 scope host 
       valid_lft forever preferred_lft forever
8: eth0@if7: <NO-CARRIER,BROADCAST,MULTICAST,UP> mtu 1500 qdisc noqueue state LOWERLAYERDOWN qlen 1000
    link/ether 9e:ab:18:d5:25:55 brd ff:ff:ff:ff:ff:ff link-netnsid 0
    inet 192.168.1.3/24 scope global eth0
       valid_lft forever preferred_lft forever
#创建桥，并将vxlan、veth加入桥
[root@test-1 ~]# ip link add br0 type bridge
[root@test-1 ~]# ip link set vxlan1 master br0
[root@test-1 ~]# ip link set vxlan1 up
[root@test-1 ~]# 
[root@test-1 ~]# ip link set dev veth1 master br0
[root@test-1 ~]# ip link set dev veth1 up
[root@test-1 ~]# ip link set dev br0 up
[root@test-1 ~]# bridge link
6: vxlan1 state UNKNOWN : <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1396 master br0 state forwarding priority 32 cost 100 
7: veth1 state UP @(null): <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 master br0 state forwarding priority 32 cost 2
```

其他设备进行类似配置（设备较多可用脚本实现）。利用命令 `ip netns exec vm0 ping IP`来验证连通性。

此过程为：

- NS eth0 ARP广播，通过veth1到达br0。
- br0上没有二层表，进行学习之后，每个口（除收报文口）进行转发，到达vxlan1。
- vxlan1口fdb表默认走多播，进行外层封装之后从eth0接口发出。

### 手动维护 vtep 组

对 overlay 网络来说，它的网段范围是分布在多个主机上的，因此传统 ARP 报文的广播无法直接使用。要想做到 overlay 网络的广播，必须把报文发送到所有 vtep 在的节点，这才引入了多播。

如果提前知道哪些 vtep 要组成一个网络，以及这些 vtep 在哪些主机上，那么就可以不使用多播。

Linux 的 vxlan 模块也提供了这个功能，而且实现起来并不复杂。创建 vtep interface 的时候不使用 `remote` 或者 `group` 参数就行：

```shell
[root@test-1 ~]# ip link add vxlan1 type vxlan id 2 dstport 4789  dev eth0 
[root@test-1 ~]# bridge fdb
01:00:5e:00:00:01 dev eth0 self permanent
```

由于没有指定 `remote` 和 `group` ，因此进行广播时不知道要发送给谁。但是可以手动添加默认的 FDB 表项

```shell
#环境只有两台设备，因此只添加一条表项
[root@test-1 ~]# bridge fdb append 00:00:00:00:00:00 dev vxlan1 dst 10.10.10.9
[root@test-1 ~]# bridge fdb
00:00:00:00:00:00 dev vxlan1 dst 10.10.10.9 self permanent
```

这种方式是手动维护多播组，解决了在某些 underlay 网络中不能使用多播的问题。但是由于需要手动维护，比较不方便，当然，可以编写脚本自动维护。

除此之外，这种方式也没有解决多播的另外一个问题：每次要查找 MAC 地址要发送大量的无用报文，如果 vtep 组节点数量很大，那么每次查询都发送 N 个报文，其中只有一个报文真正有用。

这个问题的解决可以参考此种方式，添加单播fdb表项！

### 手动维护 fdb 表

如果提前知道目的容器（或vm） MAC 地址和它所在主机的 IP 地址，也可以通过更新 fdb 表项来减少广播的报文数量。

```shell
[root@test-1 ~]# ip link add vxlan1 type vxlan id 2 dstport 4789  dev eth0 nolearning
```

`nolearning` 参数表示 vtep 不通过收到的报文来学习 fdb 表项的内容而是管理员维护。

```shell
[root@test-1 ~]# bridge fdb append 00:00:00:00:00:00 dev vxlan1 dst 10.10.10.9
[root@test-1 ~]# bridge fdb append 4e:e9:90:34:2e:b5 dev vxlan1 dst 10.10.10.9
```

- 第一条是默认表项；
- 第二条是明确的IP-MAC对应关系，**注意**：MAC是容器（vm）端口的MAC地址，而IP是NVE(Network Virtual Endpoint)的IP，即MAC是overlay的MAC，IP是underlay的IP。

不过此种方法只是把fdb进行手动维护，ARP广播没有任何改进，不过如果确定环境，那么可以手动维护ARP表项。

### 手动维护 ARP 表

如果能通过某个方式知道容器的 IP 和 MAC 地址对应关系，只要更新到每个节点，就能实现网络的连通。

但是，需要维护的是每个容器里面的 ARP 表项，因为最终通信的双方是容器。到每个容器里面（所有的 network namespace）去更新对应的 ARP 表，是件工作量很大的事情，而且容器的创建和删除还是动态的。linux 提供了一个解决方案，vtep 可以作为 arp 代理，回复 arp 请求，也就是说只要 vtep interface 知道对应的 IP - MAC 关系，在接收到容器发来的 ARP 请求时可以直接作出应答。这样的话，我们只需要更新 vtep interface 上 ARP 表项就行了。

```shell
[root@test-1 ~]# ip link add vxlan1 type vxlan id 2 dstport 4789  dev eth0 nolearning proxy
```

`proxy`表示 vtep 承担ARP代理的功能。手动添加表项

```shell
[root@test-1 ~]# bridge fdb append 00:00:00:00:00:00 dev vxlan1 dst 10.10.10.9
[root@test-1 ~]# bridge fdb append 4e:e9:90:34:2e:b5 dev vxlan1 dst 10.10.10.9
# 添加 IP-MAC对应关系
[root@test-1 ~]# ip neigh add 192.168.1.4 lladdr 4e:e9:90:34:2e:b5 dev vxlan0
```

## 优秀资料

[linux 上实现 vxlan 网络](http://cizixs.com/2017/09/28/linux-vxlan)