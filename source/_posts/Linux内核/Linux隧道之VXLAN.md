---
title: Linux隧道之VXLAN
date: 2017-12-26 17:50:28
categories: Linux内核
tags:
  - VXLAN
typora-root-url: ../../../source
---

## 起因

任何技术的产生，都有其特定的时代背景与实际需求，VXLAN正是为了解决云计算时代虚拟化中的一系列问题而产生的一项技术。

云计算平台中，服务器虚拟化技术的广泛部署，极大地增加了数据中心的计算密度；同时，为了实现业务的灵活变更，虚拟机VM（Virtual Machine）需要能够在网络中不受限迁移。
<!--more-->
然而，虚拟机数量的快速增长与虚拟机迁移业务的日趋频繁，给传统的“二层+三层”数据中心网络带来了新的挑战：

- 虚拟机规模受网络设备表项规格的限制

  对于同网段主机的通信而言，报文通过查询MAC表进行二层转发。服务器虚拟化后，数据中心中VM的数量比原有的物理机发生了数量级的增长，伴随而来的便是虚拟机网卡MAC地址数量的空前增加。

- 传统网络的隔离能力有限

  VLAN作为当前主流的网络隔离技术，在标准定义中只有12比特，也就是说可用的VLAN数量只有4000个左右。对于公有云或其它大型虚拟化云计算服务这种动辄上万甚至更多租户的场景而言，VLAN的隔离能力显然已经力不从心。

- 虚拟机迁移范围受限

  虚拟机迁移，顾名思义，就是将虚拟机从一个物理机迁移到另一个物理机，但是要求在迁移过程中业务不能中断。要做到这一点，需要保证虚拟机迁移前后，其IP地址、MAC地址等参数维持不变。这就决定了，虚拟机迁移必须发生在一个二层域中。而传统数据中心网络的二层域，将虚拟机迁移限制在了一个较小的局部范围内。

## 原理

VXLAN（Virtual eXtensible Local Area Network，虚拟扩展局域网），是由IETF定义的NVO3（Network Virtualization over Layer 3）标准技术之一，采用L2 over L4（MAC-in-UDP）的报文封装模式，将二层报文用三层协议进行封装，可实现二层网络在三层范围内进行扩展，同时满足数据中心大二层虚拟迁移和多租户的需求。

```yaml
NVO3是基于三层IP overlay网络构建虚拟网络的技术的统称，VXLAN只是NVO3技术之一。
除此之外，比较有代表性的还有NVGRE、STT。
```

### 报文格式

在分析报文格式之前，先明确几个概念：

| 概念                           | 描述                                       |
| ---------------------------- | ---------------------------------------- |
| NVE-Network Virtual Endpoint | NVE是实现网络虚拟化功能的**网络实体**。报文经过NVE封装转换后，NVE间就可基于三层基础网络建立二层虚拟化网络。 |
| VTEP-VXLAN Tunnel Endpoints  | VTEP是VXLAN隧道端点，封装在NVE中，用于VXLAN报文的封装和解封装。 |
| VNI-VXLAN Network Identifier | 类似VLAN ID，用于区分VXLAN段，不同VXLAN段的虚拟机不能直接二层相互通信。 |

关系如下

![VXLAN网络结构](/images/Linux隧道之VXLAN/VXLAN网络结构.png)

NVE直接传输的VXLAN报文格式如下

![vxlan报文格式](/images/Linux隧道之VXLAN/vxlan报文格式.jpg)

如图所示，原始报文（从vm发出的报文）经过了4层包装。由内而外依次为

- VXLAN Header

  VXLAN头（8字节），其中包含24比特的VNI字段，用来定义VXLAN网络中不同的租户。此外，还包含VXLAN Flags（8比特，取值为00001000）和两个保留字段（分别为24比特和8比特）。

- UDP Header

  UDP头（8字节），VXLAN头和原始以太帧一起作为UDP的数据。UDP头中，目的端口号（VXLAN Port）固定为4789，源端口号（UDP Src. Port）是原始以太帧通过哈希算法计算后的值。

- Outer IP Header

  封装外层IP头（20字节）。其中，源IP地址（Outer Src. IP）为源VM所属VTEP的IP地址，目的IP地址（Outer Dst. IP）为目的VM所属VTEP的IP地址。

