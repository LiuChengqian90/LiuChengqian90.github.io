---
title: 学习Kubernetes系列5——服务、负载均衡、联网
date: 2021-06-22 15:22:33
categories:
tags:
  - Kubernetes
  - k8s
typora-root-url: ../../../source
---

# 服务、负载均衡和联网

## Kubernetes 网络模型 

每一个 Pod 都有它自己的IP地址， 这就意味着你不需要显式地在 Pod 之间创建链接， 你几乎不需要处理容器端口到主机端口之间的映射。 这将形成一个干净的、向后兼容的模型；在这个模型里，从端口分配、命名、服务发现、 负载均衡、应用配置和迁移的角度来看， Pod 可以被视作虚拟机或者物理主机。

<!--more-->

Kubernetes 强制要求所有网络设施都满足以下基本要求（从而排除了有意隔离网络的策略）：

- 节点上的 Pod 可以不通过 NAT 和其他任何节点上的 Pod 通信

- 节点上的代理（比如：系统守护进程、kubelet）可以和节点上的所有 Pod 通信

备注：对于支持在主机网络中运行 Pod 的平台（比如：Linux）：

- 运行在节点主机网络里的 Pod 可以不通过 NAT 和所有节点上的 Pod 通信

这个模型不仅不复杂，而且还和 Kubernetes 的实现从虚拟机向容器平滑迁移的初衷相符， 如果你的任务开始是在虚拟机中运行的，你的虚拟机有一个 IP， 可以和项目中其他虚拟机通信。这里的模型是基本相同的。

Kubernetes 的 IP 地址存在于 Pod 范围内 - 容器共享它们的网络命名空间 - 包括它们的 IP 地址和 MAC 地址。 这就意味着 Pod 内的容器都可以通过 localhost 到达对方端口。 这也意味着 Pod 内的容器需要相互协调端口的使用，但是这和虚拟机中的进程似乎没有什么不同， 这也被称为“一个 Pod 一个 IP”模型。

**如何实现以上需求是所使用的特定容器运行时的细节。**

也可以在 Node 本身请求端口，并用这类端口**转发**到你的 Pod（称之为主机端口）， 但这是一个很特殊的操作。转发方式如何实现也是容器运行时的细节。 Pod 自己并不知道这些主机端口的存在。

Kubernetes 网络解决四方面的问题：

1. 一个 Pod 中的容器之间通过本地回路（loopback）通信。
2. 集群网络在不同 pod 之间提供通信。
3. Service 资源允许你 对外暴露 Pods 中运行的应用程序， 以支持来自于集群外部的访问。
4. 可以使用 Services 来发布仅供集群内部使用的服务。

# 服务

