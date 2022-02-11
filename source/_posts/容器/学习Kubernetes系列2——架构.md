---
title: 学习Kubernetes系列2——架构
date: 2021-05-15 19:50:55
categories:
tags:
  - Kubernetes
  - k8s
typora-root-url: ../../../source
---

此章节主要讲述k8s中架构中的几个主要部分：节点、控制面到节点的通信、控制器、云控制器管理器、CRI及GC。

<!--more-->

# 节点

Kubernetes 通过将容器放入在节点（Node）上运行的 Pod 中来执行你的工作负载。 节点可以是一个虚拟机或者物理机器，取决于所在的集群配置。 每个节点包含运行 Pods 所需的服务； 这些节点由 控制面 负责管理。

通常集群中会有若干个节点；而在一个学习用或者资源受限的环境中，你的集群中也可能 只有一个节点。

节点上的组件包括 [kubelet](https://kubernetes.io/docs/reference/generated/kubelet)、 [容器运行时](https://kubernetes.io/zh/docs/setup/production-environment/container-runtimes)以及 [kube-proxy](https://kubernetes.io/zh/docs/reference/command-line-tools-reference/kube-proxy/)。

## 管理 

向 API 服务器添加节点的方式主要有两种：

1. 节点上的 `kubelet` 向控制面执行自注册；
2. 你，或者别的什么人，手动添加一个 Node 对象。

在你创建了 Node 对象或者节点上的 `kubelet` 执行了自注册操作之后， 控制面会检查新的 Node 对象是否合法。例如，如果你使用下面的 JSON 对象来创建 Node 对象：

```json
{
  "kind": "Node",
  "apiVersion": "v1",
  "metadata": {
    "name": "10.240.79.157",
    "labels": {
      "name": "my-first-k8s-node"
    }
  }
}
```

Kubernetes 会在内部创建一个 Node 对象作为节点的表示。Kubernetes 检查 `kubelet` 向 API 服务器注册节点时使用的 `metadata.name` 字段是否匹配。 如果节点是健康的（即所有必要的服务都在运行中），则该节点可以用来运行 Pod。 否则，直到该节点变为健康之前，所有的集群活动都会忽略该节点。

> Kubernetes 会一直保存着非法节点对应的对象，并持续检查该节点是否已经 变得健康。 你，或者某个[控制器](https://kubernetes.io/zh/docs/concepts/architecture/controller/)必需显式地 删除该 Node 对象以停止健康检查操作。

Node 对象的名称必须是合法的 [DNS 子域名](https://kubernetes.io/zh/docs/concepts/overview/working-with-objects/names#dns-subdomain-names)。

### 节点自注册

当 kubelet 标志 `--register-node` 为 true（默认）时，它会尝试向 API 服务注册自己。 这是首选模式，被绝大多数发行版选用。

对于自注册模式，kubelet 使用下列参数启动：

- `--kubeconfig` - 用于向 API 服务器表明身份的凭据路径。
- `--cloud-provider` - 与某云驱动进行通信以读取与自身相关的元数据的方式。
- `--register-node` - 自动向 API 服务注册。
- `--register-with-taints` - 使用所给的污点列表（逗号分隔的 `<key>=<value>:<effect>`）注册节点。 当 `register-node` 为 false 时无效。
- `--node-ip` - 节点 IP 地址。
- `--node-labels` - 在集群中注册节点时要添加的 标签。 （参见 [NodeRestriction 准入控制插件](https://kubernetes.io/zh/docs/reference/access-authn-authz/admission-controllers/#noderestriction)所实施的标签限制）。
- `--node-status-update-frequency` - 指定 kubelet 向控制面发送状态的频率。

启用[节点授权模式](https://kubernetes.io/zh/docs/reference/access-authn-authz/node/)和 [NodeRestriction 准入插件](https://kubernetes.io/zh/docs/reference/access-authn-authz/admission-controllers/#noderestriction) 时，仅授权 `kubelet` 创建或修改其自己的节点资源。

### 手动节点管理

你可以使用 [kubectl](https://kubernetes.io/docs/user-guide/kubectl-overview/) 来创建和修改 Node 对象。

如果你希望手动创建节点对象时，请设置 kubelet 标志 `--register-node=false`。

你可以修改 Node 对象（忽略 `--register-node` 设置）。 例如，修改节点上的标签或标记其为不可调度。

你可以结合使用节点上的标签和 Pod 上的选择算符来控制调度。 例如，你可以限制某 Pod 只能在符合要求的节点子集上运行。

如果标记节点为不可调度（unschedulable），将阻止新 Pod 调度到该节点之上，但不会 影响任何已经在其上的 Pod。 这是重启节点或者执行其他维护操作之前的一个有用的准备步骤。

要标记一个节点为不可调度，执行以下命令：

```shell
kubectl cordon $NODENAME
```

更多细节参考[安全腾空节点](https://kubernetes.io/zh/docs/tasks/administer-cluster/safely-drain-node/)。

>  被 [DaemonSet](https://kubernetes.io/zh/docs/concepts/workloads/controllers/daemonset/) 控制器创建的 Pod 能够容忍节点的不可调度属性。 DaemonSet 通常提供节点本地的服务，即使节点上的负载应用已经被腾空，这些服务也仍需 运行在节点之上。
>

## 节点状态 

一个节点的状态包含以下信息:

- 地址
- 状况
- 容量与可分配
- 信息

你可以使用 `kubectl` 来查看节点状态和其他细节信息：

```shell
kubectl describe node <节点名称>
```

下面对每个部分进行详细描述。

### 地址 

这些字段的用法取决于你的云服务商或者物理机配置。

- HostName：由节点的内核设置。可以通过 kubelet 的 `--hostname-override` 参数覆盖。
- ExternalIP：通常是节点的可外部路由（从集群外可访问）的 IP 地址。
- InternalIP：通常是节点的仅可在集群内部路由的 IP 地址。

### 状况

`conditions` 字段描述了所有 `Running` 节点的状态。状况的示例包括：

| 节点状况             | 描述                                                         |
| -------------------- | ------------------------------------------------------------ |
| `Ready`              | 如节点是健康的并已经准备好接收 Pod 则为 `True`；`False` 表示节点不健康而且不能接收 Pod；`Unknown` 表示节点控制器在最近 `node-monitor-grace-period` 期间（默认 40 秒）没有收到节点的消息 |
| `DiskPressure`       | `True` 表示节点存在磁盘空间压力，即磁盘可用量低, 否则为 `False` |
| `MemoryPressure`     | `True` 表示节点存在内存压力，即节点内存可用量低，否则为 `False` |
| `PIDPressure`        | `True` 表示节点存在进程压力，即节点上进程过多；否则为 `False` |
| `NetworkUnavailable` | `True` 表示节点网络配置不正确；否则为 `False`                |

> 如果使用命令行工具来打印已保护（Cordoned）节点的细节，其中的 Condition 字段可能 包括 `SchedulingDisabled`。`SchedulingDisabled` 不是 Kubernetes API 中定义的 Condition，被保护起来的节点在其规约中被标记为不可调度（Unschedulable）。

在 Kubernetes API 中，节点的状况表示节点资源中`.status` 的一部分。 例如，以下 JSON 结构描述了一个健康节点：

```json
"conditions": [
  {
    "type": "Ready",
    "status": "True",
    "reason": "KubeletReady",
    "message": "kubelet is posting ready status",
    "lastHeartbeatTime": "2019-06-05T18:38:35Z",
    "lastTransitionTime": "2019-06-05T11:41:27Z"
  }
]
```

如果 Ready 条件的 `status` 处于 `Unknown` 或者 `False` 状态的时间超过了 `pod-eviction-timeout` 值， （一个传递给 kube-controller-manager的参数）， 节点控制器会对节点上的所有 Pod 触发 [API-发起的驱逐](https://kubernetes.io/zh/docs/concepts/scheduling-eviction/pod-eviction/#api-eviction)。 默认的逐出超时时长为 **5 分钟**。 某些情况下，当节点不可达时，API 服务器不能和其上的 kubelet 通信。 删除 Pod 的决定不能传达给 kubelet，直到它重新建立和 API 服务器的连接为止。 与此同时，被计划删除的 Pod 可能会继续在游离的节点上运行。

节点控制器在确认 Pod 在集群中已经停止运行前，不会强制删除它们。 你可以看到这些可能在无法访问的节点上运行的 Pod 处于 `Terminating` 或者 `Unknown` 状态。 如果 kubernetes 不能基于下层基础设施推断出某节点是否已经永久离开了集群， 集群管理员可能需要**手动删除该节点对象**。 从 Kubernetes 删除节点对象将导致 API 服务器删除节点上所有运行的 Pod 对象并释放它们的名字。

节点生命周期控制器会自动创建代表状况的 [污点](https://kubernetes.io/zh/docs/concepts/scheduling-eviction/taint-and-toleration/)。 当调度器将 Pod 指派给某节点时，会考虑节点上的污点。 Pod 则可以通过容忍度（Toleration）表达所能容忍的污点。

### 容量与可分配

描述节点上的可用资源：**CPU、内存和可以调度到节点上的 Pod 的个数上限**。

`capacity` 块中的字段标示节点拥有的资源总量。 `allocatable` 块指示节点上可供普通 Pod 消耗的资源量。

可以在学习如何在节点上[预留计算资源](https://kubernetes.io/zh/docs/tasks/administer-cluster/reserve-compute-resources/#node-allocatable) 的时候了解有关容量和可分配资源的更多信息。

### 信息

描述节点的一般信息，如内核版本、Kubernetes 版本（`kubelet` 和 `kube-proxy` 版本）、 容器运行时详细信息，以及 节点使用的操作系统。 `kubelet` 从节点收集这些信息并将其发布到 Kubernetes API。

## 心跳 

Kubernetes 节点发送的心跳帮助你的集群确定每个节点的可用性，并在检测到故障时采取行动。

对于节点，有两种形式的心跳:

- 更新节点的 `.status`
- [Lease](https://kubernetes.io/docs/reference/kubernetes-api/cluster-resources/lease-v1/) 对象 在 `kube-node-lease` [命名空间](https://kubernetes.io/zh/docs/concepts/overview/working-with-objects/namespaces/)中。 每个节点都有一个关联的 Lease 对象。

kubelet 负责创建和更新节点的 `.status`，以及更新它们对应的 `Lease`。

- 当状态发生变化时，或者在配置的时间间隔内没有更新事件时，kubelet 会更新 `.status`。 `.status` 更新的默认间隔为 5 分钟（比不可达节点的 40 秒默认超时时间长很多）。
- `kubelet` 会每 10 秒（默认更新间隔时间）创建并更新其 `Lease` 对象。 `Lease` 更新独立于 `NodeStatus` 更新而发生。 如果 `Lease` 的更新操作失败，`kubelet` 会采用指数回退机制，从 200 毫秒开始 重试，最长重试间隔为 7 秒钟。

## 节点控制器 

节点[控制器](https://kubernetes.io/zh/docs/concepts/architecture/controller/)是 Kubernetes 控制面组件，管理节点的方方面面。

节点控制器在节点的生命周期中扮演多个角色。 第一个是当节点注册时为它分配一个 CIDR 区段（如果启用了 CIDR 分配）。

第二个是保持节点控制器内的节点列表与云服务商所提供的可用机器列表同步。 如果在云环境下运行，只要某节点不健康，节点控制器就会**询问云服务是否节点的虚拟机仍可用**。 如果不可用，节点控制器会将该节点从它的节点列表删除。

第三个是监控节点的健康状况。 节点控制器是负责：

- 在节点节点不可达的情况下，在 Node 的 `.status` 中更新 `NodeReady` 状况。 在这种情况下，节点控制器将 `NodeReady` 状况更新为 `ConditionUnknown` 。
- 如果节点仍然无法访问：对于不可达节点上的所有 Pod触发 [API-发起的逐出](https://kubernetes.io/zh/docs/concepts/scheduling-eviction/api-eviction/)。 默认情况下，节点控制器 在将节点标记为 `ConditionUnknown` 后等待 5 分钟 提交第一个驱逐请求。

节点控制器每隔 `--node-monitor-period` 秒检查每个节点的状态。

### 逐出速率限制 

大部分情况下，节点控制器把逐出速率限制在每秒 `--node-eviction-rate` 个（默认为 0.1）。 这表示它每 10 秒钟内至多从一个节点驱逐 Pod。

当一个可用区域（Availability Zone）中的节点变为不健康时，节点的驱逐行为将发生改变。 节点控制器会同时检查可用区域中不健康（NodeReady 状况为 `ConditionUnknown` 或 `ConditionFalse`） 的节点的百分比：

- 如果不健康节点的比例超过 `--unhealthy-zone-threshold` （默认为 0.55）， 驱逐速率将会降低。
- 如果集群较小（意即小于等于 `--large-cluster-size-threshold` 个节点 - 默认为 50），驱逐操作将会停止。
- 否则驱逐速率将降为每秒 `--secondary-node-eviction-rate` 个（默认为 0.01）。

在单个可用区域实施这些策略的原因是当一个可用区域可能从控制面脱离时其它可用区域 可能仍然保持连接。 如果你的集群没有跨越云服务商的多个可用区域，那（整个集群）就只有一个可用区域。

跨多个可用区域部署你的节点的一个关键原因是当某个可用区域整体出现故障时， 工作负载可以转移到健康的可用区域。 因此，如果一个可用区域中的所有节点都不健康时，节点控制器会以正常的速率 `--node-eviction-rate` 进行驱逐操作。 在所有的可用区域都不健康（也即集群中没有健康节点）的极端情况下， 节点控制器将假设控制面与节点间的连接出了某些问题，它将停止所有驱逐动作（如果故障后部分节点重新连接， 节点控制器会从剩下不健康或者不可达节点中驱逐 `pods`）。

节点控制器还负责驱逐运行在拥有 `NoExecute` 污点的节点上的 Pod， 除非这些 Pod 能够容忍此污点。 节点控制器还负责根据节点故障（例如节点不可访问或没有就绪）为其添加 [污点](https://kubernetes.io/zh/docs/concepts/scheduling-eviction/taint-and-toleration/)。 这意味着调度器不会将 Pod 调度到不健康的节点上。

### 资源容量跟踪 

Node 对象会跟踪节点上资源的容量（例如可用内存和 CPU 数量）。 通过[自注册](https://kubernetes.io/zh/docs/concepts/architecture/nodes/#self-registration-of-nodes)机制生成的 Node 对象会在注册期间报告自身容量。 如果你[手动](https://kubernetes.io/zh/docs/concepts/architecture/nodes/#manual-node-administration)添加了 Node，你就需要在添加节点时 手动设置节点容量。

Kubernetes [调度器](https://kubernetes.io/docs/reference/generated/kube-scheduler/)保证节点上 有足够的资源供其上的所有 Pod 使用。它会检查节点上所有容器的请求的总和不会超过节点的容量。 总的请求包括由 kubelet 启动的所有容器，但不包括由容器运行时直接启动的容器， 也不包括不受 `kubelet` 控制的其他进程。

>  如果要为非 Pod 进程显式保留资源。请参考 [为系统守护进程预留资源](https://kubernetes.io/zh/docs/tasks/administer-cluster/reserve-compute-resources/#system-reserved)。

# 控制面到节点通信

## 节点到控制面

Kubernetes 采用的是中心辐射型（Hub-and-Spoke）API 模式。 所有从集群（或所运行的 Pods）发出的 API 调用都终止于 apiserver。 其它控制面组件都没有被设计为可暴露远程服务。 apiserver 被配置为在一个安全的 HTTPS 端口（通常为 443）上监听远程连接请求， 并启用一种或多种形式的客户端[身份认证](https://kubernetes.io/zh/docs/reference/access-authn-authz/authentication/)机制。 一种或多种客户端[鉴权机制](https://kubernetes.io/zh/docs/reference/access-authn-authz/authorization/)应该被启用， 特别是在允许使用[匿名请求](https://kubernetes.io/zh/docs/reference/access-authn-authz/authentication/#anonymous-requests) 或[服务账号令牌](https://kubernetes.io/zh/docs/reference/access-authn-authz/authentication/#service-account-tokens)的时候。

应该使用集群的公共根证书开通节点，这样它们就能够基于有效的客户端凭据安全地连接 apiserver。 一种好的方法是以客户端证书的形式将客户端凭据提供给 kubelet。 请查看 [kubelet TLS 启动引导](https://kubernetes.io/zh/docs/reference/command-line-tools-reference/kubelet-tls-bootstrapping/) 以了解如何自动提供 kubelet 客户端证书。

想要连接到 apiserver 的 Pod 可以使用服务账号安全地进行连接。 当 Pod 被实例化时，Kubernetes 自动把公共根证书和一个有效的持有者令牌注入到 Pod 里。 `kubernetes` 服务（位于 `default` 名字空间中）配置了一个虚拟 IP 地址，用于（通过 kube-proxy）转发 请求到 apiserver 的 HTTPS 末端。

控制面组件也通过安全端口与集群的 apiserver 通信。

这样，从集群节点和节点上运行的 Pod 到控制面的连接的缺省操作模式即是安全的， 能够在不可信的网络或公网上运行。

## 控制面到节点

从控制面（apiserver）到节点有两种主要的通信路径。 第一种是从 apiserver 到集群中每个节点上运行的 kubelet 进程。 第二种是从 apiserver 通过它的代理功能连接到任何节点、Pod 或者服务。

### API 服务器到 kubelet

从 apiserver 到 kubelet 的连接用于：

- 获取 Pod 日志
- 挂接（通过 kubectl）到运行中的 Pod
- 提供 kubelet 的端口转发功能。

这些连接终止于 kubelet 的 HTTPS 末端。 默认情况下，apiserver 不检查 kubelet 的服务证书。这使得此类连接容易受到中间人攻击， 在非受信网络或公开网络上运行也是 **不安全的**。

为了对这个连接进行认证，使用 `--kubelet-certificate-authority` 标志给 apiserver 提供一个根证书包，用于 kubelet 的服务证书。

如果无法实现这点，又要求避免在非受信网络或公共网络上进行连接，可在 apiserver 和 kubelet 之间使用 [SSH 隧道](https://kubernetes.io/zh/docs/concepts/architecture/control-plane-node-communication/#ssh-tunnels)。

最后，应该启用 [kubelet 用户认证和/或鉴权](https://kubernetes.io/zh/docs/reference/command-line-tools-reference/kubelet-authentication-authorization/) 来保护 kubelet API。

### apiserver 到节点、Pod 和服务

从 apiserver 到节点、Pod 或服务的连接默认为纯 HTTP 方式，因此既没有认证，也没有加密。 这些连接可通过给 API URL 中的节点、Pod 或服务名称添加前缀 `https:` 来运行在安全的 HTTPS 连接上。 不过这些连接既不会验证 HTTPS 末端提供的证书，也不会提供客户端证书。 因此，虽然连接是加密的，仍无法提供任何完整性保证。 这些连接 **目前还不能安全地** 在非受信网络或公共网络上运行。

### SSH 隧道

Kubernetes 支持使用 SSH 隧道来保护从控制面到节点的通信路径。在这种配置下，apiserver 建立一个到集群中各节点的 SSH 隧道（连接到在 22 端口监听的 SSH 服务） 并通过这个隧道传输所有到 kubelet、节点、Pod 或服务的请求。 这一隧道保证通信不会被暴露到集群节点所运行的网络之外。

SSH 隧道目前已被废弃。除非你了解个中细节，否则不应使用。 Konnectivity 服务是对此通信通道的替代品。

# 控制器

在 Kubernetes 中，控制器通过监控[集群](https://kubernetes.io/zh/docs/reference/glossary/?all=true#term-cluster) 的公共状态，并致力于将当前状态转变为期望的状态。

## 控制器模式

一个控制器至少追踪一种类型的 Kubernetes 资源。这些 [对象](https://kubernetes.io/zh/docs/concepts/overview/working-with-objects/kubernetes-objects/) 有一个代表期望状态的 `spec` 字段。 该资源的控制器负责确保其当前状态接近期望状态。

控制器可能会自行执行操作；在 Kubernetes 中更常见的是一个控制器会发送信息给 [API 服务器](https://kubernetes.io/zh/docs/reference/command-line-tools-reference/kube-apiserver/)，这会有副作用。 具体可参看后文的例子。

### 通过 API 服务器来控制

[Job](https://kubernetes.io/zh/docs/concepts/workloads/controllers/job/) (任务)控制器是一个 Kubernetes 内置控制器的例子。 内置控制器通过和集群 API 服务器交互来管理状态。

Job 是一种 Kubernetes 资源，它运行一个或者多个 [Pod](https://kubernetes.io/docs/concepts/workloads/pods/pod-overview/)， 来执行一个任务然后停止。 （一旦[被调度了](https://kubernetes.io/zh/docs/concepts/scheduling-eviction/)，对 `kubelet` 来说 Pod 对象就会变成了期望状态的一部分）。

在集群中，当 Job 控制器拿到新任务时，它会保证一组 Node 节点上的 `kubelet` 可以运行正确数量的 Pod 来完成工作。 Job 控制器不会自己运行任何的 Pod 或者容器。Job 控制器是通知 API 服务器来创建或者移除 Pod。 [控制面](https://kubernetes.io/zh/docs/reference/glossary/?all=true#term-control-plane)中的其它组件 根据新的消息作出反应（调度并运行新 Pod）并且最终完成工作。

创建新 Job 后，所期望的状态就是完成这个 Job。Job 控制器会让 Job 的当前状态不断接近期望状态：创建为 Job 要完成工作所需要的 Pod，使 Job 的状态接近完成。

控制器也会更新配置对象。例如：一旦 Job 的工作完成了，Job 控制器会更新 Job 对象的状态为 `Finished`。

### 直接控制

相比 Job 控制器，有些控制器**需要对集群外的一些东西进行修改**。

例如，如果你使用一个控制回路来保证集群中有足够的 [节点](https://kubernetes.io/zh/docs/concepts/architecture/nodes/)，那么控制器就需要当前集群外的 一些服务在需要时创建新节点。

和外部状态交互的控制器从 API 服务器获取到它想要的状态，然后直接和外部系统进行通信 并使当前状态更接近期望状态。

（实际上有一个[控制器](https://github.com/kubernetes/autoscaler/) 可以水平地扩展集群中的节点。）

这里，很重要的一点是，控制器做出了一些变更以使得事物更接近你的期望状态， 之后将当前状态报告给集群的 API 服务器。 其他控制回路可以观测到所汇报的数据的这种变化并采取其各自的行动。

## 期望状态与当前状态

Kubernetes 采用了系统的云原生视图，并且可以处理持续的变化。

在任务执行时，集群随时都可能被修改，并且控制回路会自动修复故障。 这意味着很可能集群永远不会达到稳定状态。

只要集群中的控制器在运行并且进行有效的修改，整体状态的稳定与否是无关紧要的。

## 运行控制器的方式

Kubernetes 内置一组控制器，运行在 [kube-controller-manager](https://kubernetes.io/docs/reference/generated/kube-controller-manager/) 内。 这些内置的控制器提供了重要的核心功能。

Deployment 控制器和 Job 控制器是 Kubernetes 内置控制器的典型例子。 Kubernetes 允许你运行一个稳定的控制平面，这样即使某些内置控制器失败了， 控制平面的其他部分会接替它们的工作。

你会遇到某些控制器运行在控制面之外，用以扩展 Kubernetes。 或者，如果你愿意，你也可以自己编写新控制器。 你可以以一组 Pod 来运行你的控制器，或者运行在 Kubernetes 之外。 最合适的方案取决于控制器所要执行的功能是什么。

# 云控制器管理器

使用云基础设施技术，你可以在公有云、私有云或者混合云环境中运行 Kubernetes。 Kubernetes 的信条是基于自动化的、API 驱动的基础设施，同时避免组件间紧密耦合。

组件 cloud-controller-manager 是指云控制器管理器， 云控制器管理器是指嵌入特定云的控制逻辑的 [控制平面](https://kubernetes.io/zh/docs/reference/glossary/?all=true#term-control-plane)组件。 云控制器管理器使得你可以将你的集群连接到云提供商的 API 之上， 并将与该云平台交互的组件同与你的集群交互的组件分离开来。

通过分离 Kubernetes 和底层云基础设置之间的互操作性逻辑， 云控制器管理器组件使云提供商能够以不同于 Kubernetes 主项目的 步调发布新特征。

`cloud-controller-manager` 组件是基于一种插件机制来构造的， 这种机制使得不同的云厂商都能将其平台与 Kubernetes 集成。

## 设计 

![components-of-kubernetes](/images/学习Kubernetes系列之概念/components-of-kubernetes.svg)

云控制器管理器以一组多副本的进程集合的形式运行在控制面中，通常表现为 Pod 中的容器。每个 `cloud-controller-manager` 在同一进程中实现多个 [控制器](https://kubernetes.io/zh/docs/concepts/architecture/controller/)。

### 节点控制器 

节点控制器负责在云基础设施中创建了新服务器时为之 更新 [节点（Node）](https://kubernetes.io/zh/docs/concepts/architecture/nodes/)对象。 节点控制器从云提供商获取当前租户中主机的信息。节点控制器执行以下功能：

1. 使用从云平台 API 获取的对应服务器的唯一标识符更新 Node 对象；
2. 利用特定云平台的信息为 Node 对象添加注解和标签，例如节点所在的 区域（Region）和所具有的资源（CPU、内存等等）；
3. 获取节点的网络地址和主机名；
4. 检查节点的健康状况。如果节点无响应，控制器通过云平台 API 查看该节点是否 已从云中禁用、删除或终止。如果节点已从云中删除，则控制器从 Kubernetes 集群 中删除 Node 对象。

某些云驱动实现中，这些任务被划分到一个节点控制器和一个节点生命周期控制器中。

### 路由控制器 

Route 控制器负责适当地配置云平台中的路由，以便 Kubernetes 集群中不同节点上的 容器之间可以相互通信。

取决于云驱动本身，路由控制器可能也会为 Pod 网络分配 IP 地址块。

### 服务控制器 

[服务（Service）](https://kubernetes.io/zh/docs/concepts/services-networking/service/)与受控的负载均衡器、 IP 地址、网络包过滤、目标健康检查等云基础设施组件集成。 服务控制器与云驱动的 API 交互，以配置负载均衡器和其他基础设施组件。 你所创建的 Service 资源会需要这些组件服务。

## 鉴权 

本节分别讲述云控制器管理器为了完成自身工作而产生的对各类 API 对象的访问需求。

### 节点控制器 

节点控制器只操作 Node 对象。它需要读取和修改 Node 对象的完全访问权限。

`v1/Node`:

- Get
- List
- Create
- Update
- Patch
- Watch
- Delete

### 路由控制器

路由控制器会监听 Node 对象的创建事件，并据此配置路由设施。 它需要读取 Node 对象的 Get 权限。

`v1/Node`:

- Get

### 服务控制器

服务控制器监测 Service 对象的 Create、Update 和 Delete 事件，并配置 对应服务的 Endpoints 对象。 为了访问 Service 对象，它需要 List、Watch 访问权限；为了更新 Service 对象 它需要 Patch 和 Update 访问权限。 为了能够配置 Service 对应的 Endpoints 资源，它需要 Create、List、Get、Watch 和 Update 等访问权限。

`v1/Service`:

- List
- Get
- Watch
- Patch
- Update

### 其他 

云控制器管理器的实现中，其核心部分需要创建 Event 对象的访问权限以及 创建 ServiceAccount 资源以保证操作安全性的权限。

`v1/Event`:

- Create
- Patch
- Update

`v1/ServiceAccount`:

- Create

用于云控制器管理器 [RBAC](https://kubernetes.io/zh/docs/reference/access-authn-authz/rbac/) 的 ClusterRole 如下例所示：

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: cloud-controller-manager
rules:
- apiGroups:
  - ""
  resources:
  - events
  verbs:
  - create
  - patch
  - update
- apiGroups:
  - ""
  resources:
  - nodes
  verbs:
  - '*'
- apiGroups:
  - ""
  resources:
  - nodes/status
  verbs:
  - patch
- apiGroups:
  - ""
  resources:
  - services
  verbs:
  - list
  - patch
  - update
  - watch
- apiGroups:
  - ""
  resources:
  - serviceaccounts
  verbs:
  - create
- apiGroups:
  - ""
  resources:
  - persistentvolumes
  verbs:
  - get
  - list
  - update
  - watch
- apiGroups:
  - ""
  resources:
  - endpoints
  verbs:
  - create
  - get
  - list
  - watch
  - update
```

