---
title: Linux Netpoll浅析
date: 2018-03-12 12:03:09
categories: Linux内核
tags:
  - Netpoll
---

  之前的文章讨论过NAPI和非NAPI的区别，但是内核中网络处理不仅只有这两种简单的划分，还有一种netpoll架构。