---
title: OpenStack中的嵌套虚拟化
date: 2017-12-18 11:16:22
categories: OpenStack
tags:
  - OpenStack
  - 嵌套虚拟化
---

在Intel处理器上，KVM使用Intel的vmx(virtul machine eXtensions)来提高虚拟机性能，即硬件辅助虚拟化技术。

那么如果在处理器中的启动的虚拟机也想使用vmx技术，应该如何处理？此时，就需要开启嵌套式虚拟nested。nested是一个可通过内核参数来启用的功能。它能够使一台虚拟机具有物理机CPU特性,支持vmx或者svm(AMD)硬件虚拟化。
<!--more-->
## 服务器配置

1. 服务器CPU需要支持 vmx(Intel架构) 或 svm(AMD架构)。

   ```shell
   # grep -E '(vmx|svm)' /proc/cpuinfo
   ```

2. 服务器的内核版本需要3.0+。

   ```shell
   # uname -r
   3.10.0-693.5.2.el7.x86_64
   ```

3. 服务器需要开启nested功能。两种架构开启方式如下。

### Intel 架构

1. 检测服务器内核是否启动嵌套。

   ```shell
   # cat /sys/module/kvm_intel/parameters/nested
   N	// Y(YES) 或 N(NO)
   ```

2. 卸载kvm_intel模块（移除之前确保无vm在运行，否则无法卸载）。

   ```shell
   # modprobe -r kvm-intel
   ```

3. 配置参数并启动

   - 临时生效

     ```shell
     # modprobe kvm_intel nested=1
     ```

   - 永久生效

     ```shell
     # echo 'options kvm-intel nested=y' >> /etc/modprobe.d/dist.conf
     # modprobe kvm-intel
     ```

4. 查看是否生效

   ```shell
   # cat /sys/module/kvm_intel/parameters/nested
   Y
   ```

### AMD 架构

1. 检测服务器内核是否启动嵌套。

   ```shell
   # cat /sys/module/kvm_amd/parameters/nested
   0	// 1(YES) 或 0(NO)
   ```

2. 卸载kvm_intel模块（移除之前确保无vm在运行，否则无法卸载）。

   ```shell
   # modprobe -r kvm-amd
   ```

3. 配置参数并启动

   永久生效

   ```shell
   # echo 'options amd nested=1' >> /etc/modprobe.d/dist.conf
   # modprobe kvm-amd
   ```

4. 查看是否生效

   ```shell
   # cat /sys/module/kvm_amd/parameters/nested
   1
   ```

## 虚拟机配置

### qemu-kvm

- 修改 '/etc/libvirt/qemu/vm.xml' 文件中有关虚拟机CPU的特性。

  在CPU数量设定下下增加'host-passthrough'支持，如下

  ```xml
  <vcpu placement='static' current='20'>22</vcpu>
  <cpu mode='host-passthrough'/>
  ```

  之后，重启虚拟机即可。

- 如果用'qemu-kvm'命令启动，则增加如下参数即可

  ```shell
  -enable-kvm -cpu qemu64,+vmx
  ```


**Tips：**

- 为了保证虚拟机在不同宿主机之间迁移时候的兼容性，Libvirt对CPU提炼出标准的几种类型，在'/usr/share/libvirt/cpu_map.xml'中可以查到。cpu_map.xml不仅是CPU型号，还有生产商信息、每种型号的CPU特性定义等信息。

- CPU配置模式可以有以下几种。

  1. host-model模式。根据物理CPU的特性，选择一个最靠近的标准CPU型号。如果没有指定CPU模式，默认也是使用这种模式。

     ```xml
     <cpu mode='host-model'/> 
     ```

  2. host-passthrough模式。直接将物理CPU暴露给虚拟机使用，在虚拟机上完全可以看到的就是物理CPU的型号。

     ```xml
     <cpu mode='host-passthrough'/> 
     ```

  3. custom模式。匹配标准类型中的一种。

     ```xml
     <cpu mode='custom' match='exact'>
     	<model fallback='allow'>core2duo</model>
     </cpu> 
     ```

     'core2duo'为 cpu_map.xml中定义的CPU属性的模块名称。

### openstack平台

openstack集成了qemu-kvm，启动虚拟机属于nova操作，因此只需要如下形式修改计算节点'/etc/nova/nova.conf'文件即可。

```yaml
[libvirt]
…………
cpu_mode=host-passthrough
virt_type=kvm
…………
```

 之后重启计算节点compute服务即可。

```shell
# systemctl restart openstack-nova-compute
```

启动虚拟机之后，进入查看是否已经支持。