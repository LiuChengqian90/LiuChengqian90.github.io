---
title: DNS服务器配置之BIND
date: 2018-01-17 11:05:19
categories:
tags:
  - DNS
  - bind9
typora-root-url: ../source/images
---

[BIND](https://zh.wikipedia.org/wiki/BIND)（Berkeley Internet Name Domain），是现今互联网上最常使用的DNS软件，使用BIND作为服务器软件的DNS服务器约占所有DNS服务器的九成。BIND现在由互联网系统协会（Internet Systems Consortium）负责开发与维护。



## 简单安装

**系统环境**

```shell
# uname -sr
Linux 3.10.0-957.12.2.el7.x86_64
# cat /etc/redhat-release
CentOS Linux release 7.5.1804 (Core)
```

| HOST              | IP           | ROLE   |
| ----------------- | ------------ | ------ |
| instance-84qrartl | 192.168.1.5  | Master |
| instance-c9btn3kt | 192.168.2.13 | Slave  |

**bind9安装**

```shell
# yum install -y bind bind-utils
# named -V
```

**配置文件**

YUM安装后，bind9整体配置文件放于`/etc/`目录

```shell
# ls /etc/named.conf
```

此配置文件注释部分包含了两个比较重要的部分：

- 配置文件例子  /usr/share/doc/bind*/sample/
- 管理员手册    /usr/share/doc/bind-{version}/Bv9ARM.html

开始更改`/etc/named.conf`试安装的bind可以简单使用。

1. 服务监听的端口及地址`listen-on`

   ```shell
   listen-on port 53 { any; };
   ```

   监听本机所有地址的53端口。

   IPv6协议的配置为`listen-on-v6`。

2. 工作目录`directory`

   服务器的工作目录。配置文件中所有使用的相对路径，指的都是在这里配置的目录下。大多数服务器的输出文件（如named.run）都缺省生成在这个目录下。如果没有设定目录，工作目录缺省设置为服务器启动时的目录‘.’。指定的目录应该是一个绝对路径。

   ```shell
   directory       "/var/named";
   ```

3. 查询控制`allow-query`

   设定哪个主机可以进行普通的查询。

   ```shell
   allow-query     { any; };
   ```

   所有主机都可以进行查询。

4. 连接其他配置`include`

   ```shell
   include "/etc/named.rfc1912.zones";
   include "/etc/named.root.key";
   ```

5. 验证配置是否正确

   ```shell
   # named-checkconf
   ```



开始对`/etc/named.rfc1912.zones`进行更改，加入我们需要的测试case

1. 文件最后新增zone `test.com`

   ```shell
   zone "test.com" IN {
           type master;
           file "test.com.zone";
           allow-update { none; };
   ```

   `type master` - 本机是 `test.com`的主服务器；

   `file test.com.zone` - 全名为 `/var/named/test.com.zone`，此zone下的其他配置。

   `allow-update` - 设定哪台主机允许为主域名服务器提交动态DNS更新。默认为拒绝任何主机进行更新。 

2. 修改`test.com.zone`

   ```shell
   # touch /var/named/test.com.zone
   # chown named:named /var/named/test.com.zone
   # vim /var/named/test.com.zone
   ```

   ```shell
   $TTL 1D
   @    IN SOA    test.com. root (
                       0    ; serial
                       1D    ; refresh
                       1H    ; retry
                       1W    ; expire
                       3H )    ; minimum
           NS      @
           A       127.0.0.1
           AAAA    ::1
   node1    IN    A    172.16.1.5
   node2    IN    A    172.16.1.6
   node3    IN    A    172.16.1.7
   ```

   ```shell
   zone文件中的所有指令都以一个 $ 开始，指令主要用来表示zone文件中的一些控制信息。
   ```

   $TTL指令为没有定义TTLs的后续记录设定即时时间。有效TTLs是在0-2147483647秒范围内，在[RFC 2308]( https://tools.ietf.org/html/rfc2308)中定义。

   @指的是当前域的顶级。

   SOA(start of authority)资源记录：它定义了一个域的全局特性，必须是出现在zone文件中的第一个资源记录，而且一个zone文件中必须只有一个SOA资源记录。其中SOA后面的test.com.与root分别是域名服务器和管理员邮箱([root@test.com](mailto:root@test.com))。

3. 验证配置是否正确

   ```shell
   named-checkzone test.com /var/named/test.com.zone
   ```

4. 启动服务`named`

   ```shell
   # systemctl start named
   ```

5. 验证

   本机(instance-84qrartl)或者host2(instance-c9btn3kt)

   ```shell
   # dig node1.test.com @192.168.1.5
   # dig node2.test.com @192.168.1.5
   ```



## ACL

acl语句给一个**地址匹配表**列赋了一个象征名称。它的名字来自于地址匹配列表的最基本功能：**访问控制表列（ACLs）**。 

注意，一个地址表列名必须首先在acl中定义了，然后才能在别处使用；提前调用是不允许的。 

下列ACLs组成： 

| any       | 匹配所有主机                 |
| --------- | ---------------------------- |
| none      | 不匹配任何主机               |
| localhost | 匹配主机上所有IPV4的网络接口 |
| localnets | 匹配所有IPV4本地网络的主机   |

localhost 和localnets的ACLs目前不支持IPV6（也就是说，localhost不匹配主机的IPV6地址，localnets不匹配连上IPV6网络的主机），因为缺乏确定本地IPV6主机地址的标准方法。 



继续修改`/etc/named.conf`验证

1. 增加ACL

   options 前增加如下内容

   ```shell
   acl allquery {
           192.168.1.5;
   };
   ```

2. 修改allow-query字段

   应用ACL

   ```shell
   allow-query     { allquery; };
   ```

3. 验证配置、重启服务

   ```shell
   # named-checkconf; 
   # systemctl restart named;
   ```

4. 在两个HOST上进行验证，仅有`instance-84qrartl`可以解析到地址。

   ```shell
   # dig node2.test.com @192.168.1.5
   ```

## 文件拆分

include

## zone语句

### 同步协议

## 视图



[CentOS7搭建BIND9 DNS服务器过程](https://blog.51cto.com/11804445/2056629)

[CentOS 7 使用 bind 配置私有网络的 DNS](https://qizhanming.com/blog/2017/05/27/how-to-configure-bind-as-a-private-network-dns-server-on-centos-7)

[How To Configure BIND as a Private Network DNS Server on CentOS 7](https://www.digitalocean.com/community/tutorials/how-to-configure-bind-as-a-private-network-dns-server-on-centos-7)

[CentOS7.4下DNS服务器软件BIND安装及相关的配置](https://blog.51cto.com/liqingbiao/2093064)

[BIND9 管理员参考手册](https://www.centos.bz/manual/BIND9-CHS.pdf)



[阿里DNS：三问BIND主辅同步](https://zhuanlan.zhihu.com/p/43444785)

[DNS工作原理及主从同步](https://blog.51cto.com/54276311/1536305)



DNS系统是由各式各样的DNS软件所驱动的，例如：

- [DJBDNS](https://zh.wikipedia.org/w/index.php?title=DJBDNS&action=edit&redlink=1)（Dan J Bernstein's DNS implementation）
- [MaraDNS](https://zh.wikipedia.org/w/index.php?title=MaraDNS&action=edit&redlink=1)
- [Name Server Daemon](https://zh.wikipedia.org/w/index.php?title=Name_Server_Daemon&action=edit&redlink=1)（Name Server Daemon）
- [PowerDNS](https://zh.wikipedia.org/w/index.php?title=PowerDNS&action=edit&redlink=1)
- [Dnsmasq](https://zh.wikipedia.org/wiki/Dnsmasq)