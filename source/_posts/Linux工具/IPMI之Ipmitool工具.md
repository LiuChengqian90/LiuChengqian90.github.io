---
title: Ipmitool工具
date: 2021-04-02 09:57:52
categories: Linux工具
tags:
  - Ipmitool
  - ipmi
---



## IPMI（Intelligent Platform Management Interface）

智能平台管理接口 (IPMI) 是一种开放标准的硬件管理接口规格，定义了嵌入式管理子系统进行通信的特定方法。IPMI 信息通过基板管理控制器 (BMC)（位于 IPMI 规格的硬件组件上）进行交流。使用低级硬件智能管理而不使用操作系统进行管理，具有两个主要优点： 首先，此配置允许进行带外服务器管理；其次，操作系统不必负担传输系统状态数据的任务。IPMI的核心是一个专用芯片/控制器(叫做服务器处理器或基板管理控制器(BMC))，其并不依赖于服务器的处理器、BIOS或操作系统来工作，可谓非常地独立，是一个单独在系统内运行的无代理管理子系统，

IPMI功能：

监控服务器的物理健康特征，如温度、电压、风扇工作状态、电源状态等；

可以通过串口、Modem以及Lan等远程环境管理服务器系统，如远程开关机；

<!--more-->

## IPMITOOL



ipmitool 是一种可用在 linux 系统下的命令行方式的 ipmi 平台管理工具，它支持 ipmi 1.5 规范（最新的规范为 ipmi 2.0），通过它可以实现获取传感器的信息、显示系统日志内容、网络远程开关机等功能。使用：



```bash
ipmitool –I open sensor list #命令可以获取传感器中的各种监测值和该值的监测阈值，包括（CPU温度，电压，风扇转速，电源调制模块温度，电源电压等信息。
ipmitool –I open sensor thresh #设置ID值等于id的监测项的各种限制值。
ipmitool –I open chassis status #查看底盘状态，其中包括了底盘电源信息，底盘工作状态等
ipmitool –I open chassis restart_cause #查看上次系统重启的原因
```



\#远程电源管理

```bash
ipmitool -I lanplus -H $oob_ip -U root -P 密码 power off (硬关机，直接切断电源)
ipmitool -I lanplus -H $oob_ip -U root -P 密码 power soft (软关机，即如同轻按一下开机按钮)
ipmitool -I lanplus -H $oob_ip -U root -P 密码 power on (硬开机)
ipmitool -I lanplus -H $oob_ip -U root -P 密码 power reset (硬重启)
ipmitool -I lanplus -H $oob_ip -U root -P 密码 power status (获取当前电源状态)
ipmitool -I lanplus -H $oob_ip -U root -P 密码 chassis power cycle
(注意power cycle 和power reset的区别在于前者从掉电到上电有１秒钟的间隔，而后者是很快上电)
```



\#远程引导（当次生效）

```bash
ipmitool -I lan -H 服务器地址 -U root -P passwd chassis bootdev pxe (网络引导)
ipmitool -I lan -H 服务器地址 -U root -P passwd chassis bootdev disk （硬盘引导）
ipmitool -I lan -H 服务器地址 -U root -P passwd chassis bootdev cdrom （光驱引导）
```



\#读取系统状态类

```bash
ipmitool sensor list  　#显示系统所有传感器列表
ipmitool fru list　　　#显示系统所有现场可替代器件的列表
ipmitool sdr list　　　#显示系统所有SDRRepository设备列表　
ipmitool  pef list      #显示系统平台时间过滤的列表
```



\#系统日志类

```bash
ipmitool sel elist　　　#显示所有系统事件日志
ipmitool sel clear　　　#删除所有系统时间日志
ipmitool sel delete ID     #删除第ID条SEL
ipmitool sel time get     　#显示当前BMC的时间
ipmitool sel time set  XXX  #设置当前BMC的时间
```



\#启动设置类

```bash
ipmitool chassis bootdev bios  #重启后停在BIOS 菜单
ipmitool chassis bootdev pxe　#重启后从PXE启动
```



\#系统相关的命令

```bash
ipmitool mc info       #显示BMC版本信息
ipmitool bmc reset cold      #BMC 热启动
ipmitool bmc reset warmBMC    #冷启动
```



\#网络接口相关命令

```bash
ipmitool lan print 1    #显示channel1的网络配置信息
ipmitool lan set  1ipaddr 10.32.2.2    #设置channel1的IP地址
ipmitool lan  set 1 netmask 255.255.0.0   #设置channel1的netmask
ipmitool lan set 4 defgw ipaddr255.255.0.254    #设置channel4的网关
ipmitool lan set  2 defgw macaddr  <macaddr>　#设置channel2的网关mac address
ipmitool lan set 2 ipsrc dhcp         #设置channel2的ip 源在DHCP
ipmitool lan set 3 ipsrc static        #设置channel2的ip是静态获得的
```



\#通道相关命令

```bash
ipmitool channel info　#显示系统默认channel
ipmitool channel  authcap channel-number privilege 　#修改通道的优先级别
ipmitool channel  getaccess channel-number user-id　#读取用户在通道上的权限
ipmitool channel setacccess channel-number  user-id callin=on ipmi=on link=onprivilege=5   #设置用户在通道上的权限
```



\#看门狗相关命令

```bash
ipmitool  mc watchdog get　#读取当前看门狗的设置
ipmitool watchdog  off   #关掉看门狗
ipmitool watchdog reset 　#在最近设置的计数器的基础上重启看门狗
```



\#用户管理相关命令

```bash
ipmitool user list chan-id   #显示某通道上的所有用户
ipmitool set password <user id>[<password>] #修改某用户的密码
ipmitool disable      <user id>　　#禁止掉某用户
ipmitool enable       <user id>　　#使能某用户
ipmitool priv         <user id> <privilegelevel> [<channel number>]　#修改某用户在某通道上的权限
ipmitool test         <user id> <16|20>[<password]>　#测试用户
```





转自：[IPMI之Ipmitool工具](https://blog.51cto.com/bovin/2128475)



