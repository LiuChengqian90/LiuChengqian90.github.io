---
title: 学习Kubernetes系列4——工作负载
date: 2021-06-18 15:22:33
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

Kubernetes Pods 有确定的生命周期。 例如，当某 Pod 在你的集群中运行时，Pod 运行所在的 节点 出现致命错误时， 所有该节点上的 Pods 都会失败。Kubernetes 将这类失败视为最终状态： 即使该节点后来恢复正常运行，你也需要创建新的 Pod 来恢复应用。

为了解耦人力，并不需要直接管理每个 Pod。 相反，可以使用 *负载资源* 来替你管理一组 Pods。 这些资源配置 控制器 来确保合适类型的、处于运行状态的 Pod 个数是正确的，与你所指定的状态相一致。

Kubernetes 提供若干种内置的工作负载资源：

- **Deployment 和 ReplicaSet** （替换原来的资源 ReplicationController）。 Deployment 很适合用来管理你的集群上的无状态应用，Deployment 中的所有 Pod 都是相互等价的，并且在需要的时候被换掉。
- **StatefulSet** 让你能够运行一个或者多个以某种方式跟踪应用状态的 Pods。 例如，如果你的负载会将数据作持久存储，你可以运行一个 StatefulSet，将每个 Pod 与某个 PersistentVolume 对应起来。你在 StatefulSet 中各个 Pod 内运行的代码可以将数据复制到同一 StatefulSet 中的其它 Pod 中以提高整体的服务可靠性。
- **DaemonSet** 定义提供节点本地支撑设施的 Pods。这些 Pods 可能对于你的**集群的运维**是 非常重要的，例如作为网络链接的辅助工具或者作为网络 插件 的一部分等等。每次你向集群中添加一个新节点时，如果该节点与某 DaemonSet 的规约匹配，则控制面会为该 DaemonSet 调度一个 Pod 到该新节点上运行。
- **Job 和 CronJob**。 定义一些一直运行到结束并停止的任务。Job 用来表达的是一次性的任务，而 CronJob 会根据其时间规划反复运行。

