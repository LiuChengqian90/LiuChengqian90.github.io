---
title: BFD与BGP联动实现路由快速收敛
date: 2022-01-27 09:57:52
categories:
tags:
  - tag
typora-root-url: ../../../source
---

## BFD简介

为了减小设备故障对业务的影响、提高网络的可用性，设备需要能够尽快检测到与相邻设备间的通信故障，以便能够及时采取措施，从而保证业务继续进行。

现有的故障检测方法主要包括以下几种：

- 硬件检测：例如通过SDH（Synchronous Digital Hierarchy，同步数字体系）告警检测链路故障。硬件检测的优点是可以很快发现故障，但并不是所有介质都能提供硬件检测。
- 慢Hello机制：通常采用路由协议中的Hello报文机制。这种机制检测到故障**所需时间为秒级**。对于高速数据传输，例如吉比特速率级，超过1秒的检测时间将导致大量数据丢失；对于时延敏感的业务，例如语音业务，超过1秒的延迟也是不能接受的。并且，这种**机制依赖于路由协议**。
- 其他检测机制：不同的协议有时会提供专用的检测机制，但在系统间互联互通时，这样的专用检测机制通常难以部署。

<!--more-->

BFD（Bidirectional Forwarding Detection，双向转发检测）是一个通用的、标准化的、介质无关和协议无关的快速故障检测机制，用于检测转发路径的连通状况，保证设备之间能够快速检测到通信故障，以便能够及时采取措施，保证业务持续运行。

BFD可以为各种上层协议（如路由协议）快速检测两台设备间双向转发路径的故障。相比于慢Hello报文机制的秒级检测，BFD可以提供**毫秒级检测**。

### 工作机制

BFD可以为各上层协议如路由协议、MPLS等统一地快速检测两台路由器间双向转发路径的故障。

BFD在两台路由器或路由交换机上建立会话，用来监测两台路由器间的双向转发路径，为上层协议服务。

BFD本身并没有发现机制，而是靠被服务的上层协议通知其该与谁建立会话，会话建立后如果在检测时间内没有收到对端的BFD控制报文则认为发生故障，通知被服务的上层协议，上层协议进行相应的处理。

#### 工作流程

![BFD会话建立流程](/images/BFD与BGP联动实现路由快速收敛/BFD会话建立流程图.png)

BFD会话建立过程：

1. 上层协议通过自己的Hello机制发现邻居并建立连接；
2. 上层协议在建立了新的邻居关系时，将邻居的参数及检测参数都（包括目的地址和源地址等）通告给BFD；
3. BFD根据收到的参数进行计算并建立邻居。



![BFD处理网络故障流程图](/images/BFD与BGP联动实现路由快速收敛/BFD处理网络故障流程图.png)

当网络出现故障时：

1. BFD检测到链路/网络故障；
2. 拆除BFD邻居会话；
3. BFD通知本地上层协议进程BFD邻居不可达；
4. 本地上层协议中止上层协议邻居关系；
5. 如果网络中存在备用路径，路由器将选择备用路径。



#### 检测方式

- 单跳检测：BFD单跳检测是指对两个直连系统进行IP连通性检测，这里所说的“单跳”是IP的一跳。
- 多跳检测：BFD可以检测两个系统间的任意路径，这些路径可能跨越很多跳，也可能在某些部分发生重叠。
- 双向检测：BFD通过在双向链路两端同时发送检测报文，检测两个方向上的链路状态，实现毫秒级的链路故障检测。（BFD检测LSP是一种特殊情况，只需在一个方向发送BFD控制报文，对端通过其他路径报告链路状况。）



#### BFD会话工作方式

BFD会话通过echo报文和控制报文实现。

**echo报文方式**

echo报文封装在**UDP报文**中传送，其UDP目的端口号为**3785**。

本端发送echo报文建立BFD会话，对链路进行检测。对端不建立BFD会话，只需把收到的echo报文转发回本端。如果在检测时间内没有收到对端转发回的echo报文，则认为会话down。

当BFD会话工作于echo报文方式时，仅在MPLS TE隧道的场景中支持多跳检测，其他应用的BFD会话仅支持单跳检测，两种应用均不受检测模式的控制。



**控制报文方式**

控制报文封装在**UDP**报文中传送，对于单跳检测其UDP目的端口号为**3784**，对于多跳检测其UDP目的端口号为**4784**。

链路两端的设备通过控制报文中携带的参数（会话标识符、期望的收发报文最小时间间隔、本端BFD会话状态等）协商建立BFD会话。BFD会话建立后，缺省情况下，系统将以协商的报文收发时间间隔在彼此之间的路径上发送BFD控制报文。



#### 运行模式



BFD会话建立前有两种模式：主动模式和被动模式。

- **主动模式**：在建立会话前不管是否收到对端发来的BFD控制报文，都会主动发送BFD控制报文；
- **被动模式**：在建立会话前不会主动发送BFD控制报文，直到收到对端发送来的控制报文。

通信双方**至少要有一方运行在主动模式**才能成功建立起BFD会话。



BFD会话**建立后**有两种模式：异步模式和查询模式。

- 异步模式：设备周期性发送BFD控制报文，如果在检测时间内没有收到对端发送的BFD控制报文，则认为会话down。
- 查询模式：假定每个系统都有一个独立的方法，确认自己连接到其他系统（比如Hello报文机制、硬件检测机制等）。这样，只要有一个BFD会话建立，系统停止发送BFD控制报文，除非某个系统需要显式地验证连接性。



## 报文格式

![BFD报文格式](/images/BFD与BGP联动实现路由快速收敛/BFD报文格式.png)