- Outer MAC Header

  封装外层以太头（14字节），如果加上VLAN段的话应该是 18字节。其中，源MAC地址（Src. MAC Addr.）为源VM所属VTEP的MAC地址，目的MAC地址（Dst. MAC Addr.）为到达目的VTEP的路径上下一跳设备的MAC地址。


知道了其逻辑及报文格式，那么下面来看vxlan是如何进行报文转发的。

## 报文转发

基本的二三层转发中，二层转发依赖的是MAC表，如果没有对应的MAC表，则主机发送ARP广播报文请求对端的MAC地址；三层转发依赖的是FIB表。在VXLAN中，其实也是同样的道理。

### 同子网互通

![同子网VM互通组网图](/images/Linux隧道之VXLAN/同子网VM互通组网图.jpg)

VM_A、VM_B和VM_C同属于10.1.1.0/24网段，且同属于VNI 5000。此时，VM_A想与VM_C进行通信。

由于是首次进行通信，VM_A上没有VM_C的MAC地址，所以会发送ARP广播报文请求VM_C的MAC地址。下面就让我们根据ARP请求报文及ARP应答报文的转发流程，来看下MAC地址是如何进行学习的。

#### ARP请求

![ARP请求报文转发流程](/images/Linux隧道之VXLAN/ARP请求报文转发流程.jpg)

1. VM_A发送源MAC为MAC_A、目的MAC为全F、源IP为IP_A、目的IP为IP_C的ARP广播报文，请求VM_C的MAC地址。

2. VTEP_1收到ARP请求后，根据二层子接口上的配置判断报文需要进入VXLAN隧道。确定了报文所属BD（Bridge Domain，类似VLAN的概念-虚拟局域网）后，也就确定了报文所属的VNI。同时，VTEP_1学习MAC_A、VNI和报文入接口（Port_1，即二层子接口对应的物理接口）的对应关系，并记录在本地MAC表中。之后，VTEP_1会根据头端复制列表对报文进行复制，并分别进行封装。

   这里封装的外层源IP地址为本地VTEP（VTEP_1）的IP地址，外层目的IP地址为对端VTEP（VTEP_2和VTEP_3）的IP地址；外层源MAC地址为本地VTEP的MAC地址，而外层目的MAC地址为去往目的IP的网络中下一跳设备的MAC地址。

   封装后的报文，根据外层MAC和IP信息，在IP网络中进行传输，直至到达对端VTEP。

3. 报文到达VTEP_2和VTEP_3后，VTEP对报文进行**解封装**，得到VM_A发送的原始报文。同时，VTEP_2和VTEP_3学习VM_A的MAC地址、VNI和远端VTEP的IP地址（IP_1）的对应关系，并记录在本地MAC表中。之后，VTEP_2和VTEP_3根据二层子接口上的配置对报文进行相应的处理并在对应的二层域内广播。

4. VM_B和VM_C接收到ARP请求后，比较报文中的目的IP地址是否为本机的IP地址。VM_B发现目的IP不是本机IP，故将报文丢弃；VM_C发现目的IP是本机IP，则对ARP请求做出应答。

#### ARP应答

![ARP应答报文转发流程](/images/Linux隧道之VXLAN/ARP应答报文转发流程.jpg)

1. 由于此时VM_C上已经学习到了VM_A的MAC地址，所以ARP应答报文为单播报文。报文源MAC为MAC_C，目的MAC为MAC_A，源IP为IP_C、目的IP为IP_A。

2. VTEP_3接收到VM_C发送的ARP应答报文后，识别报文所属的VNI（识别过程与步骤2类似）。同时，VTEP_3学习MAC_C、VNI和报文入接口（Port_3）的对应关系，并记录在本地MAC表中。之后，VTEP_3对报文进行封装。

   可以看到，这里封装的外层源IP地址为本地VTEP（VTEP_3）的IP地址，外层目的IP地址为对端VTEP（VTEP_1）的IP地址；外层源MAC地址为本地VTEP的MAC地址，而外层目的MAC地址为去往目的IP的网络中下一跳设备的MAC地址。

   封装后的报文，根据外层MAC和IP信息，在IP网络中进行传输，直至到达对端VTEP。

3. 报文到达VTEP_1后，VTEP_1对报文进行解封装，得到VM_C发送的原始报文。同时，VTEP_1学习VM_C的MAC地址、VNI和远端VTEP的IP地址（IP_3）的对应关系，并记录在本地MAC表中。之后，VTEP_1将解封装后的报文发送给VM_A。

至此，VM_A和VM_C均已学习到了对方的MAC地址。之后，VM_A和VM_C将采用单播方式进行通信。

