---
title: Linux Netpoll浅析
date: 2018-03-12 12:03:09
categories: Linux内核
tags:
  - Netpoll
---

  本文基于Linux kernel v3.10。

  网卡处理流量都几种方式：

	- 中断处理：每次接受报文都会发生中断。此种方式在高速网络中会使系统性能全面下降。
- poll方式：不依靠中断，完全依靠轮询。读取特定的寄存器，条件合适时进行收发数据。
- NAPI，上述两者的结合，具体在之前的文章中已经讲解过。

netconsole netpoll

