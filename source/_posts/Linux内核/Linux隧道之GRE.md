---
title: Linux隧道之GRE
date: 2017-12-26 17:50:28
categories: Linux内核
tags:
  - GRE
---

## 协议简介

GRE（Generic Routing Encapsulation，通用路由封装）协议是对某些网络层协议（如IP和IPX）的数据报文进行封装，使这些被封装的数据报文能够在另一个网络层协议（如IP）中传输。GRE采用了Tunnel（隧道）技术，是VPN（Virtual Private Network）的第三层隧道协议。

Tunnel是一个虚拟的点对点的连接，提供了一条通路使封装的数据报文能够在这个通路上传输，并且在一个Tunnel的两端分别对数据报进行封装及解封装。

### 报文格式

封装好的报文的形式如下

![GRE封装格式](/images/Linux隧道之GRE/GRE封装格式.png)

Payload可以是任何协议，GRE允许非IP协议在有效载荷中被传输。如果 Delivery header 是ipv4的头，则GRE被归入IP协议，协议号为47（Linux 支持的协议号）。

一个封装在IP Tunnel中的X协议报文的格式如下：

![GRE封装在IP中](/images/Linux隧道之GRE/GRE封装在IP中.png)

需要封装和传输的数据报文，称之为净荷（Payload），净荷的协议类型为乘客协议（Passenger Protocol）。系统收到一个净荷后，首先使用封装协议（Encapsulation Protocol）对这个净荷进行GRE封装，即把乘客协议报文进行了“包装”，加上了一个GRE头部成为GRE报文；然后再把封装好的原始报文和GRE头部封装在IP报文中，这样就可完全由IP层负责此报文的前向转发（Forwarding）。通常把这个负责前向转发的IP协议称为传输协议（Delivery Protocol或者Transport Protocol）。

根据传输协议的不同，可以分为GRE over IPv4和GRE over IPv6两种隧道模式。以IPV4为例分析封装、解封过程，拓扑如下

![GRE实例](/images/Linux隧道之GRE/GRE实例.png)

### 封装过程

- Private A中发送报文，检查报文头中的目的地址域来确定如何发送此包；
- 若报文的目的地址要经过Tunnel才能到达，则设备将此报文发给相应的Tunnel接口；
- Tunnel口收到此报文后进行GRE封装，在封装IP报文头后，设备根据此IP包的目的地址及路由表对报文进行转发，从相应的网络接口发送出去。

### 解封过程

- Private B从Tunnel接口收到IP报文，检查目的地址；
- 发现目的地是本路由器，则Router B剥掉此报文的IP报头，交给GRE协议处理（进行检验密钥、检查校验和及报文的序列号等）；
- GRE协议完成相应的处理后，剥掉GRE报头，再交由内部协议对此数据报进行后续的转发处理。

### GRE的安全选项

为了提高GRE隧道的安全性，GRE还支持由用户选择设置Tunnel接口的识别关键字（或称密钥），和对隧道封装的报文进行端到端校验。

