---
title: DNS服务器配置之DNSMASQ
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
   test.com.    IN SOA    ns1.test.com. root (
                       0    ; serial
                       1D    ; refresh
                       1H    ; retry
                       1W    ; expire
                       3H )    ; minimum
           NS      ns1.test.com.
           A       127.0.0.1
           AAAA    ::1
   ns1    IN    A    172.16.1.66
   node1    IN    A    172.16.1.5
   node2    IN    A    172.16.1.6
   node3    IN    A    172.16.1.7
   ```

   ```shell
   zone文件中的所有指令都以一个 $ 开始，指令主要用来表示zone文件中的一些控制信息。
   ```

   **$TTL指令**为没有定义TTLs的后续记录设定即时时间。有效TTLs是在0-2147483647秒范围内，在[RFC 2308]( https://tools.ietf.org/html/rfc2308)中定义。

   SOA(start of authority)资源记录：它定义了一个域的全局特性，必须是出现在zone文件中的第一个资源记录，而且一个zone文件中必须只有一个SOA资源记录。其中SOA后面的test.com.与root分别是域名服务器和管理员邮箱([root@test.com](mailto:root@test.com))。

3. 验证配置是否正确

   ```shell
   # named-checkzone test.com /var/named/test.com.zone
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



## 优秀资料





BIND同步原理

[阿里DNS：三问BIND主辅同步](https://zhuanlan.zhihu.com/p/43444785)

[DNS工作原理及主从同步](https://blog.51cto.com/54276311/1536305)



BIND管理

https://www.it7e.com/archives/1727.html



DNS系统是由各式各样的DNS软件所驱动的，例如：

- [DJBDNS](https://zh.wikipedia.org/w/index.php?title=DJBDNS&action=edit&redlink=1)（Dan J Bernstein's DNS implementation）
- [MaraDNS](https://zh.wikipedia.org/w/index.php?title=MaraDNS&action=edit&redlink=1)
- [Name Server Daemon](https://zh.wikipedia.org/w/index.php?title=Name_Server_Daemon&action=edit&redlink=1)（Name Server Daemon）
- [PowerDNS](https://zh.wikipedia.org/w/index.php?title=PowerDNS&action=edit&redlink=1)
- [Dnsmasq](https://zh.wikipedia.org/wiki/Dnsmasq)

