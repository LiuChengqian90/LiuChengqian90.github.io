---
title: ovs代码分析
date: 2018-04-02 20:23:12
categories: openvswitch
tags:
---

基于 ovs 2.8.2 。

## 内核模块

```c
//datapath/Modules.mk 
build_multi_modules = \
	openvswitch
both_modules = \
	$(build_multi_modules) \
	vport_geneve \
	vport_gre \
	vport_lisp \
	vport_stt \
	vport_vxlan
……
/*openvswitch 模块源文件*/
openvswitch_sources = \
	actions.c \
	conntrack.c \
	datapath.c \
	dp_notify.c \
	flow.c \
	flow_netlink.c \
	flow_table.c \
	vport.c \
	vport-internal_dev.c \
	vport-netdev.c \
	nsh.c \
	meter.c
/*vport*模块源文件*/
vport_geneve_sources = vport-geneve.c
vport_vxlan_sources = vport-vxlan.c
vport_gre_sources = vport-gre.c
vport_lisp_sources = vport-lisp.c
vport_stt_sources = vport-stt.c
nsh_sources = nsh.c
/*内核头文件*/
openvswitch_headers = \
	compat.h \
	conntrack.h \
	datapath.h \
	flow.h \
	flow_netlink.h \
	flow_table.h \
	vport.h \
	vport-internal_dev.h \
	vport-netdev.h \
	meter.h
```



## 用户态程序

### ovs-vswitchd

```c
//vswitchd/automake.mk 
/*源文件*/
vswitchd_ovs_vswitchd_SOURCES = \
	vswitchd/bridge.c \
	vswitchd/bridge.h \
	vswitchd/ovs-vswitchd.c \
	vswitchd/system-stats.c \
	vswitchd/system-stats.h \
	vswitchd/xenserver.c \
	vswitchd/xenserver.h
/*lib库,lib中根据系统（windows or unix）选择不同的文件*/
vswitchd_ovs_vswitchd_LDADD = \
	ofproto/libofproto.la \
	lib/libsflow.la \
	lib/libopenvswitch.la
```



### ovsdb-server

```c
//ovsdb/automake.mk 
……
# ovsdb-server
sbin_PROGRAMS += ovsdb/ovsdb-server
ovsdb_ovsdb_server_SOURCES = ovsdb/ovsdb-server.c
ovsdb_ovsdb_server_LDADD = ovsdb/libovsdb.la lib/libopenvswitch.la
……
```

