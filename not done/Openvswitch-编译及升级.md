---
title: Ospenvswitch 编译及升级
date: 2018-03-23 19:04:52
categorie: openvswitch
tags:
---

## 编译

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
        INSTALL /root/openvswitch-2.9.0/datapath/linux/vport-geneve.ko
      Can't read private key
        INSTALL /root/openvswitch-2.9.0/datapath/linux/vport-gre.ko
      Can't read private key
        INSTALL /root/openvswitch-2.9.0/datapath/linux/vport-lisp.ko
      Can't read private key
        INSTALL /root/openvswitch-2.9.0/datapath/linux/vport-stt.ko
      Can't read private key
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
      // 之后改写文件，让其可以开机加载就可以了
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

TBD