将运行在一组 [Pods](https://kubernetes.io/docs/concepts/workloads/pods/pod-overview/) 上的应用程序公开为网络服务的抽象方法。

使用 Kubernetes，你无需修改应用程序即可使用不熟悉的服务发现机制。 Kubernetes 为 Pods 提供自己的 IP 地址，并为一组 Pod 提供相同的 DNS 名， 并且可以在它们之间进行负载均衡。

## 动机

创建和销毁 Kubernetes [Pod](https://kubernetes.io/docs/concepts/workloads/pods/pod-overview/) 以匹配集群状态。 Pod 是非永久性资源。 如果你使用 [Deployment](https://kubernetes.io/zh/docs/concepts/workloads/controllers/deployment/) 来运行你的应用程序，则它可以动态创建和销毁 Pod。

每个 Pod 都有自己的 IP 地址，但是在 Deployment 中，在同一时刻运行的 Pod 集合可能与稍后运行该应用程序的 Pod 集合不同。

这导致了一个问题： 如果一组 Pod（称为“后端”）为集群内的其他 Pod（称为“前端”）提供功能， 那么**前端如何找出并跟踪要连接的 IP 地址，以便前端可以使用提供工作负载的后端部分**？

进入 *Services*。

## Service 资源

Kubernetes Service 定义了这样一种抽象：**逻辑上的一组 Pod，一种可以访问它们的策略 —— 通常称为微服务**。 Service 所针对的 Pods 集合通常是通过[选择算符](https://kubernetes.io/zh/docs/concepts/overview/working-with-objects/labels/)来确定的。 要了解定义服务端点的其他方法，请参阅[不带选择算符的服务](https://kubernetes.io/zh/docs/concepts/services-networking/service/#services-without-selectors)。

举个例子，考虑一个图片处理后端，它运行了 3 个副本。这些副本是可互换的 —— 前端不需要关心它们调用了哪个后端副本。 然而组成这一组后端程序的 Pod 实际上可能会发生变化， 前端客户端不应该也没必要知道，而且也不需要跟踪这一组后端的状态。

**Service 定义的抽象能够解耦这种关联。**

### 云原生服务发现

如果你想要在应用程序中使用 Kubernetes API 进行服务发现，则可以查询 [API 服务器](https://kubernetes.io/zh/docs/reference/command-line-tools-reference/kube-apiserver/) 的 Endpoints 资源，只要服务中的 Pod 集合发生更改，Endpoints 就会被更新。

对于非本机应用程序，Kubernetes 提供了在应用程序和后端 Pod 之间放置网络端口或负载均衡器的方法。

## 定义 Service

Service 在 Kubernetes 中是一个 REST 对象，和 Pod 类似。 像所有的 REST 对象一样，Service 定义可以基于 `POST` 方式，请求 API server 创建新的实例。 

例如，假定有一组 Pod，它们对外暴露了 9376 端口，同时还被打上 `app=MyApp` 标签：

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  selector:
    app: MyApp
  ports:
    - protocol: TCP
      port: 80
      targetPort: 9376
```

上述配置创建一个名称为 "my-service" 的 Service 对象，它会将请求代理到使用 TCP 端口 9376，并且具有标签 `"app=MyApp"` 的 Pod 上。

**Kubernetes 为该服务分配一个 IP 地址（有时称为 "集群IP"），该 IP 地址由服务代理使用。**

服务选择算符的控制器不断扫描与其选择器匹配的 Pod，然后将所有更新发布到也称为 “my-service” 的 Endpoint 对象。

> 需要注意的是，Service 能够将一个接收 `port` 映射到任意的 `targetPort`。 默认情况下，`targetPort` 将被设置为与 `port` 字段相同的值。

Pod 中的端口定义是有名字的，你可以在服务的 `targetPort` 属性中引用这些名称。 即使服务中使用单个配置的名称混合使用 Pod，并且通过不同的端口号提供相同的网络协议，此功能也可以使用。 这为部署和发展服务提供了很大的灵活性。 例如，你可以更改 Pods 在新版本的后端软件中公开的端口号，而不会破坏客户端。

服务的默认协议是 TCP；你还可以使用任何其他[受支持的协议](https://kubernetes.io/zh/docs/concepts/services-networking/service/#protocol-support)。

由于许多服务需要公开多个端口，因此 Kubernetes 在服务对象上支持多个端口定义。 每个端口定义可以具有相同的 `protocol`，也可以具有不同的协议。

### 没有选择算符的 Service 

服务最常见的是抽象化对 Kubernetes Pod 的访问，但是它们也可以抽象化其他种类的后端。 实例:

- 希望在生产环境中使用外部的数据库集群，但测试环境使用自己的数据库。
- 希望服务指向另一个 名字空间（Namespace）中或其它集群中的服务。
- 你正在将工作负载迁移到 Kubernetes。 在评估该方法时，你仅在 Kubernetes 中运行一部分后端。

在任何这些场景中，都能够定义没有选择算符的 Service。 实例:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  ports:
    - protocol: TCP
      port: 80
      targetPort: 9376
```

由于此服务没有选择算符，因此不会自动创建相应的 Endpoint 对象。 你可以通过手动添加 Endpoint 对象，将服务手动映射到运行该服务的网络地址和端口：

```yaml
apiVersion: v1
kind: Endpoints
metadata:
  name: my-service
subsets:
  - addresses:
      - ip: 192.0.2.42
    ports:
      - port: 9376
```

Endpoints 对象的名称必须是合法的 [DNS 子域名](https://kubernetes.io/zh/docs/concepts/overview/working-with-objects/names#dns-subdomain-names)。

> 端点 IPs *必须不可以* 是：本地回路（IPv4 的 127.0.0.0/8, IPv6 的 ::1/128）或 本地链接（IPv4 的 169.254.0.0/16 和 224.0.0.0/24，IPv6 的 fe80::/64)。
>
> 端点 IP 地址不能是其他 Kubernetes 服务的集群 IP，因为 kube-proxy不支持将虚拟 IP 作为目标。

访问没有选择算符的 Service，与有选择算符的 Service 的原理相同。 请求将被路由到用户定义的 Endpoint，YAML 中为：`192.0.2.42:9376`（TCP）。

ExternalName Service 是 Service 的特例，它没有选择算符，但是使用 DNS 名称。 有关更多信息，请参阅本文档后面的[ExternalName](https://kubernetes.io/zh/docs/concepts/services-networking/service/#externalname)。

## 虚拟 IP 和 Service 代理

在 Kubernetes 集群中，每个 Node 运行一个 `kube-proxy` 进程。 `kube-proxy` 负责为 Service 实现了一种 **VIP（虚拟 IP）的形式**，而不是 [`ExternalName`](https://kubernetes.io/zh/docs/concepts/services-networking/service/#externalname) 的形式。

### userspace 代理模式

这种模式，kube-proxy 会监视 Kubernetes 控制平面对 Service 对象和 Endpoints 对象的添加和移除操作。 对每个 Service，它会**在本地 Node 上打开一个端口（随机选择）**。 任何连接到“代理端口”的请求，都会被代理到 Service 的后端 `Pods` 中的某个上面（如 `Endpoints` 所报告的一样）。 使用哪个后端 Pod，是 kube-proxy 基于 `SessionAffinity` 来确定的。

最后，它配置 **iptables 规则**，捕获到达该 Service 的 `clusterIP`（是虚拟 IP） 和 `Port` 的请求，并**重定向到代理端口**，代理端口再代理请求到后端Pod。

**默认情况下，用户空间模式下的 kube-proxy 通过轮转算法选择后端**。

![services-userspace-overview](/images/学习Kubernetes系列之概念/services-userspace-overview.svg)

### iptables 代理模式

这种模式，`kube-proxy` 会监视 Kubernetes 控制节点对 Service 对象和 Endpoints 对象的添加和移除。 对每个 Service，它会**配置 iptables 规则，从而捕获到达该 Service 的 `clusterIP` 和端口的请求，进而将请求重定向到 Service 的一组后端中的某个 Pod 上面**。 对于每个 Endpoints 对象，它也会配置 iptables 规则，这个规则会选择一个后端组合。

**默认的策略是，kube-proxy 在 iptables 模式下随机选择一个后端。**

使用 iptables 处理流量具有较低的系统开销，因为流量由 Linux netfilter 处理， 而无需在用户空间和内核空间之间切换。 这种方法也可能更可靠。

如果 kube-proxy 在 iptables 模式下运行，并且所选的第一个 Pod 没有响应， 则连接失败。 这与用户空间模式不同：在这种情况下，kube-proxy 将检测到与第一个 Pod 的连接已失败， 并会自动使用其他后端 Pod 重试。

你可以使用 Pod [就绪探测器](https://kubernetes.io/zh/docs/concepts/workloads/pods/pod-lifecycle/#container-probes) 验证后端 Pod 可以正常工作，以便 iptables 模式下的 kube-proxy 仅看到测试正常的后端。 这样做意味着你避免将流量通过 kube-proxy 发送到已知已失败的 Pod。

![services-iptables-overview](/images/学习Kubernetes系列之概念/services-iptables-overview.svg)

### IPVS 代理模式

**FEATURE STATE:** `Kubernetes v1.11 [stable]`

在 `ipvs` 模式下，kube-proxy 监视 Kubernetes 服务和端点，**调用 `netlink` 接口相应地创建 IPVS 规则， 并定期将 IPVS 规则与 Kubernetes 服务和端点同步**。 该控制循环可确保IPVS 状态与所需状态匹配。访问服务时，IPVS 将流量定向到后端Pod之一。

IPVS代理模式基于类似于 iptables 模式的 netfilter 挂钩函数， 但是使用哈希表作为基础数据结构，并且在内核空间中工作。 这意味着，与 iptables 模式下的 kube-proxy 相比，IPVS 模式下的 kube-proxy 重定向通信的延迟要短，并且在同步代理规则时具有更好的性能。 与其他代理模式相比，IPVS 模式还支持更高的网络流量吞吐量。

IPVS 提供了更多选项来平衡后端 Pod 的流量。 这些是：

- `rr`：轮替（Round-Robin）
- `lc`：最少链接（Least Connection），即打开链接数量最少者优先
- `dh`：目标地址哈希（Destination Hashing）
- `sh`：源地址哈希（Source Hashing）
- `sed`：最短预期延迟（Shortest Expected Delay）
- `nq`：从不排队（Never Queue）

> 要在 IPVS 模式下运行 kube-proxy，必须在启动 kube-proxy 之前使 IPVS 在节点上可用。
>
> 当 kube-proxy 以 IPVS 代理模式启动时，它将验证 IPVS 内核模块是否可用。 如果未检测到 IPVS 内核模块，则 kube-proxy 将退回到以 iptables 代理模式运行。

![services-ipvs-overview](/images/学习Kubernetes系列之概念/services-ipvs-overview.svg)

如果要确保每次都将来自特定客户端的连接传递到同一 Pod， 则可以通过将 `service.spec.sessionAffinity` 设置为 "ClientIP" （默认值是 "None"），来基于客户端的 IP 地址选择会话关联。 你还可以通过适当设置 `service.spec.sessionAffinityConfig.clientIP.timeoutSeconds` 来设置最大会话停留时间。 （默认值为 10800 秒，即 3 小时）。



## 多端口 Service 

对于某些服务，你需要公开多个端口。 Kubernetes 允许你在 Service 对象上配置多个端口定义。 为服务使用多个端口时，必须提供所有端口名称，以使它们无歧义。 例如：

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  selector:
    app: MyApp
  ports:
    - name: http
      protocol: TCP
      port: 80
      targetPort: 9376
    - name: https
      protocol: TCP
      port: 443
      targetPort: 9377
```



> 与一般的Kubernetes名称一样，端口名称只能包含小写字母数字字符 和 `-`。 端口名称还必须以字母数字字符开头和结尾。
>
> 例如，名称 `123-abc` 和 `web` 有效，但是 `123_abc` 和 `-web` 无效。

## 选择自己的 IP 地址

在 `Service` 创建的请求中，可以通过设置 `spec.clusterIP` 字段来指定自己的集群 IP 地址。 比如，希望替换一个已经已存在的 DNS 条目，或者遗留系统已经配置了一个固定的 IP 且很难重新配置。

用户选择的 IP 地址必须合法，并且这个 IP 地址在 `service-cluster-ip-range` CIDR 范围内， 这对 API 服务器来说是通过一个标识来指定的。 如果 IP 地址不合法，API 服务器会返回 HTTP 状态码 422，表示值不合法。

## 流量策略 

### 外部流量策略 

你可以通过设置 `spec.externalTrafficPolicy` 字段来控制来自于外部的流量是如何路由的。 可选值有 `Cluster` 和 `Local`。字段设为 `Cluster` 会将外部流量路由到所有就绪的端点， 设为 `Local` 会只路由到当前节点上就绪的端点。 如果流量策略设置为 `Local`，而且当前节点上没有就绪的端点，kube-proxy 不会转发请求相关服务的任何流量。

### 内部流量策略 

**FEATURE STATE:** `Kubernetes v1.22 [beta]`

你可以设置 `spec.internalTrafficPolicy` 字段来控制内部来源的流量是如何转发的。可设置的值有 `Cluster` 和 `Local`。 将字段设置为 `Cluster` 会将内部流量路由到所有就绪端点，设置为 `Local` 只会路由到当前节点上就绪的端点。 如果流量策略是 `Local`，而且当前节点上没有就绪的端点，那么 kube-proxy 会丢弃流量。

## 服务发现 

Kubernetes 支持两种基本的服务发现模式 —— **环境变量和 DNS**。

### 环境变量 

当 Pod 运行在 `Node` 上，kubelet 会为每个活跃的 Service 添加一组环境变量。 它同时支持 [Docker links兼容](https://docs.docker.com/userguide/dockerlinks/) 变量 、 简单的 `{SVCNAME}_SERVICE_HOST` 和 `{SVCNAME}_SERVICE_PORT` 变量。 这里 Service 的名称需大写，横线被转换成下划线。

举个例子，一个名称为 `redis-master` 的 Service 暴露了 TCP 端口 6379， 同时给它分配了 Cluster IP 地址 10.0.0.11，这个 Service 生成了如下环境变量：

```shell
REDIS_MASTER_SERVICE_HOST=10.0.0.11
REDIS_MASTER_SERVICE_PORT=6379
REDIS_MASTER_PORT=tcp://10.0.0.11:6379
REDIS_MASTER_PORT_6379_TCP=tcp://10.0.0.11:6379
REDIS_MASTER_PORT_6379_TCP_PROTO=tcp
REDIS_MASTER_PORT_6379_TCP_PORT=6379
REDIS_MASTER_PORT_6379_TCP_ADDR=10.0.0.11
```

> 当你具有需要访问服务的 Pod 时，并且你正在使用环境变量方法将端口和集群 IP 发布到客户端 Pod 时，必须在客户端 Pod 出现 *之前* 创建服务。 否则，这些客户端 Pod 将不会设定其环境变量。
>
> 如果仅使用 DNS 查找服务的集群 IP，则无需担心此设定问题。

### DNS

你可以（几乎总是应该）使用[附加组件](https://kubernetes.io/zh/docs/concepts/cluster-administration/addons/) 为 Kubernetes 集群设置 DNS 服务。

支持集群的 DNS 服务器（例如 CoreDNS）监视 Kubernetes API 中的新服务，并为每个服务创建一组 DNS 记录。 如果在整个集群中都启用了 DNS，则所有 Pod 都应该能够通过其 DNS 名称自动解析服务。

例如，如果你在 Kubernetes 命名空间 `my-ns` 中有一个名为 `my-service` 的服务， 则控制平面和 DNS 服务共同为 `my-service.my-ns` 创建 DNS 记录。 `my-ns` 命名空间中的 Pod 应该能够通过按名检索 `my-service` 来找到服务 （`my-service.my-ns` 也可以工作）。

其他命名空间中的 Pod 必须将名称限定为 `my-service.my-ns`。 这些名称将解析为为服务分配的集群 IP。

Kubernetes 还支持命名端口的 DNS SRV（服务）记录。 如果 `my-service.my-ns` 服务具有名为 `http`　的端口，且协议设置为 TCP， 则可以对 `_http._tcp.my-service.my-ns` 执行 DNS SRV 查询查询以发现该端口号, `"http"` 以及 IP 地址。

**Kubernetes DNS 服务器是唯一的一种能够访问 `ExternalName` 类型的 Service 的方式**。 更多关于 `ExternalName` 信息可以查看 [DNS Pod 和 Service](https://kubernetes.io/zh/docs/concepts/services-networking/dns-pod-service/)。

## 无头服务（Headless Services） 

有时不需要或不想要负载均衡，以及单独的 Service IP。 遇到这种情况，可以通过指定 Cluster IP（`spec.clusterIP`）的值为 `"None"` 来创建 `Headless` Service。

你可以使用无头 Service 与其他服务发现机制进行接口，而不必与 Kubernetes 的实现捆绑在一起。

对这无头 Service 并不会分配 Cluster IP，kube-proxy 不会处理它们， 而且平台也不会为它们进行负载均衡和路由。 DNS 如何实现自动配置，依赖于 Service 是否定义了选择算符。

### 带选择算符的服务

对定义了选择算符的无头服务，Endpoint 控制器在 API 中创建了 Endpoints 记录， 并且修改 DNS 配置返回 A 记录（IP 地址），通过这个地址直接到达 `Service` 的后端 Pod 上。

### 无选择算符的服务 

对没有定义选择算符的无头服务，Endpoint 控制器不会创建 `Endpoints` 记录。 然而 DNS 系统会查找和配置，无论是：

- 对于 [`ExternalName`](https://kubernetes.io/zh/docs/concepts/services-networking/service/#external-name) 类型的服务，查找其 CNAME 记录
- 对所有其他类型的服务，查找与 Service 名称相同的任何 `Endpoints` 的记录

## 发布服务（服务类型) 

对一些应用的某些部分（如前端），可能希望将其暴露给 Kubernetes 集群外部 的 IP 地址。

Kubernetes `ServiceTypes` 允许指定你所需要的 Service 类型，默认是 `ClusterIP`。

`Type` 的取值以及行为如下：

- `ClusterIP`：通过集群的内部 IP 暴露服务，选择该值时服务只能够在集群内部访问。 这也是默认的 `ServiceType`。
- [`NodePort`](https://kubernetes.io/zh/docs/concepts/services-networking/service/#type-nodeport)：通过每个节点上的 IP 和静态端口（`NodePort`）暴露服务。 `NodePort` 服务会路由到自动创建的 `ClusterIP` 服务。 通过请求 `<节点 IP>:<节点端口>`，你可以从集群的外部访问一个 `NodePort` 服务。
- [`LoadBalancer`](https://kubernetes.io/zh/docs/concepts/services-networking/service/#loadbalancer)：使用**云提供商的负载均衡器**向外部暴露服务。 外部负载均衡器可以将流量路由到自动创建的 `NodePort` 服务和 `ClusterIP` 服务上。
- [`ExternalName`](https://kubernetes.io/zh/docs/concepts/services-networking/service/#externalname)：通过返回 `CNAME` 和对应值，可以将服务映射到 `externalName` 字段的内容（例如，`foo.bar.example.com`）。 无需创建任何类型代理。

也可以使用 [Ingress](https://kubernetes.io/zh/docs/concepts/services-networking/ingress/) 来暴露自己的服务。 Ingress 不是一种服务类型，但它充当集群的入口点。 它可以将路由规则整合到一个资源中，因为它可以在同一IP地址下公开多个服务。



### NodePort 类型 

如果你将 `type` 字段设置为 `NodePort`，则 Kubernetes 控制平面将在 `--service-node-port-range` 标志指定的范围内分配端口（默认值：30000-32767）。 每个节点将那个端口（每个节点上的相同端口号）代理到你的服务中。 你的服务在其 `.spec.ports[*].nodePort` 字段中要求分配的端口。

如果你想指定特定的 IP 代理端口，则可以设置 kube-proxy 中的 `--nodeport-addresses` 参数 或者将[kube-proxy 配置文件](https://kubernetes.io/docs/reference/config-api/kube-proxy-config.v1alpha1/) 中的等效 `nodePortAddresses` 字段设置为特定的 IP 块。 该标志采用逗号分隔的 IP 块列表（例如，`10.0.0.0/8`、`192.0.2.0/25`）来指定 kube-proxy 应该认为是此节点本地的 IP 地址范围。

例如，如果你使用 `--nodeport-addresses=127.0.0.0/8` 标志启动 kube-proxy， 则 kube-proxy 仅选择 NodePort Services 的本地回路接口。 `--nodeport-addresses` 的默认值是一个空列表。 这意味着 kube-proxy 应该考虑 NodePort 的所有可用网络接口。 （这也与早期的 Kubernetes 版本兼容）。

如果需要特定的端口号，你可以在 `nodePort` 字段中指定一个值。 控制平面将为你分配该端口或报告 API 事务失败。 这意味着你需要自己注意可能发生的端口冲突。 你还必须使用有效的端口号，该端口号在配置用于 NodePort 的范围内。

使用 NodePort 可以让你自由设置自己的负载均衡解决方案， 配置 Kubernetes 不完全支持的环境， 甚至直接暴露一个或多个节点的 IP。

需要注意的是，Service 能够通过 `<NodeIP>:spec.ports[*].nodePort` 和 `spec.clusterIp:spec.ports[*].port` 而对外可见。 如果设置了 kube-proxy 的 `--nodeport-addresses` 参数或 kube-proxy 配置文件中的等效字段， `<NodeIP>` 将被过滤 NodeIP。

例如：

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  type: NodePort
  selector:
    app: MyApp
  ports:
      # 默认情况下，为了方便起见，`targetPort` 被设置为与 `port` 字段相同的值。
    - port: 80
      targetPort: 80
      # 可选字段
      # 默认情况下，为了方便起见，Kubernetes 控制平面会从某个范围内分配一个端口号（默认：30000-32767）
      nodePort: 30007
```

### LoadBalancer 类型 

在使用支持外部负载均衡器的云提供商的服务时，设置 `type` 的值为 `"LoadBalancer"`， 将为 Service 提供负载均衡器。 负载均衡器是异步创建的，关于被提供的负载均衡器的信息将会通过 Service 的 `status.loadBalancer` 字段发布出去。

实例：

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  selector:
    app: MyApp
  ports:
    - protocol: TCP
      port: 80
      targetPort: 9376
  clusterIP: 10.0.171.239
  type: LoadBalancer
status:
  loadBalancer:
    ingress:
      - ip: 192.0.2.127
```

来自外部负载均衡器的流量将直接重定向到后端 Pod 上，不过实际它们是如何工作的，这要依赖于云提供商。

某些云提供商允许设置 `loadBalancerIP`。 在这些情况下，将根据用户设置的 `loadBalancerIP` 来创建负载均衡器。 如果没有设置 `loadBalancerIP` 字段，将会给负载均衡器指派一个临时 IP。 如果设置了 `loadBalancerIP`，但云提供商并不支持这种特性，那么设置的 `loadBalancerIP` 值将会被忽略掉。

### ExternalName 类型 

类型为 ExternalName 的服务将服务映射到 DNS 名称，而不是典型的选择器，例如 `my-service` 或者 `cassandra`。 你可以使用 `spec.externalName` 参数指定这些服务。

例如，以下 Service 定义将 `prod` 名称空间中的 `my-service` 服务映射到 `my.database.example.com`：

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-service
  namespace: prod
spec:
  type: ExternalName
  externalName: my.database.example.com
```

当查找主机 `my-service.prod.svc.cluster.local` 时，集群 DNS 服务返回 `CNAME` 记录， 其值为 `my.database.example.com`。 访问 `my-service` 的方式与其他服务的方式相同，但主要区别在于重定向发生在 DNS 级别，而不是通过代理或转发。 如果以后你决定将数据库移到集群中，则可以启动其 Pod，添加适当的选择器或端点以及更改服务的 `type`。

### 外部 IP 

如果外部的 IP 路由到集群中一个或多个 Node 上，Kubernetes Service 会被暴露给这些 externalIPs。 通过外部 IP（作为目的 IP 地址）进入到集群，打到 Service 的端口上的流量， 将会被路由到 Service 的 Endpoint 上。 `externalIPs` 不会被 Kubernetes 管理，它属于集群管理员的职责范畴。

根据 Service 的规定，`externalIPs` 可以同任意的 `ServiceType` 来一起指定。 在上面的例子中，`my-service` 可以在 "`80.11.12.10:80`"(`externalIP:port`) 上被客户端访问。

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-service
spec:
  selector:
    app: MyApp
  ports:
    - name: http
      protocol: TCP
      port: 80
      targetPort: 9376
  externalIPs:
    - 80.11.12.10
```

## 虚拟IP实施



### 避免冲突

Kubernetes 最主要的哲学之一，是用户不应该暴露那些能够导致他们操作失败、但又不是他们的过错的场景。 对于 Service 资源的设计，这意味着如果用户的选择有可能与他人冲突，那就不要让用户自行选择端口号。 这是一个隔离性的失败。

为了使用户能够为他们的 Service 选择一个端口号，我们必须确保不能有2个 Service 发生冲突。 Kubernetes 通过为每个 Service 分配它们自己的 IP 地址来实现。

为了保证每个 Service 被分配到一个唯一的 IP，需要一个内部的分配器能够原子地更新 [etcd](https://kubernetes.io/zh/docs/tasks/administer-cluster/configure-upgrade-etcd/) 中的一个全局分配映射表， 这个更新操作要先于创建每一个 Service。 为了使 Service 能够获取到 IP，这个映射表对象必须在注册中心存在， 否则创建 Service 将会失败，指示一个 IP 不能被分配。

在控制平面中，一个后台 Controller 的职责是创建映射表 （需要支持从使用了内存锁的 Kubernetes 的旧版本迁移过来）。 同时 Kubernetes 会通过控制器检查不合理的分配（如管理员干预导致的） 以及清理已被分配但不再被任何 Service 使用的 IP 地址。

### Service IP 地址

**不像 Pod 的 IP 地址，它实际路由到一个固定的目的地，Service 的 IP 实际上 不能通过单个主机来进行应答**。 相反，我们使用 `iptables`（Linux 中的数据包处理逻辑）来定义一个 虚拟 IP 地址（VIP），它可以根据需要透明地进行重定向。 当客户端连接到 VIP 时，它们的流量会自动地传输到一个合适的 Endpoint。 环境变量和 DNS，实际上会根据 Service 的 VIP 和端口来进行填充。

kube-proxy支持三种代理模式: 用户空间，iptables和IPVS；它们各自的操作略有不同。

#### Userspace 

作为一个例子，考虑前面提到的图片处理应用程序。 当创建后端 Service 时，Kubernetes master 会给它指派一个虚拟 IP 地址，比如 10.0.0.1。 假设 Service 的端口是 1234，该 Service 会被集群中所有的 `kube-proxy` 实例观察到。 当代理看到一个新的 Service， 它会打开一个新的端口，建立一个从该 VIP 重定向到 新端口的 iptables，并开始接收请求连接。

当一个客户端连接到一个 VIP，iptables 规则开始起作用，它会重定向该数据包到 "服务代理" 的端口。 "服务代理" 选择一个后端，并将客户端的流量代理到后端上。

这意味着 Service 的所有者能够选择任何他们想使用的端口，而不存在冲突的风险。 客户端可以连接到一个 IP 和端口，而不需要知道实际访问了哪些 Pod。

#### iptables

再次考虑前面提到的图片处理应用程序。 当创建后端 Service 时，Kubernetes 控制面板会给它指派一个虚拟 IP 地址，比如 10.0.0.1。 假设 Service 的端口是 1234，该 Service 会被集群中所有的 `kube-proxy` 实例观察到。 当代理看到一个新的 Service， 它会配置一系列的 iptables 规则，从 VIP 重定向到每个 Service 规则。 该特定于服务的规则连接到特定于 Endpoint 的规则，而后者会重定向（目标地址转译）到后端。

当客户端连接到一个 VIP，iptables 规则开始起作用。一个后端会被选择（或者根据会话亲和性，或者随机）， 数据包被重定向到这个后端。 不像用户空间代理，数据包从来不拷贝到用户空间，kube-proxy 不是必须为该 VIP 工作而运行， 并且客户端 IP 是不可更改的。

当流量打到 Node 的端口上，或通过负载均衡器，会执行相同的基本流程， 但是在那些案例中客户端 IP 是可以更改的。

#### IPVS

在大规模集群（例如 10000 个服务）中，iptables 操作会显着降低速度。 IPVS 专为负载平衡而设计，并基于内核内哈希表。 因此，你可以通过基于 IPVS 的 kube-proxy 在大量服务中实现性能一致性。 同时，基于 IPVS 的 kube-proxy 具有更复杂的负载均衡算法（最小连接、局部性、 加权、持久性）。

# 使用 Service 连接到应用

## Kubernetes 连接容器模型

既然有了一个持续运行、可复制的应用，我们就能够将它暴露到网络上。 在讨论 Kubernetes 网络连接的方式之前，非常值得与 Docker 中 “正常” 方式的网络进行对比。

默认情况下，Docker 使用私有主机网络连接，只能与同在一台机器上的容器进行通信。 为了实现容器的跨节点通信，必须在机器自己的 IP 上为这些容器分配端口，为容器进行端口转发或者代理。

多个开发人员或是提供容器的团队之间协调端口的分配很难做到规模化，那些难以控制的集群级别的问题，都会交由用户自己去处理。 Kubernetes 假设 Pod 可与其它 Pod 通信，不管它们在哪个主机上。 **Kubernetes 给 Pod 分配属于自己的集群私有 IP 地址**，所以没必要在 Pod 或映射到的容器的端口和主机端口之间显式地创建连接。 这表明了在 Pod 内的容器都能够连接到本地的每个端口，集群中的所有 Pod 不需要通过 NAT 转换就能够互相看到。 文档的剩余部分详述如何在一个网络模型之上运行可靠的服务。

该指南使用一个简单的 Nginx server 来演示并证明谈到的概念。

## 在集群中暴露 Pod

我们在之前的示例中已经做过，然而让我们以网络连接的视角再重做一遍。 创建一个 Nginx Pod，并且注意，它有一个容器端口的规范（service/networking/run-my-nginx.yaml）：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-nginx
spec:
  selector:
    matchLabels:
      run: my-nginx
  replicas: 2
  template:
    metadata:
      labels:
        run: my-nginx
    spec:
      containers:
      - name: my-nginx
        image: nginx
        ports:
        - containerPort: 80
```

这使得可以从集群中任何一个节点来访问它。检查节点，该 Pod 正在运行：

```shell
kubectl apply -f ./run-my-nginx.yaml
kubectl get pods -l run=my-nginx -o wide
NAME                        READY     STATUS    RESTARTS   AGE       IP            NODE
my-nginx-3800858182-jr4a2   1/1       Running   0          13s       10.244.3.4    kubernetes-minion-905m
my-nginx-3800858182-kna2y   1/1       Running   0          13s       10.244.2.5    kubernetes-minion-ljyd
```

检查 Pod 的 IP 地址：

```shell
kubectl get pods -l run=my-nginx -o yaml | grep podIP
    podIP: 10.244.3.4
    podIP: 10.244.2.5
```

应该能够通过 ssh 登录到集群中的任何一个节点上，使用 curl 也能调通所有 IP 地址。 需要注意的是，容器不会使用该节点上的 80 端口，也不会使用任何特定的 NAT 规则去路由流量到 Pod 上。 这意味着可以在同一个节点上运行多个 Pod，使用相同的容器端口，并且可以从集群中任何其他的 Pod 或节点上使用 IP 的方式访问到它们。 像 Docker 一样，端口能够被发布到主机节点的接口上，但是出于网络模型的原因应该从根本上减少这种用法。

## 创建 Service

我们有 Pod 在一个扁平的、集群范围的地址空间中运行 Nginx 服务，可以直接连接到这些 Pod，但如果某个节点死掉了会发生什么呢？ Pod 会终止，**Deployment 将创建新的 Pod，且使用不同的 IP**。这正是 Service 要解决的问题。

Kubernetes Service 从逻辑上定义了运行在集群中的一组 Pod，这些 Pod 提供了相同的功能。 **当每个 Service 创建时，会被分配一个唯一的 IP 地址（也称为 clusterIP）**。 这个 IP 地址与一个 Service 的生命周期绑定在一起，当 Service 存在的时候它也不会改变。 可以配置 Pod 使它与 Service 进行通信，Pod 知道与 Service 通信将被自动地负载均衡到该 Service 中的某些 Pod 上。

可以使用 `kubectl expose` 命令为 2个 Nginx 副本创建一个 Service：

```shell
kubectl expose deployment/my-nginx
service/my-nginx exposed
```

这等价于使用 `kubectl create -f` 命令创建，对应如下的 yaml 文件（service/networking/nginx-svc.yaml）：

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-nginx
  labels:
    run: my-nginx
spec:
  ports:
  - port: 80
    protocol: TCP
  selector:
    run: my-nginx

```

上述规约将创建一个 Service，对应具有标签 `run: my-nginx` 的 Pod，目标 TCP 端口 80， 并且在一个抽象的 Service 端口（`targetPort`：容器接收流量的端口；`port`：抽象的 Service 端口，可以使任何其它 Pod 访问该 Service 的端口）上暴露。

查看你的 Service 资源:

```shell
kubectl get svc my-nginx
NAME       TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)   AGE
my-nginx   ClusterIP   10.0.162.149   <none>        80/TCP    21s
```

正如前面所提到的，一个 Service 由一组 backend Pod 组成。这些 Pod 通过 `endpoints` 暴露出来。 Service Selector 将持续评估，结果被 POST 到一个名称为 `my-nginx` 的 Endpoint 对象上。 当 Pod 终止后，它会自动从 Endpoint 中移除，新的能够匹配上 Service Selector 的 Pod 将自动地被添加到 Endpoint 中。 检查该 Endpoint，注意到 IP 地址与在第一步创建的 Pod 是相同的。

```shell
kubectl describe svc my-nginx
Name:                my-nginx
Namespace:           default
Labels:              run=my-nginx
Annotations:         <none>
Selector:            run=my-nginx
Type:                ClusterIP
IP:                  10.0.162.149
Port:                <unset> 80/TCP
Endpoints:           10.244.2.5:80,10.244.3.4:80
Session Affinity:    None
Events:              <none>
kubectl get ep my-nginx
NAME       ENDPOINTS                     AGE
my-nginx   10.244.2.5:80,10.244.3.4:80   1m
```

现在，能够从集群中任意节点上使用 curl 命令请求 Nginx Service `<CLUSTER-IP>:<PORT>` 。 

## 访问 Service

Kubernetes支持两种查找服务的主要模式: 环境变量和DNS。 前者开箱即用，而后者则需要[CoreDNS集群插件] [CoreDNS 集群插件](https://releases.k8s.io/main/cluster/addons/dns/coredns).

**说明：** 如果不需要服务环境变量（因为可能与预期的程序冲突，可能要处理的变量太多，或者仅使用DNS等），则可以通过在 [pod spec](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.23/#pod-v1-core) 上将 `enableServiceLinks` 标志设置为 `false` 来禁用此模式。

### 环境变量

当 Pod 在 Node 上运行时，kubelet 会为每个活跃的 Service 添加一组环境变量。 这会有一个顺序的问题。想了解为何，检查正在运行的 Nginx Pod 的环境变量（Pod 名称将不会相同）：

```shell
kubectl exec my-nginx-3800858182-jr4a2 -- printenv | grep SERVICE
KUBERNETES_SERVICE_HOST=10.0.0.1
KUBERNETES_SERVICE_PORT=443
KUBERNETES_SERVICE_PORT_HTTPS=443
```

注意，还没有谈及到 Service。这是因为创建副本先于 Service。 这样做的另一个缺点是，调度器可能在同一个机器上放置所有 Pod，如果该机器宕机则所有的 Service 都会挂掉。 正确的做法是，我们杀掉 2 个 Pod，等待 Deployment 去创建它们。 这次 Service 会 *先于* 副本存在。这将实现调度器级别的 Service，能够使 Pod 分散创建（假定所有的 Node 都具有同样的容量），以及正确的环境变量：

```shell
kubectl scale deployment my-nginx --replicas=0; kubectl scale deployment my-nginx --replicas=2;

kubectl get pods -l run=my-nginx -o wide
NAME                        READY     STATUS    RESTARTS   AGE     IP            NODE
my-nginx-3800858182-e9ihh   1/1       Running   0          5s      10.244.2.7    kubernetes-minion-ljyd
my-nginx-3800858182-j4rm4   1/1       Running   0          5s      10.244.3.8    kubernetes-minion-905m
```

可能注意到，Pod 具有不同的名称，因为它们被杀掉后并被重新创建。

```shell
kubectl exec my-nginx-3800858182-e9ihh -- printenv | grep SERVICE
KUBERNETES_SERVICE_PORT=443
MY_NGINX_SERVICE_HOST=10.0.162.149
KUBERNETES_SERVICE_HOST=10.0.0.1
MY_NGINX_SERVICE_PORT=80
KUBERNETES_SERVICE_PORT_HTTPS=443
```

### DNS

**Kubernetes 提供了一个 DNS 插件 Service，它使用 skydns 自动为其它 Service 指派 DNS 名字**。 如果它在集群中处于运行状态，可以通过如下命令来检查：

```shell
kubectl get services kube-dns --namespace=kube-system
NAME       TYPE        CLUSTER-IP   EXTERNAL-IP   PORT(S)         AGE
kube-dns   ClusterIP   10.0.0.10    <none>        53/UDP,53/TCP   8m
```

如果没有在运行，可以[启用它](https://releases.k8s.io/main/cluster/addons/dns/kube-dns/README.md#how-do-i-configure-it)。 本段剩余的内容，将假设已经有一个 Service，它具有一个长久存在的 IP（my-nginx）， 一个为该 IP 指派名称的 DNS 服务器。 这里我们使用 CoreDNS 集群插件（应用名为 `kube-dns`）， 所以可以通过标准做法，使在集群中的任何 Pod 都能与该 Service 通信（例如：`gethostbyname()`）。 如果 CoreDNS 没有在运行，你可以参照 [CoreDNS README](https://github.com/coredns/deployment/tree/master/kubernetes) 或者 [安装 CoreDNS](https://kubernetes.io/zh/docs/tasks/administer-cluster/coredns/#installing-coredns) 来启用它。 让我们运行另一个 curl 应用来进行测试：

```shell
kubectl run curl --image=radial/busyboxplus:curl -i --tty
Waiting for pod default/curl-131556218-9fnch to be running, status is Pending, pod ready: false
Hit enter for command prompt
```

然后，按回车并执行命令 `nslookup my-nginx`：

```shell
[ root@curl-131556218-9fnch:/ ]$ nslookup my-nginx
Server:    10.0.0.10
Address 1: 10.0.0.10

Name:      my-nginx
Address 1: 10.0.162.149
```

## 暴露 Service

对我们应用的某些部分，可能希望将 Service 暴露在一个外部 IP 地址上。 Kubernetes 支持两种实现方式：NodePort 和 LoadBalancer。 在上一段创建的 Service 使用了 `NodePort`，因此 Nginx https 副本已经就绪， 如果使用一个公网 IP，能够处理 Internet 上的流量。

```shell
kubectl get svc my-nginx -o yaml | grep nodePort -C 5
  uid: 07191fb3-f61a-11e5-8ae5-42010af00002
spec:
  clusterIP: 10.0.162.149
  ports:
  - name: http
    nodePort: 31704
    port: 8080
    protocol: TCP
    targetPort: 80
  - name: https
    nodePort: 32453
    port: 443
    protocol: TCP
    targetPort: 443
  selector:
    run: my-nginx
kubectl get nodes -o yaml | grep ExternalIP -C 1
    - address: 104.197.41.11
      type: ExternalIP
    allocatable:
--
    - address: 23.251.152.56
      type: ExternalIP
    allocatable:
...
$ curl https://<EXTERNAL-IP>:<NODE-PORT> -k

...
<h1>Welcome to nginx!</h1>
```

让我们重新创建一个 Service，使用一个云负载均衡器，只需要将 `my-nginx` Service 的 `Type` 由 `NodePort` 改成 `LoadBalancer`。

```shell
kubectl edit svc my-nginx
kubectl get svc my-nginx
NAME       TYPE           CLUSTER-IP     EXTERNAL-IP        PORT(S)               AGE
my-nginx   LoadBalancer   10.0.162.149   xx.xxx.xxx.xxx     8080:30163/TCP        21s
curl https://<EXTERNAL-IP> -k
...
<title>Welcome to nginx!</title>
```

在 `EXTERNAL-IP` 列指定的 IP 地址是在公网上可用的。`CLUSTER-IP` 只在集群/私有云网络中可用。

注意，在 AWS 上类型 `LoadBalancer` 创建一个 ELB，它使用主机名（比较长），而不是 IP。 它太长以至于不能适配标准 `kubectl get svc` 的输出，事实上需要通过执行 `kubectl describe service my-nginx` 命令来查看它。 可以看到类似如下内容：

```shell
kubectl describe service my-nginx
...
LoadBalancer Ingress:   a320587ffd19711e5a37606cf4a74574-1142138393.us-east-1.elb.amazonaws.com
...
```

# Ingress



**FEATURE STATE:** `Kubernetes v1.19 [stable]`

Ingress 是对集群中服务的外部访问进行管理的 API 对象，典型的访问方式是 HTTP。

Ingress 可以提供负载均衡、SSL 终结和基于名称的虚拟托管。

## Ingress 是什么？

[Ingress](https://kubernetes.io/docs/reference/generated/kubernetes-api/v1.23/#ingress-v1beta1-networking-k8s-io) 公开了从集群外部到集群内[服务](https://kubernetes.io/zh/docs/concepts/services-networking/service/)的 HTTP 和 HTTPS 路由。 流量路由由 Ingress 资源上定义的规则控制。

下面是一个将所有流量都发送到同一 Service 的简单 Ingress 示例：

![ingress](/images/学习Kubernetes系列之概念/ingress.png)

可以将 Ingress 配置为服务提供外部可访问的 URL、负载均衡流量、终止 SSL/TLS，以及提供基于名称的虚拟主机等能力。 [Ingress 控制器](https://kubernetes.io/zh/docs/concepts/services-networking/ingress-controllers) 通常负责通过负载均衡器来实现 Ingress，尽管它也可以配置边缘路由器或其他前端来帮助处理流量。

Ingress 不会公开任意端口或协议。 将 HTTP 和 HTTPS 以外的服务公开到 Internet 时，通常使用 [Service.Type=NodePort](https://kubernetes.io/zh/docs/concepts/services-networking/service/#nodeport) 或 [Service.Type=LoadBalancer](https://kubernetes.io/zh/docs/concepts/services-networking/service/#loadbalancer) 类型的服务。

## 环境准备

你必须具有 [Ingress 控制器](https://kubernetes.io/zh/docs/concepts/services-networking/ingress-controllers) 才能满足 Ingress 的要求。 仅创建 Ingress 资源本身没有任何效果。

你可能需要部署 Ingress 控制器，例如 [ingress-nginx](https://kubernetes.github.io/ingress-nginx/deploy/)。 你可以从许多 [Ingress 控制器](https://kubernetes.io/zh/docs/concepts/services-networking/ingress-controllers) 中进行选择。

理想情况下，所有 Ingress 控制器都应符合参考规范。但实际上，不同的 Ingress 控制器操作略有不同。

## Ingress 资源 

一个最小的 Ingress 资源示例（service/networking/minimal-ingress.yaml）：

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: minimal-ingress
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
  - http:
      paths:
      - path: /testpath
        pathType: Prefix
        backend:
          service:
            name: test
            port:
              number: 80

```

### Ingress 规则 

每个 HTTP 规则都包含以下信息：

- 可选的 `host`。在此示例中，未指定 `host`，因此该规则适用于通过指定 IP 地址的所有入站 HTTP 通信。 如果提供了 `host`（例如 foo.bar.com），则 `rules` 适用于该 `host`。
- 路径列表 paths（例如，`/testpath`）,每个路径都有一个由 `serviceName` 和 `servicePort` 定义的关联后端。 在负载均衡器将流量定向到引用的服务之前，主机和路径都必须匹配传入请求的内容。
- `backend`（后端）是 [Service 文档](https://kubernetes.io/zh/docs/concepts/services-networking/service/)中所述的服务和端口名称的组合。 与规则的 `host` 和 `path` 匹配的对 Ingress 的 HTTP（和 HTTPS ）请求将发送到列出的 `backend`。

通常在 Ingress 控制器中会配置 `defaultBackend`（默认后端），以服务于任何不符合规约中 `path` 的请求。

### DefaultBackend 

没有 `rules` 的 Ingress 将所有流量发送到同一个默认后端。 `defaultBackend` 通常是 [Ingress 控制器](https://kubernetes.io/zh/docs/concepts/services-networking/ingress-controllers) 的配置选项，而非在 Ingress 资源中指定。

如果 `hosts` 或 `paths` 都没有与 Ingress 对象中的 HTTP 请求匹配，则流量将路由到默认后端。

### 资源后端 

`Resource` 后端是一个 `ObjectRef`，指向同一名字空间中的另一个 Kubernetes，将其作为 Ingress 对象。`Resource` 与 `Service` 配置是互斥的，在 二者均被设置时会无法通过合法性检查。 `Resource` 后端的一种常见用法是将所有入站数据导向带有静态资产的对象存储后端。

(service/networking/ingress-resource-backend.yaml)

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ingress-resource-backend
spec:
  defaultBackend:
    resource:
      apiGroup: k8s.example.com
      kind: StorageBucket
      name: static-assets
  rules:
    - http:
        paths:
          - path: /icons
            pathType: ImplementationSpecific
            backend:
              resource:
                apiGroup: k8s.example.com
                kind: StorageBucket
                name: icon-assets

```

创建了如上的 Ingress 之后，你可以使用下面的命令查看它：

```bash
kubectl describe ingress ingress-resource-backend
Name:             ingress-resource-backend
Namespace:        default
Address:
Default backend:  APIGroup: k8s.example.com, Kind: StorageBucket, Name: static-assets
Rules:
  Host        Path  Backends
  ----        ----  --------
  *
              /icons   APIGroup: k8s.example.com, Kind: StorageBucket, Name: icon-assets
Annotations:  <none>
Events:       <none>
```

### 路径类型 

Ingress 中的每个路径都需要有对应的路径类型（Path Type）。未明确设置 `pathType` 的路径无法通过合法性检查。当前支持的路径类型有三种：

- `ImplementationSpecific`：对于这种路径类型，匹配方法取决于 IngressClass。 具体实现可以将其作为单独的 `pathType` 处理或者与 `Prefix` 或 `Exact` 类型作相同处理。
- `Exact`：精确匹配 URL 路径，且区分大小写。
- `Prefix`：基于以 `/` 分隔的 URL 路径前缀匹配。匹配区分大小写，并且对路径中的元素逐个完成。 路径元素指的是由 `/` 分隔符分隔的路径中的标签列表。 如果每个 *p* 都是请求路径 *p* 的元素前缀，则请求与路径 *p* 匹配。

### 示例

| 类型   | 路径                            | 请求路径        | 匹配与否？               |
| ------ | ------------------------------- | --------------- | ------------------------ |
| Prefix | `/`                             | （所有路径）    | 是                       |
| Exact  | `/foo`                          | `/foo`          | 是                       |
| Exact  | `/foo`                          | `/bar`          | 否                       |
| Exact  | `/foo`                          | `/foo/`         | 否                       |
| Exact  | `/foo/`                         | `/foo`          | 否                       |
| Prefix | `/foo`                          | `/foo`, `/foo/` | 是                       |
| Prefix | `/foo/`                         | `/foo`, `/foo/` | 是                       |
| Prefix | `/aaa/bb`                       | `/aaa/bbb`      | 否                       |
| Prefix | `/aaa/bbb`                      | `/aaa/bbb`      | 是                       |
| Prefix | `/aaa/bbb/`                     | `/aaa/bbb`      | 是，忽略尾部斜线         |
| Prefix | `/aaa/bbb`                      | `/aaa/bbb/`     | 是，匹配尾部斜线         |
| Prefix | `/aaa/bbb`                      | `/aaa/bbb/ccc`  | 是，匹配子路径           |
| Prefix | `/aaa/bbb`                      | `/aaa/bbbxyz`   | 否，字符串前缀不匹配     |
| Prefix | `/`, `/aaa`                     | `/aaa/ccc`      | 是，匹配 `/aaa` 前缀     |
| Prefix | `/`, `/aaa`, `/aaa/bbb`         | `/aaa/bbb`      | 是，匹配 `/aaa/bbb` 前缀 |
| Prefix | `/`, `/aaa`, `/aaa/bbb`         | `/ccc`          | 是，匹配 `/` 前缀        |
| Prefix | `/aaa`                          | `/ccc`          | 否，使用默认后端         |
| 混合   | `/foo` (Prefix), `/foo` (Exact) | `/foo`          | 是，优选 Exact 类型      |

#### 多重匹配 

在某些情况下，Ingress 中的多条路径会匹配同一个请求。 这种情况下最长的匹配路径优先。 如果仍然有两条同等的匹配路径，则精确路径类型优先于前缀路径类型。

## 主机名通配符 

主机名可以是精确匹配（例如“`foo.bar.com`”）或者使用通配符来匹配 （例如“`*.foo.com`”）。 精确匹配要求 HTTP `host` 头部字段与 `host` 字段值完全匹配。 通配符匹配则要求 HTTP `host` 头部字段与通配符规则中的后缀部分相同。

| 主机        | host 头部         | 匹配与否？                          |
| ----------- | ----------------- | ----------------------------------- |
| `*.foo.com` | `bar.foo.com`     | 基于相同的后缀匹配                  |
| `*.foo.com` | `baz.bar.foo.com` | 不匹配，通配符仅覆盖了一个 DNS 标签 |
| `*.foo.com` | `foo.com`         | 不匹配，通配符仅覆盖了一个 DNS 标签 |

service/networking/ingress-wildcard-host.yaml

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ingress-wildcard-host
spec:
  rules:
  - host: "foo.bar.com"
    http:
      paths:
      - pathType: Prefix
        path: "/bar"
        backend:
          service:
            name: service1
            port:
              number: 80
  - host: "*.foo.com"
    http:
      paths:
      - pathType: Prefix
        path: "/foo"
        backend:
          service:
            name: service2
            port:
              number: 80

```

## Ingress 类 

Ingress 可以由不同的控制器实现，通常使用不同的配置。 每个 Ingress 应当指定一个类，也就是一个对 IngressClass 资源的引用。 IngressClass 资源包含额外的配置，其中包括应当实现该类的控制器名称。

service/networking/external-lb.yaml

```yaml
apiVersion: networking.k8s.io/v1
kind: IngressClass
metadata:
  name: external-lb
spec:
  controller: example.com/ingress-controller
  parameters:
    apiGroup: k8s.example.com
    kind: IngressParameters
    name: external-lb

```

ngressClass 资源包含一个可选的 `parameters` 字段，可用于为该类引用额外的、 特定于具体实现的配置。

#### 名字空间域的参数

**FEATURE STATE:** `Kubernetes v1.22 [beta]`

`parameters` 字段有一个 `scope` 和 `namespace` 字段，可用来引用特定 于名字空间的资源，对 Ingress 类进行配置。 `scope` 字段默认为 `Cluster`，表示默认是集群作用域的资源。 将 `scope` 设置为 `Namespace` 并设置 `namespace` 字段就可以引用某特定 名字空间中的参数资源。

有了名字空间域的参数，就不再需要为一个参数资源配置集群范围的 CustomResourceDefinition。 除此之外，之前对访问集群范围的资源进行授权，需要用到 RBAC 相关的资源，现在也不再需要了。

service/networking/namespaced-params.yaml 

```yaml
apiVersion: networking.k8s.io/v1
kind: IngressClass
metadata:
  name: external-lb
spec:
  controller: example.com/ingress-controller
  parameters:
    apiGroup: k8s.example.com
    kind: IngressParameters
    name: external-lb
    namespace: external-configuration
    scope: Namespace

```

### 废弃的注解 

在 Kubernetes 1.18 版本引入 IngressClass 资源和 `ingressClassName` 字段之前， Ingress 类是通过 Ingress 中的一个 `kubernetes.io/ingress.class` 注解来指定的。 这个注解从未被正式定义过，但是得到了 Ingress 控制器的广泛支持。

Ingress 中新的 `ingressClassName` 字段是该注解的替代品，但并非完全等价。 该注解通常用于引用实现该 Ingress 的控制器的名称， 而这个新的字段则是对一个包含额外 Ingress 配置的 IngressClass 资源的引用， 包括 Ingress 控制器的名称。

### 默认 Ingress 类 

你可以将一个特定的 IngressClass 标记为集群默认 Ingress 类。 将一个 IngressClass 资源的 `ingressclass.kubernetes.io/is-default-class` 注解设置为 `true` 将确保新的未指定 `ingressClassName` 字段的 Ingress 能够分配为这个默认的 IngressClass.

**注意：** 如果集群中有多个 IngressClass 被标记为默认，准入控制器将阻止创建新的未指定 `ingressClassName` 的 Ingress 对象。 解决这个问题只需确保集群中最多只能有一个 IngressClass 被标记为默认。

## Ingress 类型 

### 由单个 Service 来完成的 Ingress 

现有的 Kubernetes 概念允许你暴露单个 Service (参见[替代方案](https://kubernetes.io/zh/docs/concepts/services-networking/ingress/#alternatives))。 你也可以通过指定无规则的 *默认后端* 来对 Ingress 进行此操作。

service/networking/test-ingress.yaml 

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: test-ingress
spec:
  defaultBackend:
    service:
      name: test
      port:
        number: 80

```

如果使用 `kubectl apply -f` 创建此 Ingress，则应该能够查看刚刚添加的 Ingress 的状态：

```shell
kubectl get ingress test-ingress
NAME           CLASS         HOSTS   ADDRESS         PORTS   AGE
test-ingress   external-lb   *       203.0.113.123   80      59s
```

其中 `203.0.113.123` 是由 Ingress 控制器分配以满足该 Ingress 的 IP。

### 简单扇出 

一个扇出（fanout）配置根据请求的 HTTP URI 将来自同一 IP 地址的流量路由到多个 Service。 Ingress 允许你将负载均衡器的数量降至最低。例如，这样的设置：![ingress-fanout](/images/学习Kubernetes系列之概念/ingress-fanout.png)

将需要一个如下所示的 Ingress(service/networking/simple-fanout-example.yaml)：

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: simple-fanout-example
spec:
  rules:
  - host: foo.bar.com
    http:
      paths:
      - path: /foo
        pathType: Prefix
        backend:
          service:
            name: service1
            port:
              number: 4200
      - path: /bar
        pathType: Prefix
        backend:
          service:
            name: service2
            port:
              number: 8080

```

当你使用 `kubectl apply -f` 创建 Ingress 时：

```shell
kubectl describe ingress simple-fanout-example
Name:             simple-fanout-example
Namespace:        default
Address:          178.91.123.132
Default backend:  default-http-backend:80 (10.8.2.3:8080)
Rules:
  Host         Path  Backends
  ----         ----  --------
  foo.bar.com
               /foo   service1:4200 (10.8.0.90:4200)
               /bar   service2:8080 (10.8.0.91:8080)
Annotations:
  nginx.ingress.kubernetes.io/rewrite-target:  /
Events:
  Type     Reason  Age                From                     Message
  ----     ------  ----               ----                     -------
  Normal   ADD     22s                loadbalancer-controller  default/test
```

Ingress 控制器将提供实现特定的负载均衡器来满足 Ingress， 只要 Service (`service1`，`service2`) 存在。 当它这样做时，你会在 Address 字段看到负载均衡器的地址。

### 基于名称的虚拟托管 

基于名称的虚拟主机支持将针对多个主机名的 HTTP 流量路由到同一 IP 地址上。

![ingress-name](/images/学习Kubernetes系列之概念/ingress-name.png)

以下 Ingress 让后台负载均衡器基于[host 头部字段](https://tools.ietf.org/html/rfc7230#section-5.4) 来路由请求。

service/networking/name-virtual-host-ingress.yaml

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: name-virtual-host-ingress
spec:
  rules:
  - host: foo.bar.com
    http:
      paths:
      - pathType: Prefix
        path: "/"
        backend:
          service:
            name: service1
            port:
              number: 80
  - host: bar.foo.com
    http:
      paths:
      - pathType: Prefix
        path: "/"
        backend:
          service:
            name: service2
            port:
              number: 80

```

如果你创建的 Ingress 资源没有在 `rules` 中定义的任何 `hosts`，则可以匹配指向 Ingress 控制器 IP 地址的任何网络流量，而无需基于名称的虚拟主机。

例如，以下 Ingress 会将针对 `first.bar.com` 的请求流量路由到 `service1`， 将针对 `second.bar.com` 的请求流量路由到 `service2`， 而针对该 IP 地址的、没有在请求中定义主机名的请求流量会被路由（即，不提供请求标头） 到 `service3`。

service/networking/name-virtual-host-ingress-no-third-host.yaml

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: name-virtual-host-ingress-no-third-host
spec:
  rules:
  - host: first.bar.com
    http:
      paths:
      - pathType: Prefix
        path: "/"
        backend:
          service:
            name: service1
            port:
              number: 80
  - host: second.bar.com
    http:
      paths:
      - pathType: Prefix
        path: "/"
        backend:
          service:
            name: service2
            port:
              number: 80
  - http:
      paths:
      - pathType: Prefix
        path: "/"
        backend:
          service:
            name: service3
            port:
              number: 80

```

### TLS

你可以通过设定包含 TLS 私钥和证书的[Secret](https://kubernetes.io/zh/docs/concepts/configuration/secret/) 来保护 Ingress。 Ingress 只支持单个 TLS 端口 443，并假定 TLS 连接终止于 Ingress 节点 （与 Service 及其 Pod 之间的流量都以明文传输）。 如果 Ingress 中的 TLS 配置部分指定了不同的主机，那么它们将根据通过 SNI TLS 扩展指定的主机名 （如果 Ingress 控制器支持 SNI）在同一端口上进行复用。 TLS Secret 必须包含名为 `tls.crt` 和 `tls.key` 的键名。 这些数据包含用于 TLS 的证书和私钥。例如：

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: testsecret-tls
  namespace: default
data:
  tls.crt: base64 编码的 cert
  tls.key: base64 编码的 key
type: kubernetes.io/tls
```

在 Ingress 中引用此 Secret 将会告诉 Ingress 控制器使用 TLS 加密从客户端到负载均衡器的通道。 你需要确保创建的 TLS Secret 创建自包含 `https-example.foo.com` 的公用名称（CN）的证书。 这里的公共名称也被称为全限定域名（FQDN）。

### 负载均衡 

Ingress 控制器启动引导时使用一些适用于所有 Ingress 的负载均衡策略设置， 例如负载均衡算法、后端权重方案和其他等。 更高级的负载均衡概念（例如持久会话、动态权重）尚未通过 Ingress 公开。 你可以通过用于服务的负载均衡器来获取这些功能。

值得注意的是，尽管健康检查不是通过 Ingress 直接暴露的，在 Kubernetes 中存在并行的概念，比如 [就绪检查](https://kubernetes.io/zh/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)， 允许你实现相同的目的。 请检查特定控制器的说明文档（ [nginx](https://git.k8s.io/ingress-nginx/README.md)， [GCE](https://git.k8s.io/ingress-gce/README.md#health-checks)） 以了解它们是怎样处理健康检查的。

## 更新 Ingress 

要更新现有的 Ingress 以添加新的 Host，可以通过编辑资源来对其进行更新：

```shell
kubectl describe ingress test
Name:             test
Namespace:        default
Address:          178.91.123.132
Default backend:  default-http-backend:80 (10.8.2.3:8080)
Rules:
  Host         Path  Backends
  ----         ----  --------
  foo.bar.com
               /foo   service1:80 (10.8.0.90:80)
Annotations:
  nginx.ingress.kubernetes.io/rewrite-target:  /
Events:
  Type     Reason  Age                From                     Message
  ----     ------  ----               ----                     -------
  Normal   ADD     35s                loadbalancer-controller  default/test
kubectl edit ingress test
```

这一命令将打开编辑器，允许你以 YAML 格式编辑现有配置。 修改它来增加新的主机：

```yaml
spec:
  rules:
  - host: foo.bar.com
    http:
      paths:
      - backend:
          serviceName: service1
          servicePort: 80
        path: /foo
        pathType: Prefix
  - host: bar.baz.com
    http:
      paths:
      - backend:
          serviceName: service2
          servicePort: 80
        path: /foo
        pathType: Prefix
..
```

保存更改后，kubectl 将更新 API 服务器中的资源，该资源将告诉 Ingress 控制器重新配置负载均衡器。

验证：

```shell
kubectl describe ingress test
Name:             test
Namespace:        default
Address:          178.91.123.132
Default backend:  default-http-backend:80 (10.8.2.3:8080)
Rules:
  Host         Path  Backends
  ----         ----  --------
  foo.bar.com
               /foo   service1:80 (10.8.0.90:80)
  bar.baz.com
               /foo   service2:80 (10.8.0.91:80)
Annotations:
  nginx.ingress.kubernetes.io/rewrite-target:  /
Events:
  Type     Reason  Age                From                     Message
  ----     ------  ----               ----                     -------
  Normal   ADD     45s                loadbalancer-controller  default/test
```

你也可以通过 `kubectl replace -f` 命令调用修改后的 Ingress yaml 文件来获得同样的结果。

## 跨可用区失败 

不同的云厂商使用不同的技术来实现跨故障域的流量分布。详情请查阅相关 Ingress 控制器的文档。 

# Ingress 控制器

为了让 Ingress 资源工作，集群必须有一个正在运行的 Ingress 控制器。

与作为 `kube-controller-manager` 可执行文件的一部分运行的其他类型的控制器不同， Ingress 控制器不是随集群自动启动的。 基于此页面，你可选择最适合你的集群的 ingress 控制器实现。

Kubernetes 作为一个项目，目前支持和维护 [AWS](https://github.com/kubernetes-sigs/aws-load-balancer-controller#readme)， [GCE](https://git.k8s.io/ingress-gce/README.md) 和 [nginx](https://git.k8s.io/ingress-nginx/README.md#readme) Ingress 控制器。

## 其他控制器

**说明：** 本部分链接到提供 Kubernetes 所需功能的第三方项目。Kubernetes 项目作者不负责这些项目。此页面遵循[CNCF 网站指南](https://github.com/cncf/foundation/blob/master/website-guidelines.md)，按字母顺序列出项目。要将项目添加到此列表中，请在提交更改之前阅读[内容指南](https://kubernetes.io/docs/contribute/style/content-guide/#third-party-content)。

- [AKS 应用程序网关 Ingress 控制器](https://azure.github.io/application-gateway-kubernetes-ingress/) 是一个配置 [Azure 应用程序网关](https://docs.microsoft.com/azure/application-gateway/overview) 的 Ingress 控制器。
- [Ambassador](https://www.getambassador.io/) API 网关是一个基于 [Envoy](https://www.envoyproxy.io/) 的 Ingress 控制器。
- [Apache APISIX Ingress 控制器](https://github.com/apache/apisix-ingress-controller) 是一个基于 [Apache APISIX 网关](https://github.com/apache/apisix) 的 Ingress 控制器。
- [Avi Kubernetes Operator](https://github.com/vmware/load-balancer-and-ingress-services-for-kubernetes) 使用 [VMware NSX Advanced Load Balancer](https://avinetworks.com/) 提供第 4 到第 7 层的负载均衡。
- [BFE Ingress 控制器](https://github.com/bfenetworks/ingress-bfe) 是一个基于 [BFE](https://www.bfe-networks.net/) 的 Ingress 控制器。
- [Citrix Ingress 控制器](https://github.com/citrix/citrix-k8s-ingress-controller#readme) 可以用来与 Citrix Application Delivery Controller 一起使用。
- [Contour](https://projectcontour.io/) 是一个基于 [Envoy](https://www.envoyproxy.io/) 的 Ingress 控制器。
- [EnRoute](https://getenroute.io/) 是一个基于 [Envoy](https://www.envoyproxy.io/) API 网关， 可以作为 Ingress 控制器来执行。
- [Easegress IngressController](https://github.com/megaease/easegress/blob/main/doc/ingresscontroller.md) 是一个基于 [Easegress](https://megaease.com/easegress/) API 网关，可以作为 Ingress 控制器来执行。

- F5 BIG-IP 的 [用于 Kubernetes 的容器 Ingress 服务](https://clouddocs.f5.com/products/connectors/k8s-bigip-ctlr/latest) 让你能够使用 Ingress 来配置 F5 BIG-IP 虚拟服务器。
- [Gloo](https://gloo.solo.io/) 是一个开源的、基于 [Envoy](https://www.envoyproxy.io/) 的 Ingress 控制器，能够提供 API 网关功能，
- [HAProxy Ingress](https://haproxy-ingress.github.io/) 针对 [HAProxy](https://www.haproxy.org/#desc) 的 Ingress 控制器。
- [用于 Kubernetes 的 HAProxy Ingress 控制器](https://github.com/haproxytech/kubernetes-ingress#readme) 也是一个针对 [HAProxy](https://www.haproxy.org/#desc) 的 Ingress 控制器。
- [Istio Ingress](https://istio.io/latest/docs/tasks/traffic-management/ingress/kubernetes-ingress/) 是一个基于 [Istio](https://istio.io/) 的 Ingress 控制器。

- [用于 Kubernetes 的 Kong Ingress 控制器](https://github.com/Kong/kubernetes-ingress-controller#readme) 是一个用来驱动 [Kong Gateway](https://konghq.com/kong/) 的 Ingress 控制器。
- [用于 Kubernetes 的 NGINX Ingress 控制器](https://www.nginx.com/products/nginx-ingress-controller/) 能够与 [NGINX](https://www.nginx.com/resources/glossary/nginx/) Web 服务器（作为代理） 一起使用。
- [Skipper](https://opensource.zalando.com/skipper/kubernetes/ingress-controller/) HTTP 路由器和反向代理可用于服务组装，支持包括 Kubernetes Ingress 这类使用场景， 设计用来作为构造你自己的定制代理的库。
- [Traefik Kubernetes Ingress 提供程序](https://doc.traefik.io/traefik/providers/kubernetes-ingress/) 是一个用于 [Traefik](https://traefik.io/traefik/) 代理的 Ingress 控制器。
- [Tyk Operator](https://github.com/TykTechnologies/tyk-operator) 使用自定义资源扩展 Ingress，为之带来 API 管理能力。Tyk Operator 使用开源的 Tyk Gateway & Tyk Cloud 控制面。
- [Voyager](https://appscode.com/products/voyager) 是一个针对 [HAProxy](https://www.haproxy.org/#desc) 的 Ingress 控制器。

## 使用多个 Ingress 控制器

你可以在集群中部署[任意数量的 ingress 控制器](https://git.k8s.io/ingress-nginx/docs/user-guide/multiple-ingress.md#multiple-ingress-controllers)。 创建 ingress 时，应该使用适当的 [`ingress.class`](https://git.k8s.io/ingress-gce/docs/faq/README.md#how-do-i-run-multiple-ingress-controllers-in-the-same-cluster) 注解每个 Ingress 以表明在集群中如果有多个 Ingress 控制器时，应该使用哪个 Ingress 控制器。

如果不定义 `ingress.class`，云提供商可能使用默认的 Ingress 控制器。

理想情况下，所有 Ingress 控制器都应满足此规范，但各种 Ingress 控制器的操作略有不同。

# 网络策略

https://kubernetes.io/zh/docs/concepts/services-networking/network-policies/

# IPv4/IPv6 双协议栈

https://kubernetes.io/zh/docs/concepts/services-networking/dual-stack/