- Vers：协议的版本号，默认协议版本为1。
- Diag：本地会话最后一次从up状态转换到其他状态的原因。
-  State（Sta）：**BFD会话当前状态**，取值为：0代表AdminDown，1代表Down，2代表Init，3代表Up。
- Poll（P）：设置为1，表示发送方请求进行连接确认，或者发送请求参数改变的确认；设置为0，表示发送方不请求确认。
- Final（F）：设置为1，表示发送方响应一个接收到P比特为1的BFD控制报文；设置为0，表示发送方不响应一个接收到P比特为1的BFD控制报文。
- Control Plane Independent（C）：设置为1，表示发送方的BFD实现不依赖于它的控制平面（即，BFD报文在转发平面传输，即使控制平面失效，BFD仍然能够起作用）；设置为0，表示BFD报文在控制平面传输。
- Authentication Present（A）：如果设置为1，则表示控制报文包含认证字段，并且会话是被认证的。
- Demand（D）：设置为1，表示发送方希望操作在**查询模式**；设置为0，表示发送方不区分是否操作在查询模式，或者表示发送方不能操作在查询模式。
- Reserved（R）：在发送时设置为0，在接收时忽略。
- Detect Mult：**检测时间倍数**。即接收方允许发送方发送报文的最大连续丢包数，用来检测链路是否正常。
- Length：BFD控制报文的长度，单位字节。
- My Discriminator：发送方产生的一个唯一的、非0鉴别值，用来区分两个协议之间的多个BFD会话。
- Your Discriminator：接收方收到的鉴别值“My Discriminator”，如果没有收到这个值就返回0。
- Desired Min Tx Interval：发送方发送BFD控制报文时想要采用的最小间隔，单位毫秒。
- Required Min Rx Interval：发送方能够支持的接收两个BFD控制报文之间的间隔，单位毫秒。
- Required Min Echo Rx Interval：发送方能够支持的接收两个BFD回声报文之间的间隔，单位毫秒。如果这个值设置为0，则发送不支持接收BFD回声报文。
- Auth Type：BFD控制报文使用的认证类型。
- Auth Len：认证字段的长度，包括认证类型与认证长度字段。



## BFD支持的应用

- OSPF与BFD联动
- OSPFv3与BFD联动
- IS-IS与BFD联动
- IPv6 IS-IS与BFD联动
- RIP与BFD联动
- 静态路由与BFD联动
- BGP与BFD联动
- IPv6 BGP与BFD联动
- MPLS与BFD联动
- Track与BFD联动
- IP快速重路由



## BFD与BGP联动

操作系统为 centos 7.6，内核为 3.10

### 初始化环境

下载源码、安装依赖

```shell
git clone https://github.com/hzchenyuefang/quagga_bfd.git
yum install -y autoconf automake libtool readline-devel texinfo kernel-devel-$(uname -r) gcc gcc-c++
```



```shell
cd quagga_bfd/
./bootstrap.sh
./configure --enable-user=root --enable-group=root --exec-prefix=/usr/local/ ; make clean;make ;make install
```

> enable-user、enable-group，允许程序以指定用户允许，默认只能quagga用户启动程序
>
> exec-prefix，程序的执行目录，内部拼接的完整路径 为 $exec-prefix/sbin/



> No package 'libcares' found
>
> 
>
> 下载文件包：c-ares-1.12.0.tar：https://c-ares.haxx.se/download/
>
> ```
> 解压，
> ./configure
> make
> make install 
> cp libcares.pc /usr/local/lib/pkgconfig
> PKG_CONFIG_PATH=/usr/local/lib/pkgconfig
> export PKG_CONFIG_PATH 
> ```



### 程序迁移、验证

将 **bgpd、zebra、bfdd**及**libzebra.so.1**移入相应目录。（/usr/local/sbin , /usr/local/lib/）（**这几个文件一定要是同一个版本！！！**）

**创建bfdd 配置文件**

```shell
cat /usr/local/etc/bfdd.conf
!
! BFDd sample configuratin file
!
! bfdd.conf
!
hostname bfdd
password zebra
!
!log file zapd.log
!
log file /var/log/quagga/bfdd.log
!
```



**修改 bgpd 配置，新增bfd neighbor信息，使能bfd**

```shell
neighbor 100.66.122.1 fall-over bfd

neighbor 100.66.123.1 fall-over bfd
```



**启动进程**

```shell
# kill `pidof bfdd`; kill `pidof zebra`; kill `pidof bgpd`
# zebra -d -f /usr/local/etc/zebra.conf; bfdd -d -f /usr/local/etc/bfdd.conf ;bgpd -d -f /usr/local/etc/bgpd.conf ;
```



**查看进程状态**

1. 查看 /var/log/quagga/ 下3个日志文件，保证无报错；

2. 查看bfd 邻居是否建立

   ```shell
   telnet 127.0.0.1 2609 // 密码在bfdd配置中
   > show bfd neighbors
   ```

3. 查看bgp邻居是否建立

   ```shell
   telnet 127.0.0.1 2605 // 密码在bgpd配置中
   > show ip bgp neighbors
   ```

   

## 参考

[BGP配置BFD链路检测feature](https://www.jianshu.com/p/11ce9b787f65)

[华三-BFD技术介绍](http://www.h3c.com/cn/d_201006/676935_30003_0.htm)

[双向链路检测（BFD）之静态路由篇](https://www.bianchengquan.com/article/179317.html)

[BFD (双向转发检测) 协议简介与开发](https://blog.csdn.net/fuyuande/article/details/81253672)

[Quagga](https://wiki.gentoo.org/wiki/Frr)

[bgp与bfd](https://zhiliao.h3c.com/questions/dispcont/104109)