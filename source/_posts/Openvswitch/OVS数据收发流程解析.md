---
title: OVS数据收发流程解析
date: 2017-12-28 15:38:08
categories: openvswitch
tags:
  - ovs-patch
  - ovs-internal
  - ovs-system
  - ovs-vxlan
---

ovs版本为 2.6.1。

## OVS整体架构

OVS架构图如下，具体每个部件功能不具体分析，本文主要涉及内核部分。

![OVS内部结构](/images/OVS数据收发流程解析/OVS内部结构.png)

## OVS接口类型

执行命令'ovs-vsctl show' 或者 'ovs-dpctl show'(显示默认datapath)，来查看ovs接口信息时，常会看到接口类型，以下对OVS中有哪些接口类型及不同接口类型的接口之间的区别进行分析。

### patch

patch port类似于Linux系统中的`veth`，总是成对出现，分别连接在两个网桥上，从一个patch port收到的数据包会被转发到另一个patch port。

### internal

OVS内部创建的虚拟网卡接口。每创建一个ovs bridge，OVS会自动创建一个同名接口(Interface)挂载到新创建的bridge上。或者也可以通过`type=internal`把已经挂载的接口设置为‘internal’类型。

```shell
# ovs-vsctl add-br ovs-switch
/*OpenFlow 端口编号为 100*/
# ovs-vsctl add-port ovs-switch p0 -- set Interface p0 ofport_request=100
# ovs-vsctl set Interface p0 type=internal
```

对于 internal 类型的的网络接口，OVS 会同时在 Linux 系统中创建一个可以用来收发数据的模拟网络设备。我们可以为这个网络设备**配置 IP 地址**、进行数据监听等等。

内核中对'internal'接口的类型定义为'OVS_VPORT_TYPE_INTERNAL'（network device implemented by datapath，datapath实现的网络设备）。定义的vport操作变量为'ovs_internal_vport_ops'。

```c
static struct vport_ops ovs_internal_vport_ops = {
	.type		= OVS_VPORT_TYPE_INTERNAL,
	.create		= internal_dev_create,
	.destroy	= internal_dev_destroy,
	.send		= internal_dev_recv,
};
```

接口创建时，调用'internal_dev_create'进行接口初始化。

```c
static struct vport *internal_dev_create(const struct vport_parms *parms)
{
	struct vport *vport;
	struct internal_dev *internal_dev;
	int err;

	vport = ovs_vport_alloc(0, &ovs_internal_vport_ops, parms);
	if (IS_ERR(vport)) {
		err = PTR_ERR(vport);
		goto error;
	}
	/*内核创建接口，初始之后调用do_setup 初始化其他变量*/
	vport->dev = alloc_netdev(sizeof(struct internal_dev),
				  parms->name, NET_NAME_USER, do_setup);
	if (!vport->dev) {
		err = -ENOMEM;
		goto error_free_vport;
	}
	vport->dev->tstats = netdev_alloc_pcpu_stats(struct pcpu_sw_netstats);
	if (!vport->dev->tstats) {
		err = -ENOMEM;
		goto error_free_netdev;
	}

#ifdef HAVE_IFF_PHONY_HEADROOM
	vport->dev->needed_headroom = vport->dp->max_headroom;
#endif
  	/*设置接口nd_net属性*/
	dev_net_set(vport->dev, ovs_dp_get_net(vport->dp));
  	/*dev私有数据 映射*/
	internal_dev = internal_dev_priv(vport->dev);
	internal_dev->vport = vport;

	/* Restrict bridge port to current netns. */
	if (vport->port_no == OVSP_LOCAL)
		vport->dev->features |= NETIF_F_NETNS_LOCAL;

	rtnl_lock();
	err = register_netdevice(vport->dev);
	if (err)
		goto error_unlock;
	/*设置混杂模式*/
	dev_set_promiscuity(vport->dev, 1);
	rtnl_unlock();
	netif_start_queue(vport->dev);

	return vport;

error_unlock:
	rtnl_unlock();
	free_percpu(vport->dev->tstats);
error_free_netdev:
	free_netdev(vport->dev);
error_free_vport:
	ovs_vport_free(vport);
error:
	return ERR_PTR(err);
}
```

### system