在庞大的 Kubernetes 生态系统中，你还可以找到一些提供额外操作的第三方 工作负载资源。通过使用 [定制资源定义（CRD）](https://kubernetes.io/zh/docs/concepts/extend-kubernetes/api-extension/custom-resources/)， 你可以添加第三方工作负载资源，以完成原本不是 Kubernetes 核心功能的工作。 例如，如果你希望运行一组 `Pods`，但要求所有 Pods 都可用时才执行操作 （比如针对某种高吞吐量的分布式任务），你可以实现一个能够满足这一需求 的扩展，并将其安装到集群中运行。

# Pods

Pod 是可以在 Kubernetes 中创建和管理的、最小的可部署的计算单元。

Pod 是一组（一个或多个） 容器； 这些容器共享存储、网络、以及怎样运行这些容器的声明。 Pod 中的内容总是并置（colocated）的并且一同调度，在共享的上下文中运行。 Pod 所建模的是**特定于应用的“逻辑主机”，其中包含一个或多个应用容器**， 这些容器是相对紧密的耦合在一起的。 在非云环境中，在相同的物理机或虚拟机上运行的应用类似于在同一逻辑主机上运行的云应用。

除了应用容器，Pod 还可以包含在 Pod 启动期间运行的 **Init 容器**。 你也可以在集群中支持**临时性容器** 的情况下，为调试的目的注入临时性容器。



Pod 的共享上下文包括一组 Linux 名字空间、控制组（cgroup）和可能一些其他的隔离 方面，即用来隔离 Docker 容器的技术。 在 Pod 的上下文中，每个独立的应用可能会进一步实施隔离。

就 Docker 概念的术语而言，Pod 类似于共享名字空间和文件系统卷的**一组** Docker 容器。



## 使用 Pod

通常你不需要直接创建 Pod，甚至单实例 Pod。 相反，你会使用诸如 **Deployment 或 Job** 这类工作负载资源 来创建 Pod。如果 Pod 需要跟踪状态， 可以考虑 **StatefulSet** 资源。

Kubernetes 集群中的 Pod 主要有两种用法：

- **运行单个容器的 Pod**。"每个 Pod 一个容器"模型是最常见的 Kubernetes 用例； 在这种情况下，可以将 Pod 看作单个容器的包装器，并且 Kubernetes 直接管理 Pod，而不是容器。
- **运行多个协同工作的容器的 Pod**。 Pod 可能封装由多个紧密耦合且需要共享资源的共处容器组成的应用程序。 这些位于同一位置的容器可能形成单个内聚的服务单元 —— 一个容器将文件从共享卷提供给公众， 而另一个单独的“边车”（sidecar）容器则刷新或更新这些文件。 Pod 将这些容器和存储资源打包为一个可管理的实体。

> 将多个并置、同管的容器组织到一个 Pod 中是一种相对高级的使用场景。 只有在一些场景中，容器之间紧密关联时你才应该使用这种模式。

每个 Pod 都旨在运行给定应用程序的单个实例。如果希望横向扩展应用程序（例如，运行多个实例 以提供更多的资源），则应该使用多个 Pod，每个实例使用一个 Pod。 在 Kubernetes 中，这通常被称为 *副本（Replication）*。 通常使用一种工作负载资源及其控制器来创建和管理一组 Pod 副本。

### Pod 怎样管理多个容器

Pod 被设计成支持形成内聚服务单元的多个协作过程（形式为容器）。 Pod 中的容器被自动安排到集群中的同一物理机或虚拟机上，并可以一起进行调度。 容器之间可以共享资源和依赖、彼此通信、协调何时以及何种方式终止自身。

![work-pod](/images/学习Kubernetes系列之概念/work-pod.svg)

有些 Pod 具有 **Init 容器 和 应用容器**。 Init 容器会在启动应用容器之前运行并完成。

Pod 天生地为其成员容器提供了两种共享资源：**网络和 存储**。

## 使用 Pod 

你很少在 Kubernetes 中直接创建一个个的 Pod，甚至是单实例（Singleton）的 Pod。 这是因为 Pod 被设计成了相对临时性的、用后即抛的一次性实体。 当 Pod 由你或者间接地由 [控制器](https://kubernetes.io/zh/docs/concepts/architecture/controller/) 创建时，它被调度在集群中的[节点](https://kubernetes.io/zh/docs/concepts/architecture/nodes/)上运行。 Pod 会保持在该节点上运行，直到 Pod 结束执行、Pod 对象被删除、Pod 因资源不足而被 *驱逐* 或者节点失效为止。

重启 Pod 中的容器不应与重启 Pod 混淆。 Pod 不是进程，而是容器运行的环境。 在被删除之前，Pod 会一直存在。

> 当你为 Pod 对象创建清单时，要确保所指定的 Pod 名称是合法的 [DNS 子域名](https://kubernetes.io/zh/docs/concepts/overview/working-with-objects/names#dns-subdomain-names)。

### Pod 和控制器 

你可以使用工作负载资源来创建和管理多个 Pod。 资源的控制器能够处理副本的管理、上线，并在 Pod 失效时提供自愈能力。

下面是一些管理一个或者多个 Pod 的工作负载资源的示例：

- [Deployment](https://kubernetes.io/zh/docs/concepts/workloads/controllers/deployment/)
- [StatefulSet](https://kubernetes.io/zh/docs/concepts/workloads/controllers/statefulset/)
- [DaemonSet](https://kubernetes.io/zh/docs/concepts/workloads/controllers/daemonset/)

### Pod 模版 

[负载](https://kubernetes.io/zh/docs/concepts/workloads/)资源的控制器通常使用 *Pod 模板（Pod Template）* 来替你创建 Pod 并管理它们。

Pod 模板是包含在工作负载对象中的规范，用来创建 Pod。

工作负载的控制器会使用负载对象中的 `PodTemplate` 来生成实际的 Pod。 `PodTemplate` 是你用来运行应用时指定的负载资源的目标状态的一部分。

下面的示例是一个简单的 Job 的清单，其中的 `template` 指示启动一个容器。 该 Pod 中的容器会打印一条消息之后暂停。

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: hello
spec:
  template:
    # 这里是 Pod 模版
    spec:
      containers:
      - name: hello
        image: busybox
        command: ['sh', '-c', 'echo "Hello, Kubernetes!" && sleep 3600']
      restartPolicy: OnFailure
    # 以上为 Pod 模版
```

修改 Pod 模版或者切换到新的 Pod 模版都不会对已经存在的 Pod 起作用。 Pod 不会直接收到模版的更新。相反， 新的 Pod 会被创建出来，与更改后的 Pod 模版匹配。

例如，Deployment 控制器针对每个 Deployment 对象确保运行中的 Pod 与当前的 Pod 模版匹配。如果模版被更新，则 Deployment 必须删除现有的 Pod，基于更新后的模版 创建新的 Pod。每个工作负载资源都实现了自己的规则，用来处理对 Pod 模版的更新。



### 资源共享和通信 

Pod 使它的成员容器间能够进行数据共享和通信。

### Pod 中的存储

一个 Pod 可以设置一组共享的存储[卷](https://kubernetes.io/zh/docs/concepts/storage/volumes/)。 Pod 中的所有容器都可以访问该共享卷，从而允许这些容器共享数据。 卷还允许 Pod 中的持久数据保留下来，即使其中的容器需要重新启动。 有关 Kubernetes 如何在 Pod 中实现共享存储并将其提供给 Pod 的更多信息， 请参考[卷](https://kubernetes.io/zh/docs/concepts/storage/)。

### Pod 联网 

每个 Pod 都在每个地址族中获得一个唯一的 IP 地址。 Pod 中的每个容器共享网络名字空间，包括 IP 地址和网络端口。 *Pod 内* 的容器可以使用 `localhost` 互相通信。 当 Pod 中的容器与 *Pod 之外* 的实体通信时，它们必须协调如何使用共享的网络资源 （例如端口）。

在同一个 Pod 内，所有容器共享一个 IP 地址和端口空间，并且可以通过 `localhost` 发现对方。 他们也能通过如 SystemV 信号量或 POSIX 共享内存这类标准的进程间通信方式互相通信。 不同 Pod 中的容器的 IP 地址互不相同，没有 [特殊配置](https://kubernetes.io/zh/docs/concepts/policy/pod-security-policy/) 就不能使用 IPC 进行通信。 如果某容器希望与运行于其他 Pod 中的容器通信，可以通过 IP 联网的方式实现。

Pod 中的容器所看到的系统主机名与为 Pod 配置的 `name` 属性值相同。 [网络](https://kubernetes.io/zh/docs/concepts/cluster-administration/networking/)部分提供了更多有关此内容的信息。

## 容器的特权模式 

在 Linux 中，Pod 中的任何容器都可以使用容器规约中的 [安全性上下文](https://kubernetes.io/zh/docs/tasks/configure-pod-container/security-context/)中的 `privileged`（Linux）参数启用特权模式。 这对于想要使用操作系统管理权能（Capabilities，如操纵网络堆栈和访问设备） 的容器很有用。

> [容器运行时](https://kubernetes.io/zh/docs/setup/production-environment/container-runtimes)必须支持 特权容器的概念才能使用这一配置。

## 静态 Pod 

*静态 Pod（Static Pod）* 直接由特定节点上的 `kubelet` 守护进程管理， 不需要[API 服务器](https://kubernetes.io/zh/docs/reference/command-line-tools-reference/kube-apiserver/)看到它们。 尽管大多数 Pod 都是通过控制面（例如，[Deployment](https://kubernetes.io/zh/docs/concepts/workloads/controllers/deployment/)） 来管理的，对于静态 Pod 而言，`kubelet` 直接监控每个 Pod，并在其失效时重启之。

静态 Pod 通常绑定到某个节点上的 [kubelet](https://kubernetes.io/docs/reference/generated/kubelet)。 其主要用途是运行自托管的控制面。 在自托管场景中，使用 `kubelet` 来管理各个独立的 [控制面组件](https://kubernetes.io/zh/docs/concepts/overview/components/#control-plane-components)。

`kubelet` 自动尝试为每个静态 Pod 在 Kubernetes API 服务器上创建一个 [镜像 Pod](https://kubernetes.io/zh/docs/reference/glossary/?all=true#term-mirror-pod)。 这意味着在节点上运行的 Pod 在 API 服务器上是可见的，但不可以通过 API 服务器来控制。

**说明：**

静态 Pod 的 `spec` 不能引用其他的 API 对象（例如：[ServiceAccount](https://kubernetes.io/zh/docs/tasks/configure-pod-container/configure-service-account/)、[ConfigMap](https://kubernetes.io/zh/docs/tasks/configure-pod-container/configure-pod-configmap/)、[Secret](https://kubernetes.io/zh/docs/concepts/configuration/secret/)等）。

## 容器探针 

*Probe* 是由 kubelet 对容器执行的定期诊断。要执行诊断，kubelet 可以执行三种动作：

- `ExecAction`（借助容器运行时执行）
- `TCPSocketAction`（由 kubelet 直接检测）
- `HTTPGetAction`（由 kubelet 直接检测）

你可以参阅 Pod 的生命周期文档中的[探针](https://kubernetes.io/zh/docs/concepts/workloads/pods/pod-lifecycle/#container-probes)部分。

# Deployments

一个 *Deployment* 为 Pods 和 ReplicaSets（下一代副本控制器）提供声明式的更新能力。

你负责描述 Deployment 中的 *目标状态*，而 Deployment [控制器（Controller）](https://kubernetes.io/zh/docs/concepts/architecture/controller/) 以受控速率更改实际状态， 使其变为期望状态。你可以定义 Deployment 以创建新的 ReplicaSet，或删除现有 Deployment， 并通过新的 Deployment 收养其资源。

> 不要管理 Deployment 所拥有的 ReplicaSet 。 如果存在下面未覆盖的使用场景，请考虑在 Kubernetes 仓库中提出 Issue。

## 用例

以下是 Deployments 的典型用例：

- **创建 Deployment 以将 ReplicaSet 上线**。 ReplicaSet 在后台创建 Pods。 检查 ReplicaSet 的上线状态，查看其是否成功。
- **通过更新 Deployment 的 PodTemplateSpec，声明 Pod 的新状态**。 新的 ReplicaSet 会被创建，Deployment 以受控速率将 Pod 从旧 ReplicaSet 迁移到新 ReplicaSet。 每个新的 ReplicaSet 都会更新 Deployment 的修订版本。
- 如果 Deployment 的当前状态不稳定，**回滚到较早的 Deployment 版本**。 每次回滚都会更新 Deployment 的修订版本。
- **扩大 Deployment 规模以承担更多负载**。
- **暂停 Deployment**以应用对 PodTemplateSpec 所作的多项修改， 然后恢复其执行以启动新的上线版本。
- **使用 Deployment 状态**来判定上线过程是否出现停滞。
- **清理较旧的不再需要的 ReplicaSet** 。

## 创建 Deployment 

下面是 Deployment 示例。其中创建了一个 ReplicaSet，负责启动三个 `nginx` Pods：

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  labels:
    app: nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
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

在该例中：

- 创建名为 `nginx-deployment`（由 `.metadata.name` 字段标明）的 Deployment。
- 该 Deployment 创建三个（由 `replicas` 字段标明）Pod 副本。

- `selector` 字段定义 Deployment 如何查找要管理的 Pods。 在这里，你选择在 Pod 模板中定义的标签（`app: nginx`）。 不过，更复杂的选择规则是也可能的，只要 Pod 模板本身满足所给规则即可。

  > `spec.selector.matchLabels` 字段是 `{key,value}` 键值对映射。 在 `matchLabels` 映射中的每个 `{key,value}` 映射等效于 `matchExpressions` 中的一个元素， 即其 `key` 字段是 “key”，`operator` 为 “In”，`values` 数组仅包含 “value”。 在 `matchLabels` 和 `matchExpressions` 中给出的所有条件都必须满足才能匹配。

- `template` 字段包含以下子字段：

  - Pod 被使用 `labels` 字段打上 `app: nginx` 标签。

- - Pod 模板规约（即 `.template.spec` 字段）指示 Pods 运行一个 `nginx` 容器， 该容器运行版本为 1.14.2 的 `nginx` [Docker Hub](https://hub.docker.com/)镜像。
  - 创建一个容器并使用 `name` 字段将其命名为 `nginx`。

开始之前，请确保的 Kubernetes 集群已启动并运行。 按照以下步骤创建上述 Deployment ：

1. 通过运行以下命令创建 Deployment ：

   ```shell
   kubectl apply -f https://k8s.io/examples/controllers/nginx-deployment.yaml
   ```

   **说明：** 你可以设置 `--record` 标志将所执行的命令写入资源注解 `kubernetes.io/change-cause` 中。 这对于以后的检查是有用的。例如，要查看针对每个 Deployment 修订版本所执行过的命令。

   

2. 运行 `kubectl get deployments` 检查 Deployment 是否已创建。如果仍在创建 Deployment， 则输出类似于：

   ```shell
   NAME               DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE
   nginx-deployment   3         0         0            0           1s
   ```

   在检查集群中的 Deployment 时，所显示的字段有：

   - `NAME` 列出了集群中 Deployment 的名称。
   - `READY` 显示应用程序的可用的 *副本* 数。显示的模式是“就绪个数/期望个数”。
   - `UP-TO-DATE` 显示为了达到期望状态已经更新的副本数。
   - `AVAILABLE` 显示应用可供用户使用的副本数。
   - `AGE` 显示应用程序运行的时间。

   请注意期望副本数是根据 `.spec.replicas` 字段设置 3。

3. 要查看 Deployment 上线状态，运行 `kubectl rollout status deployment/nginx-deployment`。

   输出类似于：

   ```shell
   Waiting for rollout to finish: 2 out of 3 new replicas have been updated...
   deployment "nginx-deployment" successfully rolled out
   ```

4. 几秒钟后再次运行 `kubectl get deployments`。输出类似于：

   注意 Deployment 已创建全部三个副本，并且所有副本都是最新的（它们包含最新的 Pod 模板） 并且可用。

   ```
   NAME               DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE
   nginx-deployment   3         3         3            3           18s
   ```

5. 要查看 Deployment 创建的 ReplicaSet（`rs`），运行 `kubectl get rs`。 输出类似于：

   ```
   NAME                          DESIRED   CURRENT   READY   AGE
   nginx-deployment-75675f5897   3         3         3       18s
   ```

   ReplicaSet 输出中包含以下字段：

   - `NAME` 列出名字空间中 ReplicaSet 的名称；
   - `DESIRED` 显示应用的期望副本个数，即在创建 Deployment 时所定义的值。 此为期望状态；
   - `CURRENT` 显示当前运行状态中的副本个数；
   - `READY` 显示应用中有多少副本可以为用户提供服务；
   - `AGE` 显示应用已经运行的时间长度。

   注意 ReplicaSet 的名称始终被格式化为`[Deployment名称]-[随机字符串]`。 其中的随机字符串是使用 pod-template-hash 作为种子随机生成的。

6. 要查看每个 Pod 自动生成的标签，运行 `kubectl get pods --show-labels`。返回以下输出：

   ```
   NAME                                READY     STATUS    RESTARTS   AGE       LABELS
   nginx-deployment-75675f5897-7ci7o   1/1       Running   0          18s       app=nginx,pod-template-hash=3123191453
   nginx-deployment-75675f5897-kzszj   1/1       Running   0          18s       app=nginx,pod-template-hash=3123191453
   nginx-deployment-75675f5897-qqcnn   1/1       Running   0          18s       app=nginx,pod-template-hash=3123191453
   ```

   所创建的 ReplicaSet 确保总是存在三个 `nginx` Pod。

### Pod-template-hash 标签

> 不要更改此标签。



Deployment 控制器将 `pod-template-hash` 标签添加到 Deployment 所创建或收留的 每个 ReplicaSet 。

此标签可确保 Deployment 的子 ReplicaSets 不重叠。 标签是通过对 ReplicaSet 的 `PodTemplate` 进行哈希处理。 所生成的哈希值被添加到 ReplicaSet 选择算符、Pod 模板标签，并存在于在 ReplicaSet 可能拥有的任何现有 Pod 中。

## 更新 Deployment

> 仅当 Deployment Pod 模板（即 `.spec.template`）发生改变时，例如模板的标签或容器镜像被更新， 才会触发 Deployment 上线。 其他更新（如对 Deployment 执行扩缩容的操作）不会触发上线动作。

按照以下步骤更新 Deployment：

1. 先来更新 nginx Pod 以使用 `nginx:1.16.1` 镜像，而不是 `nginx:1.14.2` 镜像。

   ```shell
   kubectl --record deployment.apps/nginx-deployment set image \
      deployment.v1.apps/nginx-deployment nginx=nginx:1.16.1
   ```

   或者使用下面的命令：

   ```shell
   kubectl set image deployment/nginx-deployment nginx=nginx:1.16.1 --record
   ```

   输出类似于：

   ```
   deployment.apps/nginx-deployment image updated
   ```

   或者，可以 `edit` Deployment 并将 `.spec.template.spec.containers[0].image` 从 `nginx:1.14.2` 更改至 `nginx:1.16.1`。

   ```shell
   kubectl edit deployment.v1.apps/nginx-deployment
   ```

   输出类似于：

   ```
   deployment.apps/nginx-deployment edited
   ```

2. 要查看上线状态，运行：

   ```shell
	kubectl rollout status deployment/nginx-deployment
	```
	
	输出类似于：

	```
	Waiting for rollout to finish: 2 out of 3 new replicas have been updated...
	```
	
	或者

	```
	deployment "nginx-deployment" successfully rolled out
	```

### 翻转（多 Deployment 动态更新）

Deployment 控制器每次注意到新的 Deployment 时，都会创建一个 ReplicaSet 以启动所需的 Pods。 如果更新了 Deployment，则控制标签匹配 `.spec.selector` 但模板不匹配 `.spec.template` 的 Pods 的现有 ReplicaSet 被缩容。最终，新的 ReplicaSet 缩放为 `.spec.replicas` 个副本， 所有旧 ReplicaSets 缩放为 0 个副本。

当 Deployment 正在**上线时被更新**，Deployment 会针对更新创建一个新的 ReplicaSet 并开始对其扩容，之前正在被扩容的 ReplicaSet 会被**翻转**，添加到旧 ReplicaSets 列表 并开始**缩容**。

例如，假定你在创建一个 Deployment 以生成 `nginx:1.14.2` 的 5 个副本，但接下来 更新 Deployment 以创建 5 个 `nginx:1.16.1` 的副本，而此时只有 3 个`nginx:1.14.2` 副本已创建。在这种情况下，Deployment 会**立即开始**杀死 3 个 `nginx:1.14.2` Pods， 并开始创建 `nginx:1.16.1` Pods。它不会等待 `nginx:1.14.2` 的 5 个副本都创建完成 后才开始执行变更动作。



### 更改标签选择算符

通常不鼓励更新标签选择算符。建议你提前规划选择算符。 在任何情况下，如果需要更新标签选择算符，请格外小心，并确保自己了解 这背后可能发生的所有事情。

> 在 API 版本 `apps/v1` 中，Deployment 标签选择算符在创建后是不可变的。

- 添加选择算符时要求使用新标签更新 Deployment 规约中的 Pod 模板标签，否则将返回验证错误。 此更改是非重叠的，也就是说新的选择算符不会选择使用旧选择算符所创建的 ReplicaSet 和 Pod， 这会导致创建新的 ReplicaSet 时所有旧 ReplicaSet 都会被孤立。
- 选择算符的更新如果更改了某个算符的键名，这会导致与添加算符时相同的行为。
- 删除选择算符的操作会删除从 Deployment 选择算符中删除现有算符。 此操作不需要更改 Pod 模板标签。现有 ReplicaSet 不会被孤立，也不会因此创建新的 ReplicaSet， 但请注意已删除的标签仍然存在于现有的 Pod 和 ReplicaSet 中。

## 回滚 Deployment

有时，你可能想要回滚 Deployment；例如，当 Deployment 不稳定时（例如进入反复崩溃状态）。 默认情况下，Deployment 的所有上线记录都保留在系统中，以便可以随时回滚 （你可以通过修改修订历史记录限制来更改这一约束）。

> **说明：** Deployment 被触发上线时，系统就会创建 Deployment 的新的修订版本。 这意味着仅当 Deployment 的 Pod 模板（`.spec.template`）发生更改时，才会创建新修订版本 -- 例如，模板的标签或容器镜像发生变化。 其他更新，如 Deployment 的扩缩容操作不会创建 Deployment 修订版本。 这是为了方便同时执行手动缩放或自动缩放。 换言之，当你回滚到较早的修订版本时，只有 Deployment 的 Pod 模板部分会被回滚。

- 假设你在更新 Deployment 时犯了一个拼写错误，将镜像名称命名设置为 `nginx:1.161` 而不是 `nginx:1.16.1`：

  ```shell
  kubectl set image deployment.v1.apps/nginx-deployment nginx=nginx:1.161 --record=true
  ```

  输出类似于：

  ```shell
  deployment.apps/nginx-deployment image updated
  ```

- 此上线进程会出现停滞。你可以通过检查上线状态来验证：

  ```shell
  kubectl rollout status deployment/nginx-deployment
  ```

  输出类似于：

  ```
  Waiting for rollout to finish: 1 out of 3 new replicas have been updated...
  ```

- 按 Ctrl-C 停止上述上线状态观测。有关上线停滞的详细信息，[参考这里](https://kubernetes.io/zh/docs/concepts/workloads/controllers/deployment/#deployment-status)。

- 你可以看到旧的副本有两个（`nginx-deployment-1564180365` 和 `nginx-deployment-2035384211`）， 新的副本有 1 个（`nginx-deployment-3066724191`）：

  ```shell
  kubectl get rs
  ```

  输出类似于：

  ```shell
  NAME                          DESIRED   CURRENT   READY   AGE
  nginx-deployment-1564180365   3         3         3       25s
  nginx-deployment-2035384211   0         0         0       36s
  nginx-deployment-3066724191   1         1         0       6s
  ```

- 查看所创建的 Pod，你会注意到新 ReplicaSet 所创建的 1 个 Pod 卡顿在镜像拉取循环中。

  ```shell
  kubectl get pods
  ```

  输出类似于：

  ```shell
  NAME                                READY     STATUS             RESTARTS   AGE
  nginx-deployment-1564180365-70iae   1/1       Running            0          25s
  nginx-deployment-1564180365-jbqqo   1/1       Running            0          25s
  nginx-deployment-1564180365-hysrc   1/1       Running            0          25s
  nginx-deployment-3066724191-08mng   0/1       ImagePullBackOff   0          6s
  ```

  **说明：** Deployment 控制器自动停止有问题的上线过程，并停止对新的 ReplicaSet 扩容。 这行为取决于所指定的 **rollingUpdate** 参数（具体为 `maxUnavailable`）。 默认情况下，Kubernetes 将此值设置为 25%。

- 获取 Deployment 描述信息：

  ```shell
  kubectl describe deployment
  ```

  输出类似于：

  ```shell
  Name:           nginx-deployment
  Namespace:      default
  CreationTimestamp:  Tue, 15 Mar 2016 14:48:04 -0700
  Labels:         app=nginx
  Selector:       app=nginx
  Replicas:       3 desired | 1 updated | 4 total | 3 available | 1 unavailable
  StrategyType:       RollingUpdate
  MinReadySeconds:    0
  RollingUpdateStrategy:  25% max unavailable, 25% max surge
  Pod Template:
    Labels:  app=nginx
    Containers:
     nginx:
      Image:        nginx:1.91
      Port:         80/TCP
      Host Port:    0/TCP
      Environment:  <none>
      Mounts:       <none>
    Volumes:        <none>
  Conditions:
    Type           Status  Reason
    ----           ------  ------
    Available      True    MinimumReplicasAvailable
    Progressing    True    ReplicaSetUpdated
  OldReplicaSets:     nginx-deployment-1564180365 (3/3 replicas created)
  NewReplicaSet:      nginx-deployment-3066724191 (1/1 replicas created)
  Events:
    FirstSeen LastSeen    Count   From                    SubobjectPath   Type        Reason              Message
    --------- --------    -----   ----                    -------------   --------    ------              -------
    1m        1m          1       {deployment-controller }                Normal      ScalingReplicaSet   Scaled up replica set nginx-deployment-2035384211 to 3
    22s       22s         1       {deployment-controller }                Normal      ScalingReplicaSet   Scaled up replica set nginx-deployment-1564180365 to 1
    22s       22s         1       {deployment-controller }                Normal      ScalingReplicaSet   Scaled down replica set nginx-deployment-2035384211 to 2
    22s       22s         1       {deployment-controller }                Normal      ScalingReplicaSet   Scaled up replica set nginx-deployment-1564180365 to 2
    21s       21s         1       {deployment-controller }                Normal      ScalingReplicaSet   Scaled down replica set nginx-deployment-2035384211 to 1
    21s       21s         1       {deployment-controller }                Normal      ScalingReplicaSet   Scaled up replica set nginx-deployment-1564180365 to 3
    13s       13s         1       {deployment-controller }                Normal      ScalingReplicaSet   Scaled down replica set nginx-deployment-2035384211 to 0
    13s       13s         1       {deployment-controller }                Normal      ScalingReplicaSet   Scaled up replica set nginx-deployment-3066724191 to 1
  ```

  要解决此问题，需要回滚到以前稳定的 Deployment 版本。

### 检查 Deployment 上线历史

按照如下步骤检查回滚历史：

1. 首先，检查 Deployment 修订历史：

   ```shell
   kubectl rollout history deployment.v1.apps/nginx-deployment
   ```

   输出类似于：

   ```shell
   deployments "nginx-deployment"
   REVISION    CHANGE-CAUSE
   1           kubectl apply --filename=https://k8s.io/examples/controllers/nginx-deployment.yaml --record=true
   2           kubectl set image deployment.v1.apps/nginx-deployment nginx=nginx:1.9.1 --record=true
   3           kubectl set image deployment.v1.apps/nginx-deployment nginx=nginx:1.91 --record=true
   ```

   `CHANGE-CAUSE` 的内容是从 Deployment 的 `kubernetes.io/change-cause` 注解复制过来的。 复制动作发生在修订版本创建时。你可以通过以下方式设置 `CHANGE-CAUSE` 消息：

   - 使用 `kubectl annotate deployment.v1.apps/nginx-deployment kubernetes.io/change-cause="image updated to 1.9.1"` 为 Deployment 添加注解。
   - 追加 `--record` 命令行标志以保存正在更改资源的 `kubectl` 命令。
   - 手动编辑资源的清单。

2. 要查看修订历史的详细信息，运行：

   ```shell
   kubectl rollout history deployment.v1.apps/nginx-deployment --revision=2
   ```

   输出类似于：

   ```shell
   deployments "nginx-deployment" revision 2
     Labels:       app=nginx
             pod-template-hash=1159050644
     Annotations:  kubernetes.io/change-cause=kubectl set image deployment.v1.apps/nginx-deployment nginx=nginx:1.16.1 --record=true
     Containers:
      nginx:
       Image:      nginx:1.16.1
       Port:       80/TCP
        QoS Tier:
           cpu:      BestEffort
           memory:   BestEffort
       Environment Variables:      <none>
     No volumes.
   ```

### 回滚到之前的修订版本 

按照下面给出的步骤将 Deployment 从当前版本回滚到以前的版本（即版本 2）。

1. 假定现在你已决定撤消当前上线并回滚到以前的修订版本：

   ```shell
   kubectl rollout undo deployment.v1.apps/nginx-deployment
   ```

   输出类似于：

   ```
   deployment.apps/nginx-deployment
   ```

   或者，你也可以通过使用 `--to-revision` 来回滚到特定修订版本：

   ```shell
   kubectl rollout undo deployment.v1.apps/nginx-deployment --to-revision=2
   ```

   输出类似于：

   ```
   deployment.apps/nginx-deployment
   ```

   与回滚相关的指令的更详细信息，请参考 [`kubectl rollout`](https://kubernetes.io/docs/reference/generated/kubectl/kubectl-commands#rollout)。

   现在，Deployment 正在回滚到以前的稳定版本。正如你所看到的，Deployment 控制器生成了 回滚到修订版本 2 的 `DeploymentRollback` 事件。

2. 检查回滚是否成功以及 Deployment 是否正在运行，运行：

   ```shell
   kubectl get deployment nginx-deployment
   ```

   输出类似于：

   ```shell
   NAME               DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE
   nginx-deployment   3         3         3            3           30m
   ```

3. 获取 Deployment 描述信息：

   ```shell
   kubectl describe deployment nginx-deployment
   ```

   输出类似于：

   ```
   Name:                   nginx-deployment
   Namespace:              default
   CreationTimestamp:      Sun, 02 Sep 2018 18:17:55 -0500
   Labels:                 app=nginx
   Annotations:            deployment.kubernetes.io/revision=4
                           kubernetes.io/change-cause=kubectl set image deployment.v1.apps/nginx-deployment nginx=nginx:1.16.1 --record=true
   Selector:               app=nginx
   Replicas:               3 desired | 3 updated | 3 total | 3 available | 0 unavailable
   StrategyType:           RollingUpdate
   MinReadySeconds:        0
   RollingUpdateStrategy:  25% max unavailable, 25% max surge
   Pod Template:
     Labels:  app=nginx
     Containers:
      nginx:
       Image:        nginx:1.16.1
       Port:         80/TCP
       Host Port:    0/TCP
       Environment:  <none>
       Mounts:       <none>
     Volumes:        <none>
   Conditions:
     Type           Status  Reason
     ----           ------  ------
     Available      True    MinimumReplicasAvailable
     Progressing    True    NewReplicaSetAvailable
   OldReplicaSets:  <none>
   NewReplicaSet:   nginx-deployment-c4747d96c (3/3 replicas created)
   Events:
     Type    Reason              Age   From                   Message
     ----    ------              ----  ----                   -------
     Normal  ScalingReplicaSet   12m   deployment-controller  Scaled up replica set nginx-deployment-75675f5897 to 3
     Normal  ScalingReplicaSet   11m   deployment-controller  Scaled up replica set nginx-deployment-c4747d96c to 1
     Normal  ScalingReplicaSet   11m   deployment-controller  Scaled down replica set nginx-deployment-75675f5897 to 2
     Normal  ScalingReplicaSet   11m   deployment-controller  Scaled up replica set nginx-deployment-c4747d96c to 2
     Normal  ScalingReplicaSet   11m   deployment-controller  Scaled down replica set nginx-deployment-75675f5897 to 1
     Normal  ScalingReplicaSet   11m   deployment-controller  Scaled up replica set nginx-deployment-c4747d96c to 3
     Normal  ScalingReplicaSet   11m   deployment-controller  Scaled down replica set nginx-deployment-75675f5897 to 0
     Normal  ScalingReplicaSet   11m   deployment-controller  Scaled up replica set nginx-deployment-595696685f to 1
     Normal  DeploymentRollback  15s   deployment-controller  Rolled back deployment "nginx-deployment" to revision 2
     Normal  ScalingReplicaSet   15s   deployment-controller  Scaled down replica set nginx-deployment-595696685f to 0
   ```

## 缩放 Deployment

你可以使用如下指令缩放 Deployment：

```shell
kubectl scale deployment.v1.apps/nginx-deployment --replicas=10
```

输出类似于：

```
deployment.apps/nginx-deployment scaled
```

假设集群启用了[Pod 的水平自动缩放](https://kubernetes.io/zh/docs/tasks/run-application/horizontal-pod-autoscale-walkthrough/)， 你可以为 Deployment 设置自动缩放器，并基于现有 Pods 的 CPU 利用率选择 要运行的 Pods 个数下限和上限。

```shell
kubectl autoscale deployment.v1.apps/nginx-deployment --min=10 --max=15 --cpu-percent=80
```

输出类似于：

```
deployment.apps/nginx-deployment scaled
```

### 比例缩放 

RollingUpdate 的 Deployment 支持同时运行应用程序的多个版本。 当自动缩放器缩放处于上线进程（仍在进行中或暂停）中的 RollingUpdate Deployment 时， Deployment 控制器会平衡现有的活跃状态的 ReplicaSets（含 Pods 的 ReplicaSets）中的额外副本， 以降低风险。这称为 *比例缩放（Proportional Scaling）*。

例如，你正在运行一个 10 个副本的 Deployment，其 [maxSurge](https://kubernetes.io/zh/docs/concepts/workloads/controllers/deployment/#max-surge)=3，[maxUnavailable](https://kubernetes.io/zh/docs/concepts/workloads/controllers/deployment/#max-unavailable)=2。

- 确保 Deployment 的这 10 个副本都在运行。

  ```shell
  kubectl get deploy
  ```

  输出类似于：

  ```
  NAME                 DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE
  nginx-deployment     10        10        10           10          50s
  ```

- 更新 Deployment 使用新镜像，碰巧该镜像无法从集群内部解析。

  ```shell
  kubectl set image deployment.v1.apps/nginx-deployment nginx=nginx:sometag
  ```

  输出类似于：

  ```
  deployment.apps/nginx-deployment image updated
  ```

- 镜像更新使用 ReplicaSet `nginx-deployment-1989198191` 启动新的上线过程， 但由于上面提到的 `maxUnavailable` 要求，该进程被阻塞了。检查上线状态：

  ```shell
  kubectl get rs
  ```

  输出类似于：

  ```
  NAME                          DESIRED   CURRENT   READY     AGE
  nginx-deployment-1989198191   5         5         0         9s
  nginx-deployment-618515232    8         8         8         1m
  ```

- 然后，出现了新的 Deployment 扩缩请求。自动缩放器将 Deployment 副本增加到 15。 Deployment 控制器需要决定在何处添加 5 个新副本。如果未使用比例缩放，所有 5 个副本 都将添加到新的 ReplicaSet 中。使用比例缩放时，可以将额外的副本分布到所有 ReplicaSet。 较大比例的副本会被添加到拥有最多副本的 ReplicaSet，而较低比例的副本会进入到 副本较少的 ReplicaSet。所有剩下的副本都会添加到副本最多的 ReplicaSet。 具有零副本的 ReplicaSets 不会被扩容。

在上面的示例中，3 个副本被添加到旧 ReplicaSet 中，2 个副本被添加到新 ReplicaSet。 假定新的副本都很健康，上线过程最终应将所有副本迁移到新的 ReplicaSet 中。 要确认这一点，请运行：

```shell
kubectl get deploy
```

输出类似于：

```
NAME                 DESIRED   CURRENT   UP-TO-DATE   AVAILABLE   AGE
nginx-deployment     15        18        7            8           7m
```

上线状态确认了副本是如何被添加到每个 ReplicaSet 的。

```shell
kubectl get rs
```

输出类似于：

```shell
NAME                          DESIRED   CURRENT   READY     AGE
nginx-deployment-1989198191   7         7         0         7m
nginx-deployment-618515232    11        11        11        7m
```

## Deployment 状态

Deployment 的生命周期中会有许多状态。上线新的 ReplicaSet 期间可能处于 [Progressing（进行中）](https://kubernetes.io/zh/docs/concepts/workloads/controllers/deployment/#progressing-deployment)，可能是 [Complete（已完成）](https://kubernetes.io/zh/docs/concepts/workloads/controllers/deployment/#complete-deployment)，也可能是 [Failed（失败）](https://kubernetes.io/zh/docs/concepts/workloads/controllers/deployment/#failed-deployment)以至于无法继续进行。

### 进行中的 Deployment 

执行下面的任务期间，Kubernetes 标记 Deployment 为 *进行中（Progressing）*：

- Deployment 创建新的 ReplicaSet
- Deployment 正在为其最新的 ReplicaSet 扩容
- Deployment 正在为其旧有的 ReplicaSet(s) 缩容
- 新的 Pods 已经就绪或者可用（就绪至少持续了 [MinReadySeconds](https://kubernetes.io/zh/docs/concepts/workloads/controllers/deployment/#min-ready-seconds) 秒）。

你可以使用 `kubectl rollout status` 监视 Deployment 的进度。

### 完成的 Deployment 

当 Deployment 具有以下特征时，Kubernetes 将其标记为 *完成（Complete）*：

- 与 Deployment 关联的所有副本都已更新到指定的最新版本，这意味着之前请求的所有更新都已完成。
- 与 Deployment 关联的所有副本都可用。
- 未运行 Deployment 的旧副本。

你可以使用 `kubectl rollout status` 检查 Deployment 是否已完成。 如果上线成功完成，`kubectl rollout status` 返回退出代码 0。

```shell
kubectl rollout status deployment/nginx-deployment
```

输出类似于：

```shell
Waiting for rollout to finish: 2 of 3 updated replicas are available...
deployment "nginx-deployment" successfully rolled out
$ echo $?
0
```

### 失败的 Deployment 

你的 Deployment 可能会在尝试部署其最新的 ReplicaSet 受挫，一直处于未完成状态。 造成此情况一些可能因素如下：

- 配额（Quota）不足
- 就绪探测（Readiness Probe）失败
- 镜像拉取错误
- 权限不足
- 限制范围（Limit Ranges）问题
- 应用程序运行时的配置错误

检测此状况的一种方法是在 Deployment 规约中指定截止时间参数： （[`.spec.progressDeadlineSeconds`]（#progress-deadline-seconds））。 `.spec.progressDeadlineSeconds` 给出的是一个秒数值，Deployment 控制器在（通过 Deployment 状态） 标示 Deployment 进展停滞之前，需要等待所给的时长。

以下 `kubectl` 命令设置规约中的 `progressDeadlineSeconds`，从而告知控制器 在 10 分钟后报告 Deployment 没有进展：

```shell
kubectl patch deployment.v1.apps/nginx-deployment -p '{"spec":{"progressDeadlineSeconds":600}}'
```

输出类似于：

```
deployment.apps/nginx-deployment patched
```

超过截止时间后，Deployment 控制器将添加具有以下属性的 DeploymentCondition 到 Deployment 的 `.status.conditions` 中：

- Type=Progressing
- Status=False
- Reason=ProgressDeadlineExceeded

Deployment 可能会出现瞬时性的错误，可能因为设置的超时时间过短， 也可能因为其他可认为是临时性的问题。



### 对失败 Deployment 的操作 

可应用于已完成的 Deployment 的所有操作也适用于失败的 Deployment。 你可以对其执行扩缩容、回滚到以前的修订版本等操作，或者在需要对 Deployment 的 Pod 模板应用多项调整时，将 Deployment 暂停。



## 清理策略 

你可以在 Deployment 中设置 `.spec.revisionHistoryLimit` 字段以指定保留此 Deployment 的多少个旧有 ReplicaSet。其余的 ReplicaSet 将在后台被垃圾回收。 默认情况下，此值为 10。

**说明：** 显式将此字段设置为 0 将导致 Deployment 的所有历史记录被清空，因此 Deployment 将无法回滚。

## 金丝雀部署

如果要使用 Deployment 向用户子集或服务器子集上线版本，则可以遵循 [资源管理](https://kubernetes.io/zh/docs/concepts/cluster-administration/manage-deployment/#canary-deployments) 所描述的金丝雀模式，创建多个 Deployment，每个版本一个。

## 编写 Deployment 规约 

同其他 Kubernetes 配置一样， Deployment 需要 `apiVersion`，`kind` 和 `metadata` 字段。 有关配置文件的其他信息，请参考 [部署 Deployment ](https://kubernetes.io/zh/docs/tasks/run-application/run-stateless-application-deployment/)、配置容器和 [使用 kubectl 管理资源](https://kubernetes.io/zh/docs/concepts/overview/working-with-objects/object-management/)等相关文档。

Deployment 对象的名称必须是合法的 [DNS 子域名](https://kubernetes.io/zh/docs/concepts/overview/working-with-objects/names#dns-subdomain-names)。 Deployment 还需要 [`.spec` 部分](https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status)。

### Pod 模板 

`.spec` 中只有 `.spec.template` 和 `.spec.selector` 是必需的字段。

`.spec.template` 是一个 [Pod 模板](https://kubernetes.io/zh/docs/concepts/workloads/pods/#pod-templates)。 它和 [Pod](https://kubernetes.io/docs/concepts/workloads/pods/pod-overview/) 的语法规则完全相同。 只是这里它是嵌套的，因此不需要 `apiVersion` 或 `kind`。

除了 Pod 的必填字段外，Deployment 中的 Pod 模板必须指定适当的标签和适当的重新启动策略。 对于标签，请确保不要与其他控制器重叠。请参考[选择算符](https://kubernetes.io/zh/docs/concepts/workloads/controllers/deployment/#selector)。

只有 [`.spec.template.spec.restartPolicy`](https://kubernetes.io/zh/docs/concepts/workloads/pods/pod-lifecycle/#restart-policy) 等于 `Always` 才是被允许的，这也是在没有指定时的默认设置。

### 副本 

`.spec.replicas` 是指定所需 Pod 的可选字段。它的默认值是1。

### 选择算符 

`.spec.selector` 是指定本 Deployment 的 Pod [标签选择算符](https://kubernetes.io/zh/docs/concepts/overview/working-with-objects/labels/)的必需字段。

`.spec.selector` 必须匹配 `.spec.template.metadata.labels`，否则请求会被 API 拒绝。

在 API `apps/v1`版本中，`.spec.selector` 和 `.metadata.labels` 如果没有设置的话， 不会被默认设置为 `.spec.template.metadata.labels`，所以需要明确进行设置。 同时在 `apps/v1`版本中，Deployment 创建后 `.spec.selector` 是不可变的。

当 Pod 的标签和选择算符匹配，但其模板和 `.spec.template` 不同时，或者此类 Pod 的总数超过 `.spec.replicas` 的设置时，Deployment 会终结之。 如果 Pods 总数未达到期望值，Deployment 会基于 `.spec.template` 创建新的 Pod。

### 策略 

`.spec.strategy` 策略指定用于用新 Pods 替换旧 Pods 的策略。 `.spec.strategy.type` 可以是 “Recreate” 或 “RollingUpdate”。“RollingUpdate” 是默认值。

#### 重新创建 Deployment 

如果 `.spec.strategy.type==Recreate`，在创建新 Pods 之前，所有现有的 Pods 会被杀死。

#### 滚动更新 Deployment 

Deployment 会在 `.spec.strategy.type==RollingUpdate`时，采取 滚动更新的方式更新 Pods。你可以指定 `maxUnavailable` 和 `maxSurge` 来控制滚动更新 过程。

##### 最大不可用 

`.spec.strategy.rollingUpdate.maxUnavailable` 是一个可选字段，用来指定 更新过程中不可用的 Pod 的个数上限。该值可以是绝对数字（例如，5），也可以是 所需 Pods 的百分比（例如，10%）。百分比值会转换成绝对数并去除小数部分。 如果 `.spec.strategy.rollingUpdate.maxSurge` 为 0，则此值不能为 0。 默认值为 25%。

例如，当此值设置为 30% 时，滚动更新开始时会立即将旧 ReplicaSet 缩容到期望 Pod 个数的70%。 新 Pod 准备就绪后，可以继续缩容旧有的 ReplicaSet，然后对新的 ReplicaSet 扩容，确保在更新期间 可用的 Pods 总数在任何时候都至少为所需的 Pod 个数的 70%。

##### 最大峰值 

`.spec.strategy.rollingUpdate.maxSurge` 是一个可选字段，用来指定可以创建的超出 期望 Pod 个数的 Pod 数量。此值可以是绝对数（例如，5）或所需 Pods 的百分比（例如，10%）。 如果 `MaxUnavailable` 为 0，则此值不能为 0。百分比值会通过向上取整转换为绝对数。 此字段的默认值为 25%。

例如，当此值为 30% 时，启动滚动更新后，会立即对新的 ReplicaSet 扩容，同时保证新旧 Pod 的总数不超过所需 Pod 总数的 130%。一旦旧 Pods 被杀死，新的 ReplicaSet 可以进一步扩容， 同时确保更新期间的任何时候运行中的 Pods 总数最多为所需 Pods 总数的 130%。

### 进度期限秒数 

`.spec.progressDeadlineSeconds` 是一个可选字段，用于指定系统在报告 Deployment [进展失败](https://kubernetes.io/zh/docs/concepts/workloads/controllers/deployment/#failed-deployment) 之前等待 Deployment 取得进展的秒数。 这类报告会在资源状态中体现为 `Type=Progressing`、`Status=False`、 `Reason=ProgressDeadlineExceeded`。Deployment 控制器将持续重试 Deployment。 将来，一旦实现了自动回滚，Deployment 控制器将在探测到这样的条件时立即回滚 Deployment。

如果指定，则此字段值需要大于 `.spec.minReadySeconds` 取值。

### 最短就绪时间 

`.spec.minReadySeconds` 是一个可选字段，用于指定新创建的 Pod 在没有任意容器崩溃情况下的最小就绪时间， 只有超出这个时间 Pod 才被视为可用。默认值为 0（Pod 在准备就绪后立即将被视为可用）。 要了解何时 Pod 被视为就绪，可参考[容器探针](https://kubernetes.io/zh/docs/concepts/workloads/pods/pod-lifecycle/#container-probes)。

### 修订历史限制

Deployment 的修订历史记录存储在它所控制的 ReplicaSets 中。

`.spec.revisionHistoryLimit` 是一个可选字段，用来设定出于会滚目的所要保留的旧 ReplicaSet 数量。 这些旧 ReplicaSet 会消耗 etcd 中的资源，并占用 `kubectl get rs` 的输出。 每个 Deployment 修订版本的配置都存储在其 ReplicaSets 中；因此，一旦删除了旧的 ReplicaSet， 将失去回滚到 Deployment 的对应修订版本的能力。 默认情况下，系统保留 10 个旧 ReplicaSet，但其理想值取决于新 Deployment 的频率和稳定性。

更具体地说，将此字段设置为 0 意味着将清理所有具有 0 个副本的旧 ReplicaSet。 在这种情况下，无法撤消新的 Deployment 上线，因为它的修订历史被清除了。

### paused（暂停的） 

`.spec.paused` 是用于暂停和恢复 Deployment 的可选布尔字段。 暂停的 Deployment 和未暂停的 Deployment 的唯一区别是，Deployment 处于暂停状态时， PodTemplateSpec 的任何修改都不会触发新的上线。 Deployment 在创建时是默认不会处于暂停状态。



# ReplicaSet

ReplicaSet 的目的是**维护一组在任何时候都处于运行状态的 Pod 副本的稳定集合**。 因此，它通常用来保证给定数量的、完全相同的 Pod 的可用性。

## ReplicaSet 的工作原理

RepicaSet 是通过一组字段来定义的，包括一个用来识别可获得的 Pod 的集合的选择算符、一个用来标明应该维护的副本个数的数值、一个用来指定应该创建新 Pod 以满足副本个数条件时要使用的 Pod 模板等等。 每个 ReplicaSet 都通过根据需要创建和 删除 Pod 以使得副本个数达到期望值， 进而实现其存在价值。当 ReplicaSet 需要创建新的 Pod 时，会使用所提供的 Pod 模板。

ReplicaSet 通过 Pod 上的 [metadata.ownerReferences](https://kubernetes.io/zh/docs/concepts/workloads/controllers/garbage-collection/#owners-and-dependents) 字段连接到附属 Pod，该字段给出当前对象的属主资源。 ReplicaSet 所获得的 Pod 都在其 ownerReferences 字段中包含了属主 ReplicaSet 的标识信息。正是通过这一连接，ReplicaSet 知道它所维护的 Pod 集合的状态， 并据此计划其操作行为。

ReplicaSet 使用其选择算符来辨识要获得的 Pod 集合。如果某个 Pod 没有 OwnerReference 或者其 OwnerReference 不是一个 [控制器](https://kubernetes.io/zh/docs/concepts/architecture/controller/)，且其匹配到 某 ReplicaSet 的选择算符，则该 Pod 立即被此 ReplicaSet 获得。

## 何时使用 ReplicaSet

ReplicaSet 确保任何时间都有指定数量的 Pod 副本在运行。 然而，Deployment 是一个更高级的概念，它管理 ReplicaSet，并向 Pod 提供声明式的更新以及许多其他有用的功能。 因此，我们**建议使用 Deployment 而不是直接使用 ReplicaSet，除非 你需要自定义更新业务流程或根本不需要更新。**

这实际上意味着，你**可能永远不需要操作 ReplicaSet 对象：而是使用 Deployment，并在 spec 部分定义你的应用**。

## 示例

```yaml
apiVersion: apps/v1
kind: ReplicaSet
metadata:
  name: frontend
  labels:
    app: guestbook
    tier: frontend
spec:
  # modify replicas according to your case
  replicas: 3
  selector:
    matchLabels:
      tier: frontend
  template:
    metadata:
      labels:
        tier: frontend
    spec:
      containers:
      - name: php-redis
        image: gcr.io/google_samples/gb-frontend:v3
```

将此清单保存到 `frontend.yaml` 中，并将其提交到 Kubernetes 集群， 应该就能创建 yaml 文件所定义的 ReplicaSet 及其管理的 Pod。

```shell
kubectl apply -f https://kubernetes.io/examples/controllers/frontend.yaml
```

你可以看到当前被部署的 ReplicaSet：

```shell
kubectl get rs
```

并看到你所创建的前端：

```
NAME       DESIRED   CURRENT   READY   AGE
frontend   3         3         3       6s
```

你也可以查看 ReplicaSet 的状态：

```shell
kubectl describe rs/frontend
```

你会看到类似如下的输出：

```
Name:		frontend
Namespace:	default
Selector:	tier=frontend
Labels:		app=guestbook
		tier=frontend
Annotations:  kubectl.kubernetes.io/last-applied-configuration:
                {"apiVersion":"apps/v1","kind":"ReplicaSet","metadata":{"annotations":{},"labels":{"app":"guestbook","tier":"frontend"},"name":"frontend",...
Replicas:	3 current / 3 desired
Pods Status:	3 Running / 0 Waiting / 0 Succeeded / 0 Failed
Pod Template:
  Labels:       tier=frontend
  Containers:
   php-redis:
    Image:      gcr.io/google_samples/gb-frontend:v3
    Port:         <none>
    Host Port:    <none>
    Environment:  <none>
    Mounts:             <none>
  Volumes:              <none>
Events:
  Type    Reason            Age   From                   Message
  ----    ------            ----  ----                   -------
  Normal  SuccessfulCreate  117s  replicaset-controller  Created pod: frontend-wtsmm
  Normal  SuccessfulCreate  116s  replicaset-controller  Created pod: frontend-b2zdv
  Normal  SuccessfulCreate  116s  replicaset-controller  Created pod: frontend-vcmts
```

最后可以查看启动了的 Pods：

```shell
kubectl get pods
```

你会看到类似如下的 Pod 信息：

```
NAME             READY   STATUS    RESTARTS   AGE
frontend-b2zdv   1/1     Running   0          6m36s
frontend-vcmts   1/1     Running   0          6m36s
frontend-wtsmm   1/1     Running   0          6m36s
```

你也可以查看 Pods 的属主引用被设置为前端的 ReplicaSet。 要实现这点，可取回运行中的 Pods 之一的 YAML：

```shell
kubectl get pods frontend-b2zdv -o yaml
```

输出将类似这样，frontend ReplicaSet 的信息被设置在 metadata 的 `ownerReferences` 字段中：

```yaml
apiVersion: v1
kind: Pod
metadata:
  creationTimestamp: "2020-02-12T07:06:16Z"
  generateName: frontend-
  labels:
    tier: frontend
  name: frontend-b2zdv
  namespace: default
  ownerReferences:
  - apiVersion: apps/v1
    blockOwnerDeletion: true
    controller: true
    kind: ReplicaSet
    name: frontend
    uid: f391f6db-bb9b-4c09-ae74-6a1f77f3d5cf
...
```

## 编写 ReplicaSet 的 spec

与所有其他 Kubernetes API 对象一样，ReplicaSet 也需要 `apiVersion`、`kind`、和 `metadata` 字段。 对于 ReplicaSets 而言，其 `kind` 始终是 ReplicaSet。 在 Kubernetes 1.9 中，ReplicaSet 上的 API 版本 `apps/v1` 是其当前版本，且被 默认启用。API 版本 `apps/v1beta2` 已被废弃。 参考 `frontend.yaml` 示例的第一行。

ReplicaSet 对象的名称必须是合法的 [DNS 子域名](https://kubernetes.io/zh/docs/concepts/overview/working-with-objects/names#dns-subdomain-names)。

ReplicaSet 也需要 [`.spec`](https://git.k8s.io/community/contributors/devel/api-conventions.md#spec-and-status) 部分。

### Pod 模版

`.spec.template` 是一个[Pod 模版](https://kubernetes.io/zh/docs/concepts/workloads/pods/#pod-templates)， 要求设置标签。在 `frontend.yaml` 示例中，我们指定了标签 `tier: frontend`。 注意不要将标签与其他控制器的选择算符重叠，否则那些控制器会尝试收养此 Pod。

对于模板的[重启策略](https://kubernetes.io/zh/docs/concepts/workloads/pods/pod-lifecycle/#restart-policy) 字段，`.spec.template.spec.restartPolicy`，唯一允许的取值是 `Always`，这也是默认值.

### Pod 选择算符 

`.spec.selector` 字段是一个[标签选择算符](https://kubernetes.io/zh/docs/concepts/overview/working-with-objects/labels/)。 如前文中[所讨论的](https://kubernetes.io/zh/docs/concepts/workloads/controllers/replicaset/#how-a-replicaset-works)，这些是用来标识要被获取的 Pods 的标签。在签名的 `frontend.yaml` 示例中，选择算符为：

```yaml
matchLabels:
  tier: frontend
```

在 ReplicaSet 中，`.spec.template.metadata.labels` 的值必须与 `spec.selector` 值 相匹配，否则该配置会被 API 拒绝。



> 对于设置了相同的 `.spec.selector`，但 `.spec.template.metadata.labels` 和 `.spec.template.spec` 字段不同的 两个 ReplicaSet 而言，每个 ReplicaSet 都会忽略被另一个 ReplicaSet 所 创建的 Pods。

### Replicas

你可以通过设置 `.spec.replicas` 来指定要同时运行的 Pod 个数。 ReplicaSet 创建、删除 Pods 以与此值匹配。

如果你没有指定 `.spec.replicas`, 那么默认值为 1。

## 使用 ReplicaSets

### 删除 ReplicaSet 和它的 Pod

要删除 ReplicaSet 和它的所有 Pod，使用 [`kubectl delete`](https://kubernetes.io/docs/reference/generated/kubectl/kubectl-commands#delete) 命令。 默认情况下，[垃圾收集器](https://kubernetes.io/zh/docs/concepts/workloads/controllers/garbage-collection/) 自动删除所有依赖的 Pod。

当使用 REST API 或 `client-go` 库时，你必须在删除选项中将 `propagationPolicy` 设置为 `Background` 或 `Foreground`。例如：

```shell
kubectl proxy --port=8080
curl -X DELETE  'localhost:8080/apis/apps/v1/namespaces/default/replicasets/frontend' \
   -d '{"kind":"DeleteOptions","apiVersion":"v1","propagationPolicy":"Foreground"}' \
   -H "Content-Type: application/json"
```

### 只删除 ReplicaSet

你可以只删除 ReplicaSet 而不影响它的 Pods，方法是使用 [`kubectl delete`](https://kubernetes.io/docs/reference/generated/kubectl/kubectl-commands#delete) 命令并设置 `--cascade=orphan` 选项。

当使用 REST API 或 `client-go` 库时，你必须将 `propagationPolicy` 设置为 `Orphan`。 例如：

```shell
kubectl proxy --port=8080
curl -X DELETE  'localhost:8080/apis/apps/v1/namespaces/default/replicasets/frontend' \
  -d '{"kind":"DeleteOptions","apiVersion":"v1","propagationPolicy":"Orphan"}' \
  -H "Content-Type: application/json"
```

一旦删除了原来的 ReplicaSet，就可以创建一个新的来替换它。 由于新旧 ReplicaSet 的 `.spec.selector` 是相同的，新的 ReplicaSet 将接管老的 Pod。 但是，它不会努力使现有的 Pod 与新的、不同的 Pod 模板匹配。 若想要以可控的方式更新 Pod 的规约，可以使用 [Deployment](https://kubernetes.io/zh/docs/concepts/workloads/controllers/deployment/#creating-a-deployment) 资源，因为 ReplicaSet 并不直接支持滚动更新。

### 将 Pod 从 ReplicaSet 中隔离

可以通过改变标签来从 ReplicaSet 的目标集中移除 Pod。 这种技术可以用来从服务中去除 Pod，以便进行排错、数据恢复等。 以这种方式移除的 Pod 将被自动替换（假设副本的数量没有改变）。

### 缩放 RepliaSet

通过更新 `.spec.replicas` 字段，ReplicaSet 可以被轻松的进行缩放。ReplicaSet 控制器能确保匹配标签选择器的数量的 Pod 是可用的和可操作的。

在降低集合规模时，ReplicaSet 控制器通过对可用的 Pods 进行排序来优先选择 要被删除的 Pods。其一般性算法如下：

1. 首先选择剔除悬决（Pending，且不可调度）的 Pods
2. 如果设置了 `controller.kubernetes.io/pod-deletion-cost` 注解，则注解值 较小的优先被裁减掉
3. 所处节点上副本个数较多的 Pod 优先于所处节点上副本较少者
4. 如果 Pod 的创建时间不同，最近创建的 Pod 优先于早前创建的 Pod 被裁减。 （当 `LogarithmicScaleDown` 这一 [特性门控](https://kubernetes.io/zh/docs/reference/command-line-tools-reference/feature-gates/) 被启用时，创建时间是按整数幂级来分组的）。

如果以上比较结果都相同，则随机选择。

### Pod 删除开销 

**FEATURE STATE:** `Kubernetes v1.22 [beta]`

通过使用 [`controller.kubernetes.io/pod-deletion-cost`](https://kubernetes.io/zh/docs/reference/labels-annotations-taints/#pod-deletion-cost) 注解，用户可以对 ReplicaSet 缩容时要先删除哪些 Pods 设置偏好。

此注解要设置到 Pod 上，取值范围为 [-2147483647, 2147483647]。 所代表的的是删除同一 ReplicaSet 中其他 Pod 相比较而言的开销。 删除开销较小的 Pods 比删除开销较高的 Pods 更容易被删除。

Pods 如果未设置此注解，则隐含的设置值为 0。负值也是可接受的。 如果注解值非法，API 服务器会拒绝对应的 Pod。

此功能特性处于 Beta 阶段，默认被禁用。你可以通过为 kube-apiserver 和 kube-controller-manager 设置 [特性门控](https://kubernetes.io/zh/docs/reference/command-line-tools-reference/feature-gates/) `PodDeletionCost` 来启用此功能。

**说明：**

- 此机制实施时仅是尽力而为，并不能对 Pod 的删除顺序作出任何保证；
- 用户应避免频繁更新注解值，例如根据某观测度量值来更新此注解值是应该避免的。 这样做会在 API 服务器上产生大量的 Pod 更新操作。

#### 使用场景示例

同一应用的不同 Pods 可能其利用率是不同的。在对应用执行缩容操作时，可能 希望移除利用率较低的 Pods。为了避免频繁更新 Pods，应用应该在执行缩容 操作之前更新一次 `controller.kubernetes.io/pod-deletion-cost` 注解值 （将注解值设置为一个与其 Pod 利用率对应的值）。 如果应用自身控制器缩容操作时（例如 Spark 部署的驱动 Pod），这种机制 是可以起作用的。

### ReplicaSet 作为水平的 Pod 自动缩放器目标

ReplicaSet 也可以作为 [水平的 Pod 缩放器 (HPA)](https://kubernetes.io/zh/docs/tasks/run-application/horizontal-pod-autoscale/) 的目标。也就是说，ReplicaSet 可以被 HPA 自动缩放。 以下是 HPA 以我们在前一个示例中创建的副本集为目标的示例。

[`controllers/hpa-rs.yaml` ](https://raw.githubusercontent.com/kubernetes/website/main/content/zh/examples/controllers/hpa-rs.yaml)![Copy controllers/hpa-rs.yaml to clipboard](https://d33wubrfki0l68.cloudfront.net/0901162ab78eb4ff2e9e5dc8b17c3824befc91a6/44ccd/images/copycode.svg)

```yaml
apiVersion: autoscaling/v1
kind: HorizontalPodAutoscaler
metadata:
  name: frontend-scaler
spec:
  scaleTargetRef:
    kind: ReplicaSet
    name: frontend
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 50
```

将这个列表保存到 `hpa-rs.yaml` 并提交到 Kubernetes 集群，就能创建它所定义的 HPA，进而就能根据复制的 Pod 的 CPU 利用率对目标 ReplicaSet进行自动缩放。

```shell
kubectl apply -f https://k8s.io/examples/controllers/hpa-rs.yaml
```

或者，可以使用 `kubectl autoscale` 命令完成相同的操作。 (而且它更简单！)

```shell
kubectl autoscale rs frontend --max=10 --min=3 --cpu-percent=50
```

## ReplicaSet 的替代方案

### Deployment （推荐）

[`Deployment`](https://kubernetes.io/zh/docs/concepts/workloads/controllers/deployment/) 是一个 可以拥有 ReplicaSet 并使用声明式方式在服务器端完成对 Pods 滚动更新的对象。 尽管 ReplicaSet 可以独立使用，目前它们的主要用途是提供给 Deployment 作为 编排 Pod 创建、删除和更新的一种机制。当使用 Deployment 时，你不必关心 如何管理它所创建的 ReplicaSet，Deployment 拥有并管理其 ReplicaSet。 因此，建议你在需要 ReplicaSet 时使用 Deployment。

### 裸 Pod

与用户直接创建 Pod 的情况不同，ReplicaSet 会替换那些由于某些原因被删除或被终止的 Pod，例如在节点故障或破坏性的节点维护（如内核升级）的情况下。 因为这个原因，我们建议你使用 ReplicaSet，即使应用程序只需要一个 Pod。 想像一下，ReplicaSet 类似于进程监视器，只不过它在多个节点上监视多个 Pod， 而不是在单个节点上监视单个进程。 ReplicaSet 将本地容器重启的任务委托给了节点上的某个代理（例如，Kubelet 或 Docker）去完成。

### Job

使用[`Job`](https://kubernetes.io/zh/docs/concepts/workloads/controllers/job/) 代替ReplicaSet， 可以用于那些期望自行终止的 Pod。

### DaemonSet

对于管理那些提供主机级别功能（如主机监控和主机日志）的容器， 就要用 [`DaemonSet`](https://kubernetes.io/zh/docs/concepts/workloads/controllers/daemonset/) 而不用 ReplicaSet。 这些 Pod 的寿命与主机寿命有关：这些 Pod 需要先于主机上的其他 Pod 运行， 并且在机器准备重新启动/关闭时安全地终止。

### ReplicationController

ReplicaSet 是 [ReplicationController](https://kubernetes.io/zh/docs/concepts/workloads/controllers/replicationcontroller/) 的后继者。二者目的相同且行为类似，只是 ReplicationController 不支持 [标签用户指南](https://kubernetes.io/zh/docs/concepts/overview/working-with-objects/labels/#label-selectors) 中讨论的基于集合的选择算符需求。 因此，相比于 ReplicationController，应优先考虑 ReplicaSet。

# StatefulSets

StatefulSet 是用来**管理有状态应用的工作负载 API 对象**。

StatefulSet 用来管理某 [Pod](https://kubernetes.io/docs/concepts/workloads/pods/pod-overview/) 集合的部署和扩缩， 并为这些 Pod 提供持久存储和持久标识符。

和 [Deployment](https://kubernetes.io/zh/docs/concepts/workloads/controllers/deployment/) 类似， StatefulSet 管理基于相同容器规约的一组 Pod。但和 Deployment 不同的是， StatefulSet 为它们的每个 Pod 维护了一个有粘性的 ID。这些 Pod 是基于相同的规约来创建的， 但是不能相互替换：**无论怎么调度，每个 Pod 都有一个永久不变的 ID**。

如果希望使用存储卷为工作负载提供持久存储，可以使用 StatefulSet 作为解决方案的一部分。 尽管 StatefulSet 中的单个 Pod 仍可能出现故障， 但持久的 Pod 标识符使得将现有卷与替换已失败 Pod 的新 Pod 相匹配变得更加容易。

## 使用 StatefulSets

StatefulSets 对于需要满足以下一个或多个需求的应用程序很有价值：

- 稳定的、唯一的网络标识符。
- 稳定的、持久的存储。
- 有序的、优雅的部署和缩放。
- 有序的、自动的滚动更新。

在上面描述中，“稳定的”意味着 Pod 调度或重调度的整个过程是有持久性的。 如果应用程序不需要任何稳定的标识符或有序的部署、删除或伸缩，则应该使用 由一组无状态的副本控制器提供的工作负载来部署应用程序，比如 [Deployment](https://kubernetes.io/zh/docs/concepts/workloads/controllers/deployment/) 或者 [ReplicaSet](https://kubernetes.io/zh/docs/concepts/workloads/controllers/replicaset/) 可能更适用于你的无状态应用部署需要。

## 限制 

- 给定 Pod 的存储必须由 [PersistentVolume 驱动](https://github.com/kubernetes/examples/tree/master/staging/persistent-volume-provisioning/README.md) 基于所请求的 `storage class` 来提供，或者由管理员预先提供。
- 删除或者收缩 StatefulSet 并*不会*删除它关联的存储卷。 这样做是为了保证数据安全，它通常比自动清除 StatefulSet 所有相关的资源更有价值。
- StatefulSet 当前需要[无头服务](https://kubernetes.io/zh/docs/concepts/services-networking/service/#headless-services) 来负责 Pod 的网络标识。你需要负责创建此服务。
- 当删除 StatefulSets 时，StatefulSet 不提供任何终止 Pod 的保证。 为了实现 StatefulSet 中的 Pod 可以有序地且体面地终止，可以在删除之前将 StatefulSet 缩放为 0。
- 在默认 [Pod 管理策略](https://kubernetes.io/zh/docs/concepts/workloads/controllers/statefulset/#pod-management-policies)(`OrderedReady`) 时使用 [滚动更新](https://kubernetes.io/zh/docs/concepts/workloads/controllers/statefulset/#rolling-updates)，可能进入需要[人工干预](https://kubernetes.io/zh/docs/concepts/workloads/controllers/statefulset/#forced-rollback) 才能修复的损坏状态。

## 组件 

下面的示例演示了 StatefulSet 的组件。

```yaml
apiVersion: v1
kind: Service
metadata:
  name: nginx
  labels:
    app: nginx
spec:
  ports:
  - port: 80
    name: web
  clusterIP: None
  selector:
    app: nginx
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: web
spec:
  selector:
    matchLabels:
      app: nginx # has to match .spec.template.metadata.labels
  serviceName: "nginx"
  replicas: 3 # by default is 1
  template:
    metadata:
      labels:
        app: nginx # has to match .spec.selector.matchLabels
    spec:
      terminationGracePeriodSeconds: 10
      containers:
      - name: nginx
        image: k8s.gcr.io/nginx-slim:0.8
        ports:
        - containerPort: 80
          name: web
        volumeMounts:
        - name: www
          mountPath: /usr/share/nginx/html
  volumeClaimTemplates:
  - metadata:
      name: www
    spec:
      accessModes: [ "ReadWriteOnce" ]
      storageClassName: "my-storage-class"
      resources:
        requests:
          storage: 1Gi
```

上述例子中：

- 名为 `nginx` 的 Headless Service 用来控制网络域名。
- 名为 `web` 的 StatefulSet 有一个 Spec，它表明将在独立的 3 个 Pod 副本中启动 nginx 容器。
- `volumeClaimTemplates` 将通过 PersistentVolumes 驱动提供的 [PersistentVolumes](https://kubernetes.io/zh/docs/concepts/storage/persistent-volumes/) 来提供稳定的存储。

StatefulSet 的命名需要遵循[DNS 子域名](https://kubernetes.io/zh/docs/concepts/overview/working-with-objects/names#dns-subdomain-names)规范。

## Pod 选择算符 

你必须设置 StatefulSet 的 `.spec.selector` 字段，使之匹配其在 `.spec.template.metadata.labels` 中设置的标签。在 Kubernetes 1.8 版本之前， 被忽略 `.spec.selector` 字段会获得默认设置值。 在 1.8 和以后的版本中，未指定匹配的 Pod 选择器将在创建 StatefulSet 期间导致验证错误。

## Pod 标识 

StatefulSet Pod 具有唯一的标识，该标识包括顺序标识、稳定的网络标识和稳定的存储。 该标识和 Pod 是绑定的，不管它被调度在哪个节点上。

### 有序索引 

对于具有 N 个副本的 StatefulSet，StatefulSet 中的每个 Pod 将被分配一个整数序号， 从 0 到 N-1，该序号在 StatefulSet 上是唯一的。

### 稳定的网络 ID 

StatefulSet 中的每个 Pod 根据 StatefulSet 的名称和 Pod 的序号派生出它的主机名。 组合主机名的格式为`$(StatefulSet 名称)-$(序号)`。 上例将会创建三个名称分别为 `web-0、web-1、web-2` 的 Pod。 StatefulSet 可以使用 [无头服务](https://kubernetes.io/zh/docs/concepts/services-networking/service/#headless-services) 控制它的 Pod 的网络域。管理域的这个服务的格式为： `$(服务名称).$(命名空间).svc.cluster.local`，其中 `cluster.local` 是集群域。 一旦每个 Pod 创建成功，就会得到一个匹配的 DNS 子域，格式为： `$(pod 名称).$(所属服务的 DNS 域名)`，其中所属服务由 StatefulSet 的 `serviceName` 域来设定。

取决于集群域内部 DNS 的配置，有可能无法查询一个刚刚启动的 Pod 的 DNS 命名。 当集群内其他客户端在 Pod 创建完成前发出 Pod 主机名查询时，就会发生这种情况。 负缓存 (在 DNS 中较为常见) 意味着之前失败的查询结果会被记录和重用至少若干秒钟， 即使 Pod 已经正常运行了也是如此。

如果需要在 Pod 被创建之后及时发现它们，有以下选项：

- 直接查询 Kubernetes API（比如，利用 watch 机制）而不是依赖于 DNS 查询
- 缩短 Kubernetes DNS 驱动的缓存时长（通常这意味着修改 CoreDNS 的 ConfigMap，目前缓存时长为 30 秒）

正如[限制](https://kubernetes.io/zh/docs/concepts/workloads/controllers/statefulset/#limitations)中所述，你需要负责创建[无头服务](https://kubernetes.io/zh/docs/concepts/services-networking/service/#headless-services) 以便为 Pod 提供网络标识。

下面给出一些选择集群域、服务名、StatefulSet 名、及其怎样影响 StatefulSet 的 Pod 上的 DNS 名称的示例：

| 集群域名      | 服务（名字空间/名字） | StatefulSet（名字空间/名字） | StatefulSet 域名                | Pod DNS                                      | Pod 主机名   |
| ------------- | --------------------- | ---------------------------- | ------------------------------- | -------------------------------------------- | ------------ |
| cluster.local | default/nginx         | default/web                  | nginx.default.svc.cluster.local | web-{0..N-1}.nginx.default.svc.cluster.local | web-{0..N-1} |
| cluster.local | foo/nginx             | foo/web                      | nginx.foo.svc.cluster.local     | web-{0..N-1}.nginx.foo.svc.cluster.local     | web-{0..N-1} |
| kube.local    | foo/nginx             | foo/web                      | nginx.foo.svc.kube.local        | web-{0..N-1}.nginx.foo.svc.kube.local        | web-{0..N-1} |

**说明：** 集群域会被设置为 `cluster.local`，除非有[其他配置](https://kubernetes.io/zh/docs/concepts/services-networking/dns-pod-service/)。

### 稳定的存储 

对于 StatefulSet 中定义的每个 VolumeClaimTemplate，每个 Pod 接收到一个 PersistentVolumeClaim。在上面的 nginx 示例中，每个 Pod 将会得到基于 StorageClass `my-storage-class` 提供的 1 Gib 的 PersistentVolume。 如果没有声明 StorageClass，就会使用默认的 StorageClass。 当一个 Pod 被调度（重新调度）到节点上时，它的 `volumeMounts` 会挂载与其 PersistentVolumeClaims 相关联的 PersistentVolume。 请注意，当 Pod 或者 StatefulSet 被删除时，与 PersistentVolumeClaims 相关联的 PersistentVolume 并不会被删除。要删除它必须通过手动方式来完成。

### Pod 名称标签 

当 StatefulSet [控制器（Controller）](https://kubernetes.io/zh/docs/concepts/architecture/controller/) 创建 Pod 时， 它会添加一个标签 `statefulset.kubernetes.io/pod-name`，该标签值设置为 Pod 名称。 这个标签允许你给 StatefulSet 中的特定 Pod 绑定一个 Service。

## 部署和扩缩保证 

- 对于包含 N 个 副本的 StatefulSet，当部署 Pod 时，它们是依次创建的，顺序为 `0..N-1`。
- 当删除 Pod 时，它们是逆序终止的，顺序为 `N-1..0`。
- 在将缩放操作应用到 Pod 之前，它前面的所有 Pod 必须是 Running 和 Ready 状态。
- 在 Pod 终止之前，所有的继任者必须完全关闭。

StatefulSet 不应将 `pod.Spec.TerminationGracePeriodSeconds` 设置为 0。 这种做法是不安全的，要强烈阻止。更多的解释请参考 [强制删除 StatefulSet Pod](https://kubernetes.io/zh/docs/tasks/run-application/force-delete-stateful-set-pod/)。

在上面的 nginx 示例被创建后，会按照 web-0、web-1、web-2 的顺序部署三个 Pod。 在 web-0 进入 [Running 和 Ready](https://kubernetes.io/zh/docs/concepts/workloads/pods/pod-lifecycle/) 状态前不会部署 web-1。在 web-1 进入 Running 和 Ready 状态前不会部署 web-2。 如果 web-1 已经处于 Running 和 Ready 状态，而 web-2 尚未部署，在此期间发生了 web-0 运行失败，那么 web-2 将不会被部署，要等到 web-0 部署完成并进入 Running 和 Ready 状态后，才会部署 web-2。

如果用户想将示例中的 StatefulSet 收缩为 `replicas=1`，首先被终止的是 web-2。 在 web-2 没有被完全停止和删除前，web-1 不会被终止。 当 web-2 已被终止和删除、web-1 尚未被终止，如果在此期间发生 web-0 运行失败， 那么就不会终止 web-1，必须等到 web-0 进入 Running 和 Ready 状态后才会终止 web-1。

### Pod 管理策略

在 Kubernetes 1.7 及以后的版本中，StatefulSet 允许你放宽其排序保证， 同时通过它的 `.spec.podManagementPolicy` 域保持其唯一性和身份保证。

#### OrderedReady Pod 管理

`OrderedReady` Pod 管理是 StatefulSet 的默认设置。它实现了 [上面](https://kubernetes.io/zh/docs/concepts/workloads/controllers/statefulset/#deployment-and-scaling-guarantees)描述的功能。

#### 并行 Pod 管理 

`Parallel` Pod 管理让 StatefulSet 控制器并行的启动或终止所有的 Pod， 启动或者终止其他 Pod 前，无需等待 Pod 进入 Running 和 ready 或者完全停止状态。 这个选项只会影响伸缩操作的行为，更新则不会被影响。

## 更新策略 

StatefulSet 的 `.spec.updateStrategy` 字段让 你可以配置和禁用掉自动滚动更新 Pod 的容器、标签、资源请求或限制、以及注解。 有两个允许的值：

- `OnDelete`

  当 StatefulSet 的 `.spec.updateStrategy.type` 设置为 `OnDelete` 时， 它的控制器将不会自动更新 StatefulSet 中的 Pod。 用户必须手动删除 Pod 以便让控制器创建新的 Pod，以此来对 StatefulSet 的 `.spec.template` 的变动作出反应。

- `RollingUpdate`

  `RollingUpdate` 更新策略对 StatefulSet 中的 Pod 执行自动的滚动更新。这是默认的更新策略。

## 滚动更新

当 StatefulSet 的 `.spec.updateStrategy.type` 被设置为 `RollingUpdate` 时， StatefulSet 控制器会删除和重建 StatefulSet 中的每个 Pod。 它将按照与 Pod 终止相同的顺序（从最大序号到最小序号）进行，每次更新一个 Pod。

Kubernetes 控制面会等到被更新的 Pod 进入 Running 和 Ready 状态，然后再更新其前身。 如果你设置了 `.spec.minReadySeconds`（查看[最短就绪秒数](https://kubernetes.io/zh/docs/concepts/workloads/controllers/statefulset/#minimum-ready-seconds)），控制面在 Pod 就绪后会额外等待一定的时间再执行下一步。

### 分区滚动更新 

通过声明 `.spec.updateStrategy.rollingUpdate.partition` 的方式，`RollingUpdate` 更新策略可以实现分区。 如果声明了一个分区，当 StatefulSet 的 `.spec.template` 被更新时， 所有序号大于等于该分区序号的 Pod 都会被更新。 所有序号小于该分区序号的 Pod 都不会被更新，并且，即使他们被删除也会依据之前的版本进行重建。 如果 StatefulSet 的 `.spec.updateStrategy.rollingUpdate.partition` 大于它的 `.spec.replicas`，对它的 `.spec.template` 的更新将不会传递到它的 Pod。 在大多数情况下，你不需要使用分区，但如果你希望进行阶段更新、执行金丝雀或执行 分阶段上线，则这些分区会非常有用。

### 强制回滚

在默认 [Pod 管理策略](https://kubernetes.io/zh/docs/concepts/workloads/controllers/statefulset/#pod-management-policies)(`OrderedReady`) 下使用 [滚动更新](https://kubernetes.io/zh/docs/concepts/workloads/controllers/statefulset/#rolling-updates) ，可能进入需要人工干预才能修复的损坏状态。

如果更新后 Pod 模板配置进入无法运行或就绪的状态（例如，由于错误的二进制文件 或应用程序级配置错误），StatefulSet 将停止回滚并等待。

在这种状态下，仅将 Pod 模板还原为正确的配置是不够的。由于 [已知问题](https://github.com/kubernetes/kubernetes/issues/67250)，StatefulSet 将继续等待损坏状态的 Pod 准备就绪（永远不会发生），然后再尝试将其恢复为正常工作配置。

恢复模板后，还必须删除 StatefulSet 尝试使用错误的配置来运行的 Pod。这样， StatefulSet 才会开始使用被还原的模板来重新创建 Pod。

### 最短就绪秒数 

**FEATURE STATE:** `Kubernetes v1.22 [alpha]`

`.spec.minReadySeconds` 是一个可选字段，用于指定新创建的 Pod 就绪（没有任何容器崩溃）后被认为可用的最小秒数。 默认值是 0（Pod 就绪时就被认为可用）。要了解 Pod 何时被认为已就绪，请参阅[容器探针](https://kubernetes.io/zh/docs/concepts/workloads/pods/pod-lifecycle/#container-probes)。

请注意只有当你启用 `StatefulSetMinReadySeconds` [特性门控](https://kubernetes.io/zh/docs/reference/command-line-tools-reference/feature-gates/)时，该字段才会生效。

# DaemonSet

*DaemonSet* 确保全部（或者某些）节点上运行一个 Pod 的副本。 当有节点加入集群时， 也会为他们新增一个 Pod 。 当有节点从集群移除时，这些 Pod 也会被回收。删除 DaemonSet 将会删除它创建的所有 Pod。

DaemonSet 的一些典型用法：

- 在**每个节点**上运行集群守护进程
- 在**每个节点**上运行日志收集守护进程
- 在**每个节点**上运行监控守护进程

一种简单的用法是为**每种类型的守护进程在所有的节点上**都启动一个 DaemonSet。 一个稍微复杂的用法是为同一种守护进程部署多个 DaemonSet；每个具有不同的标志， 并且对不同硬件类型具有不同的内存、CPU 要求。

## 编写 DaemonSet Spec 

### 创建 DaemonSet 

你可以在 YAML 文件中描述 DaemonSet。 例如，下面的 daemonset.yaml 文件描述了一个运行 fluentd-elasticsearch Docker 镜像的 DaemonSet (controllers/daemonset.yaml)：

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: fluentd-elasticsearch
  namespace: kube-system
  labels:
    k8s-app: fluentd-logging
spec:
  selector:
    matchLabels:
      name: fluentd-elasticsearch
  template:
    metadata:
      labels:
        name: fluentd-elasticsearch
    spec:
      tolerations:
      # this toleration is to have the daemonset runnable on master nodes
      # remove it if your masters can't run pods
      - key: node-role.kubernetes.io/master
        operator: Exists
        effect: NoSchedule
      containers:
      - name: fluentd-elasticsearch
        image: quay.io/fluentd_elasticsearch/fluentd:v2.5.2
        resources:
          limits:
            memory: 200Mi
          requests:
            cpu: 100m
            memory: 200Mi
        volumeMounts:
        - name: varlog
          mountPath: /var/log
        - name: varlibdockercontainers
          mountPath: /var/lib/docker/containers
          readOnly: true
      terminationGracePeriodSeconds: 30
      volumes:
      - name: varlog
        hostPath:
          path: /var/log
      - name: varlibdockercontainers
        hostPath:
          path: /var/lib/docker/containers
```

基于 YAML 文件创建 DaemonSet：

```
kubectl apply -f https://k8s.io/examples/controllers/daemonset.yaml
```

### 必需字段 

和所有其他 Kubernetes 配置一样，DaemonSet 需要 `apiVersion`、`kind` 和 `metadata` 字段。 有关配置文件的基本信息，参见 [部署应用](https://kubernetes.io/zh/docs/tasks/run-application/run-stateless-application-deployment/)、 [配置容器](https://kubernetes.io/zh/docs/tasks/)和 [使用 kubectl 进行对象管理](https://kubernetes.io/zh/docs/concepts/overview/working-with-objects/object-management/) 文档。

DaemonSet 对象的名称必须是一个合法的 [DNS 子域名](https://kubernetes.io/zh/docs/concepts/overview/working-with-objects/names#dns-subdomain-names)。

DaemonSet 也需要一个 [`.spec`](https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status) 配置段。

### Pod 模板 

`.spec` 中唯一必需的字段是 `.spec.template`。

`.spec.template` 是一个 [Pod 模板](https://kubernetes.io/zh/docs/concepts/workloads/pods/#pod-templates)。 除了它是嵌套的，因而不具有 `apiVersion` 或 `kind` 字段之外，它与 [Pod](https://kubernetes.io/docs/concepts/workloads/pods/pod-overview/) 具有相同的 schema。

除了 Pod 必需字段外，在 DaemonSet 中的 Pod 模板必须指定合理的标签（查看 [Pod 选择算符](https://kubernetes.io/zh/docs/concepts/workloads/controllers/daemonset/#pod-selector)）。

在 DaemonSet 中的 Pod 模板必须具有一个值为 `Always` 的 [`RestartPolicy`](https://kubernetes.io/zh/docs/concepts/workloads/pods/pod-lifecycle/#restart-policy)。 当该值未指定时，默认是 `Always`。

### Pod 选择算符 

`.spec.selector` 字段表示 Pod 选择算符，它与 [Job](https://kubernetes.io/zh/docs/concepts/workloads/controllers/job/) 的 `.spec.selector` 的作用是相同的。

从 Kubernetes 1.8 开始，您必须指定与 `.spec.template` 的标签匹配的 Pod 选择算符。 用户不指定 Pod 选择算符时，该字段不再有默认值。 选择算符的默认值生成结果与 `kubectl apply` 不兼容。 此外，一旦创建了 DaemonSet，它的 `.spec.selector` 就不能修改。 修改 Pod 选择算符可能导致 Pod 意外悬浮，并且这对用户来说是费解的。

`spec.selector` 是一个对象，如下两个字段组成：

- `matchLabels` - 与 [ReplicationController](https://kubernetes.io/zh/docs/concepts/workloads/controllers/replicationcontroller/) 的 `.spec.selector` 的作用相同。
- `matchExpressions` - 允许构建更加复杂的选择器，可以通过指定 key、value 列表以及将 key 和 value 列表关联起来的 operator。

当上述两个字段都指定时，结果会按逻辑与（AND）操作处理。

如果指定了 `.spec.selector`，必须与 `.spec.template.metadata.labels` 相匹配。 如果与后者不匹配，则 DeamonSet 会被 API 拒绝。

### 仅在某些节点上运行 Pod 

如果指定了 `.spec.template.spec.nodeSelector`，DaemonSet 控制器将在能够与 [Node 选择算符](https://kubernetes.io/zh/docs/concepts/scheduling-eviction/assign-pod-node/) 匹配的节点上创建 Pod。 类似这种情况，可以指定 `.spec.template.spec.affinity`，之后 DaemonSet 控制器 将在能够与[节点亲和性](https://kubernetes.io/zh/docs/concepts/scheduling-eviction/assign-pod-node/) 匹配的节点上创建 Pod。 如果根本就没有指定，则 DaemonSet Controller 将在所有节点上创建 Pod。

## Daemon Pods 是如何被调度的 

### 通过默认调度器调度 

**FEATURE STATE:** `Kubernetes v1.23 [stable]`

DaemonSet 确保所有符合条件的节点都运行该 Pod 的一个副本。 通常，运行 Pod 的节点由 Kubernetes 调度器选择。 不过，DaemonSet Pods 由 DaemonSet 控制器创建和调度。这就带来了以下问题：

- Pod 行为的不一致性：正常 Pod 在被创建后等待调度时处于 `Pending` 状态， DaemonSet Pods 创建后不会处于 `Pending` 状态下。这使用户感到困惑。
- [Pod 抢占](https://kubernetes.io/zh/docs/concepts/configuration/pod-priority-preemption/) 由默认调度器处理。启用抢占后，DaemonSet 控制器将在不考虑 Pod 优先级和抢占 的情况下制定调度决策。

`ScheduleDaemonSetPods` 允许您使用默认调度器而不是 DaemonSet 控制器来调度 DaemonSets， 方法是将 `NodeAffinity` 条件而不是 `.spec.nodeName` 条件添加到 DaemonSet Pods。 默认调度器接下来将 Pod 绑定到目标主机。 如果 DaemonSet Pod 的节点亲和性配置已存在，则被替换 （原始的节点亲和性配置在选择目标主机之前被考虑）。 DaemonSet 控制器仅在创建或修改 DaemonSet Pod 时执行这些操作， 并且不会更改 DaemonSet 的 `spec.template`。

```yaml
nodeAffinity:
  requiredDuringSchedulingIgnoredDuringExecution:
    nodeSelectorTerms:
    - matchFields:
      - key: metadata.name
        operator: In
        values:
        - target-host-name
```

此外，系统会自动添加 `node.kubernetes.io/unschedulable：NoSchedule` 容忍度到 DaemonSet Pods。在调度 DaemonSet Pod 时，默认调度器会忽略 `unschedulable` 节点。

### 污点和容忍度 

尽管 Daemon Pods 遵循[污点和容忍度](https://kubernetes.io/zh/docs/concepts/scheduling-eviction/taint-and-toleration) 规则，根据相关特性，控制器会自动将以下容忍度添加到 DaemonSet Pod：

| 容忍度键名                               | 效果       | 版本  | 描述                                                         |
| ---------------------------------------- | ---------- | ----- | ------------------------------------------------------------ |
| `node.kubernetes.io/not-ready`           | NoExecute  | 1.13+ | 当出现类似网络断开的情况导致节点问题时，DaemonSet Pod 不会被逐出。 |
| `node.kubernetes.io/unreachable`         | NoExecute  | 1.13+ | 当出现类似于网络断开的情况导致节点问题时，DaemonSet Pod 不会被逐出。 |
| `node.kubernetes.io/disk-pressure`       | NoSchedule | 1.8+  | DaemonSet Pod 被默认调度器调度时能够容忍磁盘压力属性。       |
| `node.kubernetes.io/memory-pressure`     | NoSchedule | 1.8+  | DaemonSet Pod 被默认调度器调度时能够容忍内存压力属性。       |
| `node.kubernetes.io/unschedulable`       | NoSchedule | 1.12+ | DaemonSet Pod 能够容忍默认调度器所设置的 `unschedulable` 属性. |
| `node.kubernetes.io/network-unavailable` | NoSchedule | 1.12+ | DaemonSet 在使用宿主网络时，能够容忍默认调度器所设置的 `network-unavailable` 属性。 |

## 与 Daemon Pods 通信 

与 DaemonSet 中的 Pod 进行通信的几种可能模式如下：

- **推送（Push）**：配置 DaemonSet 中的 Pod，将更新发送到另一个服务，例如统计数据库。 这些服务没有客户端。
- **NodeIP 和已知端口**：DaemonSet 中的 Pod 可以使用 `hostPort`，从而可以通过节点 IP 访问到 Pod。客户端能通过某种方法获取节点 IP 列表，并且基于此也可以获取到相应的端口。
- **DNS**：创建具有相同 Pod 选择算符的 [无头服务](https://kubernetes.io/zh/docs/concepts/services-networking/service/#headless-services)， 通过使用 `endpoints` 资源或从 DNS 中检索到多个 A 记录来发现 DaemonSet。
- **Service**：创建具有相同 Pod 选择算符的服务，并使用该服务随机访问到某个节点上的 守护进程（没有办法访问到特定节点）。

## 更新 DaemonSet 

如果节点的标签被修改，DaemonSet 将立刻向新匹配上的节点添加 Pod， 同时删除不匹配的节点上的 Pod。

你可以修改 DaemonSet 创建的 Pod。不过并非 Pod 的所有字段都可更新。 下次当某节点（即使具有相同的名称）被创建时，DaemonSet 控制器还会使用最初的模板。

您可以删除一个 DaemonSet。如果使用 `kubectl` 并指定 `--cascade=orphan` 选项， 则 Pod 将被保留在节点上。接下来如果创建使用相同选择算符的新 DaemonSet， 新的 DaemonSet 会收养已有的 Pod。 如果有 Pod 需要被替换，DaemonSet 会根据其 `updateStrategy` 来替换。

你可以对 DaemonSet [执行滚动更新](https://kubernetes.io/zh/docs/tasks/manage-daemon/update-daemon-set/)操作。

## DaemonSet 的替代方案 

### init 脚本 

直接在节点上启动守护进程（例如使用 `init`、`upstartd` 或 `systemd`）的做法当然是可行的。 不过，基于 DaemonSet 来运行这些进程有如下一些好处：

- 像所运行的其他应用一样，DaemonSet 具备为守护进程提供监控和日志管理的能力。
- 为守护进程和应用所使用的配置语言和工具（如 Pod 模板、`kubectl`）是相同的。
- 在资源受限的容器中运行守护进程能够增加守护进程和应用容器的隔离性。 然而，这一点也可以通过在容器中运行守护进程但却不在 Pod 中运行之来实现。 例如，直接基于 Docker 启动。

### 裸 Pod 

直接创建 Pod并指定其运行在特定的节点上也是可以的。 然而，DaemonSet 能够替换由于任何原因（例如节点失败、例行节点维护、内核升级） 而被删除或终止的 Pod。 由于这个原因，你应该使用 DaemonSet 而不是单独创建 Pod。

### 静态 Pod 

通过在一个指定的、受 `kubelet` 监视的目录下编写文件来创建 Pod 也是可行的。 这类 Pod 被称为[静态 Pod](https://kubernetes.io/zh/docs/tasks/configure-pod-container/static-pod/)。 不像 DaemonSet，静态 Pod 不受 `kubectl` 和其它 Kubernetes API 客户端管理。 静态 Pod 不依赖于 API 服务器，这使得它们在启动引导新集群的情况下非常有用。 此外，静态 Pod 在将来可能会被废弃。

### Deployments

DaemonSet 与 [Deployments](https://kubernetes.io/zh/docs/concepts/workloads/controllers/deployment/) 非常类似， 它们都能创建 Pod，并且 Pod 中的进程都不希望被终止（例如，Web 服务器、存储服务器）。

**建议为无状态的服务使用 Deployments**，比如前端服务。 对这些服务而言，对副本的数量进行扩缩容、平滑升级，比精确控制 Pod 运行在某个主机上要重要得多。 **当需要 Pod 副本总是运行在全部或特定主机上**，并且当该 DaemonSet 提供了节点级别的功能（允许其他 Pod 在该特定节点上正确运行）时， 应该使用 DaemonSet。

例如，[网络插件](https://kubernetes.io/zh/docs/concepts/extend-kubernetes/compute-storage-net/network-plugins/)通常包含一个以 DaemonSet 运行的组件。 这个 DaemonSet 组件确保它所在的节点的集群网络正常工作。

# Jobs

Job 会创建一个或者多个 Pods，并将继续重试 Pods 的执行，直到指定数量的 Pods 成功终止。 随着 Pods 成功结束，Job 跟踪记录成功完成的 Pods 个数。 当数量达到指定的成功个数阈值时，任务（即 Job）结束。 删除 Job 的操作会清除所创建的全部 Pods。 挂起 Job 的操作会删除 Job 的所有活跃 Pod，直到 Job 被再次恢复执行。

一种简单的使用场景下，你会创建一个 Job 对象以便以一种可靠的方式运行某 Pod 直到完成。 当第一个 Pod 失败或者被删除（比如因为节点硬件失效或者重启）时，Job 对象会启动一个新的 Pod。

你也可以使用 Job 以并行的方式运行多个 Pod。

## 运行示例 Job 

下面是一个 Job 配置示例。它负责计算 π 到小数点后 2000 位，并将结果打印出来。 此计算大约需要 10 秒钟完成(controllers/job.yaml)。

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: pi
spec:
  template:
    spec:
      containers:
      - name: pi
        image: perl
        command: ["perl",  "-Mbignum=bpi", "-wle", "print bpi(2000)"]
      restartPolicy: Never
  backoffLimit: 4
```

你可以使用下面的命令来运行此示例：

```shell
kubectl apply -f https://kubernetes.io/examples/controllers/job.yaml
```

输出类似于：

```
job.batch/pi created
```

使用 `kubectl` 来检查 Job 的状态：

```shell
kubectl describe jobs/pi
```

输出类似于：

```
Name:           pi
Namespace:      default
Selector:       controller-uid=c9948307-e56d-4b5d-8302-ae2d7b7da67c
Labels:         controller-uid=c9948307-e56d-4b5d-8302-ae2d7b7da67c
                job-name=pi
Annotations:    kubectl.kubernetes.io/last-applied-configuration:
                  {"apiVersion":"batch/v1","kind":"Job","metadata":{"annotations":{},"name":"pi","namespace":"default"},"spec":{"backoffLimit":4,"template":...
Parallelism:    1
Completions:    1
Start Time:     Mon, 02 Dec 2019 15:20:11 +0200
Completed At:   Mon, 02 Dec 2019 15:21:16 +0200
Duration:       65s
Pods Statuses:  0 Running / 1 Succeeded / 0 Failed
Pod Template:
  Labels:  controller-uid=c9948307-e56d-4b5d-8302-ae2d7b7da67c
           job-name=pi
  Containers:
   pi:
    Image:      perl
    Port:       <none>
    Host Port:  <none>
    Command:
      perl
      -Mbignum=bpi
      -wle
      print bpi(2000)
    Environment:  <none>
    Mounts:       <none>
  Volumes:        <none>
Events:
  Type    Reason            Age   From            Message
  ----    ------            ----  ----            -------
  Normal  SuccessfulCreate  14m   job-controller  Created pod: pi-5rwd7
```

要查看 Job 对应的已完成的 Pods，可以执行 `kubectl get pods`。

要以机器可读的方式列举隶属于某 Job 的全部 Pods，你可以使用类似下面这条命令：

```shell
pods=$(kubectl get pods --selector=job-name=pi --output=jsonpath='{.items[*].metadata.name}')
echo $pods
```

输出类似于：

```
pi-5rwd7
```

这里，选择算符与 Job 的选择算符相同。`--output=jsonpath` 选项给出了一个表达式， 用来从返回的列表中提取每个 Pod 的 name 字段。

查看其中一个 Pod 的标准输出：

```shell
kubectl logs $pods
```

输出类似于：

```
3.1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679821480865132823066470938446095505822317253594081284811174502841027019385211055596446229489549303819644288109756659334461284756482337867831652712019091456485669234603486104543266482133936072602491412737245870066063155881748815209209628292540917153643678925903600113305305488204665213841469519415116094330572703657595919530921861173819326117931051185480744623799627495673518857527248912279381830119491298336733624406566430860213949463952247371907021798609437027705392171762931767523846748184676694051320005681271452635608277857713427577896091736371787214684409012249534301465495853710507922796892589235420199561121290219608640344181598136297747713099605187072113499999983729780499510597317328160963185950244594553469083026425223082533446850352619311881710100031378387528865875332083814206171776691473035982534904287554687311595628638823537875937519577818577805321712268066130019278766111959092164201989380952572010654858632788659361533818279682303019520353018529689957736225994138912497217752834791315155748572424541506959508295331168617278558890750983817546374649393192550604009277016711390098488240128583616035637076601047101819429555961989467678374494482553797747268471040475346462080466842590694912933136770289891521047521620569660240580381501935112533824300355876402474964732639141992726042699227967823547816360093417216412199245863150302861829745557067498385054945885869269956909272107975093029553211653449872027559602364806654991198818347977535663698074265425278625518184175746728909777727938000816470600161452491921732172147723501414419735685481613611573525521334757418494684385233239073941433345477624168625189835694855620992192221842725502542568876717904946016534668049886272327917860857843838279679766814541009538837863609506800642251252051173929848960841284886269456042419652850222106611863067442786220391949450471237137869609563643719172874677646575739624138908658326459958133904780275901
```

## 编写 Job 规约

与 Kubernetes 中其他资源的配置类似，Job 也需要 `apiVersion`、`kind` 和 `metadata` 字段。 Job 的名字必须是合法的 [DNS 子域名](https://kubernetes.io/zh/docs/concepts/overview/working-with-objects/names#dns-subdomain-names)。

Job 配置还需要一个[`.spec` 节](https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status)。

### Pod 模版

Job 的 `.spec` 中只有 `.spec.template` 是必需的字段。

字段 `.spec.template` 的值是一个 [Pod 模版](https://kubernetes.io/zh/docs/concepts/workloads/pods/#pod-templates)。 其定义规范与 [Pod](https://kubernetes.io/docs/concepts/workloads/pods/pod-overview/) 完全相同，只是其中不再需要 `apiVersion` 或 `kind` 字段。

除了作为 Pod 所必需的字段之外，Job 中的 Pod 模版必需设置合适的标签 （参见[Pod 选择算符](https://kubernetes.io/zh/docs/concepts/workloads/controllers/job/#pod-selector)）和合适的重启策略。

Job 中 Pod 的 [`RestartPolicy`](https://kubernetes.io/zh/docs/concepts/workloads/pods/pod-lifecycle/#restart-policy) 只能设置为 `Never` 或 `OnFailure` 之一。

### Pod 选择算符 

字段 `.spec.selector` 是可选的。在绝大多数场合，你都不需要为其赋值。 参阅[设置自己的 Pod 选择算符](https://kubernetes.io/zh/docs/concepts/workloads/controllers/job/#specifying-your-own-pod-selector).

### Job 的并行执行

适合以 Job 形式来运行的任务主要有三种：

1. 非并行 Job：
   - 通常只启动一个 Pod，除非该 Pod 失败。
   - 当 Pod 成功终止时，立即视 Job 为完成状态。
2. 具有确定完成计数的并行 Job：
   - `.spec.completions` 字段设置为非 0 的正数值。
   - Job 用来代表整个任务，当成功的 Pod 个数达到 `.spec.completions` 时，Job 被视为完成。
   - 当使用 `.spec.completionMode="Indexed"` 时，每个 Pod 都会获得一个不同的 索引值，介于 0 和 `.spec.completions-1` 之间。
3. 带工作队列的并行 Job：
   - 不设置 `spec.completions`，默认值为 `.spec.parallelism`。
   - **多个 Pod 之间必须相互协调**，或者借助外部服务确定每个 Pod 要处理哪个工作条目。 例如，任一 Pod 都可以从工作队列中取走最多 N 个工作条目。
   - 每个 Pod 都可以独立确定是否其它 Pod 都已完成，进而确定 Job 是否完成。
   - 当 Job 中 *任何* Pod 成功终止，不再创建新 Pod。
   - 一旦至少 1 个 Pod 成功完成，并且所有 Pod 都已终止，即可宣告 Job 成功完成。
   - 一旦任何 Pod 成功退出，任何其它 Pod 都不应再对此任务执行任何操作或生成任何输出。 所有 Pod 都应启动退出过程。

对于 *非并行* 的 Job，你可以不设置 `spec.completions` 和 `spec.parallelism`。 这两个属性都不设置时，均取默认值 1。

对于 *确定完成计数* 类型的 Job，你应该设置 `.spec.completions` 为所需要的完成个数。 你可以设置 `.spec.parallelism`，也可以不设置。其默认值为 1。

对于一个 *工作队列* Job，你不可以设置 `.spec.completions`，但要将`.spec.parallelism` 设置为一个非负整数。

关于如何利用不同类型的 Job 的更多信息，请参见 [Job 模式](https://kubernetes.io/zh/docs/concepts/workloads/controllers/job/#job-patterns)一节。

#### 控制并行性 

并行性请求（`.spec.parallelism`）可以设置为任何非负整数。 如果未设置，则默认为 1。 如果设置为 0，则 Job 相当于启动之后便被暂停，直到此值被增加。

实际并行性（在任意时刻运行状态的 Pods 个数）可能比并行性请求略大或略小， 原因如下：

- 对于 *确定完成计数* Job，实际上并行执行的 Pods 个数不会超出剩余的完成数。 如果 `.spec.parallelism` 值较高，会被忽略。
- 对于 *工作队列* Job，有任何 Job 成功结束之后，不会有新的 Pod 启动。 不过，剩下的 Pods 允许执行完毕。
- 如果 Job [控制器](https://kubernetes.io/zh/docs/concepts/architecture/controller/) 没有来得及作出响应，或者
- 如果 Job 控制器因为任何原因（例如，缺少 `ResourceQuota` 或者没有权限）无法创建 Pods。 Pods 个数可能比请求的数目小。
- Job 控制器可能会因为之前同一 Job 中 Pod 失效次数过多而压制新 Pod 的创建。
- 当 Pod 处于体面终止进程中，需要一定时间才能停止。

### 完成模式 

**FEATURE STATE:** `Kubernetes v1.22 [beta]`

带有 *确定完成计数* 的 Job，即 `.spec.completions` 不为 null 的 Job， 都可以在其 `.spec.completionMode` 中设置完成模式：

- `NonIndexed`（默认值）：当成功完成的 Pod 个数达到 `.spec.completions` 所 设值时认为 Job 已经完成。换言之，每个 Job 完成事件都是独立无关且同质的。 要注意的是，当 `.spec.completions` 取值为 null 时，Job 被隐式处理为 `NonIndexed`。

- `Indexed`：Job 的 Pod 会获得对应的完成索引，取值为 0 到 `.spec.completions-1`。 该索引可以通过三种方式获取：

  - Pod 注解 `batch.kubernetes.io/job-completion-index`。
  - 作为 Pod 主机名的一部分，遵循模式 `$(job-name)-$(index)`。 当你同时使用带索引的 Job（Indexed Job）与 [服务（Service）](https://kubernetes.io/zh/docs/concepts/services-networking/service/)， Job 中的 Pods 可以通过 DNS 使用确切的主机名互相寻址。
  - 对于容器化的任务，在环境变量 `JOB_COMPLETION_INDEX` 中。

  当每个索引都对应一个完成完成的 Pod 时，Job 被认为是已完成的。 关于如何使用这种模式的更多信息，可参阅 [用带索引的 Job 执行基于静态任务分配的并行处理](https://kubernetes.io/zh/docs/tasks/job/indexed-parallel-processing-static/)。 需要注意的是，对同一索引值可能被启动的 Pod 不止一个，尽管这种情况很少发生。 这时，只有一个会被记入完成计数中。

## 处理 Pod 和容器失效

Pod 中的容器可能因为多种不同原因失效，例如因为其中的进程退出时返回值非零， 或者容器因为超出内存约束而被杀死等等。 如果发生这类事件，并且 `.spec.template.spec.restartPolicy = "OnFailure"`， Pod 则继续留在当前节点，但容器会被重新运行。 因此，你的程序需要能够处理在本地被重启的情况，或者要设置 `.spec.template.spec.restartPolicy = "Never"`。 关于 `restartPolicy` 的更多信息，可参阅 [Pod 生命周期](https://kubernetes.io/zh/docs/concepts/workloads/pods/pod-lifecycle/#example-states)。

整个 Pod 也可能会失败，且原因各不相同。 例如，当 Pod 启动时，节点失效（被升级、被重启、被删除等）或者其中的容器失败而 `.spec.template.spec.restartPolicy = "Never"`。 当 Pod 失败时，Job 控制器会启动一个新的 Pod。 这意味着，你的应用需要处理在一个新 Pod 中被重启的情况。 尤其是应用需要处理之前运行所产生的临时文件、锁、不完整的输出等问题。

注意，即使你将 `.spec.parallelism` 设置为 1，且将 `.spec.completions` 设置为 1，并且 `.spec.template.spec.restartPolicy` 设置为 "Never"，同一程序仍然有可能被启动两次。

如果你确实将 `.spec.parallelism` 和 `.spec.completions` 都设置为比 1 大的值， 那就有可能同时出现多个 Pod 运行的情况。 为此，你的 Pod 也必须能够处理并发性问题。

### Pod 回退失效策略

在有些情形下，你可能希望 Job 在经历若干次重试之后直接进入失败状态，因为这很 可能意味着遇到了配置错误。 为了实现这点，可以将 `.spec.backoffLimit` 设置为视 Job 为失败之前的重试次数。 失效回退的限制值默认为 6。 与 Job 相关的失效的 Pod 会被 Job 控制器重建，回退重试时间将会按指数增长 （从 10 秒、20 秒到 40 秒）最多至 6 分钟。 当 Job 的 Pod 被删除时，或者 Pod 成功时没有其它 Pod 处于失败状态，失效回退的次数也会被重置（为 0）。

**说明：** 如果你的 Job 的 `restartPolicy` 被设置为 "OnFailure"，就要注意运行该 Job 的 Pod 会在 Job 到达失效回退次数上限时自动被终止。 这会使得调试 Job 中可执行文件的工作变得非常棘手。 我们建议在调试 Job 时将 `restartPolicy` 设置为 "Never"， 或者使用日志系统来确保失效 Jobs 的输出不会意外遗失。

## Job 终止与清理

Job 完成时不会再创建新的 Pod，不过已有的 Pod [通常](https://kubernetes.io/zh/docs/concepts/workloads/controllers/job/#pod-backoff-failure-policy)也不会被删除。 保留这些 Pod 使得你可以查看已完成的 Pod 的日志输出，以便检查错误、警告 或者其它诊断性输出。 Job 完成时 Job 对象也一样被保留下来，这样你就可以查看它的状态。 在查看了 Job 状态之后删除老的 Job 的操作留给了用户自己。 你可以使用 `kubectl` 来删除 Job（例如，`kubectl delete jobs/pi` 或者 `kubectl delete -f ./job.yaml`）。 当使用 `kubectl` 来删除 Job 时，该 Job 所创建的 Pods 也会被删除。

默认情况下，Job 会持续运行，除非某个 Pod 失败（`restartPolicy=Never`） 或者某个容器出错退出（`restartPolicy=OnFailure`）。 这时，Job 基于前述的 `spec.backoffLimit` 来决定是否以及如何重试。 一旦重试次数到达 `.spec.backoffLimit` 所设的上限，Job 会被标记为失败， 其中运行的 Pods 都会被终止。

终止 Job 的另一种方式是设置一个活跃期限。 你可以为 Job 的 `.spec.activeDeadlineSeconds` 设置一个秒数值。 该值适用于 Job 的整个生命期，无论 Job 创建了多少个 Pod。 一旦 Job 运行时间达到 `activeDeadlineSeconds` 秒，其所有运行中的 Pod 都会被终止，并且 Job 的状态更新为 `type: Failed` 及 `reason: DeadlineExceeded`。

注意 Job 的 `.spec.activeDeadlineSeconds` 优先级高于其 `.spec.backoffLimit` 设置。 因此，如果一个 Job 正在重试一个或多个失效的 Pod，该 Job 一旦到达 `activeDeadlineSeconds` 所设的时限即不再部署额外的 Pod，即使其重试次数还未 达到 `backoffLimit` 所设的限制。

例如：

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: pi-with-timeout
spec:
  backoffLimit: 5
  activeDeadlineSeconds: 100
  template:
    spec:
      containers:
      - name: pi
        image: perl
        command: ["perl",  "-Mbignum=bpi", "-wle", "print bpi(2000)"]
      restartPolicy: Never
```

注意 Job 规约和 Job 中的 [Pod 模版规约](https://kubernetes.io/zh/docs/concepts/workloads/pods/init-containers/#detailed-behavior) 都有 `activeDeadlineSeconds` 字段。 请确保你在合适的层次设置正确的字段。

还要注意的是，`restartPolicy` 对应的是 Pod，而不是 Job 本身： 一旦 Job 状态变为 `type: Failed`，就不会再发生 Job 重启的动作。 换言之，由 `.spec.activeDeadlineSeconds` 和 `.spec.backoffLimit` 所触发的 Job 终结机制 都会导致 Job 永久性的失败，而这类状态都需要手工干预才能解决。

## 自动清理完成的 Job 

完成的 Job 通常不需要留存在系统中。在系统中一直保留它们会给 API 服务器带来额外的压力。 如果 Job 由某种更高级别的控制器来管理，例如 [CronJobs](https://kubernetes.io/zh/docs/concepts/workloads/controllers/cron-jobs/)， 则 Job 可以被 CronJob 基于特定的根据容量裁定的清理策略清理掉。

### 已完成 Job 的 TTL 机制 

**FEATURE STATE:** `Kubernetes v1.21 [beta]`

自动清理已完成 Job （状态为 `Complete` 或 `Failed`）的另一种方式是使用由 [TTL 控制器](https://kubernetes.io/zh/docs/concepts/workloads/controllers/ttlafterfinished/)所提供 的 TTL 机制。 通过设置 Job 的 `.spec.ttlSecondsAfterFinished` 字段，可以让该控制器清理掉 已结束的资源。

TTL 控制器清理 Job 时，会级联式地删除 Job 对象。 换言之，它会删除所有依赖的对象，包括 Pod 及 Job 本身。 注意，当 Job 被删除时，系统会考虑其生命周期保障，例如其 Finalizers。

例如：

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: pi-with-ttl
spec:
  ttlSecondsAfterFinished: 100
  template:
    spec:
      containers:
      - name: pi
        image: perl
        command: ["perl",  "-Mbignum=bpi", "-wle", "print bpi(2000)"]
      restartPolicy: Never
```

Job `pi-with-ttl` 在结束 100 秒之后，可以成为被自动删除的对象。

如果该字段设置为 `0`，Job 在结束之后立即成为可被自动删除的对象。 如果该字段没有设置，Job 不会在结束之后被 TTL 控制器自动清除。

## Job 模式 

Job 对象可以用来支持多个 Pod 的可靠的并发执行。 Job 对象不是设计用来支持相互通信的并行进程的，后者一般在科学计算中应用较多。 Job 的确能够支持对一组相互独立而又有所关联的 *工作条目* 的并行处理。 这类工作条目可能是要发送的电子邮件、要渲染的视频帧、要编解码的文件、NoSQL 数据库中要扫描的主键范围等等。

在一个复杂系统中，可能存在多个不同的工作条目集合。这里我们仅考虑用户希望一起管理的 工作条目集合之一 — *批处理作业*。

并行计算的模式有好多种，每种都有自己的强项和弱点。这里要权衡的因素有：

- 每个工作条目对应一个 Job 或者所有工作条目对应同一 Job 对象。 后者更适合处理大量工作条目的场景； 前者会给用户带来一些额外的负担，而且需要系统管理大量的 Job 对象。
- 创建与工作条目相等的 Pod 或者令每个 Pod 可以处理多个工作条目。 前者通常不需要对现有代码和容器做较大改动； 后者则更适合工作条目数量较大的场合，原因同上。
- 有几种技术都会用到工作队列。这意味着需要运行一个队列服务，并修改现有程序或容器 使之能够利用该工作队列。 与之比较，其他方案在修改现有容器化应用以适应需求方面可能更容易一些。

下面是对这些权衡的汇总，列 2 到 4 对应上面的权衡比较。 模式的名称对应了相关示例和更详细描述的链接。

| 模式                                                         | 单个 Job 对象 | Pods 数少于工作条目数？ | 直接使用应用无需修改? |
| ------------------------------------------------------------ | :-----------: | :---------------------: | :-------------------: |
| [每工作条目一 Pod 的队列](https://kubernetes.io/zh/docs/tasks/job/coarse-parallel-processing-work-queue/) |       ✓       |                         |         有时          |
| [Pod 数量可变的队列](https://kubernetes.io/zh/docs/tasks/job/fine-parallel-processing-work-queue/) |       ✓       |            ✓            |                       |
| [静态任务分派的带索引的 Job](https://kubernetes.io/zh/docs/tasks/job/indexed-parallel-processing-static) |       ✓       |                         |           ✓           |
| [Job 模版扩展](https://kubernetes.io/zh/docs/tasks/job/parallel-processing-expansion/) |               |                         |           ✓           |

当你使用 `.spec.completions` 来设置完成数时，Job 控制器所创建的每个 Pod 使用完全相同的 [`spec`](https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#spec-and-status)。 这意味着任务的所有 Pod 都有相同的命令行，都使用相同的镜像和数据卷，甚至连 环境变量都（几乎）相同。 这些模式是让每个 Pod 执行不同工作的几种不同形式。

下表显示的是每种模式下 `.spec.parallelism` 和 `.spec.completions` 所需要的设置。 其中，`W` 表示的是工作条目的个数。

| 模式                                                         | `.spec.completions` | `.spec.parallelism` |
| ------------------------------------------------------------ | :-----------------: | :-----------------: |
| [每工作条目一 Pod 的队列](https://kubernetes.io/zh/docs/tasks/job/coarse-parallel-processing-work-queue/) |          W          |       任意值        |
| [Pod 个数可变的队列](https://kubernetes.io/zh/docs/tasks/job/fine-parallel-processing-work-queue/) |          1          |       任意值        |
| [静态任务分派的带索引的 Job](https://kubernetes.io/zh/docs/tasks/job/indexed-parallel-processing-static) |          W          |                     |
| [Job 模版扩展](https://kubernetes.io/zh/docs/tasks/job/parallel-processing-expansion/) |          1          |      应该为 1       |

## 高级用法 

### 挂起 Job 

**FEATURE STATE:** `Kubernetes v1.21 [alpha]`

**说明：**

该特性在 Kubernetes 1.21 版本中是 Alpha 阶段，启用该特性需要额外的步骤； 请确保你正在阅读[与集群版本一致的文档](https://kubernetes.io/zh/docs/home/supported-doc-versions/)。

Job 被创建时，Job 控制器会马上开始执行 Pod 创建操作以满足 Job 的需求， 并持续执行此操作直到 Job 完成为止。 不过你可能想要暂时挂起 Job 执行，之后再恢复其执行。 要挂起一个 Job，你可以将 Job 的 `.spec.suspend` 字段更新为 true。 之后，当你希望恢复其执行时，将其更新为 false。 创建一个 `.spec.suspend` 被设置为 true 的 Job 本质上会将其创建为被挂起状态。

当 Job 被从挂起状态恢复执行时，其 `.status.startTime` 字段会被重置为 当前的时间。这意味着 `.spec.activeDeadlineSeconds` 计时器会在 Job 挂起时 被停止，并在 Job 恢复执行时复位。

要记住的是，挂起 Job 会删除其所有活跃的 Pod。当 Job 被挂起时，你的 Pod 会 收到 SIGTERM 信号而被[终止](https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/#pod-termination)。 Pod 的体面终止期限会被考虑，不过 Pod 自身也必须在此期限之内处理完信号。 处理逻辑可能包括保存进度以便将来恢复，或者取消已经做出的变更等等。 Pod 以这种形式终止时，不会被记入 Job 的 `completions` 计数。

处于被挂起状态的 Job 的定义示例可能是这样子：

```shell
kubectl get job myjob -o yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: myjob
spec:
  suspend: true
  parallelism: 1
  completions: 5
  template:
    spec:
      ...
```

Job 的 `status` 可以用来确定 Job 是否被挂起，或者曾经被挂起。

```shell
kubectl get jobs/myjob -o yaml
apiVersion: batch/v1
kind: Job
# .metadata and .spec omitted
status:
  conditions:
  - lastProbeTime: "2021-02-05T13:14:33Z"
    lastTransitionTime: "2021-02-05T13:14:33Z"
    status: "True"
    type: Suspended
  startTime: "2021-02-05T13:13:48Z"
```

Job 的 "Suspended" 类型的状况在状态值为 "True" 时意味着 Job 正被 挂起；`lastTransitionTime` 字段可被用来确定 Job 被挂起的时长。 如果此状况字段的取值为 "False"，则 Job 之前被挂起且现在在运行。 如果 "Suspended" 状况在 `status` 字段中不存在，则意味着 Job 从未 被停止执行。

当 Job 被挂起和恢复执行时，也会生成事件：

```shell
kubectl describe jobs/myjob
Name:           myjob
...
Events:
  Type    Reason            Age   From            Message
  ----    ------            ----  ----            -------
  Normal  SuccessfulCreate  12m   job-controller  Created pod: myjob-hlrpl
  Normal  SuccessfulDelete  11m   job-controller  Deleted pod: myjob-hlrpl
  Normal  Suspended         11m   job-controller  Job suspended
  Normal  SuccessfulCreate  3s    job-controller  Created pod: myjob-jvb44
  Normal  Resumed           3s    job-controller  Job resumed
```

最后四个事件，特别是 "Suspended" 和 "Resumed" 事件，都是因为 `.spec.suspend` 字段值被改来改去造成的。在这两个事件之间，我们看到没有 Pod 被创建，不过当 Job 被恢复执行时，Pod 创建操作立即被重启执行。

### 指定你自己的 Pod 选择算符

通常，当你创建一个 Job 对象时，你不会设置 `.spec.selector`。 系统的默认值填充逻辑会在创建 Job 时添加此字段。 它会选择一个不会与任何其他 Job 重叠的选择算符设置。

不过，有些场合下，你可能需要重载这个自动设置的选择算符。 为了实现这点，你可以手动设置 Job 的 `spec.selector` 字段。

做这个操作时请务必小心。 如果你所设定的标签选择算符并不唯一针对 Job 对应的 Pod 集合，甚或该算符还能匹配 其他无关的 Pod，这些无关的 Job 的 Pod 可能会被删除。 或者当前 Job 会将另外一些 Pod 当作是完成自身工作的 Pods， 又或者两个 Job 之一或者二者同时都拒绝创建 Pod，无法运行至完成状态。 如果所设置的算符不具有唯一性，其他控制器（如 RC 副本控制器）及其所管理的 Pod 集合可能会变得行为不可预测。 Kubernetes 不会在你设置 `.spec.selector` 时尝试阻止你犯这类错误。

下面是一个示例场景，在这种场景下你可能会使用刚刚讲述的特性。

假定名为 `old` 的 Job 已经处于运行状态。 你希望已有的 Pod 继续运行，但你希望 Job 接下来要创建的其他 Pod 使用一个不同的 Pod 模版，甚至希望 Job 的名字也发生变化。 你无法更新现有的 Job，因为这些字段都是不可更新的。 因此，你会删除 `old` Job，但 *允许该 Job 的 Pod 集合继续运行*。 这是通过 `kubectl delete jobs/old --cascade=orphan` 实现的。 在删除之前，我们先记下该 Job 所使用的选择算符。

```shell
kubectl get job old -o yaml
```

输出类似于：

```yaml
kind: Job
metadata:
  name: old
  ...
spec:
  selector:
    matchLabels:
      controller-uid: a8f3d00d-c6d2-11e5-9f87-42010af00002
  ...
```

接下来你会创建名为 `new` 的新 Job，并显式地为其设置相同的选择算符。 由于现有 Pod 都具有标签 `controller-uid=a8f3d00d-c6d2-11e5-9f87-42010af00002`， 它们也会被名为 `new` 的 Job 所控制。

你需要在新 Job 中设置 `manualSelector: true`，因为你并未使用系统通常自动为你 生成的选择算符。

```yaml
kind: Job
metadata:
  name: new
  ...
spec:
  manualSelector: true
  selector:
    matchLabels:
      controller-uid: a8f3d00d-c6d2-11e5-9f87-42010af00002
  ...
```

新的 Job 自身会有一个不同于 `a8f3d00d-c6d2-11e5-9f87-42010af00002` 的唯一 ID。 设置 `manualSelector: true` 是在告诉系统你知道自己在干什么并要求系统允许这种不匹配 的存在。

### 使用 Finalizer 追踪 Job 

**FEATURE STATE:** `Kubernetes v1.22 [alpha]`

**说明：**

要使用该行为，你必须为 [API 服务器](https://kubernetes.io/zh/docs/reference/command-line-tools-reference/kube-apiserver/) 和[控制器管理器](https://kubernetes.io/zh/docs/reference/command-line-tools-reference/kube-controller-manager/) 启用 `JobTrackingWithFinalizers` [特性门控](https://kubernetes.io/zh/docs/reference/command-line-tools-reference/feature-gates/)。 默认是禁用的。

启用后，控制面基于下述行为追踪新的 Job。现有 Job 不受影响。 作为用户，你会看到的唯一区别是控制面对 Job 完成情况的跟踪更加准确。

该功能未启用时，Job [控制器（Controller）](https://kubernetes.io/zh/docs/concepts/architecture/controller/) 依靠计算集群中存在的 Pod 来跟踪作业状态。 也就是说，维持一个统计 `succeeded` 和 `failed` 的 Pod 的计数器。 然而，Pod 可以因为一些原因被移除，包括：

- 当一个节点宕机时，垃圾收集器会删除孤立（Orphan）Pod。
- 垃圾收集器在某个阈值后删除已完成的 Pod（处于 `Succeeded` 或 `Failed` 阶段）。
- 人工干预删除 Job 的 Pod。
- 一个外部控制器（不包含于 Kubernetes）来删除或取代 Pod。

如果你为你的集群启用了 `JobTrackingWithFinalizers` 特性，控制面会跟踪属于任何 Job 的 Pod。 并注意是否有任何这样的 Pod 被从 API 服务器上删除。 为了实现这一点，Job 控制器创建的 Pod 带有 Finalizer `batch.kubernetes.io/job-tracking`。 控制器只有在 Pod 被记入 Job 状态后才会移除 Finalizer，允许 Pod 可以被其他控制器或用户删除。

Job 控制器只对新的 Job 使用新的算法。在启用该特性之前创建的 Job 不受影响。 你可以根据检查 Job 是否含有 `batch.kubernetes.io/job-tracking` 注解，来确定 Job 控制器是否正在使用 Pod Finalizer 追踪 Job。 你**不**应该给 Job 手动添加或删除该注解。

## 替代方案 

### 裸 Pod 

当 Pod 运行所在的节点重启或者失败，Pod 会被终止并且不会被重启。 Job 会重新创建新的 Pod 来替代已终止的 Pod。 因为这个原因，我们建议你使用 Job 而不是独立的裸 Pod， 即使你的应用仅需要一个 Pod。

### 副本控制器 

Job 与[副本控制器](https://kubernetes.io/zh/docs/concepts/workloads/controllers/replicationcontroller/)是彼此互补的。 副本控制器管理的是那些不希望被终止的 Pod （例如，Web 服务器）， Job 管理的是那些希望被终止的 Pod（例如，批处理作业）。

正如在 [Pod 生命期](https://kubernetes.io/zh/docs/concepts/workloads/pods/pod-lifecycle/) 中讨论的， `Job` 仅适合于 `restartPolicy` 设置为 `OnFailure` 或 `Never` 的 Pod。 注意：如果 `restartPolicy` 未设置，其默认值是 `Always`。

### 单个 Job 启动控制器 Pod

另一种模式是用唯一的 Job 来创建 Pod，而该 Pod 负责启动其他 Pod，因此扮演了一种 后启动 Pod 的控制器的角色。 这种模式的灵活性更高，但是有时候可能会把事情搞得很复杂，很难入门， 并且与 Kubernetes 的集成度很低。

这种模式的实例之一是用 Job 来启动一个运行脚本的 Pod，脚本负责启动 Spark 主控制器（参见 [Spark 示例](https://github.com/kubernetes/examples/tree/master/staging/spark/README.md)）， 运行 Spark 驱动，之后完成清理工作。

这种方法的优点之一是整个过程得到了 Job 对象的完成保障， 同时维持了对创建哪些 Pod、如何向其分派工作的完全控制能力，

# 已完成资源的 TTL 控制器

**FEATURE STATE:** `Kubernetes v1.21 [beta]`

TTL 控制器提供了一种 TTL 机制来限制已完成执行的资源对象的生命周期。 TTL 控制器目前只处理 [Job](https://kubernetes.io/zh/docs/concepts/workloads/controllers/job/)， 可能以后会扩展以处理将完成执行的其他资源，例如 Pod 和自定义资源。

此功能目前是 Beta 版而自动启用，并且可以通过 `kube-apiserver` 和 `kube-controller-manager` 上的 [特性门控](https://kubernetes.io/zh/docs/reference/command-line-tools-reference/feature-gates/) `TTLAfterFinished` 禁用。

## TTL 控制器

TTL 控制器现在只支持 Job。集群操作员可以通过指定 Job 的 `.spec.ttlSecondsAfterFinished` 字段来自动清理已结束的作业（`Complete` 或 `Failed`），如 [示例](https://kubernetes.io/zh/docs/concepts/workloads/controllers/job/#clean-up-finished-jobs-automatically) 所示。

TTL 控制器假设资源能在执行完成后的 TTL 秒内被清理，也就是当 TTL 过期后。 当 TTL 控制器清理资源时，它将做级联删除操作，即删除资源对象的同时也删除其依赖对象。 注意，当资源被删除时，由该资源的生命周期保证其终结器（Finalizers）等被执行。

可以随时设置 TTL 秒。以下是设置 Job 的 `.spec.ttlSecondsAfterFinished` 字段的一些示例：

- 在资源清单（manifest）中指定此字段，以便 Job 在完成后的某个时间被自动清除。
- 将此字段设置为现有的、已完成的资源，以采用此新功能。
- 在创建资源时使用 [mutating admission webhook](https://kubernetes.io/zh/docs/reference/access-authn-authz/extensible-admission-controllers/#admission-webhooks) 动态设置该字段。集群管理员可以使用它对完成的资源强制执行 TTL 策略。
- 使用 [mutating admission webhook](https://kubernetes.io/zh/docs/reference/access-authn-authz/extensible-admission-controllers/#admission-webhooks) 在资源完成后动态设置该字段，并根据资源状态、标签等选择不同的 TTL 值。

## 警告

### 更新 TTL 秒

请注意，在创建资源或已经执行结束后，仍可以修改其 TTL 周期，例如 Job 的 `.spec.ttlSecondsAfterFinished` 字段。 但是一旦 Job 变为可被删除状态（当其 TTL 已过期时），即使您通过 API 增加其 TTL 时长得到了成功的响应，系统也不保证 Job 将被保留。

### 时间偏差 

由于 TTL 控制器使用存储在 Kubernetes 资源中的时间戳来确定 TTL 是否已过期， 因此该功能对集群中的时间偏差很敏感，这可能导致 TTL 控制器在错误的时间清理资源对象。

在 Kubernetes 中，需要在所有节点上运行 NTP（参见 [#6159](https://github.com/kubernetes/kubernetes/issues/6159#issuecomment-93844058)） 以避免时间偏差。时钟并不总是如此正确，但差异应该很小。 设置非零 TTL 时请注意避免这种风险。

# CronJob

**FEATURE STATE:** `Kubernetes v1.21 [stable]`

*CronJob* 创建基于时隔重复调度的 [Jobs](https://kubernetes.io/zh/docs/concepts/workloads/controllers/job/)。

一个 CronJob 对象就像 *crontab* (cron table) 文件中的一行。 它用 [Cron](https://en.wikipedia.org/wiki/Cron) 格式进行编写， 并周期性地在给定的调度时间执行 Job。

> **注意：**
>
> 所有 **CronJob** 的 `schedule:` 时间都是基于 [kube-controller-manager](https://kubernetes.io/docs/reference/generated/kube-controller-manager/). 的时区。
>
> 如果你的控制平面在 Pod 或是裸容器中运行了 kube-controller-manager， 那么为该容器所设置的时区将会决定 Cron Job 的控制器所使用的时区。

> **注意：**
>
> 如 [v1 CronJob API](https://kubernetes.io/zh/docs/reference/kubernetes-api/workload-resources/cron-job-v1/) 所述，官方并不支持设置时区。
>
> Kubernetes 项目官方并不支持设置如 `CRON_TZ` 或者 `TZ` 等变量。 `CRON_TZ` 或者 `TZ` 是用于解析和计算下一个 Job 创建时间所使用的内部库中一个实现细节。 不建议在生产集群中使用它。
>
> 为 CronJob 资源创建清单时，请确保所提供的名称是一个合法的 [DNS 子域名](https://kubernetes.io/zh/docs/concepts/overview/working-with-objects/names#dns-subdomain-names). 名称不能超过 52 个字符。 这是因为 CronJob 控制器将自动在提供的 Job 名称后附加 11 个字符，并且存在一个限制， 即 Job 名称的最大长度不能超过 63 个字符。

## CronJob

CronJob 用于执行周期性的动作，例如备份、报告生成等。 这些任务中的每一个都应该配置为周期性重复的（例如：每天/每周/每月一次）； 你可以定义任务开始执行的时间间隔。

### 示例

下面的 CronJob 示例清单会在每分钟打印出当前时间和问候消息(application/job/cronjob.yaml)：

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: hello
spec:
  schedule: "*/1 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: hello
            image: busybox
            imagePullPolicy: IfNotPresent
            command:
            - /bin/sh
            - -c
            - date; echo Hello from the Kubernetes cluster
          restartPolicy: OnFailure

```

[使用 CronJob 运行自动化任务](https://kubernetes.io/zh/docs/tasks/job/automated-tasks-with-cron-jobs/) 一文会为你详细讲解此例。

### Cron 时间表语法

```
# ┌───────────── 分钟 (0 - 59)
# │ ┌───────────── 小时 (0 - 23)
# │ │ ┌───────────── 月的某天 (1 - 31)
# │ │ │ ┌───────────── 月份 (1 - 12)
# │ │ │ │ ┌───────────── 周的某天 (0 - 6)（周日到周一；在某些系统上，7 也是星期日）
# │ │ │ │ │
# │ │ │ │ │
# │ │ │ │ │
# * * * * *
# ┌───────────── 分钟 (0 - 59)
# │ ┌───────────── 小时 (0 - 23)
# │ │ ┌───────────── 月的某天 (1 - 31)
# │ │ │ ┌───────────── 月份 (1 - 12)
# │ │ │ │ ┌───────────── 周的某天 (0 - 6) （周日到周一；在某些系统上，7 也是星期日）
# │ │ │ │ │
# │ │ │ │ │
# │ │ │ │ │
# * * * * *
```

| 输入                   | 描述                         | 相当于    |
| ---------------------- | ---------------------------- | --------- |
| @yearly (or @annually) | 每年 1 月 1 日的午夜运行一次 | 0 0 1 1 * |
| @monthly               | 每月第一天的午夜运行一次     | 0 0 1 * * |
| @weekly                | 每周的周日午夜运行一次       | 0 0 * * 0 |
| @daily (or @midnight)  | 每天午夜运行一次             | 0 0 * * * |
| @hourly                | 每小时的开始一次             | 0 * * * * |

例如，下面这行指出必须在每个星期五的午夜以及每个月 13 号的午夜开始任务：

```
0 0 13 * 5
```

要生成 CronJob 时间表表达式，你还可以使用 [crontab.guru](https://crontab.guru/) 之类的 Web 工具。

## CronJob 限制 

CronJob 根据其计划编排，在每次该执行任务的时候大约会创建一个 Job。 我们之所以说 "大约"，是因为在某些情况下，可能会创建两个 Job，或者不会创建任何 Job。 我们试图使这些情况尽量少发生，但不能完全杜绝。因此，Job 应该是 *幂等的*。

如果 `startingDeadlineSeconds` 设置为很大的数值或未设置（默认），并且 `concurrencyPolicy` 设置为 `Allow`，则作业将始终至少运行一次。

> **注意：**如果 `startingDeadlineSeconds` 的设置值低于 10 秒钟，CronJob 可能无法被调度。 这是因为 CronJob 控制器每 10 秒钟执行一次检查。



对于每个 CronJob，CronJob [控制器（Controller）](https://kubernetes.io/zh/docs/concepts/architecture/controller/) 检查从上一次调度的时间点到现在所错过了调度次数。如果错过的调度次数超过 100 次， 那么它就不会启动这个任务，并记录这个错误:

```
Cannot determine if job needs to be started. Too many missed start time (> 100). Set or decrease .spec.startingDeadlineSeconds or check clock skew.
```

需要注意的是，如果 `startingDeadlineSeconds` 字段非空，则控制器会统计从 `startingDeadlineSeconds` 设置的值到现在而不是从上一个计划时间到现在错过了多少次 Job。 例如，如果 `startingDeadlineSeconds` 是 `200`，则控制器会统计在过去 200 秒中错过了多少次 Job。

如果未能在调度时间内创建 CronJob，则计为错过。 例如，如果 `concurrencyPolicy` 被设置为 `Forbid`，并且当前有一个调度仍在运行的情况下， 试图调度的 CronJob 将被计算为错过。

例如，假设一个 CronJob 被设置为从 `08:30:00` 开始每隔一分钟创建一个新的 Job， 并且它的 `startingDeadlineSeconds` 字段未被设置。如果 CronJob 控制器从 `08:29:00` 到 `10:21:00` 终止运行，则该 Job 将不会启动，因为其错过的调度 次数超过了 100。

为了进一步阐述这个概念，假设将 CronJob 设置为从 `08:30:00` 开始每隔一分钟创建一个新的 Job， 并将其 `startingDeadlineSeconds` 字段设置为 200 秒。 如果 CronJob 控制器恰好在与上一个示例相同的时间段（`08:29:00` 到 `10:21:00`）终止运行， 则 Job 仍将从 `10:22:00` 开始。 造成这种情况的原因是控制器现在检查在最近 200 秒（即 3 个错过的调度）中发生了多少次错过的 Job 调度，而不是从现在为止的最后一个调度时间开始。

CronJob 仅负责创建与其调度时间相匹配的 Job，而 Job 又负责管理其代表的 Pod。

## 控制器版本 

从 Kubernetes v1.21 版本开始，CronJob 控制器的第二个版本被用作默认实现。 要禁用此默认 CronJob 控制器而使用原来的 CronJob 控制器，请在 [kube-controller-manager](https://kubernetes.io/docs/reference/generated/kube-controller-manager/) 中设置[特性门控](https://kubernetes.io/zh/docs/reference/command-line-tools-reference/feature-gates/) `CronJobControllerV2`，将此标志设置为 `false`。例如：

```
--feature-gates="CronJobControllerV2=false"
```
