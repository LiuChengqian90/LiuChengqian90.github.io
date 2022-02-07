---
title: 学习Kubernetes系列——工作负载
date: 2021-06-22 15:22:33
categories:
tags:
  - Kubernetes
  - k8s
typora-root-url: ../../../source
---

# 工作负载

工作负载是在 Kubernetes 上运行的应用程序。

无论你的负载是单一组件还是由多个一同工作的组件构成，在 Kubernetes 中你 可以在一组 [Pods](https://kubernetes.io/zh/docs/concepts/workloads/pods) 中运行它。 在 Kubernetes 中，Pod 代表的是集群上处于运行状态的一组 [容器](https://kubernetes.io/zh/docs/concepts/overview/what-is-kubernetes/#why-containers)。

<!--more-->