此类vport（'ovs-dpctl show'未显示类型的接口）是对设备原有接口的封装，内核类型为'OVS_VPORT_TYPE_NETDEV'。定义的vport操作变量为'ovs_netdev_vport_ops'。

```c
static struct vport_ops ovs_netdev_vport_ops = {
	.type		= OVS_VPORT_TYPE_NETDEV,
	.create		= netdev_create,
	.destroy	= netdev_destroy,
	.send		= dev_queue_xmit,
};
```

此种接口创建内部比较特殊，因此需要特殊强调。在'netdev_create'中有一段如下代码

```c
static struct vport *netdev_create(const struct vport_parms *parms)
{
	struct vport *vport;

	vport = ovs_vport_alloc(0, &ovs_netdev_vport_ops, parms);
	if (IS_ERR(vport))
		return vport;

	return ovs_netdev_link(vport, parms->name);
}
```
```c
struct vport *ovs_vport_alloc(int priv_size, const struct vport_ops *ops,
			  const struct vport_parms *parms)
{
	struct vport *vport;
	size_t alloc_size;
	/*vport分配空间*/
	alloc_size = sizeof(struct vport);
	if (priv_size) {
		alloc_size = ALIGN(alloc_size, VPORT_ALIGN);
		alloc_size += priv_size;
	}

	vport = kzalloc(alloc_size, GFP_KERNEL);
	if (!vport)
		return ERR_PTR(-ENOMEM);
	/*初始化*/
	vport->dp = parms->dp;
	vport->port_no = parms->port_no;
	vport->ops = ops;
	INIT_HLIST_NODE(&vport->dp_hash_node);

	if (ovs_vport_set_upcall_portids(vport, parms->upcall_portids)) {
		kfree(vport);
		return ERR_PTR(-EINVAL);
	}

	return vport;
}
```

```c
struct vport *ovs_netdev_link(struct vport *vport, const char *name)
{
	int err;
	/*此种类型接口是对系统原有口的映射，因此dev赋值为系统原有接口的dev*/
	vport->dev = dev_get_by_name(ovs_dp_get_net(vport->dp), name);
	if (!vport->dev) {
		err = -ENODEV;
		goto error_free_vport;
	}
	/*系统接口为以下情况是报错退出：
	- loopback口
   	- 非ARPHRD_ETHER接口
    - OVS_VPORT_TYPE_INTERNAL类型接口
    */
	if (vport->dev->flags & IFF_LOOPBACK ||
	    vport->dev->type != ARPHRD_ETHER ||
	    ovs_is_internal_dev(vport->dev)) {
		err = -EINVAL;
		goto error_put;
	}
	/*所有system都是datapatch 接口的slave接口；
	默认只要一个datapath接口(ovs-system)，所有system类型的master都为此接口。
	*/
	rtnl_lock();
	err = netdev_master_upper_dev_link(vport->dev,
					   get_dpdev(vport->dp), NULL, NULL);
	if (err)
		goto error_unlock;

	err = netdev_rx_handler_register(vport->dev, netdev_frame_hook,
					 vport);
	if (err)
		goto error_master_upper_dev_unlink;
	/*禁用接口的lro功能；*/
	dev_disable_lro(vport->dev);
  	/*开启混杂模式*/
	dev_set_promiscuity(vport->dev, 1);
  	/*设置接口私有类型*/
	vport->dev->priv_flags |= IFF_OVS_DATAPATH;
	rtnl_unlock();

	return vport;

error_master_upper_dev_unlink:
	netdev_upper_dev_unlink(vport->dev, get_dpdev(vport->dp));
error_unlock:
	rtnl_unlock();
error_put:
	dev_put(vport->dev);
error_free_vport:
	ovs_vport_free(vport);
	return ERR_PTR(err);
}
```

'netdev_rx_handler_register'实现如下

```c
int netdev_rx_handler_register(struct net_device *dev,
			       rx_handler_func_t *rx_handler,
			       void *rx_handler_data)
{
	ASSERT_RTNL();

	if (dev->rx_handler)
		return -EBUSY;

	/* Note: rx_handler_data must be set before rx_handler */
  	/*定义dev收包处理私有数据，即 vport指针，此处完成系统dev到vport的对应。
  	定义接口收包处理函数。*/
	rcu_assign_pointer(dev->rx_handler_data, rx_handler_data);
	rcu_assign_pointer(dev->rx_handler, rx_handler);

	return 0;
}
```

