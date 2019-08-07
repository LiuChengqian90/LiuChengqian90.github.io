---
title: Openvswitch 编译及升级
date: 2018-03-23 19:04:52
categories: openvswitch
tags:
  - ovs编译
---

## 编译安装

参照官网，也查了些资料，编译期间出现些问题，先将正确的流程及问题解决方法记录如下。

- Kernel 版本为 3.10.0-693.11.1.el7.x86_64 。内核与ovs关系可参考 [release](http://docs.openvswitch.org/en/latest/faq/releases/?highlight=releases)。


- 有序列表（1、2），顺序执行；无序列表（**·**），多选一。

正式开始。

1. **获取代码（2.9为例，其他版本可参考官网）**

   - wget 下载

     ```shell
     # wget http://openvswitch.org/releases/openvswitch-2.9.0.tar.gz
     # tar zxvf openvswitch-2.9.0.tar.gz
     # cd openvswitch-2.9.0
     ```

   - Git 下载

     ```shell
     # git clone https://github.com/openvswitch/ovs.git
     # cd ovs
     // git tag 或 git branch -a 查看所有分支，切换为稳定分支
     # git checkout origin/branch-2.9
     ```

2. **编译环境配置**

   1. GUN make
   2. C 编译器
      - GCC 4.6 or later.
      - Clang 3.4 or later.
      - MSVC 2013. （windows平台）
   3. libssl，openssl相关，连接的安全机密性，可选。
   4. libcap-ng，可选。
   5. Python 2.7. 用到 six version 1.4.0或之后的库。

   除此之外，如果需要Linux kernel支持的话，还需要打开以下开关（无需内核支持可参考[Open vSwitch without Kernel Support](http://docs.openvswitch.org/en/latest/intro/install/userspace/) ）。

   1. 受支持的内核版本。

      Ingress policing的支持，需要以嵌入或模块形式打开 `NET_CLS_BASIC`、 `NET_SCH_INGRESS`和 `NET_ACT_POLICE`。

      3.11之前的内核，不得加载`ip_gre`模块（NET_IPGRE）。

      开启`CONFIG_TUN`以使能ovs对TAP设备的支持。

   2. 与内核相对应的GCC版本。

   3. 一个内核构建目录对应于模块要运行的linux内核镜像（linux-header相关文件）。

   如果使用git树或者修改了打开的vswitch构建系统或数据库架构，则还需要以下软件：

   1. Autoconf version 2.63 or later.
   2. Automake version 1.10 or later.
   3. libtool version 2.4 or later. (Older versions might work too.)

   还有一些 datapath test 相关包，此处不在赘述。**对于一个系统，基本下面的命令搞定**

   ```shell
   # yum install -y autoconf automake libtool kernel-devel-$(uname -r)
   ```

   为了支持TAP 和 随机，需要`/dev/urandom`和`/dev/net/tun`这两个文件存在。

3. 构建"configure"脚本

   ```shell
   # ./boot.sh
   ```

4. **配置**

   默认情况下，所有的文件都安装在`/usr/local`目录下，即下面的命令

   ```shell
   # ./configure
   ```

   此时，openvswitch会在`／usr/local/etc/openvswitch`下查找数据库。

   但是如果想按照传统安装方式（/usr/local -> /usr, /usr/local/var -> /var, /etc/openvswitch作为默认数据库目录），则

   ```shell
   # ./configure --prefix=/usr --localstatedir=/var --sysconfdir=/etc 
   ```

   构建Linux内核模块，以便您可以运行基于内核的交换机，在--with-linux上传递内核构建目录的位置。

   ```shell
   # ./configure --with-linux=/lib/modules/$(uname -r)/build
   ```

   以上总结，直接运行

   ```shell
   # ./configure --prefix=/usr --localstatedir=/var --sysconfdir=/etc --with-linux=/lib/modules/$(uname -r)/build
   ```

   除此之前，还可以编译不同架构的ovs，例如

   ```shell
   # ./configure --with-linux=/path/to/linux KARCH=mips
   ```

   还有其他的选项，可参考官网。

5. **Building**

   1. `make install` 默认将程序及帮助文件装入`/usr/local`

      ```shell
      # make ; make install
      ```

   2. 安装内核模块

      ```shell
      # make modules_install
      ```

      如果运行时遇到类似如下错误

      ```shell
      # make modules_install
      cd datapath/linux && make modules_install
      make[1]: Entering directory `/root/openvswitch-2.9.0/datapath/linux'
      make -C /lib/modules/3.10.0-693.11.1.el7.x86_64/build M=/root/openvswitch-2.9.0/datapath/linux modules_install
      make[2]: Entering directory `/usr/src/kernels/3.10.0-693.11.1.el7.x86_64'
        INSTALL /root/openvswitch-2.9.0/datapath/linux/openvswitch.ko
      Can't read private key
       ………………
        INSTALL /root/openvswitch-2.9.0/datapath/linux/vport-vxlan.ko
      Can't read private key
        DEPMOD  3.10.0-693.11.1.el7.x86_64
      make[2]: Leaving directory `/usr/src/kernels/3.10.0-693.11.1.el7.x86_64'
      depmod `sed -n 's/#define UTS_RELEASE "\([^"]*\)"/\1/p' /lib/modules/3.10.0-693.11.1.el7.x86_64/build/include/generated/utsrelease.h`
      make[1]: Leaving directory `/root/openvswitch-2.9.0/datapath/linux'
      ```

      恭喜你，和我一样，中招了。

      此问题是安装内核模块是遇错，那么手动安装即可，并保持重启已经安装，所以需要以下操作

      ```shell
      // 查看这几个模块的依赖关系是否建立，一般在最后几行
      # vim /lib/modules/$(uname -r)/modules.dep
      // 查看相对目录的ko文件是否是刚编译过的
      # cd /lib/modules/$(uname -r)/extra
      # ls -al
      # date
      // 如果不是最新，从源码目录`datapath/linux`中把几个ko文件重新移入过去。
      // 之后改写文件，让其可以开机加载就可以了（不想重启就手动加载）
      # cat /etc/sysconfig/modules/ovs.modules 
      #!/bin/sh

      modprobe gre
      modprobe libcrc32c
      modprobe openvswitch

      modprobe vport-geneve
      modprobe vport-gre
      modprobe vport-lisp
      modprobe vport-stt
      modprobe vport-vxlan
      # chmod +x /etc/sysconfig/modules/ovs.modules  (文件加入可执行权限)
      # reboot
      ```

6. 开始

   - 全自动执行

     ```shell
     // 加入环境变量，或者直接绝对路径执行
     // 会启动 ovs-vswitchd 和 ovsdb-server
     //不在此目录，则'find /usr/ -name 'ovs-ctl''找一下
     # export PATH=$PATH:/usr/local/share/openvswitch/scripts
     # ovs-ctl start
     ```

   - 半自动（指定启动项）

     ```shell
     //只启动 ovsdb-server
     # ovs-ctl --no-ovs-vswitchd start
     //只启动 ovs-vswitchd
     # ovs-ctl --no-ovsdb-server start
     ```

   - 手动执行

     ```shell
     //不用 ovs-ctl工具
     //创建数据库目录（根据configure），此处为默认
     # mkdir -p /usr/local/etc/openvswitch
     # ovsdb-tool create /usr/local/etc/openvswitch/conf.db vswitchd/vswitch.ovsschema
     ```

     配置`ovsdb-serve`以使用数据库

     ```shell
     # mkdir -p /usr/local/var/run/openvswitch
     # ovsdb-server --remote=punix:/usr/local/var/run/openvswitch/db.sock \
         --remote=db:Open_vSwitch,Open_vSwitch,manager_options \
         --private-key=db:Open_vSwitch,SSL,private_key \
         --certificate=db:Open_vSwitch,SSL,certificate \
         --bootstrap-ca-cert=db:Open_vSwitch,SSL,ca_cert \
         --pidfile --detach --log-file
     ```

     Note：如果openvswitch 不支持`ssl`,则忽``--private-key`, `--certificate`,  `--bootstrap-ca-cert`。

     初始化数据库

     ```shell
     # ovs-vsctl --no-wait init
     ```

     开启openvswitch主要进程

     ```shell
     # ovs-vswitchd --pidfile --detach --log-file
     ```

7. 验证

   ```shell
   # ovs-vsctl add-br br0
   # ovs-vsctl add-port br0 eth0
   ```

## 升级

1. 终止进程

   本例为默认目录

   ```shell
   # kill `cd /usr/local/var/run/openvswitch && cat ovsdb-server.pid ovs-vswitchd.pid`
   ```

2. 安装新的openvswitch版本

   - 不改变配置直接编译即可；
   - 更改配置（目录及编译选项）。

3. 升级数据库

   - 库内无重要数据则直接删除重建；

   - 有重要数据则先备份数据库，然后利用`ovsdb-toolconvert`来进行升级

     ```shell
     # ovsdb-tool convert /usr/local/etc/openvswitch/conf.db vswitchd/vswitch.ovsschema
     ```

4. 启动进程。

   ```shell
   # ovs-ctl start
   ```

## 热升级

**一句话概括：**可利用 `ovs-ctl restart`一次性搞定，如果有内核修改则利用`ovs-ctl force-reload-kmod`。

1. 升级仅涉及用户空间程序（实用程序、守护进程），确保新的版本与之前加载的内核模块兼容。

2. 用户空间守护进程的升级意味着它们必须重新启动。重新启动守护进程意味着ovs-vswitchd守护进程中的openflow流将丢失。

   恢复流量的一种方法是让控制器重新填充它。

   另一种方法是使用像ovs-ofctl这样的工具保存以前的流程，然后在重新启动后重新添加它们。只有当新的开放vswitch接口保留旧的“端口”值时，恢复旧流才是准确的。

   ```shell
   // ovs-save 可以保存每个桥的流表。ovs-save COMMAND {bridge1|bridge2}
   // ovs-ofctl 封装而成。具体路径查找方式前面已写。
   # /usr/share/openvswitch/scripts/ovs-save  save-flows br-int 

   //进程重启之后可通过保存文件进行恢复
   # ovs-ofctl replace-flows  br-int /tmp/ovs-save.WvZfM1zEhH/br-int.flows.dump  -O OpenFlow14 
   ```

3. 当新用户空间守护进程重新启动时，它们会自动刷新内核中的旧流设置。如果有数百个进入内核的新流程，但用户空间守护进程正在忙于从控制器或ovs-ofctl等实用程序中设置新的用户空间流量，则这可能会很耗时（冲突）。

   打开vswitch数据库提供了一个通过open_vswitch表的`other_config:flow-restore-wait`列解决此问题的选项。有关详细信息，请参阅ovs-vswitchd.conf.db（5）[手册页](http://www.openvswitch.org/support/dist-docs/ovs-vswitchd.conf.db.5.html)。

   ```shell
   此选项热升级的过程如下：
   1、终止ovs-vswitchd
   2、设置`other_config:flow-restore-wait`为true
   3、开启ovs-vswitchd
   4、利用ovs-ofctl恢复流表
   5、设置`other_config:flow-restore-wait`为false

   ovs-ctl 选项 `restart` 和 `force-reload-kmod`利用了此过程。
   ```

4. 如果升级还涉及升级内核模块，则需要卸载旧的内核模块，并且应该加载新的内核模块。

   这意味着属于开放vswitch的内核网络设备被重新创建，并且内核流程丢失。如果用户空间守护程序立即重新启动并且用户空间流尽快恢复，则可以减少流量的停机时间。

   ```Shell
   `force-reload-kmod`卸载 vport* 和 openvswitch模块，重装 openvswitch 模块。
   ```

ovs-ctl实用程序的重新启动功能仅重新启动用户空间守护程序，确保'ofport'值在重新启动时保持一致，使用ovs-ofctl实用程序还原用户空间流，并使用`other_config:flow-restore-wait`列保留交通宕机时间降至最低。

ovs-ctl实用程序的`force-reload-kmod`函数完成了上述所有操作，但也用新的内核模块替换了旧的内核模块。

打开debian，xenserver和rhel的vswitch启动脚本使用ovs-ctl的功能，并且建议这些功能也可用于其他软件平台。

## 升级实例

验证升级构建的拓扑如下

![升级拓扑](/images/Openvswitch-编译及升级/升级拓扑.png)

过程如下

1. br-tun、br-int、 qbr、netns创建

   ```shell
   # ovs-vsctl add-br br-tun 
   # ovs-vsctl add-br br-int
   # brctl addbr qbr0 
   # ip netns add ns0
   # ip netns exec ns0 ip link set dev lo up
   ```

2. br-tun、br-int 连接

   ```shell
   # ovs-vsctl add-port br-tun patch-int -- set Interface patch-int type=patch options:peer=patch-tun
   # ovs-vsctl add-port br-int patch-tun -- set Interface patch-tun type=patch options:peer=patch-int
   ```

3. br-int、qbr连接

   ```shell
   # ip link add qvo type veth peer name qvb
   # brctl addif qbr0 qvb 
   # ovs-vsctl add-port br-int qvo 
   # ifconfig qvb up;ifconfig qvo up; ifconfig qbr0 up;
   ```

4. qbr、ns连接

   ```shell
   # ip link add qn0 type veth peer name qn1
   # brctl addif qbr0 qn0
   # ip link set qn1 netns ns0
   # ip netns exec ns0 ifconfig qn1 10.1.1.1/24 up
   # ifconfig qn0 up
   ```

5. br-tun对端连接

   ```shell
   # ovs-vsctl add-port br-tun vxlan1 -- set interface vxlan1 type=vxlan options:remote_ip=192.168.32.5 options:local_ip=192.168.32.4 
   //对端将remote_ip local_ip换一下位置
   ```

6. 进入对端netns ，ping本端netns内部ip地址，且在本端eth0接口抓包验证。

   ![抓包](/images/Openvswitch-编译及升级/抓包.png)

7. br-int 和 br-tun流表默认都是全通，所以修改一下，为了升级之后进行确认。

   ![修改流表](/images/Openvswitch-编译及升级/修改流表.png)

8. 升级！（升级之前的准备见上文，升级过程中一直ping）。

   - 不升级内核

     ```shell
     # /usr/share/openvswitch/scripts/ovs-ctl restart  
     Saving flows                                               [  OK  ]
     Exiting ovsdb-server (119795)                              [  OK  ]
     Starting ovsdb-server                                      [  OK  ]
     system ID not configured, please use --system-id ... failed!
     Configuring Open vSwitch system IDs                        [  OK  ]
     Exiting ovs-vswitchd (119865)                              [  OK  ]
     Starting ovs-vswitchd                                      [  OK  ]
     Restoring saved flows                                      [  OK  ]
     Enabling remote OVSDB managers                             [  OK  ]
     ```

     流量不中断。

   - 升级内核

     ```shell
     # /usr/share/openvswitch/scripts/ovs-ctl force-reload-kmod
     Detected internal interfaces: br-int br-tun                [  OK  ]
     Saving flows                                               [  OK  ]
     Exiting ovsdb-server (1278)                                [  OK  ]
     Starting ovsdb-server                                      [  OK  ]
     system ID not configured, please use --system-id ... failed!
     Configuring Open vSwitch system IDs                        [  OK  ]
     Exiting ovs-vswitchd (1304)                                [  OK  ]
     Saving interface configuration                             [  OK  ]
     Removing datapath: system@ovs-system                       [  OK  ]
     Removing vport_vxlan module                                [  OK  ]
     Removing openvswitch module                                [  OK  ]
     Inserting openvswitch module                               [  OK  ]
     Starting ovs-vswitchd                                      [  OK  ]
     Restoring saved flows                                      [  OK  ]
     Enabling remote OVSDB managers                             [  OK  ]
     Restoring interface configuration                          [  OK  ]
     ```

     流量不中断。

     **Notes**：升级的version >= 2.8.2 时，不会重新加载vport*内核模块，这是因为 `在RHEL 7.x上，遇到了一个由iptables启动脚本引起的错误，该脚本尝试删除与linux conntrack相关的所有内核模块。它无法卸载openvswitch内核模块，因为它有一个引用计数。但它成功地卸载了vport-geneve，并转而用上游的“geneve”内核模块。这会导致隧道断开。通过不加载基于vport的内核模块来避免上述情况。 ovs-vswitchd启动时将加载上游模块。`(参考[此处](https://github.com/openvswitch/ovs/commit/59d18a069a10b7bf63ab406650ae7c875ef4d3d3))。

9. 验证接口及流表（流量不断基本就没什么问题）。

**Notes**：ovs在openstack环境中升级时，需要将openvswitch-agent先停止，以防止ovs相关进程终止时其自动拉起。
