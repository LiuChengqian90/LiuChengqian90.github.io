---
title: VLAN 简介
date: 2017-12-26 16:28:50
tags:
  - VLAN
typora-root-url: ../../../source
---

## 简述

以太网是一种基于CSMA/CD (Carrier Sense Multiple Access/Collision Detect，载波侦听多路访问/冲突检测)的共享通讯介质的数据网络通讯技术，当主机数目较多时会导致冲突严重、广播泛滥、性能显著下降甚至使网络不可用等问题。通过交换机实现LAN互联虽然可以解决冲突(Collision)严重的问题，但仍然不能隔离广播报文。在这种情况下出现了VLAN (Virtual Local Area Network，虚拟局域网)技术，这种技术可以把一个LAN划分成多个逻辑的LAN——VLAN，每个VLAN是一个广播域，VLAN内的主机间通信就和在一个LAN内一样，而VLAN间则不能直接互通，这样，广播报文被限制在一个VLAN内，如下图所示。

![VLAN结构图](/images/VLAN 简介/VLAN结构图.jpg)

VLAN的划分不受物理位置的限制：不在同一物理位置范围的主机可以属于同一个VLAN；一个VLAN包含的用户可以连接在同一个交换机上，也可以跨越交换机，甚至可以跨越路由器。 

VLAN的优点如下：

1.  限制广播域。广播域被限制在一个VLAN内，节省了带宽，提高了网络处理能力。
2.  增强局域网的安全性。VLAN问的二层报文是相互隔离的，即一个VLAN内的用户不能和其它VLAN内的用户直接通信，如果不同VLAN要进行通信，则需通过路由器或三层交换机等三层设备。
3.  灵活构建虚拟工作组。用VLAN可以划分不同的用户到不同的工作组，同一工作组的用户也不必局限于某一固定的物理范围，网络构建和维护更方便灵活。

## 原理

传统以太网封装格式如下图。

![传统封装格式](/images/VLAN 简介/传统封装格式.png)

要使网络设备能够分辨不同VLAN的报文，需要在报文中添加标识VLAN的字段。由于VLAN是对二层网络进行限制，因此，识别字段需要添加到数据链路层封装中，如下图。

![VLAN格式](/images/VLAN 简介/VLAN格式.png)

VLAN Tag包含四个字段，分别是TPID(Tag Protocol Identifier，标签协议标识符)、Priority, CFI(Canonical Format Indicator，标准格式指示位)和VLAN ID。   

- TPID用来判断本数据帧是否带有VLAN Tag，长度为16bit，缺省取值为0x8100。
- Priority表示报文的802.1P优先级，长度为3bit。     
- CFI字段标识MAC地址在不同的传输介质中是否以标准格式进行封装，长度为1 bit，取值为0表示MAC地址以标准格式进行封装，为1表示以非标准格式封装，缺省取值为0。
- VLAN ID标识该报文所属VLAN的编号，长度为12bit，取值范围为0-4095。由于0和4095为协议保留取值，所以VLAN ID的取值范围为1-4094。

网络设备利用VLAN ID来识别报文所属的VLAN，根据报文是否携带VLAN Tag以及携带的VLAN Tag值，来对报文进行处理。

## VLAN划分

Linux中配置VLAN的工具 'vconfig'是基于端口对VLAN进行划分。命令行如下（仅截取部分）：

![vconfig](/images/VLAN 简介/vconfig.png)

此命令只是简单支持，一次只能增加一个vlan 接口。看了下面对接口类型的介绍就会知道，对于trunk类型的接口配置很不利。

## 接口类型

| 类型     | 简述                                       | Linux是否支持          |
| ------ | ---------------------------------------- | ------------------ |
| Access | 端口发出去的报文不带tag标签。一般用于和不能识别VLAN tag的终端设备相连，或者不需要区分不同VLAN成员时使用。 | 原生代码不区分类型，都打Tag出去。 |
| Trunk  | 端口发出去的报文，端口缺省VLAN内的报文不带tag，其它VLAN内的报文都必须带tag。 | 原生代码不区分类型，都打Tag出去。 |
| Hybrid | 端口发出去的报文可根据需要设置某些VLAN内的报文带tag，某些VLAN内的报文不带tag。 | 不支持。               |

## Neutron 中 VLAN 支持

### 网络节点配置

修改文件 '/etc/neutron/plugins/ml2/ml2_conf.ini'

```yaml
[ml2_type_vlan]
network_vlan_ranges = vlannet:1000:2000
```

vlannet 是在计算节点定义的 从物理接口映射来的虚拟网络。

1000:2000 是创建网络时可选择的vlan id范围。

### 计算节点配置

修改文件 ‘/etc/neutron/plugins/ml2/openvswitch_agent.ini ’

```yaml
[ovs]
……
bridge_mappings =vlannet:br-vlan
……
```

Neutron网络中 配置文件，bridge_mappings是将公共虚拟网络和公共物理网络接口对应起来。

之后在每个节点上重启有关服务即可。

### 验证

1. 创建VLAN网络。

   ![vlansub](/images/VLAN 简介/vlansub.png)

   ![valnnet](/images/VLAN 简介/valnnet.png)

2. 创建虚拟机。

3. 查看openflow规则。

   ![br-vlan-ports](/images/VLAN 简介/br-vlan-ports.png)

   ![br-int-ports](/images/VLAN 简介/br-int-ports.png)

   ![br-int-tag](/images/VLAN 简介/br-int-tag.png)

   ![br-vlan-flow.png](/images/VLAN 简介/br-vlan-flow.png)

   ![br-int-flow.png](/images/VLAN 简介/br-int-flow.png)

   由br-int 流表可知，从 br-vlan 进入的流量，会去掉 1000的 vlan tag，打上1的tag。
   由br-vlan流表可知，从br-int进入的流量，会去掉1的tag，打上1000 的 vlan tag出去。