此类接口定义了 'rx_handler'，因此，在CPU报文处理函数'__netif_receive_skb_core'中

```c
……
rx_handler = rcu_dereference(skb->dev->rx_handler);
……
type = skb->protocol;
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

也就是说此类接口处理报文在协议栈之前，因此netfilter对此类接口不起作用，所以在云环境（openstack）中，需要在虚拟机tap口与虚拟交换机之间增加Linux bridge设备来使报文经过协议栈（netfilter起作用）来实现security group。

### vxlan

- 'ovs-vsctl show'显示的type 为'vxlan'类型，此种接口为ovs虚拟接口。
- 'ovs-dpctl show'显示的type 为'vxlan'类型，此种接口是对系统的封装，可看做系统口。

ovs vxlan创建在文件'vport-vxlan.c'中，定义 操作如下

```c
static struct vport_ops ovs_vxlan_netdev_vport_ops = {
	.type			= OVS_VPORT_TYPE_VXLAN,
	.create			= vxlan_create,
	.destroy		= ovs_netdev_tunnel_destroy,
	.get_options		= vxlan_get_options,
#ifndef USE_UPSTREAM_TUNNEL
	.fill_metadata_dst	= vxlan_fill_metadata_dst,
#endif
	.send			= vxlan_xmit,
};
```

vxlan_create定义如下

```c
static struct vport *vxlan_create(const struct vport_parms *parms)
{
	struct vport *vport;
	/*alloc 创建接口*/
	vport = vxlan_tnl_create(parms);
	if (IS_ERR(vport))
		return vport;
	/*link设置*/
	return ovs_netdev_link(vport, parms->name);
}
```

'ovs_netdev_link' 函数上面已经分析过，值得注意的是，vxlan类型的接口也收包函数也是 'netdev_frame_hook' 。

基本上系统口都有master，而master为'ovs-system'。

![系统接口master](/images/OVS数据收发流程解析/系统接口master.png)

对于ovs-system作用，还没搞清楚。

## OVS接口报文处理

### system接口

虚拟机利用TUN/TAP端口来与宿主机通信，此种端口是通过命令'ip tuntap add'来创建。ovs对原有接口的封装，也包括这类接口。

#### 收包处理

1. netdev_frame_hook

  ```c
  /* Called with rcu_read_lock and bottom-halves disabled. */
  static rx_handler_result_t netdev_frame_hook(struct sk_buff **pskb)
  {
  	struct sk_buff *skb = *pskb;

  	if (unlikely(skb->pkt_type == PACKET_LOOPBACK))
  		return RX_HANDLER_PASS;
  /*USE_UPSTREAM_TUNNEL管理不同的目的处理*/
  #ifndef USE_UPSTREAM_TUNNEL
  	netdev_port_receive(skb, NULL);
  #else
  	netdev_port_receive(skb, skb_tunnel_info(skb));
  #endif
  	return RX_HANDLER_CONSUMED;
  }
  ```

2. netdev_port_receive

   ```c
   void netdev_port_receive(struct sk_buff *skb, struct ip_tunnel_info *tun_info)
   {
   	struct vport *vport;
   	/*获取vport数据*/
   	vport = ovs_netdev_get_vport(skb->dev);
   	if (unlikely(!vport))
   		goto error;
   	/*接口禁止了lro相关，因此skb需要lro相关则报错退出*/
   	if (unlikely(skb_warn_if_lro(skb)))
   		goto error;
     	/*user不唯一则进行clone*/
   	skb = skb_share_check(skb, GFP_ATOMIC);
   	if (unlikely(!skb))
   		return;
   	/*恢复二层头，下面用得到*/
   	skb_push(skb, ETH_HLEN);
     	/*重新计算校验和*/
   	skb_postpush_rcsum(skb, skb->data, ETH_HLEN);
   	ovs_vport_receive(vport, skb, tun_info);
   	return;
   error:
   	kfree_skb(skb);
   }
   ```

3. ovs_vport_receive

   ```c
   int ovs_vport_receive(struct vport *vport, struct sk_buff *skb,
   		      const struct ip_tunnel_info *tun_info)
   {
   	struct sw_flow_key key;
   	int error;
   	/*ovs私有数据*/
   	OVS_CB(skb)->input_vport = vport;
   	OVS_CB(skb)->mru = 0;
   	OVS_CB(skb)->cutlen = 0;
     	/*判断是否属于同一个网络空间*/
   	if (unlikely(dev_net(skb->dev) != ovs_dp_get_net(vport->dp))) {
   		u32 mark;

   		mark = skb->mark;
   		skb_scrub_packet(skb, true);
   		skb->mark = mark;
   		tun_info = NULL;
   	}
   	/*ovs内部协议号*/
   	ovs_skb_init_inner_protocol(skb);
   	skb_clear_ovs_gso_cb(skb);
   	/*此函数会解析skb内容，并给key中字段赋值*/
   	error = ovs_flow_key_extract(tun_info, skb, &key);
   	if (unlikely(error)) {
   		kfree_skb(skb);
   		return error;
   	}
   	ovs_dp_process_packet(skb, &key);
   	return 0;
   }
   ```

4. ovs_dp_process_packet

   ```C
   void ovs_dp_process_packet(struct sk_buff *skb, struct sw_flow_key *key)
   {
   	const struct vport *p = OVS_CB(skb)->input_vport;
   	struct datapath *dp = p->dp;
   	struct sw_flow *flow;
   	struct sw_flow_actions *sf_acts;
   	struct dp_stats_percpu *stats;
   	u64 *stats_counter;
   	u32 n_mask_hit;

   	stats = this_cpu_ptr(dp->stats_percpu);

   	/*根据key找flow表，没有的话进行upcall；
   	本文暂不对这些功能函数进行具体分析*/
   	flow = ovs_flow_tbl_lookup_stats(&dp->table, key, skb_get_hash(skb),
   					 &n_mask_hit);
   	if (unlikely(!flow)) {
   		struct dp_upcall_info upcall;
   		int error;

   		memset(&upcall, 0, sizeof(upcall));
   		upcall.cmd = OVS_PACKET_CMD_MISS;
   		upcall.portid = ovs_vport_find_upcall_portid(p, skb);
   		upcall.mru = OVS_CB(skb)->mru;
   		error = ovs_dp_upcall(dp, skb, key, &upcall, 0);
   		if (unlikely(error))
   			kfree_skb(skb);
   		else
   			consume_skb(skb);
   		stats_counter = &stats->n_missed;
   		goto out;
   	}
   	/*flow填充到skb私有数据，并执行action*/
   	ovs_flow_stats_update(flow, key->tp.flags, skb);
   	sf_acts = rcu_dereference(flow->sf_acts);
   	ovs_execute_actions(dp, skb, sf_acts, key);

   	stats_counter = &stats->n_hit;

   out:
   	/* Update datapath statistics. */
   	u64_stats_update_begin(&stats->syncp);
   	(*stats_counter)++;
   	stats->n_mask_hit += n_mask_hit;
   	u64_stats_update_end(&stats->syncp);
   }
   ```

5. ovs_execute_actions

   ```c
   /* Execute a list of actions against 'skb'. */
   int ovs_execute_actions(struct datapath *dp, struct sk_buff *skb,
   			const struct sw_flow_actions *acts,
   			struct sw_flow_key *key)
   {
   	int err, level;
   	/*单个CPU同时处理（准确的说，应该是排队，可能进程调度）4条报文*/
   	level = __this_cpu_inc_return(exec_actions_level);
   	if (unlikely(level > OVS_RECURSION_LIMIT)) {
   		net_crit_ratelimited("ovs: recursion limit reached on datapath %s, probable configuration error\n",
   				     ovs_dp_name(dp));
   		kfree_skb(skb);
   		err = -ENETDOWN;
   		goto out;
   	}

   	err = do_execute_actions(dp, skb, key,
   				 acts->actions, acts->actions_len);

   	if (level == 1)
   		process_deferred_actions(dp);

   out:
   	__this_cpu_dec(exec_actions_level);
   	return err;
   }
   ```

   在do_execute_actions函数中会根据flow进行处理，如果action是 output的话则调用

   ```c
   do_output(dp, skb, prev_port, key);
   ```

6. do_output

   ```c
   static int do_output(struct datapath *dp, struct sk_buff *skb, int out_port)
   {
   	struct vport *vport;

   	if (unlikely(!skb))
   		return -ENOMEM;

   	vport = ovs_vport_rcu(dp, out_port);
   	if (unlikely(!vport)) {
   		kfree_skb(skb);
   		return -ENODEV;
   	}
   	/*vport是flow找到的out_port的vport,因此，此处会调用vport的send函数*/
   	ovs_vport_send(vport, skb);
   	return 0;
   }
   ```


#### 发包处理

接口初始化注册的发包函数为'dev_queue_xmit'。

### internal接口

#### 收包处理

internal接口报文一般会从system类型接口传入，从system接口收包处理过程继续，internal类型接口定义的send函数为'internal_dev_recv'。

```c
static netdev_tx_t internal_dev_recv(struct sk_buff *skb)
{
	struct net_device *netdev = skb->dev;
	struct pcpu_sw_netstats *stats;
	/*接口没有管理UP，直接丢包*/
	if (unlikely(!(netdev->flags & IFF_UP))) {
		kfree_skb(skb);
		netdev->stats.rx_dropped++;
		return NETDEV_TX_OK;
	}
	/*初始化dst计数*/
	skb_dst_drop(skb);
  	/*更改某些数据（接口或会话）使用计数*/
	nf_reset(skb);
	secpath_reset(skb);
	/*更改skb接入类型、协议*/
	skb->pkt_type = PACKET_HOST;
	skb->protocol = eth_type_trans(skb, netdev);
	skb_postpull_rcsum(skb, eth_hdr(skb), ETH_HLEN);

	stats = this_cpu_ptr(netdev->tstats);
	u64_stats_update_begin(&stats->syncp);
	stats->rx_packets++;
	stats->rx_bytes += skb->len;
	u64_stats_update_end(&stats->syncp);
	/*此函数以前的文章分析过，此处不在重复*/
	netif_rx(skb);
	return NETDEV_TX_OK;
}
```

#### 发包处理

netif_rx函数重新进入了本机协议栈的处理，而internal类型的接口没有设置'rx_handler'，因此进入正常协议栈流程，最后会进入正常转发流程。

```c
dev_queue_xmit -> dev_hard_start_xmit -> ops->ndo_start_xmit(skb, dev);
```

而internal在接口创建的时候定义了 ndo_start_xmit。

```c
static struct vport *internal_dev_create(const struct vport_parms *parms)
{
	……
	vport->dev = alloc_netdev(sizeof(struct internal_dev),
				  parms->name, NET_NAME_USER, do_setup);
	if (!vport->dev) {
		err = -ENOMEM;
		goto error_free_vport;
	}
  	……
}
```

```c
static const struct net_device_ops internal_dev_netdev_ops = {
	.ndo_open = internal_dev_open,
	.ndo_stop = internal_dev_stop,
	.ndo_start_xmit = internal_dev_xmit,
	.ndo_set_mac_address = eth_mac_addr,
	.ndo_change_mtu = internal_dev_change_mtu,
	.ndo_get_stats64 = internal_get_stats,
#ifdef HAVE_IFF_PHONY_HEADROOM
	.ndo_set_rx_headroom = internal_set_rx_headroom,
#endif
};

static void do_setup(struct net_device *netdev)
{
	……
	netdev->netdev_ops = &internal_dev_netdev_ops;
  	……
}
```

继续走读函数

```c
static int internal_dev_xmit(struct sk_buff *skb, struct net_device *netdev)
{
	rcu_read_lock();
  	/*函数前面已经解析*/
	ovs_vport_receive(internal_dev_priv(netdev)->vport, skb);
	rcu_read_unlock();
  	……
	return 0;
}
```

### vxlan接口

vxlan接口的 收包处理(netdev_frame_hook) 和 发包处理(vxlan_xmit)，已经分析过。

## 优秀资料

[OVS中端口数据包收发流程](http://ry0117.com/2016/12/25/OVS%E4%B8%AD%E7%AB%AF%E5%8F%A3%E6%95%B0%E6%8D%AE%E5%8C%85%E6%94%B6%E5%8F%91%E6%B5%81%E7%A8%8B/)

[Openvswitch原理与代码分析(1)：总体架构](http://www.cnblogs.com/popsuper1982/p/5848879.html)

