---
title: Docker简介
date: 2020-11-16 11:05:19
categories:
tags:
  - docker
typora-root-url: ../../../source
---

旨在记录学习docker的搭建过程，个人使用。

<!--more-->

# Docker是啥

Docker 是一个开源的应用容器引擎，基于 [Go 语言](https://www.runoob.com/go/go-tutorial.html) 并遵从 Apache2.0 协议开源。

Docker 可以让开发者打包他们的应用以及依赖包到一个轻量级、可移植的容器中，然后发布到任何流行的 Linux 机器上，也可以实现虚拟化。

Docker 从 17.03 版本之后分为 CE（Community Edition: 社区版） 和 EE（Enterprise Edition: 企业版）。



## 应用场景

- Web 应用的自动化打包和发布。
- 自动化测试和持续集成、发布。
- 在服务型环境中部署和调整数据库或其他的后台应用。
- 从头编译或者扩展现有的 OpenShift 或 Cloud Foundry 平台来搭建自己的 PaaS 环境。

## 优点

Docker 是一个用于开发，交付和运行应用程序的开放平台。

Docker 使您能够将应用程序与基础架构分开，从而可以快速交付软件。

借助 Docker，您可以与管理应用程序相同的方式来管理基础架构。

通过利用 Docker 的方法来快速交付，测试和部署代码，您可以大大减少编写代码和在生产环境中运行代码之间的延迟。

### 快速，一致地交付您的应用程序

Docker 允许开发人员使用您提供的应用程序或服务的本地容器在标准化环境中工作，从而简化了开发的生命周期。

容器非常适合持续集成和持续交付（CI / CD）工作流程，请考虑以下示例方案：

- 您的开发人员在本地编写代码，并使用 Docker 容器与同事共享他们的工作。
- 他们使用 Docker 将其应用程序推送到测试环境中，并执行自动或手动测试。
- 当开发人员发现错误时，他们可以在开发环境中对其进行修复，然后将其重新部署到测试环境中，以进行测试和验证。
- 测试完成后，将修补程序推送给生产环境，就像将更新的镜像推送到生产环境一样简单。

### 响应式部署和扩展

Docker 是基于容器的平台，允许高度可移植的工作负载。

Docker 容器可以在开发人员的本机上，数据中心的物理或虚拟机上，云服务上或混合环境中运行。

Docker 的可移植性和轻量级的特性，还可以使您轻松地完成动态管理的工作负担，并根据业务需求指示，实时扩展或拆除应用程序和服务。

### 在同一硬件上运行更多工作负载

Docker 轻巧快速。它为基于虚拟机管理程序的虚拟机提供了可行、经济、高效的替代方案，因此您可以利用更多的计算能力来实现业务目标。

Docker 非常适合于高密度环境以及中小型部署，而您可以用更少的资源做更多的事情。



# Centos Docker安装

操作系统

```shell
CentOS Linux release 7.6.1810 (Core)
```



## 自动安装

官方安装命令

```shell
# curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun
```



国内 daocloud 一键安装命令

```shell
# curl -sSL https://get.daocloud.io/docker | sh
```



## 手动安装

### 卸载旧版本

较旧的 Docker 版本称为 docker 或 docker-engine 。如果已安装这些程序，请卸载它们以及相关的依赖项。

```shell
$ sudo yum remove docker \
                docker-client \
                docker-client-latest \
                docker-common \
                docker-latest \
                docker-latest-logrotate \
                docker-logrotate \
                docker-engin\
```

### Docker Engine-Community

#### 设置Docker 仓库

在新主机上首次安装 Docker Engine-Community 之前，需要设置 Docker 仓库。之后，您可以从仓库安装和更新 Docker。

yum-utils 提供了 yum-config-manager ，并且 device mapper 存储驱动程序需要 device-mapper-persistent-data 和 lvm2。

```shell
$ sudo yum install -y yum-utils \
  device-mapper-persistent-data \
  lvm2
```



使用以下命令来设置稳定的仓库。

```shell
# 官方源地址
$ sudo yum-config-manager \
    --add-repo \
    https://download.docker.com/linux/centos/docker-ce.repo
```



```shell
# 阿里云
$ sudo yum-config-manager \
    --add-repo \
    http://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo
```



```shell
# 清华大学源
$ sudo yum-config-manager \
    --add-repo \
    https://mirrors.tuna.tsinghua.edu.cn/docker-ce/linux/centos/docker-ce.repo
```



#### 安装 Docker Engine-Community

安装最新版本的 Docker Engine-Community 和 containerd，或者转到下一步安装特定版本：

```shell
$ sudo yum install docker-ce docker-ce-cli containerd.io
```

如果提示您接受 GPG 密钥，请选是。

Docker 安装完默认未启动。并且已经创建好 docker 用户组，但该用户组下没有用户。



**要安装特定版本的 Docker Engine-Community，请在存储库中列出可用版本，然后选择并安装：**

1. 列出并排序您存储库中可用的版本。此示例按版本号（从高到低）对结果进行排序。

   ```shell
   $ yum list docker-ce --showduplicates | sort -r
   docker-ce.x86_64            3:19.03.9-3.el7                    docker-ce-stable
   docker-ce.x86_64            3:19.03.8-3.el7                    docker-ce-stable
   docker-ce.x86_64            3:19.03.7-3.el7                    docker-ce-stable
   docker-ce.x86_64            3:19.03.6-3.el7                    docker-ce-stable
   docker-ce.x86_64            3:19.03.5-3.el7                    docker-ce-stable
   ```

   

2. 通过其完整的软件包名称安装特定版本，该软件包名称是软件包名称（docker-ce）加上版本字符串（第二列），从第一个冒号（:）一直到第一个连字符，并用连字符（-）分隔。例如：docker-ce-18.09.1。

   ```shell
   $ sudo yum install docker-ce-<VERSION_STRING> docker-ce-cli-<VERSION_STRING> containerd.io
   ```

   启动 Docker。

   ```shell
   $ sudo systemctl start docker
   ```

   通过运行 hello-world 映像来验证是否正确安装了 Docker Engine-Community 。

   ```shell
   $ sudo docker run hello-world
   ```

   

# Docker使用

## Hello World

Docker 允许你在容器内运行应用程序， 使用 **docker run** 命令来在容器内运行一个应用程序。

```shell
# docker run centos:centos7.6.1810 /bin/echo "Hello world"
Hello world
```



- **docker:** Docker 的二进制执行文件。
- **run:** 与前面的 docker 组合来运行一个容器。
- **centos:centos7.6.1810** 指定要运行的镜像，Docker 首先从本地主机上查找镜像是否存在，如果不存在，Docker 就会从镜像仓库 Docker Hub 下载公共镜像。
- **/bin/echo "Hello world":** 在启动的容器里执行的命令。

### 交互式的容器

可以通过 docker 的两个参数 -i -t，让 docker 运行的容器实现**"对话"**的能力：

```shell
# docker run -i -t centos:centos7.6.1810 /bin/bash
[root@349caf157263 /]#
```

- **-t:** 在新容器内指定一个伪终端或终端。
- **-i:** 允许你对容器内的标准输入 (STDIN) 进行交互。

`[root@349caf157263 /]#` ，此时已进入centos7.6.1810系统的容器。在容器中可以运行`cat /proc/version`和`ls`分别查看当前系统的版本信息和当前目录下的文件列表。

可以通过运行 exit 命令或者使用 CTRL+D 来退出容器。

### 启动容器（后台模式）

使用以下命令创建一个以进程方式运行的容器

```shell
$ docker run -d centos:centos7.6.1810 /bin/sh -c "while true; do echo hello world; sleep 1; done"
9acf573a0da26b1dab24437c823bead08fe23177da7f234d8a6b8570bf6224de
```



在输出中，我们没有看到期望的 "hello world"，而是一串长字符

**9acf573a0da26b1dab24437c823bead08fe23177da7f234d8a6b8570bf6224de**

这个长字符串叫做**容器 ID**，对每个容器来说都是唯一的，我们可以通过容器 ID 来查看对应的容器发生了什么。

首先，我们需要确认容器有在运行，可以通过 **docker ps** 来查看：

```shell
$ docker ps
CONTAINER ID        IMAGE                   COMMAND                  CREATED             STATUS              PORTS               NAMES
9acf573a0da2        centos:centos7.6.1810   "/bin/sh -c 'while t…"   4 seconds ago       Up 3 seconds                            unruffled_jennings
```



- **CONTAINER ID:** 容器 ID。

- **IMAGE:** 使用的镜像。

- **COMMAND:** 启动容器时运行的命令。

- **CREATED:** 容器的创建时间。

- **STATUS:** 容器状态。

  状态有7种：

  - created（已创建）
  - restarting（重启中）
  - running 或 Up（运行中）
  - removing（迁移中）
  - paused（暂停）
  - exited（停止）
  - dead（死亡）

- **PORTS:** 容器的端口信息和使用的连接类型（tcp\udp）。

- **NAMES:** 自动分配的容器名称。

在宿主主机内使用 **docker logs** 命令，查看容器内的标准输出：

```shell
$ docker logs 9acf573a0da2
hello world
hello world
hello world
```

**9acf573a0da2**可以替换为容器名 **unruffled_jennings**

### 停止容器

我们使用 **docker stop** 命令来停止容器:

```shell
$ docker stop 9acf573a0da2
9acf573a0da2
```



## 容器使用

### docker command

docker 客户端非常简单 ,我们可以直接输入 docker 命令来查看到 Docker 客户端的所有命令选项。

```shell
$ docker
```

![docker-command](/images/Docker简介/docker-command.png)

可以通过命令 **docker command --help** 更深入的了解指定的 Docker 命令使用方法。

![docker-run-command](/images/Docker简介/docker-run-command.png)

### 获取镜像

如果我们本地没有 ubuntu 镜像，我们可以使用 docker pull 命令来载入 ubuntu 镜像：

```shell
$ docker pull ubuntu
```

### 启动容器

以下命令使用 ubuntu 镜像启动一个容器，参数为以命令行模式进入该容器：

```shell
$ docker run -it ubuntu /bin/bash
```

- **-i**: 交互式操作。
- **-t**: 终端。
- **ubuntu**: ubuntu 镜像。
- **/bin/bash**：放在镜像名后的是命令，这里我们希望有个交互式 Shell，因此用的是 /bin/bash。

要退出终端，直接输入 **exit**  或者 CTRL + D。



### 启动已停止运行的容器

查看所有的容器命令如下：

```shell
$ docker ps -a
```

![docker-ps-a](/images/Docker简介/docker-ps-a.png)

使用 docker start/restart 启动一个已停止的容器：

```shell
$ docker start 9acf573a0da2
```

![docker-start-9acf573a0da2](/images/Docker简介/docker-start-9acf573a0da2.png)

### 后台运行

在大部分的场景下，我们希望 docker 的服务是在后台运行的，我们可以过 **-d** 指定容器的运行模式。

```shell
$ docker run -itd --name centos-test centos:centos7.6.1810 /bin/bash
```

![docker-run-d](/images/Docker简介/docker-run-d.png)

加了 **-d** 参数默认不会进入容器，想要进入容器需要使用指令 **docker exec**。

### 进入容器

在使用 **-d** 参数时，容器启动后会进入后台。此时想要进入容器，可以通过以下指令进入：

- **docker exec**：推荐命令，退出容器终端，不会导致容器的停止。
- **docker attach**

**exec 命令**

```shell
$ docker exec -it 8729a8ba0385 /bin/bash
```

![docker-exec-ti](/images/Docker简介/docker-exec-ti.png)



**attach 命令**

```shell
$ docker attach 8729a8ba0385
```

![docker-attach](/images/Docker简介/docker-attach.png)

### 导出和导入容器

**导出容器**

如果要导出本地某个容器，可以使用 **docker export** 命令。

```shell
$ docker export 8729a8ba0385 > centos.tar
```

![docker-export](/images/Docker简介/docker-export.png)

这样将导出容器快照到本地文件。

**导入容器快照**

可以使用 docker import 从容器快照文件中再导入为镜像，以下实例将快照文件 centos.tar 导入到镜像 test/centos:v1:

```shell
$ cat centos.tar | docker import - test/centos:v1
```

![docker-import](/images/Docker简介/docker-import.png)

此外，也可以通过指定 URL 或者某个目录来导入，例如：

```shell
$ docker import http://example.com/exampleimage.tgz example/imagerepo
```

### 删除容器

删除容器使用 **docker rm** 命令：

```shell
$ docker rm -f 8729a8ba0385
```

可以利用下面的命令清理掉所有处于**终止状态**的容器。

```shell
$ docker container prune
```



## 镜像使用

当运行容器时，使用的镜像如果在本地中不存在，docker 就会自动从 docker 镜像仓库中下载，默认是从 Docker Hub 公共镜像源下载。

### 列出镜像列表

可以使用 **docker images** 来列出本地主机上的镜像。

```shell
$ docker images 
REPOSITORY          TAG                 IMAGE ID            CREATED             SIZE
hello-world         latest              bf756fb1ae65        10 months ago       13.3kB
centos              centos7.6.1810      f1cb7c7d58b7        20 months ago       202MB
```

- **REPOSITORY：**表示镜像的仓库源
- **TAG：**镜像的标签
- **IMAGE ID：**镜像ID
- **CREATED：**镜像创建时间
- **SIZE：**镜像大小

同一仓库源可以有多个 TAG，代表这个仓库源的不同个版本，如 ubuntu 仓库源里，有 15.10、14.04 等多个不同的版本，我们使用 REPOSITORY:TAG 来定义不同的镜像。



### 获取一个新的镜像

当我们在本地主机上使用一个不存在的镜像时 Docker 就会自动下载这个镜像。如果我们想预先下载这个镜像，我们可以使用 docker pull 命令来下载它。

```shell
$ docker pull ubuntu:13.10
```



### 查找镜像

我们可以从 Docker Hub 网站来搜索镜像，Docker Hub 网址为： **https://hub.docker.com/**

我们也可以使用 docker search 命令来搜索镜像。比如我们需要一个 httpd 的镜像来作为我们的 web 服务。我们可以通过 docker search 命令搜索 httpd 来寻找适合我们的镜像。

```shell
$ docker search httpd
```

![docker-search-httpd.png](/images/Docker简介/docker-search-httpd.png)

**NAME:** 镜像仓库源的名称

**DESCRIPTION:** 镜像的描述

**OFFICIAL:** 是否 docker 官方发布

**stars:** 类似 Github 里面的 star，表示点赞、喜欢的意思。

**AUTOMATED:** 自动构建。

### 拖取镜像

我们决定使用上图中的 "centos/httpd"镜像，使用命令 docker pull 来下载镜像。

```shell
$ docker pull centos/httpd
```



### 删除镜像

镜像删除使用 **docker rmi** 命令，比如我们删除 hello-world 镜像：

```shell
$ docker rmi hello-world
```

### 创建镜像

当我们从 docker 镜像仓库中下载的镜像不能满足我们的需求时，我们可以通过以下两种方式对镜像进行更改。

- 从已经创建的容器中更新镜像，并且提交这个镜像
- 使用 Dockerfile 指令来创建一个新的镜像

#### 更新镜像

创建一个容器

```shell
$ docker run -ti centos:centos7.6.1810 /bin/bash
```

在运行的容器内使用 **yum update -y** 命令进行更新。

在完成操作之后，输入 exit 命令来退出这个容器。

此时 ID 为 2a11ba047fc9 的容器，是按我们的需求更改的容器。我们可以通过命令 docker commit 来提交容器副本。

```shell
$ docker commit -m="has update" -a="lcq" 2a11ba047fc9 lcq/centos:v2
sha256:7141a1f72c8a2c42067cae92e69662953450d954f18fe16fe725d1f830ce7e53
```

- **-m:** 提交的描述信息
- **-a:** 指定镜像作者
- **e218edb10161：**容器 ID
- **runoob/ubuntu:v2:** 指定要创建的目标镜像名

我们可以使用 **docker images** 命令来查看我们的新镜像 **lcq/centos:v2**。

#### 构建镜像

我们使用命令 **docker build** ， 从零开始来创建一个新的镜像。为此，我们需要创建一个 Dockerfile 文件，其中包含一组指令来告诉 Docker 如何构建我们的镜像。

每一个指令都会在镜像上创建一个新的层，每一个指令的前缀都必须是大写的。

第一条FROM，指定使用哪个镜像源

RUN 指令告诉docker 在镜像内执行命令，安装了什么。。。

然后，我们使用 Dockerfile 文件，通过 docker build 命令来构建一个镜像。

```shell
$ cat Dockerfile
FROM    lcq/centos:v2
MAINTAINER      LCQ "lcq@god.com"

RUN     /bin/echo 'root:123456' |chpasswd
RUN     useradd lcq
RUN     /bin/echo 'lcq:123456' |chpasswd
RUN     /bin/echo -e "LANG=\"en_US.UTF-8\"" >/etc/default/local
EXPOSE  22
EXPOSE  80
CMD     /usr/sbin/sshd -D
```



![docker-build-t](/images/Docker简介/docker-build-t.png)

参数说明：

- **-t** ：指定要创建的目标镜像名
- **.** ：Dockerfile 文件所在目录，可以指定Dockerfile 的**绝对路径**



#### 设置镜像标签

我们可以使用 docker tag 命令，为镜像设置一个新的标签。

```shell
$ docker tag 8f03ca40114f lcq/centos:dev
```



## 容器连接

容器中可以运行一些网络应用，要让外部也可以访问这些应用，可以通过 **-P** 或 **-p** 参数来指定端口映射。

### 网络端口映射

```shell
$ docker run -d -P training/webapp python app.py
f3a18ed1f29ed7ad56730742878b30017224e1c17893dc438095a762bcd42e1c
```

我们可以指定容器绑定的网络地址，比如绑定 127.0.0.1。

我们使用 **-P** 参数创建一个容器，使用 **docker ps** 可以看到容器端口 5000 绑定主机端口 32768。

![docker-port-map-1.png](/images/Docker简介/docker-port-map-1.png)

我们也可以使用 **-p** 标识来指定容器端口绑定到主机端口。

两种方式的区别是:

- **-P :**是容器内部端口**随机**映射到主机的高端口。
- **-p :** 是容器内部端口绑定到**指定**的主机端口。

```shell
$ docker run -d -p 5001:5000 training/webapp python app.py
12b08fe445b973a4a9e30271d7e26a2274383a45393a883bd4db0a0fa39b1a28
```

![docker-port-map-2.png](/images/Docker简介/docker-port-map-2.png)



另外，我们可以指定容器绑定的网络地址，比如绑定 127.0.0.1。

```shell
$ docker run -d -p 127.0.0.1:5002:5000 training/webapp python app.py
59fd11e7b66f5a4ee3d33d0af2ca506d53ddcbb0118965c47cbfd92e8b9a8ed4
```

![image-20201127193751627](/images/Docker简介/docker-port-map-3.png)

这样我们就可以通过访问 127.0.0.1:5002 来访问容器的 5000 端口。

上面的例子中，默认都是绑定 tcp 端口，如果要绑定 UDP 端口，可以在端口后面加上 **/udp**。

```shell
$ docker run -d -p 127.0.0.1:5000:5000/udp training/webapp python app.py
```



**docker port** 命令可以让我们快捷地查看端口的绑定情况。

```shell
$ docker port adoring_stonebraker 5000
```

![docker-port-map-4.png](/images/Docker简介/docker-port-map-4.png)



### Docker 容器互联

端口映射并不是唯一把 docker 连接到另一个容器的方法。

docker 有一个连接系统允许将多个容器连接在一起，共享连接信息。

docker 连接会创建一个父子关系，其中父容器可以看到子容器的信息。

#### 容器命名

当我们创建一个容器的时候，docker 会自动对它进行命名。另外，我们也可以使用 **--name** 标识来命名容器

```shell
$ docker run -d -P --name l_test training/webapp python app.py
```

#### 新建网络

容器程序启动时会默认创建一个网桥docker0

![docker-bridge-1.png](/images/Docker简介/docker-bridge-1.png)



当然，也可以另建一个网桥

```shell
$ docker network create -d bridge test-net
c090a0f56b323e04c3d2de27871bec7c759f1ead185dc3555fd8cb62f91d3a98
```

![image-20201128005910158](/images/Docker简介/docker-bridge-2.png)

参数说明：

**-d**：参数指定 Docker 网络类型，有 bridge、overlay。

其中 overlay 网络类型用于 Swarm mode。

#### 连接容器

运行两个容器并连接到新建的 test-net 网络:

```shell
$ docker run -itd --name test1 --network test-net centos:centos7.6.1810 bash
$ docker run -itd --name test2 --network test-net centos:centos7.6.1810 bash
```

![image-20201128010401053](/images/Docker简介/docker-bridge-3.png)

用网络命令来进行连通性测试

![image-20201128010837072](/images/Docker简介/docker-bridge-4.png)



### 配置 DNS

我们可以在宿主机的 /etc/docker/daemon.json 文件中增加以下内容来设置全部容器的 DNS：

```json
{
  "dns" : [
    "114.114.114.114",
    "8.8.8.8"
  ]
}
```

配置完，需要重启 docker 才能生效。

```shell
$ docker run -it --rm  centos:centos7.6.1810  cat etc/resolv.conf
```

![image-20201128011512226](/images/Docker简介/docker-dns-1.png)

**手动指定容器的配置**

如果只想在指定的容器设置 DNS，则可以使用以下命令：

```shell
$ docker run -it --rm -h host_centos  --dns=114.114.114.114 --dns-search=baidu.com centos:centos7.6.1810
```



![image-20201128011711557](/images/Docker简介/docker-dns-2.png)

参数说明：

**--rm**：容器退出时自动清理容器内部的文件系统。

**-h HOSTNAME 或者 --hostname=HOSTNAME**： 设定容器的主机名，它会被写到容器内的 /etc/hostname 和 /etc/hosts。

**--dns=IP_ADDRESS**： 添加 DNS 服务器到容器的 /etc/resolv.conf 中，让容器用这个服务器来解析所有不在 /etc/hosts 中的主机名。

**--dns-search=DOMAIN**： 设定容器的搜索域，当设定搜索域为 .example.com 时，在搜索一个名为 host 的主机时，DNS 不仅搜索 host，还会搜索 host.example.com。



如果在容器启动时没有指定 **--dns** 和 **--dns-search**，Docker 会默认用宿主主机上的 /etc/resolv.conf 来配置容器的 DNS。



## 仓库管理

仓库（Repository）是集中存放镜像的地方。

以下介绍一下 [Docker Hub](https://hub.docker.com/)。当然不止 docker hub，只是远程的服务商不一样，操作都是一样的。

### Docker Hub

目前 Docker 官方维护了一个公共仓库 [Docker Hub](https://hub.docker.com/)。

大部分需求都可以通过在 Docker Hub 中直接下载镜像来实现。

#### 注册

在 [https://hub.docker.com](https://hub.docker.com/) 免费注册一个 Docker 账号。

#### 登录和退出

登录需要输入用户名和密码，登录成功后，我们就可以从 docker hub 上拉取自己账号下的全部镜像。

```shell
$ docker login
```

![image-20201128141036794](/images/Docker简介/docker-login-1.png)

**退出**

退出 docker hub 可以使用以下命令：

```shell
$ docker logout
```

#### 拉取镜像

你可以通过 docker search 命令来查找官方仓库中的镜像，并利用 docker pull 命令来将它下载到本地。

以 ubuntu 为关键词进行搜索：

```shell
$ docker search ubuntu
```

![image-20201128141136027](/images/Docker简介/docker-search-ubuntu.png)

使用 docker pull 将官方 ubuntu 镜像下载到本地：

```shell
$ docker pull ubuntu 
```

![image-20201128141239372](/images/Docker简介/docker-pull-ubuntu.png)



#### 推送镜像

用户登录后，可以通过 docker push 命令将自己的镜像推送到 Docker Hub。

以下命令中的 username 请替换为你的 Docker 账号用户名。

```shell
$ docker tag ubuntu:13.10 username/ubuntu:13.10
$ docker image ls
REPOSITORY            TAG                 IMAGE ID            CREATED             SIZE
ubuntu                13.10               7f020f7bf345        6 years ago         185MB
username/ubuntu   13.10               7f020f7bf345        6 years ago         185MB
$ docker push username/ubuntu:13.10
$ docker search username/ubuntu:13.10

NAME             DESCRIPTION       STARS         OFFICIAL    AUTOMATED
username/ubuntu:13.10
```



## Dockerfile

Dockerfile 是一个用来构建镜像的文本文件，文本内容包含了一条条构建镜像所需的指令和说明。

### 使用 Dockerfile 定制镜像

**定制一个 nginx 镜像（构建好的镜像内会有一个 /usr/share/nginx/html/index.html 文件）**

在一个空目录下，新建一个名为 Dockerfile 文件，并在文件内添加以下内容：

```shell
FROM nginx
RUN echo 'This is local nginx image' > /usr/share/nginx/html/index.html
```

![image-20201128143812274](/../../../Library/Application Support/typora-user-images/image-20201128143812274.png)

**FROM 和 RUN 指令的作用**

**FROM**：定制的镜像都是基于 FROM 的镜像，这里的 nginx 就是定制需要的基础镜像。后续的操作都是基于 nginx。

**RUN**：用于执行后面跟着的命令行命令。有以下俩种格式：

shell 格式：

```shell
RUN <命令行命令>
# <命令行命令> 等同于，在终端操作的 shell 命令。
```

exec 格式：

```shell
RUN ["可执行文件", "参数1", "参数2"]
# 例如：
# RUN ["./test.php", "dev", "offline"] 等价于 RUN ./test.php dev offline
```

**注意**：Dockerfile 的指令每执行一次都会在 docker 上新建一层。所以过多无意义的层，会造成镜像膨胀过大。例如：

```shell
FROM centos
RUN yum install wget
RUN wget -O redis.tar.gz "http://download.redis.io/releases/redis-5.0.3.tar.gz"
RUN tar -xvf redis.tar.gz
以上执行会创建 3 层镜像。可简化为以下格式：
FROM centos
RUN yum install wget \
    && wget -O redis.tar.gz "http://download.redis.io/releases/redis-5.0.3.tar.gz" \
    && tar -xvf redis.tar.gz
```

如上，以 **&&** 符号连接命令，这样执行后，只会创建 1 层镜像。

#### 开始构建镜像

在 Dockerfile 文件的存放目录下，执行构建动作。

以下示例，通过目录下的 Dockerfile 构建一个 nginx:v3（镜像名称:镜像标签）。

**注**：最后的 **.** 代表本次执行的上下文路径。

```shell
$ docker build -t nginx:v3 .
```

![image-20201128144248519](/images/Docker简介/docker-build-1.png)

以上显示，说明已经构建成功。

#### 上下文路径

上一节中，有提到指令最后一个 **.** 是上下文路径，那么什么是上下文路径呢？

```shell
$ docker build -t nginx:v3 .
```

上下文路径，是指 docker 在构建镜像，有时候想要使用到本机的文件（比如复制），docker build 命令得知这个路径后，会将路径下的所有内容打包。

**解析**：由于 docker 的运行模式是 C/S。我们本机是 C，docker 引擎是 S。实际的构建过程是在 docker 引擎下完成的，所以这个时候无法用到我们本机的文件。这就需要把我们本机的指定目录下的文件一起打包提供给 docker 引擎使用。

如果未说明最后一个参数，那么默认上下文路径就是 Dockerfile 所在的位置。

**注意**：上下文路径下不要放无用的文件，因为会一起打包发送给 docker 引擎，如果文件过多会造成过程缓慢。

### 指令详解

#### COPY

复制指令，从上下文目录中复制文件或者目录到容器里指定路径。

格式：

```
COPY [--chown=<user>:<group>] <源路径1>...  <目标路径>
COPY [--chown=<user>:<group>] ["<源路径1>",...  "<目标路径>"]
```

**[--chown=<user>:<group>]**：可选参数，用户改变复制到容器内文件的拥有者和属组。

**<源路径>**：源文件或者源目录，这里可以是通配符表达式，其通配符规则要满足 Go 的 filepath.Match 规则。例如：

```
COPY hom* /mydir/
COPY hom?.txt /mydir/
```

**<目标路径>**：容器内的指定路径，该路径不用事先建好，路径不存在的话，会自动创建。

#### ADD

ADD 指令和 COPY 的使用格式一致（同样需求下，官方推荐使用 COPY）。功能也类似，不同之处如下：

- ADD 的优点：在执行 <源文件> 为 tar 压缩文件的话，压缩格式为 gzip, bzip2 以及 xz 的情况下，会自动复制并解压到 <目标路径>。
- ADD 的缺点：在不解压的前提下，无法复制 tar 压缩文件。会令镜像构建缓存失效，从而可能会令镜像构建变得比较缓慢。具体是否使用，可以根据是否需要自动解压来决定。

#### CMD

类似于 RUN 指令，用于运行程序，但二者运行的时间点不同:

- CMD 在docker run 时运行。
- RUN 是在 docker build。

**作用**：为启动的容器指定默认要运行的程序，程序运行结束，容器也就结束。CMD 指令指定的程序可被 docker run 命令行参数中指定要运行的程序所覆盖。

**注意**：如果 Dockerfile 中如果存在多个 CMD 指令，仅最后一个生效。

格式：

```
CMD <shell 命令> 
CMD ["<可执行文件或命令>","<param1>","<param2>",...] 
CMD ["<param1>","<param2>",...]  # 该写法是为 ENTRYPOINT 指令指定的程序提供默认参数
```

推荐使用第二种格式，执行过程比较明确。第一种格式实际上在运行的过程中也会自动转换成第二种格式运行，并且默认可执行文件是 sh。

#### ENTRYPOINT

类似于 CMD 指令，但其不会被 docker run 的命令行参数指定的指令所覆盖，而且这些命令行参数会被当作参数送给 ENTRYPOINT 指令指定的程序。

但是, 如果运行 docker run 时使用了 --entrypoint 选项，此选项的参数可当作要运行的程序覆盖 ENTRYPOINT 指令指定的程序。

**优点**：在执行 docker run 的时候可以指定 ENTRYPOINT 运行所需的参数。

**注意**：如果 Dockerfile 中如果存在多个 ENTRYPOINT 指令，仅最后一个生效。

格式：

```
ENTRYPOINT ["<executeable>","<param1>","<param2>",...]
```

可以搭配 CMD 命令使用：一般是变参才会使用 CMD ，这里的 CMD 等于是在给 ENTRYPOINT 传参，以下示例会提到。

示例：

假设已通过 Dockerfile 构建了 nginx:test 镜像：

```
FROM nginx

ENTRYPOINT ["nginx", "-c"] # 定参
CMD ["/etc/nginx/nginx.conf"] # 变参 
```

1、不传参运行

```
$ docker run  nginx:test
```

容器内会默认运行以下命令，启动主进程。

```
nginx -c /etc/nginx/nginx.conf
```

2、传参运行

```
$ docker run  nginx:test -c /etc/nginx/new.conf
```

容器内会默认运行以下命令，启动主进程(/etc/nginx/new.conf:假设容器内已有此文件)

```
nginx -c /etc/nginx/new.conf
```

#### ENV

设置环境变量，定义了环境变量，那么在后续的指令中，就可以使用这个环境变量。

格式：

```
ENV <key> <value>
ENV <key1>=<value1> <key2>=<value2>...
```

以下示例设置 NODE_VERSION = 7.2.0 ， 在后续的指令中可以通过 $NODE_VERSION 引用：

```
ENV NODE_VERSION 7.2.0

RUN curl -SLO "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz" \
  && curl -SLO "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt.asc"
```

#### ARG

构建参数，与 ENV 作用一至。不过作用域不一样。ARG 设置的环境变量仅对 Dockerfile 内有效，也就是说只有 docker build 的过程中有效，构建好的镜像内不存在此环境变量。

构建命令 docker build 中可以用 --build-arg <参数名>=<值> 来覆盖。

格式：

```
ARG <参数名>[=<默认值>]
```

#### VOLUME

定义匿名数据卷。在启动容器时忘记挂载数据卷，会自动挂载到匿名卷。

作用：

- 避免重要的数据，因容器重启而丢失，这是非常致命的。
- 避免容器不断变大。

格式：

```
VOLUME ["<路径1>", "<路径2>"...]
VOLUME <路径>
```

在启动容器 docker run 的时候，我们可以通过 -v 参数修改挂载点。

#### EXPOSE

仅仅只是声明端口。

作用：

- 帮助镜像使用者理解这个镜像服务的守护端口，以方便配置映射。
- 在运行时使用随机端口映射时，也就是 docker run -P 时，会自动随机映射 EXPOSE 的端口。

格式：

```
EXPOSE <端口1> [<端口2>...]
```

#### WORKDIR

指定工作目录。用 WORKDIR 指定的工作目录，会在构建镜像的每一层中都存在。（WORKDIR 指定的工作目录，必须是提前创建好的）。

docker build 构建镜像过程中的，每一个 RUN 命令都是新建的一层。只有通过 WORKDIR 创建的目录才会一直存在。

格式：

```
WORKDIR <工作目录路径>
```

#### USER

用于指定执行后续命令的用户和用户组，这边只是切换后续命令执行的用户（用户和用户组必须提前已经存在）。

格式：

```
USER <用户名>[:<用户组>]
```

#### HEALTHCHECK

用于指定某个程序或者指令来监控 docker 容器服务的运行状态。

格式：

```
HEALTHCHECK [选项] CMD <命令>：设置检查容器健康状况的命令
HEALTHCHECK NONE：如果基础镜像有健康检查指令，使用这行可以屏蔽掉其健康检查指令

HEALTHCHECK [选项] CMD <命令> : 这边 CMD 后面跟随的命令使用，可以参考 CMD 的用法。
```

#### ONBUILD

用于延迟构建命令的执行。简单的说，就是 Dockerfile 里用 ONBUILD 指定的命令，在本次构建镜像的过程中不会执行（假设镜像为 test-build）。当有新的 Dockerfile 使用了之前构建的镜像 FROM test-build ，这是执行新镜像的 Dockerfile 构建时候，会执行 test-build 的 Dockerfile 里的 ONBUILD 指定的命令。

格式：

```
ONBUILD <其它指令>
```



## Compose

Compose 是用于**定义和运行多容器 Docker 应用程序的工具**。

通过 Compose，可以使用 YML 文件来配置应用程序需要的所有服务。然后，使用一个命令，就可以从 YML 文件配置中创建并启动所有服务。

如果你还不了解 YML 文件配置，可以先阅读 [YAML 入门教程](https://www.runoob.com/w3cnote/yaml-intro.html)。

Compose 使用的三个步骤：

- 使用 Dockerfile 定义应用程序的环境。
- 使用 docker-compose.yml 定义构成应用程序的服务，这样它们可以在隔离环境中一起运行。
- 最后，执行 docker-compose up 命令来启动并运行整个应用程序。

docker-compose.yml 的配置案例如下（配置参数参考下文）：

```yaml
# yaml 配置实例
version: '3'
services:
  web:
    build: .
    ports:
   - "5000:5000"
    volumes:
   - .:/code
    - logvolume01:/var/log
    links:
   - redis
  redis:
    image: redis
volumes:
  logvolume01: {}
```

### Compose 安装

Linux 上我们可以从 Github 上下载它的二进制包来使用，最新发行的版本地址：https://github.com/docker/compose/releases。

运行以下命令以下载 Docker Compose 的当前稳定版本：

```shell
$ sudo curl -L "https://github.com/docker/compose/releases/download/1.27.4/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
```

要安装其他版本的 Compose，请替换 1.27.4。

国内加速：

```shell
$ sudo curl -L https://get.daocloud.io/docker/compose/releases/download/1.27.4/docker-compose-`uname -s`-`uname -m` > /usr/local/bin/docker-compose
```



将可执行权限应用于二进制文件：

```shell
$ sudo chmod +x /usr/local/bin/docker-compose
```

创建软链：

```shell
$ sudo ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose
```

测试是否安装成功：

```shell
$ docker-compose --version
docker-compose version 1.27.4, build 40524192
```

**注意**： 对于 alpine，需要以下依赖包： py-pip，python-dev，libffi-dev，openssl-dev，gcc，libc-dev，和 make。

### 使用

#### 1.准备

创建一个测试目录：

```shell
$ mkdir composetest
$ cd composetest
```

在测试目录中创建一个名为 app.py 的文件，并复制粘贴以下内容：

```python
import time

import redis
from flask import Flask

app = Flask(__name__)
cache = redis.Redis(host='redis', port=6379)


def get_hit_count():
    retries = 5
    while True:
        try:
            return cache.incr('hits')
        except redis.exceptions.ConnectionError as exc:
            if retries == 0:
                raise exc
            retries -= 1
            time.sleep(0.5)


@app.route('/')
def hello():
    count = get_hit_count()
    return 'Hello World! I have been seen {} times.\n'.format(count)
```

在此示例中，redis 是应用程序网络上的 redis 容器的主机名，该主机使用的端口为 6379。

在 composetest 目录中创建另一个名为 requirements.txt 的文件，内容如下：

```shell
flask
redis
```

#### 2.创建 Dockerfile 文件

在 composetest 目录中，创建一个名为的文件 Dockerfile，内容如下：

```shell
FROM python:3.7-alpine
WORKDIR /code
ENV FLASK_APP app.py
ENV FLASK_RUN_HOST 0.0.0.0
RUN apk add --no-cache gcc musl-dev linux-headers
COPY requirements.txt requirements.txt
RUN pip install -r requirements.txt
COPY . .
CMD ["flask", "run"]
```

**Dockerfile 内容解释：**

- **FROM python:3.7-alpine**: 从 Python 3.7 映像开始构建镜像。

- **WORKDIR /code**: 将工作目录设置为 /code。

- ```
  ENV FLASK_APP app.py
  ENV FLASK_RUN_HOST 0.0.0.0
  ```

  设置 flask 命令使用的环境变量。

- **RUN apk add --no-cache gcc musl-dev linux-headers**: 安装 gcc，以便诸如 MarkupSafe 和 SQLAlchemy 之类的 Python 包可以编译加速。

- ```
  COPY requirements.txt requirements.txt
  RUN pip install -r requirements.txt
  ```

  复制 requirements.txt 并安装 Python 依赖项。

- **COPY . .**: 将 . 项目中的当前目录复制到 . 镜像中的工作目录。

- **CMD ["flask", "run"]**: 容器提供默认的执行命令为：flask run。

#### 3.创建 docker-compose.yml

在测试目录中创建一个名为 docker-compose.yml 的文件，然后粘贴以下内容：

```
# yaml 配置
version: '3'
services:
  web:
    build: .
    ports:
     - "5000:5000"
  redis:
    image: "redis:alpine"
```

该 Compose 文件定义了两个服务：web 和 redis。

- **web**：该 web 服务使用从 Dockerfile 当前目录中构建的镜像。然后，它将容器和主机绑定到暴露的端口 5000。此示例服务使用 Flask Web 服务器的默认端口 5000 。
- **redis**：该 redis 服务使用 Docker Hub 的公共 Redis 映像。

#### 4.使用 Compose 命令构建和运行您的应用

在测试目录中，执行以下命令来启动应用程序：

```
docker-compose up
```

如果你想在后台执行该服务可以加上 **-d** 参数：

```
docker-compose up -d
```



运行时，可能会有“fetch http://dl-cdn.alpinelinux.org/alpine/v3.12/main/x86_64/APKINDEX.tar.gz” 耗时过长或者超时问题，可以在Dockerfile文件中增加下面的第二行

```shell
FROM alpine:3.7
RUN echo -e http://mirrors.ustc.edu.cn/alpine/v3.12/main/ > /etc/apk/repositories
```



如果有pip 下载超时，需要更改本地pip源，将其指向国内，参考 [PIP安装docker-compose超时问题解决方案](https://www.yisu.com/zixun/315290.html) 。



正确运行之后，启动的容器如下

![image-20201129163704748](/images/Docker简介/docker-compose-2.png)



![image-20201129164033049](/images/Docker简介/docker-compose-3.png)





### yml 配置指令参考

#### version

指定本 yml 依从的 compose 哪个版本制定的。

#### build

指定为构建镜像上下文路径：

例如 webapp 服务，指定为从上下文路径 ./dir/Dockerfile 所构建的镜像：

```
version: "3.7"
services:
  webapp:
    build: ./dir
```

或者，作为具有在上下文指定的路径的对象，以及可选的 Dockerfile 和 args：

```
version: "3.7"
services:
  webapp:
    build:
      context: ./dir
      dockerfile: Dockerfile-alternate
      args:
        buildno: 1
      labels:
        - "com.example.description=Accounting webapp"
        - "com.example.department=Finance"
        - "com.example.label-with-empty-value"
      target: prod
```

- context：上下文路径。
- dockerfile：指定构建镜像的 Dockerfile 文件名。
- args：添加构建参数，这是只能在构建过程中访问的环境变量。
- labels：设置构建镜像的标签。
- target：多层构建，可以指定构建哪一层。

#### cap_add，cap_drop

添加或删除容器拥有的宿主机的内核功能。

```
cap_add:
  - ALL # 开启全部权限

cap_drop:
  - SYS_PTRACE # 关闭 ptrace权限
```

#### cgroup_parent

为容器指定父 cgroup 组，意味着将继承该组的资源限制。

```
cgroup_parent: m-executor-abcd
```

#### command

覆盖容器启动的默认命令。

```
command: ["bundle", "exec", "thin", "-p", "3000"]
```

#### container_name

指定自定义容器名称，而不是生成的默认名称。

```
container_name: my-web-container
```

#### depends_on

设置依赖关系。

- docker-compose up ：以依赖性顺序启动服务。在以下示例中，先启动 db 和 redis ，才会启动 web。
- docker-compose up SERVICE ：自动包含 SERVICE 的依赖项。在以下示例中，docker-compose up web 还将创建并启动 db 和 redis。
- docker-compose stop ：按依赖关系顺序停止服务。在以下示例中，web 在 db 和 redis 之前停止。

```
version: "3.7"
services:
  web:
    build: .
    depends_on:
      - db
      - redis
  redis:
    image: redis
  db:
    image: postgres
```

注意：web 服务不会等待 redis db 完全启动 之后才启动。

#### deploy

指定与服务的部署和运行有关的配置。只在 swarm 模式下才会有用。

```
version: "3.7"
services:
  redis:
    image: redis:alpine
    deploy:
      mode：replicated
      replicas: 6
      endpoint_mode: dnsrr
      labels: 
        description: "This redis service label"
      resources:
        limits:
          cpus: '0.50'
          memory: 50M
        reservations:
          cpus: '0.25'
          memory: 20M
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 120s
```

可以选参数：

**endpoint_mode**：访问集群服务的方式。

```
endpoint_mode: vip 
# Docker 集群服务一个对外的虚拟 ip。所有的请求都会通过这个虚拟 ip 到达集群服务内部的机器。
endpoint_mode: dnsrr
# DNS 轮询（DNSRR）。所有的请求会自动轮询获取到集群 ip 列表中的一个 ip 地址。
```

**labels**：在服务上设置标签。可以用容器上的 labels（跟 deploy 同级的配置） 覆盖 deploy 下的 labels。

**mode**：指定服务提供的模式。

- **replicated**：复制服务，复制指定服务到集群的机器上。
- **global**：全局服务，服务将部署至集群的每个节点。
- 图解：下图中黄色的方块是 replicated 模式的运行情况，灰色方块是 global 模式的运行情况。

![img](/images/Docker简介/docker-composex.png)

**replicas：mode** 为 replicated 时，需要使用此参数配置具体运行的节点数量。

**resources**：配置服务器资源使用的限制，例如上例子，配置 redis 集群运行需要的 cpu 的百分比 和 内存的占用。避免占用资源过高出现异常。

**restart_policy**：配置如何在退出容器时重新启动容器。

- condition：可选 none，on-failure 或者 any（默认值：any）。
- delay：设置多久之后重启（默认值：0）。
- max_attempts：尝试重新启动容器的次数，超出次数，则不再尝试（默认值：一直重试）。
- window：设置容器重启超时时间（默认值：0）。

**rollback_config**：配置在更新失败的情况下应如何回滚服务。

- parallelism：一次要回滚的容器数。如果设置为0，则所有容器将同时回滚。
- delay：每个容器组回滚之间等待的时间（默认为0s）。
- failure_action：如果回滚失败，该怎么办。其中一个 continue 或者 pause（默认pause）。
- monitor：每个容器更新后，持续观察是否失败了的时间 (ns|us|ms|s|m|h)（默认为0s）。
- max_failure_ratio：在回滚期间可以容忍的故障率（默认为0）。
- order：回滚期间的操作顺序。其中一个 stop-first（串行回滚），或者 start-first（并行回滚）（默认 stop-first ）。

**update_config**：配置应如何更新服务，对于配置滚动更新很有用。

- parallelism：一次更新的容器数。
- delay：在更新一组容器之间等待的时间。
- failure_action：如果更新失败，该怎么办。其中一个 continue，rollback 或者pause （默认：pause）。
- monitor：每个容器更新后，持续观察是否失败了的时间 (ns|us|ms|s|m|h)（默认为0s）。
- max_failure_ratio：在更新过程中可以容忍的故障率。
- order：回滚期间的操作顺序。其中一个 stop-first（串行回滚），或者 start-first（并行回滚）（默认stop-first）。

**注**：仅支持 V3.4 及更高版本。

#### devices

指定设备映射列表。

```
devices:
  - "/dev/ttyUSB0:/dev/ttyUSB0"
```

#### dns

自定义 DNS 服务器，可以是单个值或列表的多个值。

```
dns: 8.8.8.8

dns:
  - 8.8.8.8
  - 9.9.9.9
```

#### dns_search

自定义 DNS 搜索域。可以是单个值或列表。

```
dns_search: example.com

dns_search:
  - dc1.example.com
  - dc2.example.com
```

#### entrypoint

覆盖容器默认的 entrypoint。

```
entrypoint: /code/entrypoint.sh
```

也可以是以下格式：

```
entrypoint:
    - php
    - -d
    - zend_extension=/usr/local/lib/php/extensions/no-debug-non-zts-20100525/xdebug.so
    - -d
    - memory_limit=-1
    - vendor/bin/phpunit
```

#### env_file

从文件添加环境变量。可以是单个值或列表的多个值。

```
env_file: .env
```

也可以是列表格式：

```
env_file:
  - ./common.env
  - ./apps/web.env
  - /opt/secrets.env
```

#### environment

添加环境变量。您可以使用数组或字典、任何布尔值，布尔值需要用引号引起来，以确保 YML 解析器不会将其转换为 True 或 False。

```
environment:
  RACK_ENV: development
  SHOW: 'true'
```

#### expose

暴露端口，但不映射到宿主机，只被连接的服务访问。

仅可以指定内部端口为参数：

```
expose:
 - "3000"
 - "8000"
```

#### extra_hosts

添加主机名映射。类似 docker client --add-host。

```
extra_hosts:
 - "somehost:162.242.195.82"
 - "otherhost:50.31.209.229"
```

以上会在此服务的内部容器中 /etc/hosts 创建一个具有 ip 地址和主机名的映射关系：

```
162.242.195.82  somehost
50.31.209.229   otherhost
```

#### healthcheck

用于检测 docker 服务是否健康运行。

```
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost"] # 设置检测程序
  interval: 1m30s # 设置检测间隔
  timeout: 10s # 设置检测超时时间
  retries: 3 # 设置重试次数
  start_period: 40s # 启动后，多少秒开始启动检测程序
```

#### image

指定容器运行的镜像。以下格式都可以：

```
image: redis
image: ubuntu:14.04
image: tutum/influxdb
image: example-registry.com:4000/postgresql
image: a4bc65fd # 镜像id
```

#### logging

服务的日志记录配置。

driver：指定服务容器的日志记录驱动程序，默认值为json-file。有以下三个选项

```
driver: "json-file"
driver: "syslog"
driver: "none"
```

仅在 json-file 驱动程序下，可以使用以下参数，限制日志得数量和大小。

```
logging:
  driver: json-file
  options:
    max-size: "200k" # 单个文件大小为200k
    max-file: "10" # 最多10个文件
```

当达到文件限制上限，会自动删除旧得文件。

syslog 驱动程序下，可以使用 syslog-address 指定日志接收地址。

```
logging:
  driver: syslog
  options:
    syslog-address: "tcp://192.168.0.42:123"
```

#### network_mode

设置网络模式。

```
network_mode: "bridge"
network_mode: "host"
network_mode: "none"
network_mode: "service:[service name]"
network_mode: "container:[container name/id]"
```

networks

配置容器连接的网络，引用顶级 networks 下的条目 。

```
services:
  some-service:
    networks:
      some-network:
        aliases:
         - alias1
      other-network:
        aliases:
         - alias2
networks:
  some-network:
    # Use a custom driver
    driver: custom-driver-1
  other-network:
    # Use a custom driver which takes special options
    driver: custom-driver-2
```

**aliases** ：同一网络上的其他容器可以使用服务名称或此别名来连接到对应容器的服务。

#### restart

- no：是默认的重启策略，在任何情况下都不会重启容器。
- always：容器总是重新启动。
- on-failure：在容器非正常退出时（退出状态非0），才会重启容器。
- unless-stopped：在容器退出时总是重启容器，但是不考虑在Docker守护进程启动时就已经停止了的容器

```
restart: "no"
restart: always
restart: on-failure
restart: unless-stopped
```

注：swarm 集群模式，请改用 restart_policy。

#### secrets

存储敏感数据，例如密码：

```
version: "3.1"
services:

mysql:
  image: mysql
  environment:
    MYSQL_ROOT_PASSWORD_FILE: /run/secrets/my_secret
  secrets:
    - my_secret

secrets:
  my_secret:
    file: ./my_secret.txt
```

#### security_opt

修改容器默认的 schema 标签。

```
security-opt：
  - label:user:USER   # 设置容器的用户标签
  - label:role:ROLE   # 设置容器的角色标签
  - label:type:TYPE   # 设置容器的安全策略标签
  - label:level:LEVEL  # 设置容器的安全等级标签
```

#### stop_grace_period

指定在容器无法处理 SIGTERM (或者任何 stop_signal 的信号)，等待多久后发送 SIGKILL 信号关闭容器。

```
stop_grace_period: 1s # 等待 1 秒
stop_grace_period: 1m30s # 等待 1 分 30 秒 
```

默认的等待时间是 10 秒。

#### stop_signal

设置停止容器的替代信号。默认情况下使用 SIGTERM 。

以下示例，使用 SIGUSR1 替代信号 SIGTERM 来停止容器。

```
stop_signal: SIGUSR1
```

#### sysctls

设置容器中的内核参数，可以使用数组或字典格式。

```
sysctls:
  net.core.somaxconn: 1024
  net.ipv4.tcp_syncookies: 0

sysctls:
  - net.core.somaxconn=1024
  - net.ipv4.tcp_syncookies=0
```

#### tmpfs

在容器内安装一个临时文件系统。可以是单个值或列表的多个值。

```
tmpfs: /run

tmpfs:
  - /run
  - /tmp
```

#### ulimits

覆盖容器默认的 ulimit。

```
ulimits:
  nproc: 65535
  nofile:
    soft: 20000
    hard: 40000
```

#### volumes

将主机的数据卷或着文件挂载到容器里。

```
version: "3.7"
services:
  db:
    image: postgres:latest
    volumes:
      - "/localhost/postgres.sock:/var/run/postgres/postgres.sock"
      - "/localhost/data:/var/lib/postgresql/data"
```



## Machine

Docker Machine 是一种可以让您在虚拟主机上安装 Docker 的工具，并可以使用 docker-machine 命令来管理主机。

Docker Machine 也可以集中管理所有的 docker 主机，比如快速的给 100 台服务器安装上 docker。

Docker Machine 管理的虚拟主机可以是机上的，也可以是云供应商，如阿里云，腾讯云，AWS，或 DigitalOcean。

使用 docker-machine 命令，您可以启动，检查，停止和重新启动托管主机，也可以升级 Docker 客户端和守护程序，以及配置 Docker 客户端与您的主机进行通信。

![img](/images/Docker简介/docker-machine-1.png)

### 安装

安装 Docker Machine 之前你需要先安装 Docker。

Docker Mechine 可以在多种平台上安装使用，包括 Linux 、MacOS 以及 windows。

**linux**

```shell
$ base=https://github.com/docker/machine/releases/download/v0.16.0 &&
  curl -L $base/docker-machine-$(uname -s)-$(uname -m) >/tmp/docker-machine &&
  sudo mv /tmp/docker-machine /usr/local/bin/docker-machine &&
  chmod +x /usr/local/bin/docker-machine
```

查看是否安装成功：

```shell
$ docker-machine version
docker-machine version 0.16.0, build 9371605
```

![image-20201129200954112](/images/Docker简介/docker-machine-2.png)

国内没找到可替代的源。所以最好用国外的虚机。

### 使用

本章通过 virtualbox 来介绍 docker-machine 的使用方法。其他云服务商操作与此基本一致。具体可以参考每家服务商的指导文档。

更多使用可以参考 [Docker Machine 是什么？](https://www.cnblogs.com/sparkdev/p/7044950.html) 。

#### 列出可用的机器

可以看到目前只有这里默认的 default 虚拟机。

```shell
$ docker-machine ls
```

#### 创建机器

创建一台名为 test 的机器。

```shell
$ docker-machine create --driver virtualbox test
```



**Note:**

我用的centos，可能会报错

![image-20201129201414938](/images/Docker简介/docker-machine-3.png)



需要安装vboxmanage

1. 配置VirtualBox源 

   ```shell
   # cat /etc/yum.repos.d/virtualbox.repo
   [virtualbox]
   name=Oracle Linux / RHEL / CentOS-$releasever / $basearch - VirtualBox
   baseurl=http://download.virtualbox.org/virtualbox/rpm/el/$releasever/$basearch
   enabled=1
   gpgcheck=0
   repo_gpgcheck=0
   gpgkey=https://www.virtualbox.org/download/oracle_vbox.asc
   ```

2. 安装VirtualBox

   ```shell
   # yum install -y VirtualBox-5.2 # 使用yum search VirtualBox 然后安装指定版本的VirtualBox
   # sudo /sbin/vboxconfig # 重新加载VirtualBox服务
   ```

    如果内核版本不一样可能会出错，需要根据提示安装正确的内核文件。

   可参考：

   [CentOS7--手动升级内核到指定版本](https://blog.csdn.net/jobbofhe/article/details/105045494)

   [Centos7.5安装VirtualBox-5.2](https://www.cnblogs.com/hongdada/p/9578849.html)

   ![image-20201129212459593](/../../../Library/Application Support/typora-user-images/image-20201129212459593.png)



再次启动时又有新问题，“This computer doesn't have VT-X/AMD-v enabled. Enabling it in the BIOS is mandatory”

[Error with pre-create check](https://stackoverflow.com/questions/57441382/error-with-pre-create-check-this-computer-doesnt-have-vt-x-amd-v-enabled-ena) 

多加个参数

```shell
# docker-machine create --driver virtualbox --virtualbox-no-vtx-check test
```

如果想使其占用较少资源，可指定cpu、磁盘

```shell
# docker-machine create --driver virtualbox --virtualbox-no-vtx-check --virtualbox-memory=1024 --virtualbox-cpu-count=1 --virtualbox-disk-size=10240 test
```



#### 查看机器的 ip

```shell
$ docker-machine ip test
```



#### 停止机器

```shell
$ docker-machine stop test
```



#### 启动机器

```shell
$ docker-machine start test
```



#### 进入机器

```shell
$ docker-machine ssh test
```



### docker-machine 命令参数说明

- **docker-machine active**：查看当前激活状态的 Docker 主机。

  ```shell
  $ docker-machine ls
  
  NAME      ACTIVE   DRIVER         STATE     URL
  dev       -        virtualbox     Running   tcp://192.168.99.103:2376
  staging   *        digitalocean   Running   tcp://203.0.113.81:2376
  
  $ echo $DOCKER_HOST
  tcp://203.0.113.81:2376
  
  $ docker-machine active
  staging
  ```

- **config**：查看当前激活状态 Docker 主机的连接信息。

- **creat**：创建 Docker 主机

- **env**：显示连接到某个主机需要的环境变量

- **inspect**： 以 json 格式输出指定Docker的详细信息

- **ip**： 获取指定 Docker 主机的地址

- **kill**： 直接杀死指定的 Docker 主机

- **ls**： 列出所有的管理主机

- **provision**： 重新配置指定主机

- **regenerate-certs**： 为某个主机重新生成 TLS 信息

- **restart**： 重启指定的主机

- **rm**： 删除某台 Docker 主机，对应的虚拟机也会被删除

- **ssh**： 通过 SSH 连接到主机上，执行命令

- **scp**： 在 Docker 主机之间以及 Docker 主机和本地主机之间通过 scp 远程复制数据

- **mount**： 使用 SSHFS 从计算机装载或卸载目录

- **start**： 启动一个指定的 Docker 主机，如果对象是个虚拟机，该虚拟机将被启动

- **status**： 获取指定 Docker 主机的状态(包括：Running、Paused、Saved、Stopped、Stopping、Starting、Error)等

- **stop**： 停止一个指定的 Docker 主机

- **upgrade**： 将一个指定主机的 Docker 版本更新为最新

- **url**： 获取指定 Docker 主机的监听 URL

- **version**： 显示 Docker Machine 的版本或者主机 Docker 版本

- **help**： 显示帮助信息



# Docker实例



## 安装Centos

CentOS（Community Enterprise Operating System）是 Linux 发行版之一，它是来自于 Red Hat Enterprise Linux(RHEL) 依照开放源代码规定发布的源代码所编译而成。由于出自同样的源代码，因此有些要求高度稳定性的服务器以 CentOS 替代商业版的 Red Hat Enterprise Linux 使用。

### 查看可用的 CentOS 版本

访问 CentOS 镜像库地址：https://hub.docker.com/_/centos?tab=tags&page=1。

可以通过 Sort by 查看其他版本的 CentOS 。默认是最新版本 centos:latest 。

![image-20201208105938713](/images/Docker简介/docker-hub-centos.png)



### 拉取指定版本的 CentOS 镜像

这里我们安装指定版本为例(centos8.3.2011)

```shell
$ docker pull centos:centos8.3.2011
```

![image-20201208110605821](/images/Docker简介/docker-centos-pull.png)

### 查看本地镜像

```shell
$ docker images
```

![image-20201208110634842](/images/Docker简介/docker-centos-images.png)

### 运行容器

```shell
$ docker run -itd --name centos-test centos:centos8.3.2011
```

![image-20201208110711780](/images/Docker简介/docker-centos-run.png)

## 安装Nginx

Nginx 是一个高性能的 HTTP 和反向代理 web 服务器，同时也提供了 IMAP/POP3/SMTP 服务 。

### 查看可用的 Nginx 版本

除类似centos官网查找外，还可以用search命令进行查找镜像

```shell
$ docker search nginx
```

![image-20201208110927695](/images/Docker简介/docker-search-nginx.png)

### 取最新版的 Nginx 镜像

```shell
$ docker pull nginx:latest
```

![image-20201208111135253](/images/Docker简介/docker-pull-nginx.png)

### 运行容器

```shell
$ docker run --name nginx-test -p 8080:80 -d nginx:latest
```

参数说明：

- **--name nginx-test**：容器名称。
- **-p 8080:80**： 端口进行映射，将本地 8080 端口映射到容器内部的 80 端口。
- **-d nginx**： 设置容器在在后台一直运行。



我们可以通过浏览器可以直接访问本机 8080 端口的 nginx 服务：

![image-20201208111444124](/images/Docker简介/docker-nginx-google.png)

## 安装Node.js

Node.js 是一个基于 Chrome V8 引擎的 JavaScript 运行环境，是一个让 JavaScript 运行在服务端的开发平台。

```shell
$ docker pull node:lastest
$ docker run -itd --name node-test node
$ docker exec -it node-test /bin/bash
```

![image-20201208112157069](/images/Docker简介/docker-node.png)



## 安装PHP

PHP 是一种创建动态交互性站点的强有力的服务器端脚本语言。

```shell
$ docker pull php:5.6-fpm
$ docker images
```

![image-20201208113144791](/images/Docker简介/docker-php-1.png)



### Nginx + PHP 部署

启动php

```shell
$ docker run --name  myphp-fpm -v ~/nginx/www:/www  -d php:5.6-fpm
```

- **-v ~/nginx/www:/www** : 将主机中项目的目录 www 挂载到容器的 /www

创建 ~/nginx/conf/conf.d 目录并在此目录下添加 **test-php.conf** 文件

```shell
$ mkdir ~/nginx/conf/conf.d -p
$ cat ~/nginx/conf/conf.d/test-php.conf
server {
    listen       80;
    server_name  localhost;

    location / {
        root   /usr/share/nginx/html;
        index  index.html index.htm index.php;
    }

    error_page   500 502 503 504  /50x.html;
    location = /50x.html {
        root   /usr/share/nginx/html;
    }

    location ~ \.php$ {
        fastcgi_pass   php:9000;
        fastcgi_index  index.php;
        fastcgi_param  SCRIPT_FILENAME  /www/$fastcgi_script_name;
        include        fastcgi_params;
    }
}
```

- **php:9000**: 表示 php-fpm 服务的 URL，下面我们会具体说明。
- **/www/**: 是 **myphp-fpm** 中 php 文件的存储路径，映射到本地的 ~/nginx/www 目录。



启动 nginx：

```shell
$ docker run --name runoob-php-nginx -p 8083:80 -d \
    -v ~/nginx/www:/usr/share/nginx/html:ro \
    -v ~/nginx/conf/conf.d:/etc/nginx/conf.d:ro \
    --link myphp-fpm:php \
    nginx:latest
```

- **-p 8083:80**: 端口映射，把 **nginx** 中的 80 映射到本地的 8083 端口。
- **~/nginx/www**: 是本地 html 文件的存储目录，/usr/share/nginx/html 是容器内 html 文件的存储目录。
- **~/nginx/conf/conf.d**: 是本地 nginx 配置文件的存储目录，/etc/nginx/conf.d 是容器内 nginx 配置文件的存储目录。
- **--link myphp-fpm:php**: 把 **myphp-fpm** 的网络并入 ***nginx\***，并通过修改 **nginx** 的 /etc/hosts，把域名 **php** 映射成 127.0.0.1，让 nginx 通过 php:9000 访问 php-fpm。

![image-20201208113850478](/images/Docker简介/docker-php-2.png)



接下来我们在 ~/nginx/www 目录下创建 index.php，代码如下：

```
<?php
echo phpinfo();
?>
```

浏览器打开 主机地址:8083/index.php，显示如下：

![image-20201208114343548](/images/Docker简介/docker-php-3.png)



## 安装MySQL

MySQL 是世界上最受欢迎的开源数据库。凭借其可靠性、易用性和性能，MySQL 已成为 Web 应用程序的数据库优先选择。

```shell
$ docker search mysql
$ docker pull mysql:latest
$ docker run -itd --name mysql-test -p 3306:3306 -e MYSQL_ROOT_PASSWORD=123456 mysql
```

- **-p 3306:3306** ：映射容器服务的 3306 端口到宿主机的 3306 端口，外部主机可以直接通过 **宿主机ip:3306** 访问到 MySQL 的服务。
- **MYSQL_ROOT_PASSWORD=123456**：设置 MySQL 服务 root 用户的密码。

本机可以通过 root 和密码 123456 访问 MySQL 服务。

```shell
$ mysql -h localhost -uroot -p
```



**NOTE:**

1. Can't connect to local MySQL server through socket '/var/lib/mysql/mysql.sock'

   根据报错提示，是本地mysql连接服务器时，没有找到/var/lib/mysql/mysql.sock文件。那么从这入手，我们看到mysql容器中的服务器启动后的mysql.sock文件在哪。

   进入容器查看

   ![image-20201208140256510](/images/Docker简介/docker-mysql-1.png)

   ```shell
   [mysqld]
   pid-file        = /var/run/mysqld/mysqld.pid
   socket          = /var/run/mysqld/mysqld.sock
   datadir         = /var/lib/mysql
   secure-file-priv= NULL
   
   # Custom config should go here
   !includedir /etc/mysql/conf.d/
   ```

   需要将配置文件中的相关目录挂载到主机，同时保证容器有权限访问本地挂载的目录，以挂载到本地 `/opt/data/mysql`为例

   ```shell
   $ sudo chown -R polkitd:input /opt/data/mysql
   $ docker run --name=mysql -it -p 3306:3306 \
   		-v /opt/data/mysql/mysqld:/var/run/mysqld \
   		-v /opt/data/mysql/db:/var/lib/mysql \
   		-v /opt/data/mysql/conf:/etc/mysql/conf.d \
   		-v /opt/data/mysql/files:/var/lib/mysql-files \
   		-e MYSQL_ROOT_PASSWORD=123456 --privileged=true -d mysql
   ```

   删除容器，重新创建即可。

2. Access denied for user 'root'@'localhost'

   本地主机连接容器的mysql时，需要查到 /var/lib/mysql/mysql.sock。启动mysql容器后，在/opt/data/mysql/mysqld目录下有一个mysqld.sock。我们要把这个文件链接到本地主机的var/lib/myql目录中。

   ```shell
   $ sudo ln -s /opt/data/mysql/mysqld/mysqld.sock /var/lib/mysql/mysql.sock #/var/lib/mysql 没有则手动创建
   ```

3. Authentication plugin 'caching_sha2_password' cannot be loaded

   本机需要安装mysql-community-client，以centos 7为例

   ```shell
   $ wget http://dev.mysql.com/get/mysql57-community-release-el7-9.noarch.rpm
   $ sudo rpm -ivh mysql57-community-release-el7-9.noarch.rpm
   $ yum install mysql-community-client.x86_64
   ```

4. Access denied for user 'root'@'localhost'

   进入mysql容器目录  `/etc/mysql/conf.d/`

   或者，由于  `/etc/mysql/conf.d/`挂载到了本机 `/opt/data/mysql/conf`，所以也可以直接进入本机挂载目录

   修改 **docker.cnf** 文件（没有则创建）为

   ```shell
   [mysqld]
   skip-host-cache
   skip-name-resolve
   skip-grant-tables
   ```

以上最终修改后，记得重启mysql docker

```shell
$ docker restart $mysql_docker_id
```

![image-20201208141541588](/images/Docker简介/docker-mysql-2.png)



## 安装Tomcat

Tomcat是一个被广泛使用的Java WEB应用服务器。

```shell
$ docker pull tomcat:latest
$ docker run --name tomcat -p 8080:8080  -d tomcat
```



进行访问的时候，有可能会出现  “404 NOT FOUND”

此时，需要进入容器，将 `/usr/local/tomcat`目录下的 `webapps.dist` 命名为 `webapps`即可。

![image-20201208151856425](/images/Docker简介/docker-tomcat-1.png)



## 安装Redis

Redis 是一个开源的使用 ANSI C 语言编写、支持网络、可基于内存亦可持久化的日志型、Key-Value 的 NoSQL 数据库，并提供多种语言的 API。

```shell
$ docker pull redis:latest
$ docker run -itd --name redis-test -p 6379:6379 redis
```



![image-20201208152346484](/images/Docker简介/docker-redis-1.png)



## 安装MongoDB

MongoDB 是一个免费的开源跨平台面向文档的 NoSQL 数据库程序。

```shell
$ docker pull mongo:latest
$ docker run -itd --name mongo -p 27017:27017 mongo --auth
```

- **--auth**：需要密码才能访问容器服务。

![image-20201208152703078](/images/Docker简介/docker-mongodb-1.png)



使用以下命令添加用户和设置密码，并且尝试连接。

```shell
$ docker exec -it mongo mongo admin
# 创建一个名为 admin，密码为 123456 的用户。
>  db.createUser({ user:'admin',pwd:'123456',roles:[ { role:'userAdminAnyDatabase', db: 'admin'},"readWriteAnyDatabase"]});
# 尝试使用上面创建的用户信息进行连接。
> db.auth('admin', '123456')
```

![image-20201208152754098](/images/Docker简介/docker-mongodb-2.png)



# REF

[Docker教程](https://www.runoob.com/docker/docker-tutorial.html)

[Docker 官网](https://www.docker.com)

[Docker Doc](https://docs.docker.com/reference/)

[Github Docker 源码](https://github.com/docker/docker-ce)