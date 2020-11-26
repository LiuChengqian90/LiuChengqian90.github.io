---
title: Docker简介
date: 2020-11-16 11:05:19
categories:
tags:
typora-root-url: ../../../source
---

旨在记录学习docker的搭建过程，个人使用。

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

```

```





## 镜像使用

## 容器连接

## 仓库管理

## Dockerfile

## Compose

## Machine

## Swarm 集群管理



# Docker实例

安装Centos

安装Nginx

安装Node.js

安装PHP

安装MySQL

安装Tomcat

安装Python

安装Redis

安装MongoDB

安装Apache



# Docker资源汇总



# REF

[Docker教程](https://www.runoob.com/docker/docker-tutorial.html)

[Docker 官网](https://www.docker.com)

[Docker Doc](https://docs.docker.com/reference/)

[Github Docker 源码](https://github.com/docker/docker-ce)