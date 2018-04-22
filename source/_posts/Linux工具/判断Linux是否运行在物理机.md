---
title: 判断Linux是否运行在物理机
date: 2018-04-17 11:38:45
categories: Linux工具
tags:
  - dmidecode
  - lspci
---

## dmidecode命令

`dmidecode`命令用来查看硬件信息。

```shell
dmidecode is a tool for dumping a computer DMI (some say SMBIOS) table contents in a human-readable format. So if your machine is a vm, you should not get any output.
```

DMI ，即Desktop Management Interface。也有被称为SMBIOS，即System Management BIOS。 

较低版本的dmidecode命令不支持参数，因此要看信息的话，要用more/less/grep来配合才能更好些。

- 查看服务器型号：dmidecode | grep ‘Product Name’
- 查看主板的序列号：dmidecode |grep ‘Serial Number’
- 查看系统序列号：dmidecode -s system-serial-number
- 查看内存信息：dmidecode -t memory
- 查看OEM信息：dmidecode -t 11

### 显示生产厂商

#### 物理机

```shell
# dmidecode -s system-manufacturer
IBM
```

#### 虚拟机

```shell
# dmidecode -s system-manufacturer
OpenStack Foundation
```

### 显示产品名

#### 物理机

```shell
# dmidecode -s system-product-name
System x3650 M4 -[7915IA5]-
```

#### 虚拟机

```shell
# dmidecode -s system-product-name
OpenStack Nova
```

## /proc/scsi/scsi文件

```shell
Try check on /proc/scsi/scsi, if it is a vm, you would not get any attached device: 
Attached devices:
```

### 物理机

```shell
# cat /proc/scsi/scsi
Attached devices:
Host: scsi0 Channel: 02 Id: 00 Lun: 00
  Vendor: IBM      Model: ServeRAID M5110e Rev: 3.15
  Type:   Direct-Access                    ANSI  SCSI revision: 05
```

### 虚拟机

```shell
# cat /proc/scsi/scsi
Attached devices:
```

## ethtool命令

### 物理机

```shell
# ethtool -i eth0
driver: igb
version: 3.2.10
firmware-version: 1.5-2
expansion-rom-version: 
bus-info: 0000:06:00.0
supports-statistics: yes
supports-test: yes
supports-eeprom-access: yes
supports-register-dump: yes
supports-priv-flags: no
```

### 虚拟机

```shell
# ethtool -i eth0
driver: virtio_net
version: 1.0.0
firmware-version: 
expansion-rom-version: 
bus-info: 0000:00:03.0
supports-statistics: no
supports-test: no
supports-eeprom-access: no
supports-register-dump: no
supports-priv-flags: no
```



此处简单介绍一下`lspci`命令。

## lspci

lspci 是一个用来显示系统中所有PCI总线设备或连接到该总线上的所有设备的工具。

1. `lspci` 不加任何选项

   ```shell
   Host bridge:					<==主板芯片
   VGA compatible controller		 <==显卡
   Audio device					<==音频设备
   PCI bridge						<==接口插槽
   USB Controller					<==USB控制器
   ISA bridge                                
   IDE interface                            
   SMBus                                       
   Ethernet controller				<==网卡
   ```

2. `lspci -tv` 列出所有的pci设备

3. `lspci | grep -i 'eth'` 查看网卡型号

### lscpi 和 eth*的对应关系

1. /sys/devices设备信息

   ```shell
   # pwd
   /sys/devices
   # find . -name '*eth*'
   ./pci0000:00/0000:00:1c.0/0000:06:00.0/net:eth0
   ./pci0000:00/0000:00:1c.0/0000:06:00.1/net:eth1
   ./pci0000:00/0000:00:1c.0/0000:06:00.2/net:eth2
   ./pci0000:00/0000:00:1c.0/0000:06:00.3/net:eth3
   # lspci -s 06:00.0
   06:00.0 Ethernet controller: Intel Corporation I350 Gigabit Network Connection (rev 01)
   ```

2. ethtool 方式

   ```shell
   # ethtool -i eth1 
   driver: igb
   version: 3.2.10
   firmware-version: 1.5-2
   expansion-rom-version: 
   bus-info: 0000:06:00.1
   supports-statistics: yes
   supports-test: yes
   supports-eeprom-access: yes
   supports-register-dump: yes
   supports-priv-flags: no
   # lspci -s 06:00.1			// bus-info
   06:00.1 Ethernet controller: Intel Corporation I350 Gigabit Network Connection (rev 01)
   ```



## 优秀资料

[怎么判断你的linux系统是不是运行在虚拟机器上面](https://blog.csdn.net/gatieme/article/details/50962554)

[linux下eth*与lspci中对应关系](https://www.oschina.net/question/197184_109851)