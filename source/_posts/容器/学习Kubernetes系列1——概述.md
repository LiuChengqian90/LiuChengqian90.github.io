---
title: 学习Kubernetes系列1——概述
date: 2021-05-05 09:57:52
categories:
tags:
  - Kubernetes
  - k8s
typora-root-url: ../../../source
---

终于下定决心搞清楚k8s的架构、原理，本blog k8s系列文章仅做浏览官网时的笔记，同样需要学习k8s的同学，可以直接去 [Kubernetes官网](https://kubernetes.io/zh/docs/concepts/)查看各种文档。

# Kubernetes 是什么？

Kubernetes 是一个可移植的、可扩展的开源平台，用于**管理容器化的工作负载和服务**，可促进声明式配置和自动化。 Kubernetes 拥有一个庞大且快速增长的生态系统。Kubernetes 的服务、支持和工具广泛可用。

<!--more-->

## 容器技术发展

![container_evolution](/images/学习Kubernetes系列之概念/container_evolution.svg)

**传统部署时代：**

早期，应用程序运行于物理服务器上，但是无法为应用程序定义资源边界，这会导致资源分配问题。

- **资源不足**：多个应用程序运行于单台物理服务器，可能会出现一个程序占用大部分资源的情况， 结果可能导致其他程序的性能下降。 
- **资源过剩**：多个应用程序运行于多台物理服务器，可能导致资源利用不足而无法扩展， 并且维护许多物理服务器的成本很高。



**虚拟化部署时代：**

作为解决方案，引入了虚拟化。虚拟化技术允许在单个物理服务器的 CPU 上运行多个虚拟机（VM）。 虚拟化允许应用程序在 VM 之间隔离，并提供一定程度的安全，因为一个应用程序的信息 不能被另一应用程序随意访问。

虚拟化技术能够更好地利用物理服务器上的资源，并且因为可轻松地添加或更新应用程序 而可以实现更好的可伸缩性，降低硬件成本等等。

每个 VM 是一台完整的计算机，在虚拟化硬件之上**运行所有组件，包括其自己的操作系统**。

**容器部署时代：**

容器类似于 VM，但是它们具有被放宽的隔离属性，可以在应用程序之间共享操作系统（OS）。因此，容器被认为是轻量级的。

容器与 VM 类似，具有自己的文件系统、CPU、内存、进程空间等。 由于它们与基础架构分离，因此可以跨云和 OS 发行版本进行移植。

容器因具有许多优势而变得流行起来。下面列出的是容器的一些好处：

- 敏捷应用程序的创建和部署：与使用 VM 镜像相比，提高了容器镜像创建的简便性和效率。
- 持续开发、集成和部署：通过快速简单的回滚（由于镜像不可变性），支持可靠且频繁的 容器镜像构建和部署。
- 关注开发与运维的分离：在**构建/发布**时而不是在部署时创建应用程序容器镜像， 从而将应用程序与基础架构分离。
- 可观察性：不仅可以显示操作系统级别的信息和指标，还可以显示应用程序的运行状况和其他指标信号。
- 跨开发、测试和生产的环境一致性：在便携式计算机上与在云中相同地运行。
- 跨云和操作系统发行版本的可移植性：可在 Ubuntu、RHEL、CoreOS、本地、 Google Kubernetes Engine 和其他任何地方运行。
- 以应用程序为中心的管理：提高抽象级别，从在虚拟硬件上运行 OS 到使用逻辑资源在 OS 上运行应用程序。
- 松散耦合、分布式、弹性、解放的微服务：应用程序被分解成较小的独立部分， 并且可以动态部署和管理 - 而不是在一台大型单机上整体运行。
- 资源隔离：可预测的应用程序性能。
- 资源利用：高效率和高密度。



# Kubernetes 能做什么？

容器是打包和运行应用程序的好方式。在生产环境中，需要管理运行应用程序的容器，并确保服务不会停机（容器故障，需要新启动容器）。

Kubernetes 提供了一个**可弹性运行分布式系统的框架**。 Kubernetes 会满足你的扩展要求、故障转移、部署模式等。



- **服务发现和负载均衡**

  Kubernetes 可以使用 DNS 名称或自己的 IP 地址公开容器，如果进入容器的流量很大， Kubernetes 可以负载均衡并分配网络流量，从而使部署稳定。

- **存储编排**

  Kubernetes 允许你自动挂载你选择的存储系统，例如本地存储、公共云提供商等。

- **自动部署和回滚**

  你可以使用 Kubernetes 描述已部署容器的所需状态，它可以以受控的速率将实际状态 更改为期望状态。例如，你可以自动化 Kubernetes 来为你的部署创建新容器， 删除现有容器并将它们的所有资源用于新容器。

- **自动完成装箱计算**

  Kubernetes 允许你指定每个容器所需 CPU 和内存（RAM）。 当容器指定了资源请求时，Kubernetes 可以做出更好的决策来管理容器的资源。

- **自我修复**

  Kubernetes 重新启动失败的容器、替换容器、杀死不响应用户定义的 运行状况检查的容器，并且在准备好服务之前不将其通告给客户端。

- **密钥与配置管理**

  Kubernetes 允许你存储和管理敏感信息，例如密码、OAuth 令牌和 ssh 密钥。 你可以在不重建容器镜像的情况下部署和更新密钥和应用程序配置，也无需在堆栈配置中暴露密钥。



# Kubernetes 组件

先提前熟悉两个概念，**Pod和节点(Node)**。

*Pod* 是可以在 Kubernetes 中创建和管理的、**最小的可部署的计算单元**。是 Kubernetes 抽象出来的，表示一组（**一个或多个**）应用程序容器（如 Docker），以及这些容器的一些共享资源。这些资源包括:

- 共享存储，当作卷
- 网络，作为唯一的集群 IP 地址
- 有关每个容器如何运行的信息，例如容器映像版本或要使用的特定端口。

Pod 中的容器**共享 IP 地址和端口**，始终位于**同一位置并且共同调度**，并在**同一工作节点上的共享上下文中运行**。

在 Kubernetes 上创建 Deployment 时，该 Deployment 会在其中创建包含容器的 Pod （而不是直接创建容器）。每个 Pod 都与调度它的工作节点绑定，并保持在那里直到终止（根据重启策略）或删除。 如果工作节点发生故障，则会在群集中的其他可用工作节点上调度相同的 Pod。

![module_03_pods](/images/学习Kubernetes系列之概念/module_03_pods.svg)

**节点**可以是一个虚拟机或者物理机器，取决于所在的集群配置。

一个 pod 总是运行在 **工作节点**。工作节点是 Kubernetes 中的参与计算的机器，可以是虚拟机或物理计算机，具体取决于集群。每个工作节点由主节点管理。工作节点可以有多个 pod ，Kubernetes 主节点会自动处理在群集中的工作节点上调度 pod 。 主节点的自动调度考量了每个工作节点上的可用资源。

每个 Kubernetes 工作节点至少运行：

- Kubelet，负责 Kubernetes 主节点和工作节点之间通信的过程; 它管理 Pod 和机器上运行的容器。
- Container runtime（如 Docker）负责从仓库中提取容器镜像，解压缩容器以及运行应用程序。

![module_03_nodes](/images/学习Kubernetes系列之概念/module_03_nodes.svg)

所以，**节点并不等于Pod，一个节点可以有多个Pod，一个Pod是一组（一个或多个）（共享资源的）容器**。



正式开始组件概念学习。

一个 Kubernetes 集群由**一组**被称作**节点**的机器组成。这些节点上运行 Kubernetes 所管理的**容器化应用**。集群具有至少一个工作节点。

工作节点托管作为应用负载的组件的 Pod 。控制平面管理集群中的工作节点和 Pod 。 为集群提供故障转移和高可用性，这些控制平面一般跨多主机运行，集群跨多个节点运行。

![Kubernetes集群的组件](/images/学习Kubernetes系列之概念/Kubernetes集群的组件.svg)

## 控制面组件（Control Plane Components） 

控制平面的组件对集群做出全局决策(比如调度)，以及检测和响应集群事件（例如，当不满足部署的 `replicas` 字段时，启动新的pod）。

控制平面组件**可以在集群中的任何节点上运行**。通常会在同一个服务器上启动所有控制平面组件， 并且不会在此计算机上运行用户容器。（管理、业务分离）

请参阅[使用 kubeadm 构建高可用性集群](https://kubernetes.io/zh/docs/setup/production-environment/tools/kubeadm/high-availability/) 中关于多 VM 控制平面设置的示例。



### kube-apiserver

API server作为 Kubernetes 控制面的前端，公开了 Kubernetes API。 [kube-apiserver](https://kubernetes.io/zh/docs/reference/command-line-tools-reference/kube-apiserver/) 是Kubernetes API server的主要实现。

kube-apiserver 设计上考虑了水平伸缩，可以运行 kube-apiserver 的多个实例，并在这些实例之间平衡流量。



### etcd

etcd 是兼具**一致性**和**高可用性**的键值数据库，可以作为保存 Kubernetes 所有集群数据的后台数据库。

如果使用etcd作为 Kubernetes 集群的存储后台，请确保为etcd制定[备份计划](https://kubernetes.io/zh/docs/tasks/administer-cluster/configure-upgrade-etcd/#%E5%A4%87%E4%BB%BD-etcd-%E9%9B%86%E7%BE%A4)。

要了解 etcd 更深层次的信息，请参考 [etcd 文档](https://etcd.io/docs/)。



### kube-scheduler

控制面组件，负责**监视**新创建的、未指定运行[节点（node）](https://kubernetes.io/zh/docs/concepts/architecture/nodes/)的 [Pods](https://kubernetes.io/docs/concepts/workloads/pods/pod-overview/)，选择节点让 Pod 在上面运行。

**调度决策**考虑的因素包括单个 Pod 和 Pod 集合的资源需求、硬件/软件/策略约束、亲和性和反亲和性规范、数据位置、工作负载间的干扰和最后时限。



### kube-controller-manager

运行[控制器](https://kubernetes.io/zh/docs/concepts/architecture/controller/)进程的控制面组件。

从逻辑上讲，每个[控制器](https://kubernetes.io/zh/docs/concepts/architecture/controller/)都是一个单独的进程， 但是为了降低复杂性，它们都被编译到同一个可执行文件，并在一个进程中运行。

这些控制器包括:

- 节点控制器（Node Controller）: 负责在**节点出现故障时进行通知和响应**
- 任务控制器（Job controller）: 监测代表一次性任务的 Job 对象，然后创建 Pods 来运行这些任务直至完成
- 端点控制器（Endpoints Controller）: 填充端点(Endpoints)对象(即加入 Service 与 Pod)
- 服务帐户和令牌控制器（Service Account & Token Controllers）: 为新的命名空间创建默认帐户和 API 访问令牌



### cloud-controller-manager

云控制器管理器是指嵌入特定云的控制逻辑的 [控制平面](https://kubernetes.io/zh/docs/reference/glossary/?all=true#term-control-plane)组件。 cloud-controller-manager使得你可以将你的**集群连接到云提供商的 API 之上**， 并将与该云平台交互的组件同与你的集群交互的组件分离开来。

`cloud-controller-manager` 仅运行特定于云平台的控制回路。 如果你在自己的环境中运行 Kubernetes，或者在本地计算机中运行学习环境， 所部署的环境中不需要云控制器管理器。

与 `kube-controller-manager` 类似，`cloud-controller-manager` 将若干逻辑上独立的 控制回路组合到同一个可执行文件中，供你以同一进程的方式运行。 你可以对其执行水平扩容（运行不止一个副本）以提升性能或者增强容错能力。

下面的控制器都包含对云平台驱动的依赖：

- 节点控制器（Node Controller）: 用于在节点终止响应后检查云提供商以确定节点是否已被删除
- 路由控制器（Route Controller）: 用于在底层云基础架构中设置路由
- 服务控制器（Service Controller）: 用于创建、更新和删除云提供商负载均衡器.



## Node 组件 

节点组件在每个节点上运行，维护运行的 Pod 并提供 Kubernetes 运行环境。

### kubelet

一个在集群中每个节点（node）上运行的代理。 它保证容器（containers）都运行在 Pod中。

kubelet 接收一组通过各类机制提供给它的 **PodSpecs**，确保这些 PodSpecs 中描述的容器处于运行状态且健康。

kubelet 不会管理不是由 Kubernetes 创建的容器。



### kube-proxy

[kube-proxy](https://kubernetes.io/zh/docs/reference/command-line-tools-reference/kube-proxy/) 是集群中每个节点上运行的网络代理， 实现 Kubernetes [服务（Service）](https://kubernetes.io/zh/docs/concepts/services-networking/service/) 概念的一部分。

kube-proxy **维护节点上的网络规则**。这些网络规则允许从集群内部或外部的网络会话与 Pod 进行网络通信。

如果操作系统提供了数据包过滤层并可用的话，kube-proxy 会通过它来实现网络规则。否则， kube-proxy 仅转发流量本身。



### 容器运行时（Container Runtime） 

容器运行环境是负责运行容器的软件。

Kubernetes 支持多个容器运行环境: [Docker](https://kubernetes.io/zh/docs/reference/kubectl/docker-cli-to-kubectl/)、 [containerd](https://containerd.io/docs/)、[CRI-O](https://cri-o.io/#what-is-cri-o) 以及任何实现 [Kubernetes CRI (容器运行环境接口)](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-node/container-runtime-interface.md)。



## 插件（Addons） 

插件使用 Kubernetes 资源（[DaemonSet](https://kubernetes.io/zh/docs/concepts/workloads/controllers/daemonset/)、 [Deployment](https://kubernetes.io/zh/docs/concepts/workloads/controllers/deployment/)等）实现集群功能。 因为这些插件提供集群级别的功能，插件中命名空间域的资源属于 `kube-system` 命名空间。

下面描述众多插件中的几种。有关可用插件的完整列表，请参见 [插件（Addons）](https://kubernetes.io/zh/docs/concepts/cluster-administration/addons/)。

### DNS 

尽管其他插件都并非严格意义上的必需组件，但几乎所有 Kubernetes 集群都应该 有[集群 DNS](https://kubernetes.io/zh/docs/concepts/services-networking/dns-pod-service/)， 因为很多示例都需要 DNS 服务。

集群 DNS 是一个 DNS 服务器，和环境中的其他 DNS 服务器一起工作，它为 Kubernetes 服务提供 DNS 记录。

Kubernetes 启动的容器自动将此 DNS 服务器包含在其 DNS 搜索列表中。



### Web 界面（仪表盘）

[Dashboard](https://kubernetes.io/zh/docs/tasks/access-application-cluster/web-ui-dashboard/) 是 Kubernetes 集群的通用的、基于 Web 的用户界面。 它使用户可以管理集群中运行的应用程序以及集群本身并进行故障排除。



### 容器资源监控

[容器资源监控](https://kubernetes.io/zh/docs/tasks/debug-application-cluster/resource-usage-monitoring/) 将关于容器的一些常见的时间序列度量值保存到一个集中的数据库中，并提供用于浏览这些数据的界面。



### 集群层面日志

[集群层面日志](https://kubernetes.io/zh/docs/concepts/cluster-administration/logging/) 机制负责将容器的日志数据 保存到一个集中的日志存储中，该存储能够提供搜索和浏览接口。



# Kubernetes 对象

在 Kubernetes 系统中，*Kubernetes 对象* 是**持久化的实体**。 Kubernetes 使用这些实体去**表示整个集群的状态**。特别地，它们描述了如下信息：

- 哪些容器化应用在运行（以及在哪些节点上）
- 可以被应用使用的资源
- 关于应用运行时表现的策略，比如重启策略、升级策略，以及容错策略

Kubernetes 对象是 “目标性记录” —— **一旦创建对象，Kubernetes 系统将持续工作以确保对象存在**。 通过创建对象，本质上是在告知 Kubernetes 系统，所需要的集群工作负载看起来是什么样子的， 这就是 Kubernetes 集群的 **期望状态（Desired State）**。

操作 Kubernetes 对象 —— 无论是创建、修改，或者删除 —— 需要使用 [Kubernetes API](https://kubernetes.io/zh/docs/concepts/overview/kubernetes-api)。 比如，当使用 `kubectl` 命令行接口时，CLI 会执行必要的 Kubernetes API 调用， 也可以在程序中使用 [客户端库](https://kubernetes.io/zh/docs/reference/using-api/client-libraries/)直接调用 Kubernetes API。



### 对象规约（Spec）与状态（Status） 

几乎每个 Kubernetes 对象包含**两个嵌套的对象字段**，它们负责管理对象的配置： 对象 *`spec`（规约）* 和 对象 *`status`（状态）* 。

对于具有 `spec` 的对象，必须在创建对象时设置其内容，描述希望对象所具有的特征： *期望状态（Desired State）* 。

`status` 描述了对象的 *当前状态（Current State）*，它是由 Kubernetes 系统和组件 设置并更新的。在任何时刻，Kubernetes [控制面](https://kubernetes.io/zh/docs/reference/glossary/?all=true#term-control-plane) 都一直积极地管理着对象的实际状态，以使之与期望状态相匹配。

例如，Kubernetes 中的 Deployment 对象能够表示运行在集群中的应用。 当创建 Deployment 时，可能需要设置 Deployment 的 `spec`，以指定该应用需要有 3 个副本运行。 Kubernetes 系统读取 Deployment 规约，并启动我们所期望的应用的 3 个实例 —— 更新状态以与规约相匹配。 如果这些实例中有的失败了（一种状态变更），Kubernetes 系统通过执行修正操作 来响应规约和状态间的不一致 —— 在这里意味着它会启动一个新的实例来替换。

关于对象 spec、status 和 metadata 的更多信息，可参阅 [Kubernetes API 约定](https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md)。



### 描述 Kubernetes 对象

创建 Kubernetes 对象时，必须提供对象的规约，用来描述该对象的期望状态， 以及关于对象的一些基本信息（例如名称）。 当使用 Kubernetes API 创建对象时（或者直接创建，或者基于`kubectl`）， API 请求必须在请求体中包含 JSON 格式的信息。 **大多数情况下，需要在 .yaml 文件中为 `kubectl` 提供这些信息**。 `kubectl` 在发起 API 请求时，将这些信息转换成 JSON 格式。

下面的示例展示了 Kubernetes Deployment 的**必需字段和对象规约**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
spec:
  selector:
    matchLabels:
      app: nginx
  replicas: 2 # tells deployment to run 2 pods matching the template
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.14.2
        ports:
        - containerPort: 80
```

使用类似于上面的 `.yaml` 文件来创建 Deployment的一种方式是使用 `kubectl` 命令行接口（CLI）中的 [`kubectl apply`](https://kubernetes.io/docs/reference/generated/kubectl/kubectl-commands#apply) 命令， 将 `.yaml` 文件作为参数。

```shell
kubectl apply -f https://k8s.io/examples/application/deployment.yaml --record
```

输出类似如下这样：

```shell
deployment.apps/nginx-deployment created
```

### 必需字段 

在想要创建的 Kubernetes 对象对应的 `.yaml` 文件中，需要配置如下的字段：

- `apiVersion` - 创建该对象所使用的 Kubernetes API 的版本
- `kind` - 想要创建的对象的类别
- `metadata` - 帮助唯一性标识对象的一些数据，包括一个 `name` 字符串、UID 和可选的 `namespace`
- `spec` - 你所期望的该对象的状态

对象 `spec` 的精确格式对每个 Kubernetes 对象来说是不同的，包含了特定于该对象的嵌套字段。

 [Kubernetes API 参考](https://kubernetes.io/docs/reference/kubernetes-api/) 能够帮助我们找到任何我们想创建的对象的规约格式。例如，Pod 参考文档详细说明了 API 中 Pod 的 [`spec` 字段](https://kubernetes.io/docs/reference/kubernetes-api/workload-resources/pod-v1/#PodSpec)， Deployment 的参考文档则详细说明了 Deployment 的 [`spec` 字段](https://kubernetes.io/docs/reference/kubernetes-api/workload-resources/deployment-v1/#DeploymentSpec)。 

在这些 API 参考页面中，将看到提到的 PodSpec 和 DeploymentSpec。 这些名字是 Kubernetes 用来实现其 API 的 Golang 代码的实现细节。

# Kubernetes 对象管理

`kubectl` 命令行工具支持多种不同的方式来创建和管理 Kubernetes 对象。阅读 [Kubectl book](https://kubectl.docs.kubernetes.io/) 来了解 kubectl 管理对象的详细信息。

## 管理技巧

> 应该只使用一种技术来管理 Kubernetes 对象。混合和匹配技术作用在同一对象上将导致未定义行为。

| 管理技术       | 作用于   | 建议的环境 | 支持的写者 | 学习难度 |
| -------------- | -------- | ---------- | ---------- | -------- |
| 指令式命令     | 活跃对象 | 开发项目   | 1+         | 最低     |
| 指令式对象配置 | 单个文件 | 生产项目   | 1          | 中等     |
| 声明式对象配置 | 文件目录 | 生产项目   | 1+         | 最高     |

## 指令式命令

使用指令式命令时，用户可以在集群中的**活动对象**上进行操作。用户将操作传给 `kubectl` 命令作为参数或标志。

这是开始或者在集群中运行一次性任务的推荐方法。因为这个技术直接在活跃对象 上操作，所以它**不提供以前配置的历史记录**。

通过创建 Deployment 对象来运行 nginx 容器的实例：

```sh
kubectl create deployment nginx --image nginx
```

### 权衡

与对象配置相比的优点：

- 命令简单，易学且易于记忆。
- 命令仅需一步即可对集群进行更改。

与对象配置相比的缺点：

- 命令不与变更审查流程集成。
- 命令不提供与更改关联的审核跟踪。
- 除了实时内容外，命令不提供记录源。
- 命令不提供用于创建新对象的模板。

## 指令式对象配置

在指令式对象配置中，kubectl 命令指定操作（创建，替换等），可选标志和 至少一个文件名。指定的文件必须包含 YAML 或 JSON 格式的对象的完整定义。

> `replace` 指令式命令将现有规范替换为新提供的规范，并放弃对配置文件中 缺少的对象的所有更改。
>
> 此方法不应与 对象规约被独立于配置文件进行更新的资源 类型一起使用。比如类型为 `LoadBalancer` 的服务，它的 `externalIPs` 字段就是独立于集群配置进行更新。

创建配置文件中定义的对象：

```sh
kubectl create -f nginx.yaml
```

删除两个配置文件中定义的对象：

```sh
kubectl delete -f nginx.yaml -f redis.yaml
```

通过覆盖活动配置来更新配置文件中定义的对象：

```sh
kubectl replace -f nginx.yaml
```

### 权衡

与指令式命令相比的优点：

- 对象配置可以存储在源控制系统中，比如 Git。
- 对象配置可以与流程集成，例如在推送和审计之前检查更新。
- 对象配置提供了用于创建新对象的模板。

与指令式命令相比的缺点：

- 对象配置需要对对象架构有基本的了解。
- 对象配置需要额外的步骤来编写 YAML 文件。

与声明式对象配置相比的优点：

- 指令式对象配置行为更加简单易懂。
- 从 Kubernetes 1.5 版本开始，指令对象配置更加成熟。

与声明式对象配置相比的缺点：

- **指令式对象配置更适合文件，而非目录**。
- 对活动对象的更新必须反映在配置文件中，否则会在下一次替换时丢失。

## 声明式对象配置

使用声明式对象配置时，用户对本地存储的对象配置文件进行操作，但是用户未定义要对该文件执行的操作。 `kubectl` 会自动检测每个文件的创建、更新和删除操作。 这使得配置可以在目录上工作，根据目录中配置文件对不同的对象执行不同的操作。

> 声明式对象配置保留其他编写者所做的修改，即使这些更改并未合并到对象配置文件中。 可以通过使用 `patch` API 操作仅写入观察到的差异，而不是使用 `replace` API 操作来替换整个对象配置来实现。

处理 `configs` 目录中的所有对象配置文件，创建并更新活跃对象。 可以首先使用 `diff` 子命令查看将要进行的更改，然后在进行应用：

```sh
kubectl diff -f configs/
kubectl apply -f configs/
```

递归处理目录：

```sh
kubectl diff -R -f configs/
kubectl apply -R -f configs/
```

### 权衡

与指令式对象配置相比的优点：

- 对活动对象所做的更改即使未合并到配置文件中，也会被保留下来。
- 声明性对象配置更好地支持对目录进行操作并自动检测每个文件的操作类型（创建，修补，删除）。

与指令式对象配置相比的缺点：

- 声明式对象配置难于调试并且出现异常时结果难以理解。
- 使用 diff 产生的部分更新会创建复杂的合并和补丁操作。

# 对象名称和 IDs

集群中的每一个对象都有一个`名称`来标识在**同类资源**中的唯一性。

每个 Kubernetes 对象也有一个`UID`来标识在整个集群中的唯一性。

比如，在同一个`名字空间`中有一个名为 `myapp-1234` 的 Pod, 但是可以命名一个 Pod 和一个 Deployment 同为 `myapp-1234`.

对于用户提供的非唯一性的属性，Kubernetes 提供了 标签（Labels）和 注解（Annotation）机制。

## 名称 

客户端提供的字符串，引用资源 url 中的对象，如`/api/v1/pods/some name`。

某一时刻，只能有一个给定类型的对象具有给定的名称。但是，如果删除该对象，则可以创建同名的新对象。

> 当对象所代表的是一个物理实体（例如代表一台物理主机的 Node）时， 如果在 Node 对象未被删除并重建的条件下，重新创建了同名的物理主机， 则 Kubernetes 会将新的主机看作是老的主机，这可能会带来某种不一致性。

比较常见的四种资源命名约束。

### DNS 子域名 

很多资源类型需要可以用作 DNS 子域名的名称。 DNS 子域名的定义可参见 [RFC 1123](https://tools.ietf.org/html/rfc1123)。 这一要求意味着名称必须满足如下规则：

- 不能超过253个字符
- 只能包含小写字母、数字，以及'-' 和 '.'
- 须以字母数字开头
- 须以字母数字结尾

### RFC 1123 标签名 

某些资源类型需要其名称遵循 [RFC 1123](https://tools.ietf.org/html/rfc1123) 所定义的 DNS 标签标准。也就是命名必须满足如下规则：

- 最多 63 个字符
- 只能包含小写字母、数字，以及 '-'
- 须以字母、数字开头
- 须以字母数字结尾

### RFC 1035 标签名 

某些资源类型需要其名称遵循 [RFC 1035](https://tools.ietf.org/html/rfc1035) 所定义的 DNS 标签标准。也就是命名必须满足如下规则：

- 最多 63 个字符
- 只能包含小写字母、数字，以及 '-'
- 须以字母开头
- 须以字母数字结尾

### 路径分段名称 

某些资源类型要求名称能被安全地用作路径中的片段。 换句话说，其名称不能是 `.`、`..`，也不可以包含 `/` 或 `%` 这些字符。

下面是一个名为`nginx-demo`的 Pod 的配置清单：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: nginx-demo
spec:
  containers:
  - name: nginx
    image: nginx:1.14.2
    ports:
    - containerPort: 80
```

**说明：** 某些资源类型可能具有额外的命名约束。

## UIDs

Kubernetes 系统生成的字符串，唯一标识对象。

在 Kubernetes 集群的整个生命周期中创建的每个对象都有一个不同的 uid，它旨在区分类似实体的历史事件。

Kubernetes UIDs 是全局唯一标识符（也叫 UUIDs）。 UUIDs 是标准化的，见 ISO/IEC 9834-8 和 ITU-T X.667.

# 名字空间

Kubernetes 支持多个虚拟集群，它们底层依赖于同一个物理集群。 这些**虚拟集群被称为名字空间**。 在一些文档里名字空间也称为命名空间。

## 何时使用多个名字空间

名字空间适用于存在很多跨多个团队或项目的用户的场景。对于只有几到几十个用户的集群，根本不需要创建或考虑名字空间。

名字空间为名称提供了一个范围。**资源的名称需要在名字空间内是唯一的**，但不能跨名字空间。 **名字空间不能相互嵌套，每个 Kubernetes 资源只能在一个名字空间中**。

名字空间是在多个用户之间划分集群资源的一种方法（通过[资源配额](https://kubernetes.io/zh/docs/concepts/policy/resource-quotas/)）。

不必使用多个名字空间来分隔仅仅轻微不同的资源，例如同一软件的不同版本： 应该使用[标签](https://kubernetes.io/zh/docs/concepts/overview/working-with-objects/labels/) 来区分同一名字空间中的不同资源。

## 使用名字空间

名字空间的创建和删除在[名字空间的管理指南文档](https://kubernetes.io/zh/docs/tasks/administer-cluster/namespaces/)描述。

> 避免使用前缀 `kube-` 创建名字空间，因为它是为 Kubernetes 系统名字空间保留的。

### 查看名字空间

可以使用以下命令列出集群中现存的名字空间：

```shell
kubectl get namespace
NAME          STATUS    AGE
default       Active    1d
kube-node-lease   Active   1d
kube-system   Active    1d
kube-public   Active    1d
```

Kubernetes 会创建四个初始名字空间：

- `default` 没有指明使用其它名字空间的对象所使用的默认名字空间
- `kube-system` Kubernetes 系统创建对象所使用的名字空间
- `kube-public` 这个名字空间是自动创建的，所有用户（包括未经过身份验证的用户）都可以读取它。 这个名字空间主要用于集群使用，以防某些资源在整个集群中应该是可见和可读的。 这个名字空间的公共方面只是一种约定，而不是要求。
- `kube-node-lease` 此名字空间用于与各个节点相关的 [租约（Lease）](https://kubernetes.io/docs/reference/kubernetes-api/cluster-resources/lease-v1/)对象。 节点租期允许 kubelet 发送[心跳](https://kubernetes.io/zh/docs/concepts/architecture/nodes/#heartbeats)，由此控制面能够检测到节点故障。

### 为请求设置名字空间

要为当前请求设置名字空间，请使用 `--namespace` 参数。

例如：

```shell
kubectl run nginx --image=nginx --namespace=<名字空间名称>
kubectl get pods --namespace=<名字空间名称>
```

### 设置名字空间偏好

你可以永久保存名字空间，以用于对应上下文中所有后续 kubectl 命令。

```shell
kubectl config set-context --current --namespace=<名字空间名称>
# 验证之
kubectl config view | grep namespace:
```

## 名字空间和 DNS

当你创建一个服务时， Kubernetes 会创建一个相应的 DNS 条目。

该条目的形式是 `<服务名称>.<名字空间名称>.svc.cluster.local`，这意味着如果容器只使用 `<服务名称>`，它将被解析到本地名字空间的服务。这对于跨多个名字空间（如开发、分级和生产） 使用相同的配置非常有用。如果你希望跨名字空间访问，则需要使用完全限定域名（FQDN）。

## 并非所有对象都在名字空间中

大多数 kubernetes 资源（例如 Pod、Service、副本控制器等）都位于某些名字空间中。 但是名字空间资源本身并不在名字空间中。而且底层资源，例如 节点 和持久化卷不属于任何名字空间。

查看哪些 Kubernetes 资源在名字空间中，哪些不在名字空间中：

```shell
# 位于名字空间中的资源
kubectl api-resources --namespaced=true

# 不在名字空间中的资源
kubectl api-resources --namespaced=false
```

## 自动打标签 

**FEATURE STATE:** `Kubernetes 1.21 [beta]`

Kubernetes 控制面会为所有名字空间设置一个不可变更的 标签`kubernetes.io/metadata.name`，只要 `NamespaceDefaultLabelName` 这一 [特性门控](https://kubernetes.io/zh/docs/reference/command-line-tools-reference/feature-gates/) 被启用。标签的值是名字空间的名称。



# 标签和选择算符

*标签（Labels）* 是附加到 Kubernetes 对象（比如 Pods）上的键值对。 标签旨在用于指定对用户有意义且相关的对象的标识属性，但不直接对核心系统有语义含义。 标签可以用于组织和选择对象的子集。标签可以在创建时附加到对象，随后可以随时添加和修改。 每个对象都可以定义一组键/值标签。每个键对于给定对象必须是唯一的。

```json
"metadata": {
  "labels": {
    "key1" : "value1",
    "key2" : "value2"
  }
}
```

标签能够支持高效的查询和监听操作，对于用户界面和命令行是很理想的。 应使用[注解](https://kubernetes.io/zh/docs/concepts/overview/working-with-objects/annotations/) 记录非识别信息。

## 动机

标签使用户能够以松散耦合的方式将他们自己的组织结构映射到系统对象，而无需客户端存储这些映射。

服务部署和批处理流水线通常是多维实体（例如，多个分区或部署、多个发行序列、多个层，每层多个微服务）。 管理通常需要交叉操作，这打破了严格的层次表示的封装，特别是由基础设施而不是用户确定的严格的层次结构。

示例标签：

- `"release" : "stable"`, `"release" : "canary"`
- `"environment" : "dev"`, `"environment" : "qa"`, `"environment" : "production"`
- `"tier" : "frontend"`, `"tier" : "backend"`, `"tier" : "cache"`
- `"partition" : "customerA"`, `"partition" : "customerB"`
- `"track" : "daily"`, `"track" : "weekly"`

有一些[常用标签](https://kubernetes.io/zh/docs/concepts/overview/working-with-objects/common-labels/)的例子; 你可以任意制定自己的约定。 请记住，标签的 Key 对于给定对象必须是唯一的。

## 语法和字符集

*标签* 是键值对。有效的标签键有两个段：**可选的前缀**和**名称**，用斜杠（`/`）分隔。 名称段是必需的，必须小于等于 63 个字符，以字母数字字符（`[a-z0-9A-Z]`）开头和结尾， 带有破折号（`-`），下划线（`_`），点（ `.`）和之间的字母数字。 前缀是可选的。如果指定，前缀必须是 DNS 子域：由点（`.`）分隔的一系列 DNS 标签，总共不超过 253 个字符， 后跟斜杠（`/`）。

如果省略前缀，则假定标签键对用户是私有的。 向最终用户对象添加标签的自动系统组件（例如 `kube-scheduler`、`kube-controller-manager`、 `kube-apiserver`、`kubectl` 或其他第三方自动化工具）必须指定前缀。

`kubernetes.io/` 和 `k8s.io/` 前缀是为 Kubernetes 核心组件[保留的](https://kubernetes.io/zh/docs/reference/labels-annotations-taints/)。

有效标签值：

- 必须为 63 个字符或更少（可以为空）
- 除非标签值为空，必须以字母数字字符（`[a-z0-9A-Z]`）开头和结尾
- 包含破折号（`-`）、下划线（`_`）、点（`.`）和字母或数字。

## 标签选择算符 

与[名称和 UID](https://kubernetes.io/zh/docs/concepts/overview/working-with-objects/names/) 不同， 标签不支持唯一性。通常，我们希望许多对象携带相同的标签。

通过 *标签选择算符*，客户端/用户可以识别一组对象。标签选择算符是 Kubernetes 中的核心分组原语。

API 目前支持两种类型的选择算符：*基于等值的* 和 *基于集合的*。 标签选择算符可以**由逗号分隔**的多个 *需求* 组成。 在多个需求的情况下，必须满足所有要求，因此逗号分隔符充当逻辑 *与*（`&&`）运算符。

空标签选择算符或者未指定的选择算符的语义取决于上下文， 支持使用选择算符的 API 类别应该将算符的合法性和含义用文档记录下来。

> 对于某些 API 类别（例如 ReplicaSet）而言，两个实例的标签选择算符不得在命名空间内重叠， 否则它们的控制器将互相冲突，无法确定应该存在的副本个数。

> 对于基于等值的和基于集合的条件而言，不存在逻辑或（`||`）操作符。 你要确保你的过滤语句按合适的方式组织。

### *基于等值的* 需求[ ](https://kubernetes.io/zh/docs/concepts/overview/working-with-objects/labels/#基于等值的-需求)

*基于等值* 或 *基于不等值* 的需求允许按标签键和值进行过滤。 匹配对象必须满足所有指定的标签约束，尽管它们也可能具有其他标签。 可接受的运算符有`=`、`==` 和 `!=` 三种。 前两个表示 *相等*（并且只是同义词），而后者表示 *不相等*。例如：

```
environment = production
tier != frontend
```

前者选择所有资源，其键名等于 `environment`，值等于 `production`。 后者选择所有资源，其键名等于 `tier`，值不同于 `frontend`，所有资源都没有带有 `tier` 键的标签。 可以使用逗号运算符来过滤 `production` 环境中的非 `frontend` 层资源：`environment=production,tier!=frontend`。

基于等值的标签要求的一种使用场景是 Pod 要指定节点选择标准。 例如，下面的示例 Pod 选择带有标签 "`accelerator=nvidia-tesla-p100`"。

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: cuda-test
spec:
  containers:
    - name: cuda-test
      image: "k8s.gcr.io/cuda-vector-add:v0.1"
      resources:
        limits:
          nvidia.com/gpu: 1
  nodeSelector:
    accelerator: nvidia-tesla-p100
```

### *基于集合* 的需求

*基于集合* 的标签需求允许你通过一组值来过滤键。 支持三种操作符：`in`、`notin` 和 `exists` (只可以用在键标识符上)。例如：

```
environment in (production, qa)
tier notin (frontend, backend)
partition
!partition
```

- 第一个示例选择了所有键等于 `environment` 并且值等于 `production` 或者 `qa` 的资源。
- 第二个示例选择了所有键等于 `tier` 并且值不等于 `frontend` 或者 `backend` 的资源，以及所有没有 `tier` 键标签的资源。
- 第三个示例选择了所有包含了有 `partition` 标签的资源；没有校验它的值。
- 第四个示例选择了所有没有 `partition` 标签的资源；没有校验它的值。 类似地，逗号分隔符充当 *与* 运算符。因此，使用 `partition` 键（无论为何值）和 `environment` 不同于 `qa` 来过滤资源可以使用 `partition, environment notin（qa)` 来实现。

*基于集合* 的标签选择算符是相等标签选择算符的一般形式，因为 `environment=production` 等同于 `environment in（production）`；`!=` 和 `notin` 也是类似的。

*基于集合* 的要求可以与基于 *相等* 的要求混合使用。例如：`partition in (customerA, customerB),environment!=qa`。



# 注解

你可以使用 Kubernetes 注解为对象附加任意的非标识的元数据。客户端程序（例如工具和库）能够获取这些元数据信息。

## 为对象附加元数据

你可以使用标签或注解将元数据附加到 Kubernetes 对象。 标签可以用来**选择对象和查找**满足某些条件的对象集合。 相反，注解不用于标识和选择对象。 注解中的元数据，可以很小，也可以很大，可以是结构化的，也可以是非结构化的，能够包含标签不允许的字符。

注解和标签一样，是键/值对:

```json
"metadata": {
  "annotations": {
    "key1" : "value1",
    "key2" : "value2"
  }
}
```

> Map 中的键和值必须是字符串。 换句话说，你不能使用数字、布尔值、列表或其他类型的键或值。

以下是一些例子，用来说明哪些信息可以使用注解来记录:

- 由声明性配置所管理的字段。 将这些字段附加为注解，能够将它们与客户端或服务端设置的默认值、 自动生成的字段以及通过自动调整大小或自动伸缩系统设置的字段区分开来。
- 构建、发布或镜像信息（如时间戳、发布 ID、Git 分支、PR 数量、镜像哈希、仓库地址）。
- 指向日志记录、监控、分析或审计仓库的指针。

- 可用于调试目的的客户端库或工具信息：例如，名称、版本和构建信息。
- 用户或者工具/系统的来源信息，例如来自其他生态系统组件的相关对象的 URL。
- 轻量级上线工具的元数据信息：例如，配置或检查点。
- 负责人员的电话或呼机号码，或指定在何处可以找到该信息的目录条目，如团队网站。
- 从用户到最终运行的指令，以修改行为或使用非标准功能。

你可以将这类信息存储在外部数据库或目录中而不使用注解， 但这样做就使得开发人员很难生成用于部署、管理、自检的客户端共享库和工具。

## 语法和字符集

*注解（Annotations）* 存储的形式是键/值对。有效的注解键分为两部分： 可选的前缀和名称，以斜杠（`/`）分隔。 名称段是必需项，并且必须在63个字符以内，以字母数字字符（`[a-z0-9A-Z]`）开头和结尾， 并允许使用破折号（`-`），下划线（`_`），点（`.`）和字母数字。 前缀是可选的。如果指定，则前缀必须是DNS子域：一系列由点（`.`）分隔的DNS标签， 总计不超过253个字符，后跟斜杠（`/`）。 如果省略前缀，则假定注解键对用户是私有的。 由系统组件添加的注解 （例如，`kube-scheduler`，`kube-controller-manager`，`kube-apiserver`，`kubectl` 或其他第三方组件），必须为终端用户添加注解前缀。

`kubernetes.io/` 和 `k8s.io/` 前缀是为Kubernetes核心组件保留的。

例如，下面是一个 Pod 的配置文件，其注解中包含 `imageregistry: https://hub.docker.com/`：

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: annotations-demo
  annotations:
    imageregistry: "https://hub.docker.com/"
spec:
  containers:
  - name: nginx
    image: nginx:1.7.9
    ports:
    - containerPort: 80
```



# 词汇表

https://kubernetes.io/zh/docs/reference/glossary/?fundamental=true





# 参考

[Kubernetes 文档](https://kubernetes.io/zh/docs/home/)

[Kubernetes vs OpenStack](https://zhuanlan.zhihu.com/p/44133059)

[史上最全面的Kubernetes（K8S）入门笔记](https://www.wendev.site/2021/11/22/%E5%8F%B2%E4%B8%8A%E6%9C%80%E5%85%A8%E9%9D%A2%E7%9A%84Kubernetes%EF%BC%88K8S%EF%BC%89%E5%85%A5%E9%97%A8%E7%AC%94%E8%AE%B0/)





https://minikube.sigs.k8s.io/docs/start/

https://www.wendev.site/2021/11/22/%E5%8F%B2%E4%B8%8A%E6%9C%80%E5%85%A8%E9%9D%A2%E7%9A%84Kubernetes%EF%BC%88K8S%EF%BC%89%E5%85%A5%E9%97%A8%E7%AC%94%E8%AE%B0/

https://www.zhihu.com/question/37498459

https://www.1024sou.com/article/321121.html

https://blog.csdn.net/dualvencsdn/article/details/79207281