### 不同子网互通

![不同子网VM互通组网图](/images/Linux隧道之VXLAN/不同子网VM互通组网图.jpg)

VM_A和VM_B分别属于10.1.10.0/24网段和10.1.20.0/24网段，且分别属于VNI 5000和VNI 6000。VM_A和VM_B对应的三层网关分别是VTEP_3上BDIF 10和BDIF 20的IP地址。VTEP_3上存在到10.1.10.0/24网段和10.1.20.0/24网段的路由。此时，VM_A想与VM_B进行通信。

```yaml
BDIF接口的功能与VLANIF接口类似，是基于BD创建的三层逻辑接口，用以实现不同子网VM之间或VXLAN网络与非VXLAN网络之间的通信。
```

由于是首次进行通信，且VM_A和VM_B处于不同网段，VM_A需要先发送ARP广播报文请求网关（BDIF 10）的MAC，获得网关的MAC后，VM_A先将数据报文发送给网关；之后网关也将发送ARP广播报文请求VM_B的MAC，获得VM_B的MAC后，网关再将数据报文发送给VM_B。以上MAC地址学习的过程与同子网互通中MAC地址学习的流程一致，不再赘述。现在假设VM_A和VM_B均已学到网关的MAC、网关也已经学到VM_A和VM_B的MAC。

![不同子网VM互通报文转发流程](/images/Linux隧道之VXLAN/不同子网VM互通报文转发流程.jpg)

1. VM_A先将数据报文发送给网关。报文的源MAC为MAC_A，目的MAC为网关BDIF 10的MAC_10，源IP地址为IP_A，目的IP为IP_B。

2. VTEP_1收到数据报文后，识别此报文所属的VNI（VNI 5000），并根据MAC表项对报文进行封装。可以看到，这里封装的外层源IP地址为本地VTEP的IP地址（IP_1），外层目的IP地址为对端VTEP的IP地址（IP_3）；外层源MAC地址为本地VTEP的MAC地址（MAC_1），而外层目的MAC地址为去往目的IP的网络中下一跳设备的MAC地址。

   封装后的报文，根据外层MAC和IP信息，在IP网络中进行传输，直至到达对端VTEP。

3. 报文进入VTEP_3，VTEP_3对报文进行解封装，得到VM_A发送的原始报文。然后，VTEP_3会对报文做如下处理：

   - VTEP_3发现该报文的目的MAC为本机BDIF 10接口的MAC，而目的IP地址为IP_B（10.1.20.1），所以会根据路由表查找到IP_B的下一跳。
   - 发现下一跳为10.1.20.10，出接口为BDIF 20。此时VTEP_3查询ARP表项，并将原始报文的源MAC修改为BDIF 20接口的MAC（MAC_20），将目的MAC修改为VM_B的MAC（MAC_B）。
   - 报文到BDIF 20接口时，识别到需要进入VXLAN隧道（VNI 6000），所以根据MAC表对报文进行封装。这里封装的外层源IP地址为本地VTEP的IP地址（IP_3），外层目的IP地址为对端VTEP的IP地址（IP_2）；外层源MAC地址为本地VTEP的MAC地址（MAC_3），而外层目的MAC地址为去往目的IP的网络中下一跳设备的MAC地址。

   封装后的报文，根据外层MAC和IP信息，在IP网络中进行传输，直至到达对端VTEP。

4. 报文到达VTEP_2后，VTEP_2对报文进行解封装，得到内层的数据报文，并将其发送给VM_B。

```yaml
VXLAN网络与非VXLAN网络之间的互通，也需要借助于三层网关。
其实现不同点在于报文在VXLAN网络侧会进行封装，而在非VXLAN网络侧不需要进行封装。
报文从VXLAN侧进入网关并解封装后，就按照普通的单播报文发送方式进行转发。
```

## 优秀链接

[Vxlan基础理解](http://blog.csdn.net/freezgw1985/article/details/16354897/)

[Vxlan学习笔记——原理](http://www.cnblogs.com/hbgzy/p/5279269.html)

[VXLAN介绍](http://developer.huawei.com/cn/ict/Products/Agile_Network/Components/DCN/detail/net/VXLAN)

[技术发烧友：认识VXLAN](http://blog.51cto.com/justim/1745351)

[Neutron VxLAN + Linux Bridge 环境中的网络 MTU](http://www.cnblogs.com/sammyliu/p/5079898.html)