在[RFC1701](https://www.rfc-editor.org/pdfrfc/rfc1701.txt.pdf)中规定：

- 若GRE报文头中的Key标识位置1，则收发双方将进行通道识别关键字的验证，只有Tunnel两端设置的识别关键字完全一致时才能通过验证，否则将报文丢弃。
- 若GRE报文头中的Checksum标识位置1，则校验和有效。发送方将根据GRE头及Payload信息计算校验和，并将包含校验和的报文发送给对端。接收方对接收到的报文计算校验和，并与报文中的校验和比较，如果一致则对报文进一步处理，否则丢弃。

## Linux对GRE的支持

代码基于 kernel 3.10.105。

### 模块初始化

```c
static int __init gre_init(void)
{
	pr_info("GRE over IPv4 demultiplexor driver\n");
	/*IP 内部协议号， 47*/
	if (inet_add_protocol(&net_gre_protocol, IPPROTO_GRE) < 0) {
		pr_err("can't add protocol\n");
		return -EAGAIN;
	}
	/*offload相关函数*/
	if (inet_add_offload(&gre_offload, IPPROTO_GRE)) {
		pr_err("can't add protocol offload\n");
		inet_del_protocol(&net_gre_protocol, IPPROTO_GRE);
		return -EAGAIN;
	}
	return 0;
}
```

而 `net_gre_protocol` 定义为

```c
static const struct net_protocol net_gre_protocol = {
	.handler     = gre_rcv,
	.err_handler = gre_err,
	.netns_ok    = 1,
};
```

因此，在收到GRE报文并上送到本地后，在函数`ip_local_deliver_finish`中会调用函数`gre_rcv`。

### 收包

```
TIPS:
接口创建函数 ip_tunnel_create。
```

#### gre_rcv

```C
static int gre_rcv(struct sk_buff *skb)
{
	const struct gre_protocol *proto;
	u8 ver;
	int ret;

	if (!pskb_may_pull(skb, 12))
		goto drop;
	/*判断GRE 版本；3.10.105中有 CISCO 和 PPTP 两个版本*/
	ver = skb->data[1]&0x7f;
	if (ver >= GREPROTO_MAX)
		goto drop;
	/*找出此版本的处理函数，以函数 gre_add_protocol 进行注册*/
	rcu_read_lock();
  	/*本例以 CISCO为例进行分析*/
	proto = rcu_dereference(gre_proto[ver]);
	if (!proto || !proto->handler)
		goto drop_unlock;
	ret = proto->handler(skb);
	rcu_read_unlock();
	return ret;

drop_unlock:
	rcu_read_unlock();
drop:
	kfree_skb(skb);
	return NET_RX_DROP;
}
```

```c

static int __init ipgre_init(void)
{
	int err;
	/*定义了两种不同的设备类型 ： gre、gretap；
	gretap 处理 内部封装为 ETH_P_TEB 类型报文；
	其他报文 gre类型处理
	*/
	err = register_pernet_device(&ipgre_net_ops);
	if (err < 0)
		return err;

	err = register_pernet_device(&ipgre_tap_net_ops);
	if (err < 0)
		goto pnet_tap_faied;

	err = gre_add_protocol(&ipgre_protocol, GREPROTO_CISCO);
	if (err < 0) {
		pr_info("%s: can't add protocol\n", __func__);
		goto add_proto_failed;
	}
  	……
}
-->>
static const struct gre_protocol ipgre_protocol = {
	.handler     = ipgre_rcv,
	.err_handler = ipgre_err,
};
```

#### ipgre_rcv

```c
static int ipgre_rcv(struct sk_buff *skb)
{
	struct net *net = dev_net(skb->dev);
	struct ip_tunnel_net *itn;
	const struct iphdr *iph;
	struct ip_tunnel *tunnel;
	struct tnl_ptk_info tpi;
	int hdr_len;
	bool csum_err = false;
	/*根据skb解析gre头部，并将flag，内部协议等存入tpi；
	hdr_len 为GRE头部长度*/
	if (parse_gre_header(skb, &tpi, &csum_err, &hdr_len) < 0)
		goto drop;
	/*proto 有效载荷数据包的协议类型。 
	  通常，该值将是数据包的以太网协议类型字段。
	  ETH_P_TEB 0x6558 表示 Transparent Ethernet Bridging
    */
	if (tpi.proto == htons(ETH_P_TEB))
		itn = net_generic(net, gre_tap_net_id);
	else
		itn = net_generic(net, ipgre_net_id);
	/*获取IP头，查找隧道信息；
	找到的话证明本地存在处理此报文的接口；
	没有的话发送ICMP 目的不可达警告
	*/
	iph = ip_hdr(skb);
	tunnel = ip_tunnel_lookup(itn, skb->dev->ifindex, tpi.flags,
				  iph->saddr, iph->daddr, tpi.key);

	if (tunnel) {
		skb_pop_mac_header(skb);
		ip_tunnel_rcv(tunnel, skb, &tpi, hdr_len, log_ecn_error);
		return 0;
	}
	icmp_send(skb, ICMP_DEST_UNREACH, ICMP_PORT_UNREACH, 0);
drop:
	kfree_skb(skb);
	return 0;
}
```

#### ip_tunnel_rcv

```C
int ip_tunnel_rcv(struct ip_tunnel *tunnel, struct sk_buff *skb,
		  const struct tnl_ptk_info *tpi, int hdr_len, bool log_ecn_error)
{
	struct pcpu_tstats *tstats;
	const struct iphdr *iph = ip_hdr(skb);
	int err;

	secpath_reset(skb);
  	/*重置skb protocol 、二层头、去掉gre头部、重新校验*/
	skb->protocol = tpi->proto;
	skb->mac_header = skb->network_header;
	__pskb_pull(skb, hdr_len);
	skb_postpull_rcsum(skb, skb_transport_header(skb), tunnel->hlen);
  	/*开启了GRE广播，判断目的地址是否为广播，之后进行广播处理*/
#ifdef CONFIG_NET_IPGRE_BROADCAST
	if (ipv4_is_multicast(iph->daddr)) {
		/* Looped back packet, drop it! */
		if (rt_is_output_route(skb_rtable(skb)))
			goto drop;
		tunnel->dev->stats.multicast++;
		skb->pkt_type = PACKET_BROADCAST;
	}
#endif
	/*校验和标志和隧道信息不符则丢包*/
	if ((!(tpi->flags&TUNNEL_CSUM) &&  (tunnel->parms.i_flags&TUNNEL_CSUM)) ||
	     ((tpi->flags&TUNNEL_CSUM) && !(tunnel->parms.i_flags&TUNNEL_CSUM))) {
		tunnel->dev->stats.rx_crc_errors++;
		tunnel->dev->stats.rx_errors++;
		goto drop;
	}
	/*隧道开启序列号标志 但是 报文中没开启或序列号错误 则丢包*/
	if (tunnel->parms.i_flags&TUNNEL_SEQ) {
		if (!(tpi->flags&TUNNEL_SEQ) ||
		    (tunnel->i_seqno && (s32)(ntohl(tpi->seq) - tunnel->i_seqno) < 0)) {
			tunnel->dev->stats.rx_fifo_errors++;
			tunnel->dev->stats.rx_errors++;
			goto drop;
		}
		tunnel->i_seqno = ntohl(tpi->seq) + 1;
	}

	/*隧道接口类型为 ARPHRD_ETHER（Ethernet）*/
	if (tunnel->dev->type == ARPHRD_ETHER) {
		if (!pskb_may_pull(skb, ETH_HLEN)) {
			tunnel->dev->stats.rx_length_errors++;
			tunnel->dev->stats.rx_errors++;
			goto drop;
		}
		/*处理内部报文，获取内部ip header；
		修改skb内部信息：dev、protocol等；
		重新计算校验和*/
		iph = ip_hdr(skb);
		skb->protocol = eth_type_trans(skb, tunnel->dev);
		skb_postpull_rcsum(skb, eth_hdr(skb), ETH_HLEN);
	}
  	/*同样重置信息*/
	skb->pkt_type = PACKET_HOST;
	__skb_tunnel_rx(skb, tunnel->dev);
	skb_reset_network_header(skb);
  	/*解封装*/
	err = IP_ECN_decapsulate(iph, skb);
	…………
	gro_cells_receive(&tunnel->gro_cells, skb);
	return 0;

drop:
	kfree_skb(skb);
	return 0;
}
```

#### gro_cells_receive

```c
static inline void gro_cells_receive(struct gro_cells *gcells, struct sk_buff *skb)
{
	struct gro_cell *cell = gcells->cells;
	struct net_device *dev = skb->dev;
	/*接口不支持GRO或 skb为复制报文，则进入netif_rx，此函数不在分析*/
	if (!cell || skb_cloned(skb) || !(dev->features & NETIF_F_GRO)) {
		netif_rx(skb);
		return;
	}
	/*下面是NAPI方式处理报文*/
	if (skb_rx_queue_recorded(skb))
		cell += skb_get_rx_queue(skb) & gcells->gro_cells_mask;

	if (skb_queue_len(&cell->napi_skbs) > netdev_max_backlog) {
		atomic_long_inc(&dev->rx_dropped);
		kfree_skb(skb);
		return;
	}

	/* We run in BH context */
	spin_lock(&cell->napi_skbs.lock);

	__skb_queue_tail(&cell->napi_skbs, skb);
	if (skb_queue_len(&cell->napi_skbs) == 1)
		napi_schedule(&cell->napi);

	spin_unlock(&cell->napi_skbs.lock);
}
```

### 发包

模块初始化时，注册的链路处理函数中

```C
/*只看setup*/
static struct rtnl_link_ops ipgre_link_ops __read_mostly = {
	.kind		= "gre",
  	……
	.setup		= ipgre_tunnel_setup,
  	……
};
static struct rtnl_link_ops ipgre_tap_ops __read_mostly = {
	.kind		= "gretap",
  	……
	.setup		= ipgre_tap_setup,
  	……
};
```

以'gretap'为例分析

```c 
static void ipgre_tap_setup(struct net_device *dev)
{
	ether_setup(dev);
	dev->netdev_ops		= &gre_tap_netdev_ops;
	ip_tunnel_setup(dev, gre_tap_net_id);
}
-->>
static const struct net_device_ops gre_tap_netdev_ops = {
	.ndo_init		= gre_tap_init,
	.ndo_uninit		= ip_tunnel_uninit,
	.ndo_start_xmit		= gre_tap_xmit,
	.ndo_set_mac_address 	= eth_mac_addr,
	.ndo_validate_addr	= eth_validate_addr,
	.ndo_change_mtu		= ip_tunnel_change_mtu,
	.ndo_get_stats64	= ip_tunnel_get_stats64,
};
```

#### gre_tap_xmit

```c
static netdev_tx_t gre_tap_xmit(struct sk_buff *skb,
				struct net_device *dev)
{
	struct ip_tunnel *tunnel = netdev_priv(dev);
	/*接口支持gso，以gso方式处理*/
	skb = handle_offloads(tunnel, skb);
	if (IS_ERR(skb))
		goto out;
	/*推头部空间而不修改数据*/
	if (skb_cow_head(skb, dev->needed_headroom))
		goto free_skb;
	
	__gre_xmit(skb, dev, &tunnel->parms.iph, htons(ETH_P_TEB));
	return NETDEV_TX_OK;
  	……
}
```

#### __gre_xmit

```C

static void __gre_xmit(struct sk_buff *skb, struct net_device *dev,
		       const struct iphdr *tnl_params,
		       __be16 proto)
{
	struct ip_tunnel *tunnel = netdev_priv(dev);
	struct tnl_ptk_info tpi;
	/*需要增加封装，因此将原有skb头赋值给inner头部字段*/
	if (likely(!skb->encapsulation)) {
		skb_reset_inner_headers(skb);
		skb->encapsulation = 1;
	}
	/*tpi为gre头部一些数据，之后build gre头部时会将此数据放到skb中*/
	tpi.flags = tunnel->parms.o_flags;
	tpi.proto = proto;
	tpi.key = tunnel->parms.o_key;
	if (tunnel->parms.o_flags & TUNNEL_SEQ)
		tunnel->o_seqno++;
	tpi.seq = htonl(tunnel->o_seqno);

	/* Push GRE header. */
	skb = gre_build_header(skb, &tpi, tunnel->hlen);
	if (unlikely(!skb)) {
		dev->stats.tx_dropped++;
		return;
	}
	
	ip_tunnel_xmit(skb, dev, tnl_params);
}
```

#### ip_tunnel_xmit

```c
void ip_tunnel_xmit(struct sk_buff *skb, struct net_device *dev,
		    const struct iphdr *tnl_params)
{
	struct ip_tunnel *tunnel = netdev_priv(dev);
	const struct iphdr *inner_iph;
	struct iphdr *iph;
	struct flowi4 fl4;
	u8     tos, ttl;
	__be16 df;
	struct rtable *rt;		/* Route to the other host */
	struct net_device *tdev;	/* Device to other host */
	unsigned int max_headroom;	/* The extra header space needed */
	__be32 dst;

	inner_iph = (const struct iphdr *)skb_inner_network_header(skb);

	memset(IPCB(skb), 0, sizeof(*IPCB(skb)));
  	/*隧道没有指定远端IP则自动查找匹配路由*/
	dst = tnl_params->daddr;
	if (dst == 0) {
		/* NBMA tunnel */
		if (skb_dst(skb) == NULL) {
			dev->stats.tx_fifo_errors++;
			goto tx_error;
		}

		if (skb->protocol == htons(ETH_P_IP)) {
			rt = skb_rtable(skb);
			dst = rt_nexthop(rt, inner_iph->daddr);
		}
		……
		else
			goto tx_error;
	}

	tos = tnl_params->tos;
	if (tos & 0x1) {
		tos &= ~0x1;
		if (skb->protocol == htons(ETH_P_IP))
			tos = inner_iph->tos;
		else if (skb->protocol == htons(ETH_P_IPV6))
			tos = ipv6_get_dsfield((const struct ipv6hdr *)inner_iph);
	}
	/*根据源目IP等信息查找路由*/
	rt = ip_route_output_tunnel(dev_net(dev), &fl4,
				    tunnel->parms.iph.protocol,
				    dst, tnl_params->saddr,
				    tunnel->parms.o_key,
				    RT_TOS(tos),
				    tunnel->parms.link);
	if (IS_ERR(rt)) {
		dev->stats.tx_carrier_errors++;
		goto tx_error;
	}
	tdev = rt->dst.dev;
	/*同一接口 入和出 */
	if (tdev == dev) {
		ip_rt_put(rt);
		dev->stats.collisions++;
		goto tx_error;
	}
	
	if (tnl_update_pmtu(dev, skb, rt, tnl_params->frag_off)) {
		ip_rt_put(rt);
		goto tx_error;
	}

	……
    /*隧道信息没有设置ttl,则使用内部报文的ttl*/
	ttl = tnl_params->ttl;
	if (ttl == 0) {
		if (skb->protocol == htons(ETH_P_IP))
			ttl = inner_iph->ttl;
      	……
		else
			ttl = ip4_dst_hoplimit(&rt->dst);
	}
	/*是否需要分片*/
	df = tnl_params->frag_off;
	if (skb->protocol == htons(ETH_P_IP))
		df |= (inner_iph->frag_off&htons(IP_DF));

	max_headroom = LL_RESERVED_SPACE(tdev) + sizeof(struct iphdr)
					       + rt->dst.header_len;
	if (max_headroom > dev->needed_headroom)
		dev->needed_headroom = max_headroom;

	if (skb_cow_head(skb, dev->needed_headroom)) {
		dev->stats.tx_dropped++;
		dev_kfree_skb(skb);
		return;
	}

	skb_dst_drop(skb);
	skb_dst_set(skb, &rt->dst);

	/*插入IP头部*/
	skb_push(skb, sizeof(struct iphdr));
	skb_reset_network_header(skb);

	iph = ip_hdr(skb);
	inner_iph = (const struct iphdr *)skb_inner_network_header(skb);

	iph->version	=	4;
	iph->ihl	=	sizeof(struct iphdr) >> 2;
	iph->frag_off	=	df;
	iph->protocol	=	tnl_params->protocol;
	iph->tos	=	ip_tunnel_ecn_encap(tos, inner_iph, skb);
	iph->daddr	=	fl4.daddr;
	iph->saddr	=	fl4.saddr;
	iph->ttl	=	ttl;
	__ip_select_ident(iph, skb_shinfo(skb)->gso_segs ?: 1);

	iptunnel_xmit(skb, dev);
	return;
  	……
}
```

#### iptunnel_xmit

```c

static inline void iptunnel_xmit(struct sk_buff *skb, struct net_device *dev)
{
	int err;
	int pkt_len = skb->len - skb_transport_offset(skb);
	struct pcpu_tstats *tstats = this_cpu_ptr(dev->tstats);

	nf_reset(skb);
	/*标准发包流程*/
	err = ip_local_out(skb);
  	……
}
```

## GRE实例

 期望拓扑如下

![linux-gre](/images/Linux隧道之GRE/linux-gre.png)

**环境信息**

```shell
#vm 1
[root@test-1 ~]# uname -sr
Linux 3.10.0-693.el7.x86_64
[root@test-1 ~]# ip addr show 
……
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1446 qdisc pfifo_fast state UP qlen 1000
    link/ether fa:16:3e:0c:e3:c6 brd ff:ff:ff:ff:ff:ff
    inet 10.10.10.11/24 brd 10.10.10.255 scope global dynamic eth0
       valid_lft 82685sec preferred_lft 82685sec

#vm2
[root@test-2 net]# uname -sr
Linux 3.10.0-693.el7.x86_64
[root@test-2 net]# ip addr show 
……
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1446 qdisc pfifo_fast state UP qlen 1000
    link/ether fa:16:3e:50:61:0d brd ff:ff:ff:ff:ff:ff
    inet 10.10.10.9/24 brd 10.10.10.255 scope global dynamic eth0
       valid_lft 82645sec preferred_lft 82645sec
```

**开始配置**

1. 首先需要给设备加载ip_gre模块

  ```shell
  [root@test-1 ~]# modprobe ip_gre
  ```

  加载完成之后，设备应该会多出两个接口：gre0、gretap0。这是模块初始过程中创建的两个针对不同gre类型的两个接口(first device)。

2. 创建接口并设置IP。

   ```shell
   [root@test-1 ~]# ip tunnel add gre1 mode gre remote 10.10.10.9 local 10.10.10.11 ttl 255
   [root@test-1 ~]# ip link set gre1 up
   [root@test-1 ~]# ip addr add 192.168.1.3/24 peer 192.168.1.4/24 dev gre1
   ```

   对端设备做类似配置。

3. 路由表项。

   ```shell
   [root@test-1 ~]# ip route 
   192.168.1.0/24 dev gre1 proto kernel scope link src 192.168.1.3 
   ```

4. 测试连通性。


对端抓包如下

![GRE-tcpdump](/images/Linux隧道之GRE/GRE-tcpdump.png)

### troubleshooting

ping 不通时，进行抓包，命令如下

```shell
# tcpdump  -i eno1 ip[9]=47
# ip头第9（从0开始）位为protocol位，gre在linux中的支持为47。
```

两端都进行抓包，判断报文是否到达。

1. 对端已经接收到，但是无回应：判断对端规则（iptables等）是否已经放开。
2. 本端收到回应但ping依然不通：估计是本地规则问题。


## 优秀资料

[GRE技术介绍](http://www.h3c.com/cn/d_200805/605933_30003_0.htm)