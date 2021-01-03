---
title: 解析Docker网络架构
date: 2020-12-07 11:05:19
categories:
tags:
  - docker
typora-root-url: ../../../source
---

<!--more-->

## Docker网络基础

Docker 网络使用内核的网络栈作为低级原语来创建更高级别的网络驱动程序。简而言之，*Docker 网络* **就是** *Linux 网络*。

Docker 使用了几个 Linux 网络基础模块来实现其原生网络驱动程序，包括 **Linux 网桥**，**网络命名空间**，**veth** 和 **iptables**。这些工具的组合（作为网络驱动程序实现）为复杂的网络策略提供转发规则，网络分段和管理工具。

### Linux 网桥

**Linux 网桥**是第 2 层设备，它是 Linux 内核中物理交换机的虚拟实现。它通过检视流量动态学习 MAC 地址，并据此转发流量。

Linux 网桥广泛用于许多 Docker 网络驱动程序中。Linux 网桥不应与 Docker 网络驱动程序 bridge 混淆，后者是 Linux 网桥的更高级别实现。

### 网络命名空间

**Linux 网络命名空间**是内核中隔离的网络栈，具有自己的接口，路由和防火墙规则。它负责容器和 Linux 的安全方面，用于隔离容器。

在网络术语中，它们类似于 VRF，它将主机内的网络控制和数据隔离。网络命名空间确保同一主机上的两个容器无法相互通信，甚至无法与主机本身通信，除非通过 Docker 网络进行配置。通常，Docker网络驱动程序为每个容器实现单独的命名空间。但是，容器可以共享相同的网络命名空间，甚至可以是主机网络命名空间的一部分。主机网络命名空间容纳主机接口和主机路由表。此网络命名空间称为全局网络命名空间。

### 虚拟以太网设备

**虚拟以太网设备**或简称 **veth** 是 Linux 网络接口，充当两个网络命名空间之间的连接线。veth 是一个全双工链接，每个命名空间中都有一个接口。一个接口中的流量被引导出另一个接口。Docker 网络驱动程序利用 veth 在创建 Docker 网络时提供名称空间之间的显式连接。当容器连接到 Docker 网络时，veth 的一端放在容器内（通常被视为 ethX 接口），而另一端连接到 Docker 网络。

### iptables

**iptables** 是原生包过滤系统，自 2.4 版本以来一直是 Linux 内核的一部分。它是一个功能丰富的 L3/L4 防火墙，为数据包的标记，伪装和丢弃提供规则链。本机 Docker 网络驱动程序广泛使用 iptables 来隔离网络流量，提供主机端口映射，并标记流量以实现负载平衡决策。



## Docker网络架构

