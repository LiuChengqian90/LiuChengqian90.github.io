---
title: 学习Kubernetes系列3——容器
date: 2021-06-10 13:20:44
categories:
tags:
  - Kubernetes
  - k8s
typora-root-url: ../../../source
---

# 容器

每个运行的容器都是可重复的； 包含依赖环境在内的标准，意味着无论您在哪里运行它，您都会得到相同的行为。

容器将应用程序从底层的主机设施中解耦。 这使得在不同的云或 OS 环境中部署更加容易。

<!--more-->

# 镜像

容器镜像（Image）所承载的是**封装了应用程序及其所有软件依赖的二进制数据**。 容器镜像是可执行的软件包，可以单独运行；该软件包对所处的运行时环境具有 良定（Well Defined）的假定。

你通常会创建应用的容器镜像并将其推送到某仓库（Registry），然后在 Pod中引用它。

## 镜像名称 

容器镜像通常会被赋予 `pause`、`example/mycontainer` 或者 `kube-apiserver` 这类的名称。 镜像名称也可以包含所在仓库的主机名。例如：`fictional.registry.example/imagename`。 还可以包含仓库的端口号，例如：`fictional.registry.example:10443/imagename`。

如果你不指定仓库的主机名，Kubernetes 认为你在使用 Docker 公共仓库。

在镜像名称之后，你可以添加一个 *标签（Tag）* （就像在 `docker` 或 `podman` 中也在用的那样）。 使用标签能让你辨识同一镜像序列中的不同版本。

镜像标签可以包含小写字母、大写字母、数字、下划线（`_`）、句点（`.`）和连字符（`-`）。 关于在镜像标签中何处可以使用分隔字符（`_`、`-` 和 `.`）还有一些额外的规则。 如果你不指定标签，Kubernetes 认为你想使用标签 `latest`。

## 更新镜像 

当你最初创建一个 [Deployment](https://kubernetes.io/zh/docs/concepts/workloads/controllers/deployment/)、 [StatefulSet](https://kubernetes.io/zh/docs/concepts/workloads/controllers/statefulset/)、Pod 或者其他包含 Pod 模板的对象时，如果没有显式设定的话，Pod 中所有容器的默认镜像 拉取策略是 `IfNotPresent`。这一策略会使得 [kubelet](https://kubernetes.io/docs/reference/generated/kubelet) 在镜像已经存在的情况下直接略过拉取镜像的操作。

### 镜像拉取策略 

容器的 `imagePullPolicy` 和镜像的标签会影响 [kubelet](https://kubernetes.io/zh/docs/reference/command-line-tools-reference/kubelet/) 尝试拉取（下载）指定的镜像。

以下列表包含了 `imagePullPolicy` 可以设置的值，以及这些值的效果：

- `IfNotPresent`

  只有当镜像在本地不存在时才会拉取。

- `Always`

  每当 kubelet 启动一个容器时，kubelet 会查询容器的镜像仓库， 将名称解析为一个镜像[摘要](https://docs.docker.com/engine/reference/commandline/pull/#pull-an-image-by-digest-immutable-identifier)。 如果 kubelet 有一个容器镜像，并且对应的摘要已在本地缓存，kubelet 就会使用其缓存的镜像； 否则，kubelet 就会使用解析后的摘要拉取镜像，并使用该镜像来启动容器。

- `Never`

  Kubelet 不会尝试获取镜像。如果镜像已经以某种方式存在本地， kubelet 会尝试启动容器；否则，会启动失败。 

只要能够可靠地访问镜像仓库，底层镜像提供者的缓存语义甚至可以使 `imagePullPolicy: Always` 高效。 你的容器运行时可以注意到节点上已经存在的镜像层，这样就不需要再次下载。

> 在生产环境中部署容器时，你应该避免使用 `:latest` 标签，因为这使得正在运行的镜像的版本难以追踪，并且难以正确地回滚。
>
> 相反，应指定一个有意义的标签，如 `v1.42.0`。

为了确保 Pod 总是使用相同版本的容器镜像，你可以指定镜像的摘要； 将 `<image-name>:<tag>` 替换为 `<image-name>@<digest>`，例如 `image@sha256:45b23dee08af5e43a7fea6c4cf9c25ccf269ee113168c19722f87876677c5cb2`。

当使用镜像标签时，如果镜像仓库修改了代码所对应的镜像标签，可能会出现新旧代码混杂在 Pod 中运行的情况。 **镜像摘要唯一标识了镜像的特定版本，因此 Kubernetes 每次启动具有指定镜像名称和摘要的容器时，都会运行相同的代码**。 指定一个镜像可以固定你所运行的代码，这样镜像仓库的变化就不会导致版本的混杂。

#### 默认镜像拉取策略 

当你（或控制器）向 API 服务器提交一个新的 Pod 时，你的集群会在满足特定条件时设置 `imagePullPolicy `字段：

- 如果你省略了 `imagePullPolicy` 字段，并且容器镜像的标签是 `:latest`， `imagePullPolicy` 会自动设置为 `Always`。
- 如果你省略了 `imagePullPolicy` 字段，并且没有指定容器镜像的标签， `imagePullPolicy` 会自动设置为 `Always`。
- 如果你省略了 `imagePullPolicy` 字段，并且为容器镜像指定了非 `:latest` 的标签， `imagePullPolicy` 就会自动设置为 `IfNotPresent`。

> 容器的 `imagePullPolicy` 的值总是在对象初次 *创建* 时设置的，如果后来镜像的标签发生变化，则不会更新。
>
> 例如，如果你用一个 *非* `:latest` 的镜像标签创建一个 Deployment， 并在随后更新该 Deployment 的镜像标签为 `:latest`，则 `imagePullPolicy` 字段 *不会* 变成 `Always`。 你必须手动更改已经创建的资源的拉取策略。

#### 必要的镜像拉取 

如果你想总是强制执行拉取，你可以使用下述的一中方式：

- 设置容器的 `imagePullPolicy` 为 `Always`。
- 省略 `imagePullPolicy`，并使用 `:latest` 作为镜像标签； 当你提交 Pod 时，Kubernetes 会将策略设置为 `Always`。
- 省略 `imagePullPolicy` 和镜像的标签； 当你提交 Pod 时，Kubernetes 会将策略设置为 `Always`。
- 启用准入控制器 [AlwaysPullImages](https://kubernetes.io/zh/docs/reference/access-authn-authz/admission-controllers/#alwayspullimages)。

### ImagePullBackOff

当 kubelet 使用容器运行时创建 Pod 时，容器可能因为 `ImagePullBackOff` 导致状态为 [Waiting](https://kubernetes.io/zh/docs/concepts/workloads/pods/pod-lifecycle/#container-state-waiting)。

`ImagePullBackOff` 状态意味着容器无法启动， 因为 Kubernetes 无法拉取容器镜像（原因包括无效的镜像名称，或从私有仓库拉取而没有 `imagePullSecret`）。 `BackOff` 部分表示 Kubernetes 将继续尝试拉取镜像，并增加回退延迟。

Kubernetes 会增加每次尝试之间的延迟，直到达到编译限制，即 300 秒（5 分钟）。

## 带镜像索引的多架构镜像 

除了提供二进制的镜像之外，容器仓库也可以提供 [容器镜像索引](https://github.com/opencontainers/image-spec/blob/master/image-index.md)。 镜像索引可以根据特定于体系结构版本的容器指向镜像的多个 [镜像清单](https://github.com/opencontainers/image-spec/blob/master/manifest.md)。 这背后的理念是让你可以为镜像命名（例如：`pause`、`example/mycontainer`、`kube-apiserver`） 的同时，允许不同的系统基于它们所使用的机器体系结构取回正确的二进制镜像。

Kubernetes 自身通常在命名容器镜像时添加后缀 `-$(ARCH)`。 为了向前兼容，请在生成较老的镜像时也提供后缀。 这里的理念是为某镜像（如 `pause`）生成针对所有平台都适用的清单时， 生成 `pause-amd64` 这类镜像，以便较老的配置文件或者将镜像后缀影编码到其中的 YAML 文件也能兼容。

## 使用私有仓库 

从私有仓库读取镜像时可能需要密钥。 凭证可以用以下方式提供:

- 配置节点向私有仓库进行身份验证
  - 所有 Pod 均可读取任何已配置的私有仓库
  - 需要集群管理员配置节点
- 预拉镜像
  - 所有 Pod 都可以使用节点上缓存的所有镜像
  - 需要所有节点的 root 访问权限才能进行设置
- 在 Pod 中设置 ImagePullSecrets
  - 只有提供自己密钥的 Pod 才能访问私有仓库
- 特定于厂商的扩展或者本地扩展
  - 如果你在使用定制的节点配置，你（或者云平台提供商）可以实现让节点 向容器仓库认证的机制

### 配置 Node 对私有仓库认证

如果你在节点上运行的是 Docker，你可以配置 Docker 容器运行时来向私有容器仓库认证身份。

此方法适用于能够对节点进行配置的场合。

> Kubernetes 默认仅支持 Docker 配置中的 `auths` 和 `HttpHeaders` 部分， 不支持 Docker 凭据辅助程序（`credHelpers` 或 `credsStore`）。

Docker 将私有仓库的密钥保存在 `$HOME/.dockercfg` 或 `$HOME/.docker/config.json` 文件中。如果你将相同的文件放在下面所列的搜索路径中，`kubelet` 会在拉取镜像时将其用作凭据 数据来源：

- `{--root-dir:-/var/lib/kubelet}/config.json`
- `{kubelet 当前工作目录}/config.json`
- `${HOME}/.docker/config.json`
- `/.docker/config.json`
- `{--root-dir:-/var/lib/kubelet}/.dockercfg`
- `{kubelet 当前工作目录}/.dockercfg`
- `${HOME}/.dockercfg`
- `/.dockercfg`

> 可能不得不为 `kubelet` 进程显式地设置 `HOME=/root` 环境变量。

推荐采用如下步骤来配置节点以便访问私有仓库。

1. 针对你要使用的每组凭据，运行 `docker login [服务器]` 命令。这会更新 你本地环境中的 `$HOME/.docker/config.json` 文件。
2. 在编辑器中打开查看 `$HOME/.docker/config.json` 文件，确保其中仅包含你要 使用的凭据信息。
3. 获得节点列表；例如：
   - 如果想要节点名称：`nodes=$(kubectl get nodes -o jsonpath='{range.items[*].metadata}{.name} {end}')`
   - 如果想要节点 IP ，`nodes=$(kubectl get nodes -o jsonpath='{range .items[*].status.addresses[?(@.type=="ExternalIP")]}{.address} {end}')`
4. 将本地的 `.docker/config.json` 拷贝到所有节点，放入如上所列的目录之一：
   - 例如，可以试一下：`for n in $nodes; do scp ~/.docker/config.json root@"$n":/var/lib/kubelet/config.json; done`

创建使用私有镜像的 Pod 来验证。例如：

```shell
kubectl apply -f - <<EOF
apiVersion: v1
kind: Pod
metadata:
  name: private-image-test-1
spec:
  containers:
    - name: uses-private-image
      image: $PRIVATE_IMAGE_NAME
      imagePullPolicy: Always
      command: [ "echo", "SUCCESS" ]
EOF
```

输出类似于：

```
pod/private-image-test-1 created
```

如果一切顺利，那么一段时间后你可以执行：

```shell
kubectl logs private-image-test-1
```

然后可以看到命令的输出：

```
SUCCESS
```

如果你怀疑命令失败了，你可以运行：

```shell
kubectl describe pods/private-image-test-1 | grep 'Failed'
```

如果命令确实失败，输出类似于：

```
  Fri, 26 Jun 2015 15:36:13 -0700    Fri, 26 Jun 2015 15:39:13 -0700    19    {kubelet node-i2hq}    spec.containers{uses-private-image}    failed        Failed to pull image "user/privaterepo:v1": Error: image user/privaterepo:v1 not found
```

你必须确保集群中所有节点的 `.docker/config.json` 文件内容相同。 否则，Pod 会能在一些节点上正常运行而无法在另一些节点上启动。 例如，如果使用节点自动扩缩，那么每个实例模板都需要包含 `.docker/config.json`， 或者挂载一个包含该文件的驱动器。

在 `.docker/config.json` 中配置了私有仓库密钥后，所有 Pod 都将能读取私有仓库中的镜像。

### config.json 说明

对于 `config.json` 的解释在原始 Docker 实现和 Kubernetes 的解释之间有所不同。 在 Docker 中，`auths` 键只能指定根 URL ，而 Kubernetes 允许 glob URLs 以及 前缀匹配的路径。这意味着，像这样的 `config.json` 是有效的：

```json
{
    "auths": {
        "*my-registry.io/images": {
            "auth": "…"
        }
    }
}
```

使用以下语法匹配根 URL （`*my-registry.io`）：

```
pattern:
    { term }

term:
    '*'         匹配任何无分隔符字符序列
    '?'         匹配任意单个非分隔符
    '[' [ '^' ] 字符范围
                  字符集（必须非空）
    c           匹配字符 c （c 不为 '*','?','\\','['）
    '\\' c      匹配字符 c

字符范围: 
    c           匹配字符 c （c 不为 '\\','?','-',']'）
    '\\' c      匹配字符 c
    lo '-' hi   匹配字符范围在 lo 到 hi 之间字符
```

现在镜像拉取操作会将每种有效模式的凭据都传递给 CRI 容器运行时。例如下面的容器镜像名称会匹配成功：

- `my-registry.io/images`
- `my-registry.io/images/my-image`
- `my-registry.io/images/another-image`
- `sub.my-registry.io/images/my-image`
- `a.sub.my-registry.io/images/my-image`

kubelet 为每个找到的凭证的镜像按顺序拉取。 这意味着在 `config.json` 中可能有多项：

```json
{
    "auths": {
        "my-registry.io/images": {
            "auth": "…"
        },
        "my-registry.io/images/subpath": {
            "auth": "…"
        }
    }
}
```

如果一个容器指定了要拉取的镜像 `my-registry.io/images/subpath/my-image`， 并且其中一个失败，kubelet 将尝试从另一个身份验证源下载镜像。

### 提前拉取镜像 

> 该方法适用于你能够控制节点配置的场合。 如果你的云供应商负责管理节点并自动置换节点，这一方案无法可靠地工作。

默认情况下，`kubelet` 会尝试从指定的仓库拉取每个镜像。 但是，如果容器属性 `imagePullPolicy` 设置为 `IfNotPresent` 或者 `Never`， 则会优先使用（对应 `IfNotPresent`）或者一定使用（对应 `Never`）本地镜像。

如果你希望使用提前拉取镜像的方法代替仓库认证，就必须保证集群中所有节点提前拉取的镜像是相同的。

这一方案可以用来提前载入指定的镜像以提高速度，或者作为向私有仓库执行身份认证的一种替代方案。

所有的 Pod 都可以使用节点上提前拉取的镜像。

### 在 Pod 上指定 ImagePullSecrets

> 运行使用私有仓库中镜像的容器时，建议使用这种方法。

Kubernetes 支持在 Pod 中设置容器镜像仓库的密钥。

#### 使用 Docker Config 创建 Secret 

运行以下命令，将大写字母代替为合适的值：

```shell
kubectl create secret docker-registry <名称> \
  --docker-server=DOCKER_REGISTRY_SERVER \
  --docker-username=DOCKER_USER \
  --docker-password=DOCKER_PASSWORD \
  --docker-email=DOCKER_EMAIL
```

如果你已经有 Docker 凭据文件，则可以将凭据文件导入为 Kubernetes [Secret](https://kubernetes.io/zh/docs/concepts/configuration/secret/)， 而不是执行上面的命令。 [基于已有的 Docker 凭据创建 Secret](https://kubernetes.io/zh/docs/tasks/configure-pod-container/pull-image-private-registry/#registry-secret-existing-credentials) 解释了如何完成这一操作。

如果你在使用多个私有容器仓库，这种技术将特别有用。 原因是 `kubectl create secret docker-registry` 创建的是仅适用于某个私有仓库的 Secret。

> Pod 只能引用位于自身所在名字空间中的 Secret，因此需要针对每个名字空间 重复执行上述过程。

#### 在 Pod 中引用 ImagePullSecrets

现在，在创建 Pod 时，可以在 Pod 定义中增加 `imagePullSecrets` 部分来引用该 Secret。

例如：

```shell
cat <<EOF > pod.yaml
apiVersion: v1
kind: Pod
metadata:
  name: foo
  namespace: awesomeapps
spec:
  containers:
    - name: foo
      image: janedoe/awesomeapp:v1
  imagePullSecrets:
    - name: myregistrykey
EOF

cat <<EOF >> ./kustomization.yaml
resources:
- pod.yaml
EOF
```

你需要对使用私有仓库的每个 Pod 执行以上操作。 不过，设置该字段的过程也可以通过为 [服务账号](https://kubernetes.io/zh/docs/tasks/configure-pod-container/configure-service-account/) 资源设置 `imagePullSecrets` 来自动完成。 有关详细指令可参见 [将 ImagePullSecrets 添加到服务账号](https://kubernetes.io/zh/docs/tasks/configure-pod-container/configure-service-account/#add-imagepullsecrets-to-a-service-account)。

你也可以将此方法与节点级别的 `.docker/config.json` 配置结合使用。 来自不同来源的凭据会被合并。

# 容器环境

Kubernetes 的容器环境给容器提供了几个重要的资源：

- 文件系统，其中包含一个[镜像](https://kubernetes.io/zh/docs/concepts/containers/images/) 和一个或多个的[卷](https://kubernetes.io/zh/docs/concepts/storage/volumes/)
- 容器自身的信息
- 集群中其他对象的信息

### 容器信息

容器的 *hostname* 是它所运行在的 pod 的名称。它可以通过 `hostname` 命令或者调用 libc 中的 [`gethostname`](https://man7.org/linux/man-pages/man2/gethostname.2.html) 函数来获取。

Pod 名称和命名空间可以通过 [下行 API](https://kubernetes.io/zh/docs/tasks/inject-data-application/downward-api-volume-expose-pod-information/) 转换为环境变量。

Pod 定义中的用户所定义的环境变量也可在容器中使用，就像在 Docker 镜像中静态指定的任何环境变量一样。

### 集群信息

创建容器时正在运行的所有服务都可用作该容器的环境变量。 这里的服务仅限于新容器的 Pod 所在的名字空间中的服务，以及 Kubernetes 控制面的服务。 这些环境变量与 Docker 链接的语法相同。

对于名为 *foo* 的服务，当映射到名为 *bar* 的容器时，以下变量是被定义了的：

```shell
FOO_SERVICE_HOST=<the host the service is running on>
FOO_SERVICE_PORT=<the port the service is running on>
```

服务具有专用的 IP 地址。如果启用了 [DNS 插件](https://releases.k8s.io/v1.23.0/cluster/addons/dns/)， 可以在容器中通过 DNS 来访问服务。

# 容器运行时类（Runtime Class）

**FEATURE STATE:** `Kubernetes v1.20 [stable]`

本页面描述了 RuntimeClass 资源和运行时的选择机制。

RuntimeClass 是一个用于选择容器运行时配置的特性，容器运行时配置用于运行 Pod 中的容器。

## 动机 

你可以在**不同的 Pod 设置不同的 RuntimeClass**，以提供性能与安全性之间的平衡。 例如，如果你的部分工作负载需要高级别的信息安全保证，你可以决定在调度这些 Pod 时尽量使它们在使用**硬件虚拟化**的容器运行时中运行。 这样，你将从这些不同运行时所提供的额外隔离中获益，代价是一些额外的开销。

你还可以使用 RuntimeClass 运行**具有相同容器运行时但具有不同设置的 Pod**。

## 设置 

1. 在节点上配置 CRI 的实现（取决于所选用的运行时）
2. 创建相应的 RuntimeClass 资源

### 1. 在节点上配置 CRI 实现

RuntimeClass 的配置依赖于 运行时接口（CRI）的实现。 

> RuntimeClass 假设集群中的节点配置是同构的（换言之，所有的节点在容器运行时方面的配置是相同的）。 如果需要支持异构节点，配置方法请参阅下面的 调度 章节。

所有这些配置都具有相应的 `handler` 名，并被 RuntimeClass 引用。 handler 必须是有效的 [DNS 标签名](https://kubernetes.io/zh/docs/concepts/overview/working-with-objects/names/#dns-label-names)。

### 创建相应的 RuntimeClass 资源

在上面步骤 1 中，每个配置都需要有一个用于标识配置的 `handler`。 针对每个 handler 需要创建一个 RuntimeClass 对象。

RuntimeClass 资源当前只有两个重要的字段：RuntimeClass 名 (`metadata.name`) 和 handler (`handler`)。 对象定义如下所示：

```yaml
apiVersion: node.k8s.io/v1  # RuntimeClass 定义于 node.k8s.io API 组
kind: RuntimeClass
metadata:
  name: myclass  # 用来引用 RuntimeClass 的名字
  # RuntimeClass 是一个集群层面的资源
handler: myconfiguration  # 对应的 CRI 配置的名称
```

> 建议将 RuntimeClass 写操作（create、update、patch 和 delete）限定于集群管理员使用。 通常这是默认配置。参阅[授权概述](https://kubernetes.io/zh/docs/reference/access-authn-authz/authorization/)了解更多信息。

## 使用说明 

一旦完成集群中 RuntimeClasses 的配置，使用起来非常方便。 在 Pod spec 中指定 `runtimeClassName` 即可。例如:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: mypod
spec:
  runtimeClassName: myclass
  # ...
```

这一设置会告诉 kubelet 使用所指的 RuntimeClass 来运行该 pod。 如果所指的 RuntimeClass 不存在或者 CRI 无法运行相应的 handler， 那么 pod 将会进入 `Failed` 终止[阶段](https://kubernetes.io/zh/docs/concepts/workloads/pods/pod-lifecycle/#pod-phase)。 你可以查看相应的[事件](https://kubernetes.io/zh/docs/tasks/debug-application-cluster/debug-application-introspection/)， 获取执行过程中的错误信息。

如果未指定 `runtimeClassName` ，则将使用默认的 RuntimeHandler，相当于禁用 RuntimeClass 功能特性。

### CRI 配置 

关于如何安装 CRI 运行时，请查阅 [CRI 安装](https://kubernetes.io/zh/docs/setup/production-environment/container-runtimes/)。

#### dockershim

为 dockershim 设置 RuntimeClass 时，必须将运行时处理程序设置为 `docker`。 Dockershim 不支持自定义的可配置的运行时处理程序。

#### [containerd](https://containerd.io/)

通过 containerd 的 `/etc/containerd/config.toml` 配置文件来配置运行时 handler。 handler 需要配置在 runtimes 块中：

```
[plugins."io.containerd.grpc.v1.cri".containerd.runtimes.${HANDLER_NAME}]
```

更详细信息，请查阅 containerd 配置文档： https://github.com/containerd/cri/blob/master/docs/config.md

#### [cri-o](https://cri-o.io/)

通过 cri-o 的 `/etc/crio/crio.conf` 配置文件来配置运行时 handler。 handler 需要配置在 [crio.runtime 表](https://github.com/kubernetes-sigs/cri-o/blob/master/docs/crio.conf.5.md#crioruntime-table) 下面：

```
[crio.runtime.runtimes.${HANDLER_NAME}]
  runtime_path = "${PATH_TO_BINARY}"
```

更详细信息，请查阅 CRI-O [配置文档](https://github.com/cri-o/cri-o/blob/master/docs/crio.conf.5.md)。

## 调度 

**FEATURE STATE:** `Kubernetes v1.16 [beta]`

通过为 RuntimeClass 指定 `scheduling` 字段， 你可以通过设置约束，确保运行该 RuntimeClass 的 Pod 被调度到支持该 RuntimeClass 的节点上。 如果未设置 `scheduling`，则假定所有节点均支持此 RuntimeClass 。

为了确保 pod 会被调度到支持指定运行时的 node 上，每个 node 需要设置一个通用的 label 用于被 `runtimeclass.scheduling.nodeSelector` 挑选。在 admission 阶段，RuntimeClass 的 nodeSelector 将会与 pod 的 nodeSelector 合并，取二者的交集。如果有冲突，pod 将会被拒绝。

如果 node 需要阻止某些需要特定 RuntimeClass 的 pod，可以在 `tolerations` 中指定。 与 `nodeSelector` 一样，tolerations 也在 admission 阶段与 pod 的 tolerations 合并，取二者的并集。

更多有关 node selector 和 tolerations 的配置信息，请查阅 [将 Pod 分派到节点](https://kubernetes.io/zh/docs/concepts/scheduling-eviction/assign-pod-node/)。

### Pod 开销 

**FEATURE STATE:** `Kubernetes v1.18 [beta]`

你可以指定与运行 Pod 相关的 *开销* 资源。声明开销即允许集群（包括调度器）在决策 Pod 和资源时将其考虑在内。 若要使用 Pod 开销特性，你必须确保 PodOverhead [特性门控](https://kubernetes.io/zh/docs/reference/command-line-tools-reference/feature-gates/) 处于启用状态（默认为启用状态）。

Pod 开销通过 RuntimeClass 的 `overhead` 字段定义。 通过使用这些字段，你可以指定使用该 RuntimeClass 运行 Pod 时的开销并确保 Kubernetes 将这些开销计算在内。

# 容器生命周期回调

描述了 kubelet 管理的容器如何使用容器生命周期回调框架， 藉由其管理生命周期中的事件触发，运行指定代码。

## 概述

类似于许多具有生命周期回调组件的编程语言框架，例如 Angular、Kubernetes 为容器提供了生命周期回调。 回调使容器能够了解其管理生命周期中的事件，并在执行相应的生命周期回调时运行在处理程序中实现的代码。

## 容器回调

有两个回调暴露给容器：

```
PostStart
```

这个回调在容器被创建之后立即被执行。 但是，不能保证回调会在容器入口点（ENTRYPOINT）之前执行。 没有参数传递给处理程序。

```
PreStop
```

在容器因 API 请求或者管理事件（诸如存活态探针、启动探针失败、资源抢占、资源竞争等） 而被终止之前，此回调会被调用。 如果容器已经处于已终止或者已完成状态，则对 preStop 回调的调用将失败。 在用来停止容器的 TERM 信号被发出之前，回调必须执行结束。 Pod 的终止宽限周期在 `PreStop` 回调被执行之前即开始计数，所以无论 回调函数的执行结果如何，容器最终都会在 Pod 的终止宽限期内被终止。 没有参数会被传递给处理程序。

有关终止行为的更详细描述，请参见 [终止 Pod](https://kubernetes.io/zh/docs/concepts/workloads/pods/pod-lifecycle/#termination-of-pods)。

### 回调处理程序的实现

容器可以通过实现和注册该回调的处理程序来访问该回调。 针对容器，有两种类型的回调处理程序可供实现：

- Exec - 在容器的 cgroups 和名称空间中执行特定的命令（例如 `pre-stop.sh`）。 命令所消耗的资源计入容器的资源消耗。
- HTTP - 对容器上的特定端点执行 HTTP 请求。

### 回调处理程序执行

当调用容器生命周期管理回调时，Kubernetes 管理系统根据回调动作执行其处理程序， `httpGet` 和 `tcpSocket` 在kubelet 进程执行，而 `exec` 则由容器内执行 。

回调处理程序调用在包含容器的 Pod 上下文中是同步的。 这意味着对于 `PostStart` 回调，容器入口点和回调异步触发。 但是，如果回调运行或挂起的时间太长，则容器无法达到 `running` 状态。

`PreStop` 回调并不会与停止容器的信号处理程序异步执行；回调必须在 可以发送信号之前完成执行。 如果 `PreStop` 回调在执行期间停滞不前，Pod 的阶段会变成 `Terminating` 并且一致处于该状态，直到其 `terminationGracePeriodSeconds` 耗尽为止， 这时 Pod 会被杀死。 这一宽限期是针对 `PreStop` 回调的执行时间及容器正常停止时间的总和而言的。 例如，如果 `terminationGracePeriodSeconds` 是 60，回调函数花了 55 秒钟 完成执行，而容器在收到信号之后花了 10 秒钟来正常结束，那么容器会在其 能够正常结束之前即被杀死，因为 `terminationGracePeriodSeconds` 的值 小于后面两件事情所花费的总时间（55+10）。

如果 `PostStart` 或 `PreStop` 回调失败，它会杀死容器。

用户应该使他们的回调处理程序尽可能的轻量级。 但也需要考虑长时间运行的命令也很有用的情况，比如在停止容器之前保存状态。

### 回调递送保证

回调的递送应该是 *至少一次*，这意味着对于任何给定的事件， 例如 `PostStart` 或 `PreStop`，回调可以被调用多次。 如何正确处理被多次调用的情况，是回调实现所要考虑的问题。

通常情况下，只会进行单次递送。 例如，如果 HTTP 回调接收器宕机，无法接收流量，则不会尝试重新发送。 然而，偶尔也会发生重复递送的可能。 例如，如果 kubelet 在发送回调的过程中重新启动，回调可能会在 kubelet 恢复后重新发送。

### 调试回调处理程序

回调处理程序的日志不会在 Pod 事件中公开。 如果处理程序由于某种原因失败，它将播放一个事件。 对于 `PostStart`，这是 `FailedPostStartHook` 事件，对于 `PreStop`，这是 `FailedPreStopHook` 事件。 您可以通过运行 `kubectl describe pod <pod_name>` 命令来查看这些事件。 下面是运行这个命令的一些事件输出示例:

```
Events:
  FirstSeen    LastSeen    Count    From                            SubobjectPath        Type        Reason        Message
  ---------    --------    -----    ----                            -------------        --------    ------        -------
  1m        1m        1    {default-scheduler }                                Normal        Scheduled    Successfully assigned test-1730497541-cq1d2 to gke-test-cluster-default-pool-a07e5d30-siqd
  1m        1m        1    {kubelet gke-test-cluster-default-pool-a07e5d30-siqd}    spec.containers{main}    Normal        Pulling        pulling image "test:1.0"
  1m        1m        1    {kubelet gke-test-cluster-default-pool-a07e5d30-siqd}    spec.containers{main}    Normal        Created        Created container with docker id 5c6a256a2567; Security:[seccomp=unconfined]
  1m        1m        1    {kubelet gke-test-cluster-default-pool-a07e5d30-siqd}    spec.containers{main}    Normal        Pulled        Successfully pulled image "test:1.0"
  1m        1m        1    {kubelet gke-test-cluster-default-pool-a07e5d30-siqd}    spec.containers{main}    Normal        Started        Started container with docker id 5c6a256a2567
  38s        38s        1    {kubelet gke-test-cluster-default-pool-a07e5d30-siqd}    spec.containers{main}    Normal        Killing        Killing container with docker id 5c6a256a2567: PostStart handler: Error executing in Docker Container: 1
  37s        37s        1    {kubelet gke-test-cluster-default-pool-a07e5d30-siqd}    spec.containers{main}    Normal        Killing        Killing container with docker id 8df9fdfd7054: PostStart handler: Error executing in Docker Container: 1
  38s        37s        2    {kubelet gke-test-cluster-default-pool-a07e5d30-siqd}                Warning        FailedSync    Error syncing pod, skipping: failed to "StartContainer" for "main" with RunContainerError: "PostStart handler: Error executing in Docker Container: 1"
  1m         22s         2     {kubelet gke-test-cluster-default-pool-a07e5d30-siqd}    spec.containers{main}    Warning        FailedPostStartHook
```