Docker自1.9版本中引入了一整套docker network子命令和跨主机网络支持。这允许用户可以根据他们应用的拓扑结构创建虚拟网络并将容器接入其所对应的网络。在之前的版本中，网络部分代码被抽离并单独成为了Docker的网络库，即**[libnetwork](https://github.com/moby/libnetwork)**。在此之后，容器的网络模式也被抽像变成了统一接口的驱动。

为了标准化网络的驱动开发步骤和支持多种网络驱动，Docker公司在libnetwork中使用了**CNM（Container Network Model）**。

CNM定义了构建容器虚拟化网络的模型，同时还提供了可以用于开发多种网络驱动的标准化接口和组件。

CNM 的设计哲学是为了提供跨多种基础设施的应用可移植性。这一模型在应用可移植性和充分利用基础设施自有特性、能力之间，取得了一个平衡。

**Docker daemon通过调用libnetwork对外提供的API完成网络的创建和管理等功能。libnetwrok中则使用了CNM来完成网络功能的提供。**



![DOCKER-NET-AR-1](/images/解析Docker网络架构/DOCKER-NET-AR-1.png)

### CNI组件

- **沙箱** —— 一个沙箱包含容器的网络栈配置。这包括容器接口的管理、路由表和 DNS 设置。沙箱的实现可以是 Linux Network Namespace，FreeBSD Jail 或是其他类似的技术。一个沙箱可以包含来自不同网络的多个端点。
- **端点** —— 端点负责将沙箱与网络相连。端点部件的存在使得实际的网络连接可以从应用中抽象出来。这有助于维持可移植性，使服务可以采用不同的网络驱动，而无需顾虑如何与网络相连。
- **网络** —— CNM 并不是用 OSI 模型中的概念来诠释“网络”。网络部件的实现可以通过 Linux bridge，VLAN 等等。网络就是一个相互连通的若干端点的集合。与网络不连通的端点不具有网络连通性。

### CNI驱动接口

容器网络模型 CNM 提供了两个可插拔的开放接口，供用户、社区和供应商使用，以更好地利用网络中的其他功能、可见性或可控性。

存在以下两种网络驱动接口：

- **网络驱动**—— Docker 网络驱动提供使网络运行的实际实现。它们是可插拔的，因此可以使用不同的驱动程序并轻松互换以支持不同的用例。可以在给定的 Docker Engine 或群集上同时使用多个网络驱动程序，但每个 Docker 网络仅通过单个网络驱动程序进行实例化。有两种类型的 CNM 网络驱动程序：
  - **原生网络驱动** —— 原生网络驱动程序是 Docker Engine 的原生部分，由 Docker 提供。有多种驱动程序可供选择，支持不同的功能，如覆盖网络或本地网桥。
  - **远程网络驱动** —— 远程网络驱动是社区和其他供应商创建的网络驱动程序。这些驱动程序可用于和现有软硬件相集成。用户还可以在需要用到现有网络驱动程序不支持的特定功能的情况下创建自己的驱动程序。
- **IPAM 驱动** —— Docker 具有本机 IP 地址管理驱动程序，若未另加指定，将为网络和端点提供默认子网或 IP 地址。IP 地址也可以通过网络、容器和服务创建命令手动分配。我们同样拥有远程 IPAM 驱动程序，可与现有 IPAM 工具集成。

![DOCKER-NET-AR-2](/images/解析Docker网络架构/DOCKER-NET-AR-2.png)

### Docker 原生网络驱动

Docker [原生网络驱动程序](https://github.com/moby/libnetwork/tree/master/drivers)是 Docker Engine 的一部分，不需要任何额外的模块。它们通过标准 Docker 网络命令调用和使用。

| 驱动    | 描述                                                         |
| ------- | ------------------------------------------------------------ |
| bridge  | `bridge` 驱动会在 Docker 管理的主机上创建一个 Linux 网桥。默认情况下，网桥上的容器可以相互通信。也可以通过 `bridge` 驱动程序配置，实现对外部容器的访问。 |
| host    | 使用 `host` 驱动意味着容器将使用主机的网络栈。没有命名空间分离，主机上的所有接口都可以由容器直接使用。 |
| overlay | `overlay` 驱动创建一个支持多主机网络的覆盖网络。它综合使用本地 Linux 网桥和 VXLAN，通过物理网络基础架构覆盖容器到容器的通信。 |
| ipvlan  |                                                              |
| macvlan | `macvlan` 驱动使用 MACVLAN 桥接模式在容器接口和父主机接口（或子接口）之间建立连接。它可用于为在物理网络上路由的容器提供 IP 地址。此外，可以将 VLAN 中继到 `macvlan` 驱动程序以强制执行第 2 层容器隔离。 |
| none    | `none` 驱动程序为容器提供了自己的网络栈和网络命名空间，但不配置容器内的接口。如果没有其他配置，容器将与主机网络栈完全隔离。 |



#### 网络范围

如 `docker network ls` 命令结果所示，Docker 网络驱动程序具有 *范围* 的概念。网络范围是驱动程序的作用域，可以是本地范围或 Swarm 集群范围。本地范围驱动程序在主机范围内提供连接和网络服务（如 DNS 或 IPAM）。Swarm 范围驱动程序提供跨群集的连接和网络服务。集群范围网络在整个群集中具有相同的网络 ID，而本地范围网络在每个主机上具有唯一的网络 ID。

![image-20201231120322142](/images/解析Docker网络架构/DOCKER-NET-AR-3.png)

### Docker 远程网络驱动

| 驱动                                                         | 描述                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| [**contiv**](http://contiv.github.io/)                       | 由 Cisco Systems 领导的开源网络插件，为多租户微服务部署提供基础架构和安全策略。Contiv 还为非容器工作负载和物理网络（如 ACI）提供兼容集成。Contiv 实现了远程网络和 IPAM 驱动。 |
| [**weave**](https://www.weave.works/docs/net/latest/introducing-weave/) | 作为网络插件，weave 用于创建跨多个主机或多个云连接 Docker 容器的虚拟网络。Weave 提供应用程序的自动发现功能，可以在部分连接的网络上运行，不需要外部群集存储，并且操作友好。 |
| [**calico**](https://www.projectcalico.org/)                 | 云数据中心虚拟网络的开源解决方案。它面向数据中心，大多数工作负载（虚拟机，容器或裸机服务器）只需要 IP 连接。Calico 使用标准 IP 路由提供此连接。工作负载之间的隔离都是通过托管源和目标工作负载的服务器上的 iptables 实现的，无论是根据租户所有权还是任何更细粒度的策略。 |
| [**kuryr**](https://github.com/openstack/kuryr)              | 作为 OpenStack Kuryr 项目的一部分开发的网络插件。它通过利用 OpenStack 网络服务 Neutron 实现 Docker 网络（libnetwork）远程驱动程序 API。Kuryr 还包括一个 IPAM 驱动程序。 |

### Docker 远程 IPAM 驱动

| 驱动                                                         | 描述                                                 |
| ------------------------------------------------------------ | ---------------------------------------------------- |
| [**infoblox**](https://hub.docker.com/r/infoblox/ipam-driver/) | 一个开源 IPAM 插件，提供与现有 Infoblox 工具的集成。 |

> Docker 拥有许多相关插件，并且越来越多的插件正被设计、发布。Docker 维护着[最常用插件列表](https://docs.docker.com/engine/extend/legacy_plugins/)。



## Docker 网络控制面板

除了传播控制面板数据之外，Docker 分布式网络控制面板还管理 Swarm 集群的 Docker 网络状态。它是 **Docker Swarm 集群**的内置功能，不需要任何额外的组件，如外部 KV 存储。控制平面使用基于 [SWIM](https://www.cs.cornell.edu/~asdas/research/dsn02-swim.pdf) 的 [Gossip](https://en.wikipedia.org/wiki/Gossip_protocol) 协议在 Docker 容器集群中传播网络状态信息和拓扑。Gossip 协议非常有效地实现了集群内的最终一致性，同时保持了非常大规模集群中消息大小，故障检测时间和收敛时间的恒定速率。这可确保网络能够跨多个节点进行扩展，而不会引入缩放问题，例如收敛缓慢或误报节点故障。

控制面板非常安全，通过加密通道提供机密性、完整性和身份验证。它也是每个网络的边界，大大减少了主机收到的更新。

![DOCKER-NET-AR-4](/images/解析Docker网络架构/DOCKER-NET-AR-4.png)

控制平面的分布式特性可确保群集控制器故障不会影响网络性能。

Docker 网络控制面板组件如下：

- **消息传播**以对等方式更新节点，将每次交换中的信息传递到更大的节点组。固定的对等组间隔和大小确保即使群集的大小扩展，网络的情况也是不变的。跨对等体的指数信息传播确保了收敛速度快，并且能满足任何簇大小。
- **故障检测**利用直接和间接的问候消息来排除网络拥塞和特定路径导致误报节点故障。
- 定期实施**完全状态同步**以更快地实现一致性并解析网络分区。
- **拓扑感知**算法探明自身与其他对等体之间的相对延迟。这用于优化对等组，使收敛更快，更高效。
- **控制面板加密**可以防止中间人攻击和其他可能危及网络安全的攻击。

> Docker 网络控制面板是 [Swarm](https://docs.docker.com/engine/swarm/) 的一个组件，需要一个 Swarm 集群才能运行。



## Docker Bridge 网络驱动

### 默认 Docker bridge 网络

在任何运行 Docker Engine 的主机上，默认情况下都有一个名为 bridge 的本地 Docker 网络。此网络使用桥接网络驱动程序创建，该驱动程序实例化名为 docker0 的 Linux 网桥。

在独立的 Docker 主机上，如果未指定其他网络，则 `bridge` 是容器连接的默认网络。在以下示例中，创建了一个没有网络参数的容器。Docker Engine 默认将其连接到 `bridge` 网络。在容器内部，注意由 `bridge` 驱动程序创建的 eth0，并由 Docker 本机 IPAM 驱动程序给出一个地址。

```shell
# docker run -ti --name test busybox sh
/ # ip a
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
6: eth0@if7: <BROADCAST,MULTICAST,UP,LOWER_UP,M-DOWN> mtu 1500 qdisc noqueue
    link/ether 02:42:ac:11:00:02 brd ff:ff:ff:ff:ff:ff
    inet 172.17.0.2/16 brd 172.17.255.255 scope global eth0
       valid_lft forever preferred_lft forever
```

容器接口的 MAC 地址是动态生成的，并嵌入 IP 地址以避免冲突。这里 `ac:11:00:02` 对应于 `172.17.0.2`。



主机上显示docker会创建 `vetha3788c4` 

```shell
# ip a
1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 qdisc noqueue state UNKNOWN group default qlen 1000
    link/loopback 00:00:00:00:00:00 brd 00:00:00:00:00:00
    inet 127.0.0.1/8 scope host lo
       valid_lft forever preferred_lft forever
    inet6 ::1/128 scope host
       valid_lft forever preferred_lft forever
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP group default qlen 1000
    link/ether fa:26:00:02:b2:26 brd ff:ff:ff:ff:ff:ff
    inet 192.168.1.33/24 brd 192.168.1.255 scope global eth0
       valid_lft forever preferred_lft forever
    inet6 fe80::f826:ff:fe02:b226/64 scope link
       valid_lft forever preferred_lft forever
3: docker0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue state UP group default
    link/ether 02:42:99:7e:a6:55 brd ff:ff:ff:ff:ff:ff
    inet 172.17.0.1/16 brd 172.17.255.255 scope global docker0
       valid_lft forever preferred_lft forever
    inet6 fe80::42:99ff:fe7e:a655/64 scope link
       valid_lft forever preferred_lft forever
7: veth23b0bef@if6: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc noqueue master docker0 state UP group default
    link/ether ae:b4:89:f6:92:c1 brd ff:ff:ff:ff:ff:ff link-netnsid 0
    inet6 fe80::acb4:89ff:fef6:92c1/64 scope link
       valid_lft forever preferred_lft forever
```



`veth23b0bef@if6` 与容器内的`eth0@if7`是一对`veth`接口。

**主机上的工具** `brctl` 显示主机网络命名空间中存在的 Linux 网桥。它显示了一个名为 `docker0` 的网桥。`docker0` 有一个接口 `vetha3788c4`，它提供从网桥到容器 `test` 内的 `eth0` 接口的连接。

```shell
# brctl show
bridge name	bridge id		STP enabled	interfaces
docker0		8000.0242997ea655	no		veth23b0bef
```



在容器 `test` 内部，容器路由表将流量引导到容器的 `eth0`，从而传输到 `docker0` 网桥。

```shell
/ # ip r
default via 172.17.0.1 dev eth0
172.17.0.0/16 dev eth0 scope link  src 172.17.0.2
```

容器可以具有零到多个接口，具体取决于它连接的网络数量。一个 Docker 网络只能为网络中的每个容器提供一个接口。

![DOCKER-NET-AR-5](/images/解析Docker网络架构/DOCKER-NET-AR-5.png)

主机路由表提供了外部网络上 `docker0` 和 `eth0` 之间的连接，完成了从容器内部到外部网络的路径。

```shell
# ip route
default via 192.168.1.1 dev eth0
172.17.0.0/16 dev docker0 proto kernel scope link src 172.17.0.1
192.168.1.0/24 dev eth0 proto kernel scope link src 192.168.1.33
```

默认情况下，`bridge` 将从以下范围分配一个子网，172.[17-31].0.0/16 或 192.168.[0-240].0/20，它与任何现有主机接口不重叠。

默认的 `bridge` 网络也可以配置为用户提供的地址范围。此外，现有的 Linux 网桥可直接用于 `bridge` 网络，而不需要 Docker 另外创建一个。

有关自定义网桥的更多信息，请转至 [Docker Engine 文档](https://docs.docker.com/engine/userguide/networking/default_network/custom-docker0/)。

> 默认 `bridge` 网络是唯一支持遗留[链路](https://docs.docker.com/engine/userguide/networking/default_network/dockerlinks/)的网络。默认 `bridge` 网络**不支持**基于名称的服务发现和用户提供的 IP 地址。



### 用户自定义 bridge 网络

除了默认网络，用户还可以创建自己的网络，称为**用户自定义网络**，可以是任何网络驱动类型。

用户定义的 `bridge` 网络，相当于在主机上设置新的 Linux 网桥。与默认 `bridge` 网络不同，用户定义的网络支持手动 IP 地址和子网分配。如果未给出赋值，则 Docker 的默认 IPAM 驱动程序将分配私有 IP 空间中可用的下一个子网。

![DOCKER-NET-AR-6](/images/解析Docker网络架构/DOCKER-NET-AR-6.png)

在用户定义的 `bridge` 网络下面创建了两个连接到它的容器。指定了子网，网络名为 `my_bridge`。一个容器未获得 IP 参数，因此 IPAM 驱动程序会为其分配子网中的下一个可用 IP， 另一个容器已指定 IP。

```shell
# docker network create -d bridge --subnet 10.0.0.0/24 my_bridge
12d3bf634b2546631e6ba9ab8826aaf701646f681de7193f51af927fcbab23d9
# docker run -itd --name c2 --net my_bridge busybox sh
addbcafa705f627c1fd5c6ad356fc71be521a7922a5fe700335c027b8fdefb64
# docker run -itd --name c3 --net my_bridge --ip 10.0.0.254 busybox sh
f38ba5993eaac845f4aa9884fc263100e6d6c3b6c5957b324bb3673f8e27231b
```

`brctl` 现在显示主机上的第二个 Linux 网桥。这一 Linux 网桥的名称 `br-4bcc22f5e5b9` 与 `my_bridge` 网络的网络 ID 匹配。`my_bridge` 还有两个连接到容器 `c2` 和 `c3` 的 veth 接口。

> 1. 用户创建的network与默认的network不能用于同一容器
> 2. 两种相同类型的network不能用于同一容器



## Docker Host 网络驱动

使用 `host` 驱动程序的容器都在同一主机网络命名空间中，并使用主机的网络接口和 IP 堆栈。主机网络中的所有容器都能够在主机接口上相互通信。从网络角度来看，它们相当于在没有使用容器技术的主机上运行的多个进程。因为它们使用相同的主机接口，所以任意两个容器都不能够绑定到同一个 TCP 端口。如果在同一主机上安排多个容器，可能会导致端口争用。

`--net=host` 有效地关闭了 Docker 网络，容器使用主机操作系统的 host（或默认）网络栈。

![DOCKER-NET-AR-7](/images/解析Docker网络架构/DOCKER-NET-AR-7.png)

```shell
# docker run -itd --net host --name C1 alpine sh
# ip add | grep eth0
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP group default qlen 1000
    inet 192.168.1.33/24 brd 192.168.1.255 scope global eth0
# docker run -it --net host --name C1 alpine ip add | grep eth0
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc mq state UP group default qlen 1000
    inet 192.168.1.33/24 brd 192.168.1.255 scope global eth0
```



当容器使用 `host` 网络时，主机`C1` 和 `nginx` 都共享相同的 `eth0` 接口。这使得 `host` 网络**不适合多租户或对安全性要求高的应用程序**。`host` 模式的容器可以访问主机上的其他任一容器。这种情况下，可以使用 `localhost` 在容器之间进行通信，如示例中所示，从 `C1` 执行 `curl nginx` 可成功访问。

使用 `host` 驱动程序，Docker 不管理容器网络栈的任何部分，例如端口映射或路由规则。这意味着像 `-p` 和 `--icc` 这样的常见网络标志对 `host` 驱动程序没有任何意义，它们被忽略了。这确实使 `host` 网络成为最简单和最低延迟的网络驱动程序。流量路径直接从容器进程流向主机接口，提供相当于非容器化进程的裸机性能。

完全的主机访问权限和无自动策略管理可能使 `host` 驱动程序难以作为通用网络驱动程序。但是， `host` 确实有一些有趣的性质，可能适用于超高性能应用程序或应用程序故障排除等场景。



## Docker Overlay 网络驱动

原生 Docker `overlay` 网络驱动程序从根本上简化了多主机网络中的许多问题。

 `overlay` 使用 Swarm 分布式控制面板，在非常大规模的集群中提供集中化管理、稳定性和安全性。

### VXLAN 数据平面

`overlay` 驱动程序使用行业标准的 VXLAN 数据平面，将容器网络与底层物理网络（*underlay*）分离。Docker overlay 网络将容器流量封装在 VXLAN 标头中，允许流量穿过第 2 层或第 3 层物理网络。无论底层物理拓扑结构如何，overlay 使网络分段灵活且易于控制。使用标准 IETF VXLAN 标头有助于标准工具检查和分析网络流量。

IETF VXLAN（[RFC 7348](https://datatracker.ietf.org/doc/rfc7348/)）是一种数据层封装格式，它通过第 3 层网络覆盖第 2 层网段。VXLAN 旨在用于标准 IP 网络，支持共享物理网络基础架构上的大规模多租户设计。现有的内部部署和基于云的网络可以无感知地支持 VXLAN。

VXLAN 定义为 MAC-in-UDP 封装，将容器第 2 层的帧数据放置在底层 IP/UDP 头中。底层 IP/UDP 报头提供底层网络上主机之间的传输。overlay 是无状态 VXLAN 隧道，其作为参与给定 overlay 网络的每个主机之间的点对多点连接而存在。由于覆盖层独立于底层拓扑，因此应用程序变得更具可移植性。因此，无论是在本地，在开发人员桌面上还是在公共云中，都可以与应用程序一起传输网络策略和连接。

### Overlay 驱动内部架构

**Docker Swarm** 控制面板可自动完成 overlay 网络的所有配置，不需要 VXLAN 配置或 Linux 网络配置。数据平面加密是 overlay 的可选功能，也可以在创建网络时由 overlay 驱动程序自动配置。用户或网络运营商只需定义网络（`docker network create -d overlay ...`）并将容器附加到该网络。



### Overlay示例

| node  | hostname            | ip           |
| ----- | ------------------- | ------------ |
| node1 | instance-2768osg3-2 | 192.168.0.25 |
| node2 | instance-2768osg3-1 | 192.168.0.26 |



- 将node1作为master，在node1上执行init swarm，初始化swarm环境

  ```shell
  # docker swarm init
  ```

  ![image-20210103165309724](/images/解析Docker网络架构/DOCKER-NET-AR-10.png)

  启动docker swarm之后可以在host上看到启动了2个端口：2377和7946，2377作为cluster管理端口，7946用于节点发现。swarm的overlay network会用到3个端口，由于此时没有创建overlay network，故没有4789端口（注：4789端口号为IANA分配的vxlan的UDP端口号）。官方描述参见[use overlay network](https://docs.docker.com/network/overlay/#operations-for-all-overlay-networks)

  ![image-20210103165022507](/images/解析Docker网络架构/DOCKER-NET-AR-8.png)

  ![image-20210103165206882](/images/解析Docker网络架构/DOCKER-NET-AR-9.png)

  新增了**docker_gwbridge**和**ingress**，前者提供通过bridge方式提供容器与host的通信，后者在默认情况下提供通过overlay方式与其他容器跨host通信

- 设置node2加入swarm，同时该节点上也会打开一个7946端口，与swarm服务端通信。

  node2执行node1 init swarm时的help

  ```shell
  # docker swarm join --token SWMTKN-1-1z0y362n7f0di43cq9t8jaurgo3jm93whvwsezzf0r7q59yv9s-0q57eoco3y6zhv3h0ntsamq75 192.168.0.25:2377
  ```

- 在node1上查看节点信息，可以看到2个节点信息，即node1和node2

  ```shell
  # docker node ls
  ```

  ![image-20210103165528584](/images/解析Docker网络架构/DOCKER-NET-AR-11.png)

- 在node1创建一个自定义的overlay网络

  容器加入默认“ingress” overlay network会报错 “PermissionDenied”。

  ```shell
  # docker network create -d overlay --attachable my-overlay
  7fe9ew67whn6bz1q06bkfqpxf
  ```

- 在node1上创建一个连接到my-overlay的容器

  ```shell
  # docker run -itd --network=my-overlay --name=CT1 centos /bin/sh
  f5b6ae4977df9b5f97c96ccd54601c74c34fb9b2843ad395484cc14310dbae15
  ```

- 在node2上创建连接到my-overlay的容器

  ```shell
  # docker run -itd --network=my-overlay --name=CT2 centos /bin/sh
  728c7bea94d12c774e74e6f830648c44a7c8bc09e49db3b51b94774bca15516d
  ```

- 进入node2容器，ping node1 容器 10网段地址，可通。

  ![image-20210103175426997](/images/解析Docker网络架构/DOCKER-NET-AR-12.png)





至此，梳理两个节点的网络信息

docker 目前的ns存储在`/var/run/docker/netns`目录

**node1**



主机网络

![image-20210103180334768](/images/解析Docker网络架构/DOCKER-NET-AR-14.png)



目前node1有下面几个 NS

![image-20210103183326799](/images/解析Docker网络架构/DOCKER-NET-AR-16.png)

开始整理NS网络信息

> 1-4yf0gd7smm 为ingress overlay 网络命名空间
>
> ingress_sbox也是docker默认创建的网络命名空间，这两个本文未使用，可忽略。



容器内网络信息

```shell
# ip a
# ip route
```

![image-20210103180158315](/images/解析Docker网络架构/DOCKER-NET-AR-13.png)



my-overlay 网络信息

```shell
# # nsenter --net=/var/run/docker/netns/1-7fe9ew67wh ip a
```

![image-20210103181822986](/images/解析Docker网络架构/DOCKER-NET-AR-15.png)



```shell
# nsenter --net=/var/run/docker/netns/1-7fe9ew67wh ip -d link show dev vxlan0
11: vxlan0@if11: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1450 qdisc noqueue master br0 state UNKNOWN mode DEFAULT group default
    link/ether 96:24:91:3f:f7:e5 brd ff:ff:ff:ff:ff:ff link-netnsid 0 promiscuity 1
    vxlan id 4097 srcport 0 0 dstport 4789 proxy l2miss l3miss ageing 300 noudpcsum noudp6zerocsumtx noudp6zerocsumrx
    bridge_slave state forwarding priority 32 cost 100 hairpin off guard off root_block off fastleave off learning on flood on port_id 0x8001 port_no 0x1 designated_port 32769 designated_cost 0 designated_bridge 8000.26:a7:4e:d6:1c:3e designated_root 8000.26:a7:4e:d6:1c:3e hold_timer    0.00 message_age_timer    0.00 forward_delay_timer    0.00 topology_change_ack 0 config_pending 0 proxy_arp off proxy_arp_wifi off mcast_router 1 mcast_fast_leave off mcast_flood on addrgenmode eui64 numtxqueues 1 numrxqueues 1 gso_max_size 65536 gso_max_segs 65535
```



以上信息整理如图

![docker-overlay](/images/解析Docker网络架构/DOCKER-NET-AR-17.png)

## MACVLAN

`macvlan` 驱动程序是经过检验的真正网络虚拟化技术的新实现。Linux 上的实现非常轻量级，因为它们不是使用 Linux 网桥进行隔离，而是简单地与 Linux 以太网接口或子接口相关联，以强制实现网络之间的分离以及与物理网络的连接。

`macvlan` 驱动程序使用父接口的概念。此接口可以是物理接口，例如 `eth0`，用于 802.1q VLAN 标记的子接口，如 `eth0.10`（`.10` 表示 `VLAN 10`），或者甚至是绑定的主机适配器，它将两个以太网接口捆绑到一个逻辑接口中。

在 MACVLAN 网络配置期间需要网关地址。网关必须位于网络基础架构提供的主机外部。MACVLAN 网络允许在同一网络上的容器之间进行访问。如果没有在主机外部路由，则无法在同一主机上的不同 MACVLAN 网络之间进行访问。



### 相同 macvlan 网络之间的通信

| node  | hostname            | ip           |
| ----- | ------------------- | ------------ |
| node1 | instance-2768osg3-2 | 192.168.0.25 |
| node2 | instance-2768osg3-1 | 192.168.0.26 |

![docker-macvlan-1](/images/解析Docker网络架构/docker-macvlan-1.png)

1. 两个node创建两个 macvlan 网络

   ```shell
   # docker network create -d macvlan --subnet=172.16.10.0/24 --gateway=172.16.10.1 -o parent=eth0 mac1
   ```

   这条命令中，

   - `-d` 指定 Docker 网络 driver
   - `--subnet` 指定 macvlan 网络所在的网络
   - `--gateway` 指定网关
   - `-o parent` 指定用来分配 macvlan 网络的物理网卡

   之后可以看到当前主机的网络环境，其中出现了 macvlan 网络：

   ```shell
   # docker network ls
   NETWORK ID     NAME      DRIVER    SCOPE
   f7317588717a   bridge    bridge    local
   968963e96717   host      host      local
   2f521f38321d   mac1      macvlan   local
   a4be66e8bd67   none      null      local
   ```

2. 在 node1 运行容器 c1，并指定使用 macvlan 网络：

   ```shell
   # docker run -itd --name c1 --ip=172.16.10.2 --network mac1 busybox
   ```

   - `--ip` 指定容器 c1 使用的 IP，这样做的目的是防止自动分配，造成 IP 冲突
   - `--network` 指定 macvlan 网络

3. 在 node2 中运行容器 c2：

   ```shell
   # docker run -itd --name c2 --ip=172.16.10.3 --network mac1 busybox
   ```

4. 在node1 c1中ping node2 c2，可通

> 注意：以上的实验都需要物理网卡 eth0 开启混杂模式，不然会 ping 不通。
>
> 云环境中，注意路由配置。

### 不同 macvlan 网络之间的通信

![docker-macvlan-2](/images/解析Docker网络架构/docker-macvlan-2.png)

1. 分别在两台主机上将物理网口 eth0 创建出两个 VLAN 子接口

   ```shell
   # vconfig add eth0 10
   # vconfig add eth0 20
   
   //设置 VLAN 的 REORDER_HDR 参数，默认就行了
   # vconfig set_flag eth0.10 1 1
   # vconfig set_flag eth0.20 1 1
   
   //启用接口
   # ifconfig eth0.10 up
   # ifconfig eth0.20 up
   ```

2. 分别在 node1 和 node2 上基于两个 VLAN 子接口创建 2 个 macvlan 网络，mac10 和 mac20

   ```shell
   # docker network create -d macvlan --subnet=172.16.10.0/24 --gateway=172.16.10.1 -o parent=eth0.10 mac10
   # docker network create -d macvlan --subnet=172.16.20.0/24 --gateway=172.16.20.1 -o parent=eth0.20 mac20
   ```

3. 分别在 node1 和 node2 上运行容器，并指定不同的 macvlan 网络

   ```shell
   // host1
   # docker run -itd --name c1 --ip=172.16.10.10 --network mac10 busybox
   # docker run -itd --name c2 --ip=172.16.20.11 --network mac20 busybox
   
   // host2 
   # docker run -itd --name c3 --ip=172.16.10.12 --network mac10 busybox
   # docker run -itd --name c4 --ip=172.16.20.13 --network mac20 busybox
   ```

通过验证，c1 和 c3，c2 和 c4 在同一 macvlan 网络下，互相可以 ping 通，在不同的 macvlan 网络下的容器，互相 ping 不通。

这个原因也很明确，不同 macvlan 网络处于不同的网络，而且通过 VLAN 隔离，自然 ping 不了。

但这也只是在二层上通不了，通过三层的路由是可以通的，具体请参考 [Docker 网络模型之 macvlan 详解](https://ctimbai.github.io/2019/04/14/tech/docker-macvlan/)。

## IPVLAN

ipvlan 和 macvlan 类似，都是从一个主机接口虚拟出多个虚拟网络接口。

macvlan是虚拟出的接口mac不同，ipvlan是虚拟出的接口IP不同，共享同一MAC地址。

因此，DHCP 协议分配 ip 的时候一般会用 mac 地址作为机器的标识。这个情况下，客户端动态获取 ip 的时候需要配置唯一的 ClientID 字段，并且 DHCP server 也要正确配置使用该字段作为机器标识，而不是使用 mac 地址。

[ipvlan](https://lwn.net/Articles/620087/) 是 linux kernel 比较新的特性，linux kernel 3.19 开始支持 ipvlan，但是比较稳定推荐的版本是 **>=4.2**（因为 docker 对之前版本的支持有 bug）。



## None 网络驱动（隔离）

与 `host` 网络驱动程序类似，`none` 网络驱动程序本质上是一种不经管理的网络选项。Docker Engine 不会在容器内创建接口、建立端口映射或安装连接路由。使用 `--net=none` 的容器与其他容器和主机完全隔离。网络管理员或外部工具必须负责提供此管道。使用 none 的容器只有一个 `loopback` 接口而没有其他接口。

与 `host` 驱动程序不同，`none` 驱动程序为每个容器创建单独的命名空间。这可以保证任何容器和主机之间的网络隔离。

> 使用 --net=none 或 --net=host 的容器无法连接到任何其他 Docker 网络。



## 参考资料

[深入解析Docker 架构原理](https://i4t.com/4248.html)

[“深入浅出”来解读Docker网络核心原理](https://blog.51cto.com/ganbing/2087598)

[Docker 参考架构：设计可扩展、可移植的 Docker 容器网络](https://studygolang.com/articles/23458)

[浅聊几种主流Docker网络的实现原理](https://www.infoq.cn/article/9vfppfzprxlm4ssllxsr)

[docker网络之overlay](https://cloud.tencent.com/developer/article/1603567)

[macvlan 详解](http://mp.weixin.qq.com/s?__biz=MzI1OTY2MzMxOQ==&mid=2247485246&idx=1&sn=c42a3618c357ebf5f6b7b7ce78ae568f&chksm=ea743386dd03ba90ad65940321385f68f9315fec16d82a08efa12c18501d8cadf95cf9e614a2&scene=21#wechat_redirect)

[Docker 网络模型之 macvlan 详解](https://ctimbai.github.io/2019/04/14/tech/docker-macvlan/)

[linux 网络虚拟化： ipvlan](https://cizixs.com/2017/02/17/network-virtualization-ipvlan/)

[docker 使用 ipvlan 网络](https://typefo.com/docker/docker-ipvlan-configuration.html)

