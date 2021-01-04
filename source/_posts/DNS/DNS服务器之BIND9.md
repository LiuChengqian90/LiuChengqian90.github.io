---
title: DNS服务器之BIND9
date: 2019-08-05 11:05:19
categories: DNS
tags:
  - DNS
  - bind9
---

[BIND](https://zh.wikipedia.org/wiki/BIND)（Berkeley Internet Name Domain），是现今互联网上最常使用的DNS软件，使用BIND作为服务器软件的DNS服务器约占所有DNS服务器的九成。BIND现在由互联网系统协会（Internet Systems Consortium）负责开发与维护。
<!--more-->
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
   };
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



## OPTIONS语句

options语句设立可以被整个BIND使用的全局选项。这个语句在每个配置文件中只有一处。如果出现多个options语句，则第一个options的配置有效，并且会产生一个警告信息。如果没有options语句，每个选项择使用缺省值。 

在`named.conf`文件中options语句的语法如下：

```shell
options {  
[ version version_string; ]  
[ directory path_name; ]  
[ named-xfer path_name; ]  
[ tkey-domain domainname; ]  
[ tkey-dhkey key_name key_tag; ]  
[ dump-file path_name; ]  
[ memstatistics-file path_name; ]  
[ pid-file path_name; ]  
[ statistics-file path_name; ]  
[ zone-statistics yes_or_no; ]  
[ auth-nxdomain yes_or_no; ]  
[ deallocate-on-exit yes_or_no; ]  
[ dialup dialup_option; ]  
[ fake-iquery yes_or_no; ]  
[ fetch-glue yes_or_no; ]  
[ has-old-clients yes_or_no; ]  
[ host-statistics yes_or_no; ]  
[ minimal-responses yes_or_no; ]  
[ multiple-cnames yes_or_no; ]  
[ notify yes_or_no | explicit; ]  
[ recursion yes_or_no; ]  
[ rfc2308-type1 yes_or_no; ]  
[ use-id-pool yes_or_no; ]  
[ maintain-ixfr-base yes_or_no; ]  
[ forward ( only | first ); ]  
[ forwarders { ip_addr [port ip_port] ; [ ip_addr [port ip_port] ; ... ] }; ]  
[ check-names ( master | slave | response )( warn | fail | ignore ); ]  
[ allow-notify { address_match_list }; ]  
[ allow-query { address_match_list }; ]  
[ allow-transfer { address_match_list }; ]  
[ allow-recursion { address_match_list }; ]  
[ allow-v6-synthesis { address_match_list }; ]  
[ blackhole { address_match_list }; ]  
[ listen-on [ port ip_port ] { address_match_list }; ]  
[ listen-on-v6 [ port ip_port ] { address_match_list }; ]  
[ query-source [ address ( ip_addr | * ) ] [ port ( ip_port | * ) ]; ]  
[ max-transfer-time-in number; ]  
[ max-transfer-time-out number; ]  
[ max-transfer-idle-in number; ]  
[ max-transfer-idle-out number; ]  
[ tcp-clients number; ]  
[ recursive-clients number; ]  
[ serial-query-rate number; ]  
[ serial-queries number; ]  
[ transfer-format ( one-answer | many-answers ); ]  
[ transfers-in number; ]  
[ transfers-out number; ]  
[ transfers-per-ns number; ]  
[ transfer-source (ip4_addr | *) [port ip_port] ; ]  
[ transfer-source-v6 (ip6_addr | *) [port ip_port] ; ]  
[ notify-source (ip4_addr | *) [port ip_port] ; ]  
[ notify-source-v6 (ip6_addr | *) [port ip_port] ; ]  
[ alsonotify { ip_addr [port ip_port] ; [ ip_addr [port ip_port] ; ... ] }; ]  
[ max-ixfr-log-size number; ]  
[ coresize size_spec ; ]  
[ datasize size_spec ; ]  
[ files size_spec ; ]  
[ stacksize size_spec ; ]  
[ cleaning-interval number; ]  
[ heartbeat-interval number; ]  
[ interface-interval number; ]  
[ statistics-interval number; ]  
[ topology { address_match_list }];  
[ sortlist { address_match_list }];  
[ rrset-order { order_spec ; [ order_spec ; ... ] } };  
[ lame-ttl number; ]  
[ max-ncache-ttl number; ]  
[ max-cache-ttl number; ]  
[ sig-validity-interval number ; ]  
[ min-roots number; ]  
[ use-ixfr yes_or_no ; ]  
[ provide-ixfr yes_or_no; ]  
[ request-ixfr yes_or_no; ]  
[ treat-cr-as-space yes_or_no ; ]  
[ min-refresh-time number ; ]  
[ max-refresh-time number ; ]  
[ min-retry-time number ; ]  
[ max-retry-time number ; ]  
[ port ip_port; ]  
[ additional-from-auth yes_or_no ; ]  
[ additional-from-cache yes_or_no ; ]  
[ random-device path_name ; ]  
[ max-cache-size size_spec ; ]  
[ match-mapped-addresses yes_or_no; ]  
};
```

### 基本选项

**version** 

回答针对服务器版本的请求时的内容。缺省返回的是服务器的真实版本。 

**directory** 

**服务器的工作目录**。配置文件中所有使用的相对路径，指的都是在这里配置的目录下。

大多数服务器的输出文件（如named.run）都缺省生成在这个目录下。如果没有设定目录，工作目录缺省设置为服务器启动时的目录‘.’。**指定的目录应该是一个绝对路径**。 

**tkey-domain** 

这个域名将会附带在由TKEY生成的所有共享密匙名字的后面。

当用户请求进行TKEY交换时，它会为密匙设定或不设定所要求的名称。如果设置了tkey_domain，共享密匙的名字将会是"client specified part"（用户设定的部分） + "tkey-domain"。否则，共享密匙的名字将是"random hex digits"（随机的16进制数） + "tkey-domain"。在大多数情况下，domainname 应该是服务器的域名。 

**Tkey-dhkey** 

针对使用 Diffie-Hellman 的 TKEY 模式的用户，服务器用来生成共享密匙的Diffie-Hellman 密匙。服务器必须可以从工作目录中调入公共和私人密匙。大多数情况下，密匙的名称应该是服务器的主机名。 

**dump-file**  

当执行 rndc dumpdb 命令时，服务器存放数据库文件的路径名。如果没有指定，缺省名字是 named_dump.db。 

**memstatistics-file** 

服务器输出的内存使用统计文件的路径名。如果没有指定，默认值为 named.memstats。 

**注意：还没有在 BIND9 中实现！** 

**pid-file**  

进程 ID 文件的路径名。如果没有指定，默认为/var/run/named.pid。

pid-file 是给那些需要向运行着的服务器发送信号的程序使用的。 

**statistics-file**  

当使用 rndc stats 命令的时候，服务器会将统计信息追加到的文件路径名。如果没有指

定，默认为 named.stats 在服务器程序的当前目录中。 

**Port** 

服务器用来接收和发送 DNS 协议数据的 UDP/TCP 端口号。默认为 53。这个选项主要用于服务器的检测；因为如果不使用 53 端口的话，服务器将不能与其它的 DNS 进行通讯。 

**random-device** 

服务器使用的 entropy 源：entropy 主要用于 DNSSEC 操作，如 TKEY 的数据交换和加密域的动态更新。此选项指定了 entropy 将会从哪个设备（或文件）中读取信息。如果它是一个文件，则当文件耗尽后，需要 entropy 的操作将会失败。如果没有指定，默认值是/dev/random（或等价的），如果它存在，否则就是没有。random-device 选项是在服务器启动时，初始化配置时起作用的，在以后的重启时则被忽略。



### Boolean 选项 

**auth-nxdomain**  

如果是 yes，那么 AA 位将一直设置成 NXDOMAIN 响应，甚至在服务器不是授权服务器的情况下都是这样的。默认值是 no  ；这与 BIND8 不同。如果用户使用的是非常老版本的 DNS 软件，则有必要把它设置成 yes。

**deallocate-on-exit**  

此选项在BIND8中用于检查出口处内存泄露。BIND9忽略此选项，并始终进行检查。 

**Dialup** 

如果是yes，那么服务器将会象在通过一条按需拨号的链路进行域传送一样，对待所有的域（按需拨号就是在服务器有流量的时候，链路才连通）。根据域类型的不同它有不同的作用，并将集中域的维护操作，这样所有有关的操作都会集中在一段很短的时间内完成，每个heartbeat-interval一次，一般是在一次调用之中完成。它也禁止一些

正常的域维护的流量。默认值是no。 

dialup选项也可以定义在view和zone语句中，这样就会代替了全局设置中dialup的选项。 

**如果域是一个主域，服务器就会对所有辅域发送NOTIFY请求**。这将激活辅域名服务器中的对域的序列号的检验。这样当建立一个连接时，辅域名服务器才能确认这个域的传输合法性。 

如果这个域是一个辅域或是末梢域（stub zone），那么服务器将会禁止通常的“zone up to date”（refresh）请求，为了能发送NOTIFY请求，只有在heartbeat-interval过期之后才执行。 

通过下列的设置，可以实现更好的控制。 

1. notify只发送NOTIFY信息。 
2. notify-passive发送NOTIFY信息，并禁止普通的刷新（refresh）请求。 
3. refresh禁止普通的刷新处理，当heartbeat-interval过期时才发送刷新请求。 
4. passive只用于关闭普通的刷新处理。 

**minimal-responses** 

如果是 yes，当产生响应的时候，服务器将只会按照需要将记录添加到 authority 和 additional 的数据部分。（例如，delegations，negative responses）。这样会改善服务器的性能。默认值为 no。 

**multiple-cnames**  

这个选项在 BIND8 中使用，允许一个域名承认多条 CNAME 记录（与 DNS 标准相违背）。

BIND9.2 在主 hosts 文件和动态更新中都严格强制执行 CNAME 规则。 

**notify** 

如果是 yes（默认），当一个授权的服务器修改了一个域后，**DNS NOTIFY** 信息被发送出去。此信息将会发给列在域 NS 记录上的服务器（除了由 SOA MNAME 标示的主域名服务器）和任何列在 also-notify 选项中的服务器。 

如果是 explicit，则 notify 将只发给列在 also-notify 中的服务器。

如果是 no，就不会发出任何报文。 

Notify 选项也可能设定在 zone 语句中，这样它就替代了 options 中的 notify 语句。

**如果 notify 会使得辅域名服务器崩溃，就需要将此选项关闭。** 

**recursion** 

如果是 yes，并且一个 DNS 询问要求递归，那么服务器将会做所有能够回答查询请求的工作。

如果 recursion 是 off 的，并且服务器不知道答案，它将会返回一个推荐（referral）响应。

默认值是 yes。注意把 recursion 设为 `no;`不会阻止用户从服务器的缓存中得到数据，它仅仅阻止新数据作为查询的结果被缓存。服务器的内部操作还是可以影响本地的缓存内容，如 NOTIFY 地址查询。 

**rfc2308-type1** 

设置成 yes 将会使得服务器发送 NS 记录和关于 negative answer 的 SOA 记录。默认值为 no。 

注：BIND9 中还不支持。 

**Zone-statistics** 

如果是 yes，缺省情况下，服务器将会收集在服务器所有域的统计数据。这些统计数据可以通过使用 **rndc stats** 来访问，rndc stats 命令可以将这些信息转储到 statistics-file 中的文件中去。 

**provide-ixfr**  

决定本地服务器是否作为主域名服务器，当远端的一台辅域名服务器要求的时候，响应增量的域传输。

- 如果设定成 yes，增量传输将会在任何可能的时候进行。

- 如果设定为 no，所有对远端服务器的传输都将是非增量的。

- 如果不设置，在视图或者全局选项块中的 provide-ixfr 选项的值将使用默认值。 

### 转发 

转发功能可以用来在一些服务器上产生一个大的缓存，从而减少到外部服务器链路上的流量。它可以使用在和 internet 没有直接连接的内部域名服务器上，用来提供对外部域名的查询。只有当服务器是非授权的，并且缓存中没有相关记录时，才会进行转发。 

**forward** 

此选项只有当 forwarders 列表中有内容的时候才有意义。当值是 First，默认情况下，使服务器先查询设置的 forwarders，如果它没有得到回答，服务器就会自己寻找答案。如果设定的是 only，服务器就只会把请求转发到其它服务器上去。 

**forwarders** 

设定转发使用的 ip 地址。默认的列表是空的(不转发)。转发也可以设置在每个域上，这样全局选项中的转发设置就不会起作用了。用户可以将不同的域转发到服务器上，或者者对不同的域可以实现 forward only 或 first 的不同方式，也可以根本就不转发。 

### 访问控制 

可以根据用户请求使用的 IP 地址进行限制。 

**allow-notify** 

设定哪个主机上的辅域（不包括主域）已经进行了修改。allow-notify 也可以在 zone 语句中设定，这样全局 options 中的 allow-notify 选项在这里就不起作用了。但它**只对辅域有效**。如果没有设定，默认的是只从主域发送 notify 信息。 

**allow-query** 

设定哪个主机可以进行普通的查询。allow-query 也能在 zone 语句中设定，这样全局options 中的 allow-query 选项在这里就不起作用了。默认的是允许所有主机进行查询。 

**allow-recursion**  

设定哪台主机可以进行递归查询。如果没有设定，缺省是允许所有主机进行递归查询的。注意**禁止一台主机的递归查询，并不能阻止这台主机查询已经存在于服务器缓存中的数据**。 

**allow-v6-synthesis**  

设定哪台主机能接收对 ipv6 的响应。 

**allow-transfer**  

设定哪台主机允许和本地服务器进行域传输。allow-transfer 也可以设置在 zone 语句中，这样全局 options 中的 allow-transfer 选项在这里就不起作用了。如果没有设定，默认值是允许和所有主机进行域传输。 

**Blackhole** 

设定一个地址列表，服务器将不会接收来自这个列表的查询请求，或者解析这些地址。从这些地址来的查询将得不到响应。默认值是 none。 

### 接口 

接口和端口(服务器回答来自于此的询问)可以使用**listen-on**选项来设定。

listen-on使用可选的端口和一个地址匹配表列（address_match_list）。服务器将会监听所有匹配地址表列中所允许的端口。如果没有设定端口，就将使用53。 

允许使用多个listen-on语句。例如: 

```shell
listen-on { 5.6.7.8; };  
listen-on port 1234 { !1.2.3.4; 1.2/16; };  
```

将在5.6.7.8的ip地址上打开53端口，在除了1.2.3.4的1.2网段上打开1234端口。 

如果没有设定listen-on，服务器将在所有接口上监听端口53。 

`listen-on-v6`选项用来设定监听进入服务器的ipv6请求的端口。 

服务器并不象在ipv4中那样对每个IPV6端口地址绑定一个独立的socket。相反，它一直监听ipv6通配的地址。这样，对于listen-on-v6语句唯一的address_match_list的参数就是： 

{ any; } 和 { none;}  

多个listen-on-v6选项可以用来监听多个端口 : 

```shell
listen-on-v6 port 53 { any; };  
listen-on-v6 port 1234 { any; };  
```

要使服务器不监听任何ipv6地址，使用： 

```shell
listen-on-v6 { none; };  
```

如果没有设定listen-on-v6语句，服务器将不会监听任何ipv6地址。 

### 查询地址 

如果服务器查不到要解析的地址，它将会查询其它域名服务器。query-source可以用来设定这类请求所使用的地址和端口。对于使用ipv6发送的查询，有一个独立的query-source-v6选项。如果address是\*或者被省略了，则将会使用一个通配的IP地址(INADDR ANY)。如果port是*或者被省略了，则将会使用一个随机的大于1024的端口。

默认为: 

```shell
query-source address * port *;  
query-source-v6 address * port *; 
```

query-source 选项中设置的地址是同时用于 UDP 和 TCP 两种请求的，但是 port 仅仅用于 UDP 请求。TCP请求使用的是随机的大于 1024 的端口。 

### 域传输 

BIND 有适当的机制来简化域传输，并限定系统传输的负载量。

**also-notify**  

定义一个用于全局的域名服务器 IP 地址列表。无论何时，当一个新的域文件被调入系统，域名服务器都会向这些地址，还有这些域中的 NS 记录发送 NOTIFY 信息。

这有助于更新的域文件极快的在相关的域名服务器上收敛同步。如果一个 also-notify 列表配置在一个 zone 语句中，全局 options 中的 also-notify 语句就会在这里失效。

当一个zone-notify 语句被设定为 no，系统就不会向在全局中 also-notify 列表中的 IP 地址发送NOTIFY 消息。缺省状态为空表(没有全局通知列表)。 

**max-transfer-time-in** 

比设定时间更长的进入的域传输将会被终止。默认值是 120 分钟(2 小时)。 

**max-transfer-idle-in** 

在设定时间下没有任何进展的进入域传输将会被终止。默认为 60 分钟(1 小时)。 

**max-transfer-time-out** 

运行时间比设定的时间长的发出的域传输将会被终止。默认为 120 分钟(2 小时). 

**max-transfer-idle-out** 

在设定时间下没有任何进展的发出的域传输将会被终止。默认为 60 分钟(1 小时)。 

**serial-query-rate**  

辅域名服务器将会定时查询主域名服务器，来确定域的串号是否改变。每个查询将会占用一些辅域名服务器网络带宽。为限制占用的带宽，BIND9 可以限制每个查询发送的频率。serial-query-rate 的值是一个整数，就是每秒能发送的最大查询数。默认值为20。 

**Serial-queries** 

在 BIND8 中, serial-queries 选项设定了在任何时候允许达到的最大的并发查询数。

BIND9 不限制串号查询的数量并忽略了 serial-queries 选项。它会使用 serial-query-rate选项来限制查询的频率。 

**transfer-format**  

域传输可以用两种不同格式，one-answer 和 many-answer。

transfer-format 选项使用在主域名服务器上，用来确定发送哪种格式。

one-answer 在每个资源记录传输中使用一个DNS 消息。

many-answer 则将尽可能多的资源记录集中在一个消息中。many-answer 是更加有效的，但只有相对比较新的辅域名服务器才支持它，如 BIND9、BIND8.x 和打了补丁的 BIND4.9.5。默认的设置为 many-answer。使用 server 语句中的相关选项，可以替代全局选项中的 transfer-format 设置。 

**transfers-in**  

可以同时运行的进入的域传输的最大值。默认值为 10。增加 transfers-in 的值，可以加速辅域的收敛速度，但也可能增加本地系统的负载。 

**transfers-out** 

可以同时运行的发出的传输的最大值。超过限定的域传输请求将会被拒绝。默认值为10。 

**transfers-per-ns** 

从一台指定的远程域名服务器，同时进行的进入的域传输的最大值。默认值 2。

增加transfers-per-ns 的值，会加速辅域的收敛速度，但也可能增加远程系统的负载。使用server 语句中的 transfer 短语可以替代全局选项中的 transfers-per-ns。 

**transfer-source** 

transfer-source 决定在从外部域名服务器上得到域传送数据时，选哪个本地的 ip 地址使用在 IPV4 的 TCP 连接中。它可以选定 IPV4 的源地址，和可选的 UDP 端口，用于更新的查询和转发的动态更新。不过不做设置，它会缺省挑选一个系统中的地址(常常是最靠近远终端服务器的接口地址)。但这个地址必须已经配置在远终端的 allow-tranfer选项中，才能进行域传送。此语句为所有的域设定了 transfer-source，但如果 view 或 zone中也使用了 transfer-source 语句，则全局选项中的配置就在这里失效了。 

**transfer-source-v6** 

和 transfer-source 一样，只是域传输是通过 IPV6 执行的。 

**notify-source** 

notify-source 确定使用哪些本地的源地址和可选的 UDP 端口，用于发送 NOTIFY 消息。

这个地址必须在辅域名服务器的 master 域或在 allow-notify 中设置。它会为所有域设定notify-source,  但如果 view 或 zone 中也使用了 notify-source 语句，则全局选项中的配置就在这里失效了。 

**notify-source-v6** 

与 notify-source 类似，但应用于 ipv6 地址的 notify 报文的发送。



### 操作系统资源限制 

可以限制服务器对许多系统资源的使用。这些就是通过调节资源限制的数值来完成的。例如，1G 可以代替 1073741824，限定一个十亿字节的限制。Unlimited 要求不限制使用，或者最大可用量。Default 将会使用服务器启动时的缺省值。 

下列选项设定了域名服务器进程的操作系统资源占用限制。一些操作系统可能不支持一些或所有的限制。在这样的系统中，当使用不被支持的限制时，会产生一个告警。

**coresize**  

core dump文件的最大值尺寸。默认值为default 

**datasize** 

服务器可以使用的最大数据内存量。默认值为default。这是一个在服务器系统内存中已经设置了的参数。如果服务器要超过这个限制的内存，则会失败，这将使服务器不能提供DNS服务。所以，这个选项作为一种限制服务器所使用的内存量的方式就不太有效，但是它能够将操作系统设置的太小的缺省数据尺寸增大。如果要限制服务器使用的内存量，可以使用max-cache-size 和 recursive-clients选项。 

**files** 

服务器可以同时打开的最大文件数。默认是unlimited。 

**stacksize** 

服务器可以使用最大的堆栈内存量。默认值为default。

### 服务器资源限制 

下列选项设定了服务器资源使用限制，这是由域名服务内部做的而不是操作系统设定的。 

**recursive-clients** 

服务器同时为用户执行的递归查询的最大数量。默认值1000，因为每个递归用户使用许多位内存，一般为20KB，主机上的 recursive-clients选项值必须根据实际内存大小调整。 

**tcp-clients**  

服务器同时接受的TCP连接的最大数量，默认值100。 

**max-cache-size**  

**服务器缓存使用的最大内存量，用比特表示**。但在缓存数据的量达到这个界限，服务器将会使记录提早过期这样限制就不会被突破。在多视图的服务器中，限制分别使用于每个视图的缓存。默认值没有限制，意味着只有当总的限制被突破的时候记录才会被缓存清除。

### 周期性任务间隔 

**cleaning-interval**  

服务器将在cleaning-interval 的每一时间中从缓存中清除过期的资源记录。默认为60分钟，如果设置为0，就不会有周期性清理。 

**heartbeat-interval** 

服务器将会为所有标记dialup的域运行维护任务，无论它的间隔在何时到期。默认为60分钟，合理值不超过1天(1440分钟)。如果设定为0,不会为这些域产生域维护。 

**interface-interval** 

服务器将在每个interface-interval时间扫描网络接口表。默认为60分钟。如果设置为0，仅当配置文件被加载时才会进行接口扫描。在扫描之后，所有新接口上的监听器将会被打开(listen-on配置使用的接口)。关闭接口上的监听器将会被清除。

**statistics-interval** 

域名服务器统计将会在每个statistics-interval时刻被记入日志。默认值60分钟，如果设为0，  就没有统计数据记入日志。 注意:BIND9不支持。



### 拓扑 

当服务器从一个域名服务器列表中选择一个域名服务器查询时，这些域名服务器是没有什么不同的，但是服务器会优先选择在托扑结构上距离自己最近的服务器去做解析。拓扑语句使用一个地址匹配列表并且以一个特殊方式解释它。每个顶层表列元素被赋了一段距离，非否定元素得到它们在表列中的位置的距离，匹配距离表的开头越近，它离服务器的距离就越小。否定匹配元素将会从服务器分配最大距离；没有匹配的地址将会得到一个比任何非否定表元素都远的并且比任何否定元素近的距离。例如： 

```shell
topology {  
10/8;  
!1.2.3/24;  
{ 1.2/16; 3/8; };  
};  
```

最优先网段10的服务器，然后是在网络1.2.0.0(网络掩码255.255.0.0)和3.0.0.0(网络掩码255.0.0.0)；再就是没列出来的，但是没有否定的网段。否定的网段1.2.3的主机(网络掩码255.255.255.0)。 

默认拓扑为: 

```shell
topology { localhost; localnets; };  
```

注意：BIND9不支持拓扑选项。 

### **RRset**排序 

当多重记录在一个解答中被返回的时候，设定在响应中的记录的顺序是很有用的.。

rrset-order语句允许对在多记录响应下的记录的顺序的设定。

```
[ class class_name ][ type type_name ][ name "domain_name"] order ordering  
```

如果没有设定类，默认值为ANY。如果没有设定类型，默认值为ANY。如果没有设定名称，默认值为”*”。 

合法的排序值是： 

- fixed          记录以它们在域文件中的顺序排序 

- random     记录以随机顺序被返回 

- cyclic          记录以环顺序被返回 

例如： 

```shell
rrset-order {  
class IN type A name "host.example.com" order random;  
order cyclic;  
};  
```

将会使得任何处于IN类中的A类记录的响应以随机顺序返回，IN类以"host.example.com"为后缀。其他的记录以循环记录被返回。 

如果多重rrset-order语句出现，它们并不组合在一起，只适用于最后一个条。 

注意：rrset-order语句不被BIND9支持，BIND9目前只支持"random-cyclic"排序，服务器随机选择RRset集中的开始点，有顺序返回在那个点开始的记录。如果需要的话围绕RRset结尾。 

### 统计文件 

由BIND9产生的统计文件和由BIND8产生的类似，但不完全一样。 一个统计数据开始于行+++ Statistics Dump +++ (973798949)，这里出现的数字是一个标准UNIX型的时间戳，从1970年1月1日开始以秒计。紧跟这行的是一系列行，包括一个记数器类型，记数器值，任意的域名和任意的视图名，没有所列的视图和域的行是整个服务器的整体统计。具有域和视图的行以给定的视图和域命名(对默认的视图来说视图名缺省)。 

这个统计数据以行--- Statistics Dump ---(973798949)结束，在这数字是和开始行的数字一样的。Success 对服务器或者域做出的成功查询。定义一个成功查询是，查询返回非错误响应而不是返回推荐响应 

| Referral  | 导致推荐响应查询                         |
| --------- | ---------------------------------------- |
| Nxrrset   | 导致没有数据的非错误查询的响应           |
| Nxdomain  | 导致NXDOMAIN的查询数量                   |
| Recursion | 使服务器运行递归以找出最后答案的查询数量 |
| Failure   | 导致失败的查询数量                       |



##  **ORIGIN**指令

语法如下：

```shell
$ORIGIN domain-name [ comment] 
```

\$ORIGIN设置附属于任何不合格记录的域名。当一个域被首先读入时存在一个任意的\$ORIGIN  <zone-name>，当前的\$ORIGIN附属于域。



修改`/var/named/test.com.zone`

```shell
$TTL 1D
$ORIGIN test.com.
@    IN SOA    ns1 root (
                    0    ; serial
                    1D    ; refresh
                    1H    ; retry
                    1W    ; expire
                    3H )    ; minimum
        NS      ns1
        A       127.0.0.1
        AAAA    ::1
        MX  10  mail
ns1    IN    A    172.16.1.66
mail    IN    A    172.16.1.88
node1    IN    A    172.16.1.5
node2    IN    A    172.16.1.6
node3    IN    A    172.16.1.7
```

@指的是当前域的顶级。

验证配置并重启服务

```shell
# named-checkzone test.com /var/named/test.com.zone
# systemctl start named
```

验证记录是否生效

```shell
# dig node1.test.com @192.168.1.5
# dig test.com @192.168.1.5
```



## ACL语句

**语法**如下

```shell
acl acl-name {  
address_match_list  
};
```

ACL语句给一个**地址匹配表**列赋了一个象征名称。它的名字来自于地址匹配列表的最基本功能：**访问控制表列（ACLs）**。 

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



## **INCLUDE**指令

include语句可以在include语句出现的地方插入指定的文件。Include 语句通过允许对配置文件的读或写，来简化对配置文件的管理。

语法如下：

```shell
$INCLUDE filename [ origin ] [ comment ] (文件名 [源] [注释])
```

读和运行文件filename就好象它已经被包含进文件中。如果ORIGIN被设定，文件将会被设定为ORIGIN的值，否则就使用当前的\$ORIGIN。 一旦文件被打开，ORIGIN和当前的域名将会恢复到它们对$INCLUDE有优先权的值。 

注意：[RFC1035](https://tools.ietf.org/html/rfc1035)设定的当前源应该在一个$INCLUDE之后恢复，但它并不要求当前域名也应该恢复。BIND9全都恢复。这可以作为一个从[RFC1035](https://tools.ietf.org/html/rfc1035)中的出的偏差，一个特性或者两者都是。



创建`/etc/named/acllist`文件以验证INCLUDE功能

1. 新建`/etc/named/acllist`，内容如下

   ```shell
   acl allquery {
           192.168.1.5;
   };
   ```

2. 更改`/etc/named.conf`，删除其中的acl部分

3. 在`/etc/named.conf`文件options前添加include语句

   ```shell
   include "/etc/named/acllist";
   ```

4. 在两个HOST上进行验证。

   ```shell
   # dig node2.test.com @192.168.1.5
   ```

   `192.168.1.13`主机上会返回REFUSED。

   

## ZONE语句

ZONE语句原来定义一个区。

其语法如下

```shell
zone zone_name [class] [{  
type ( master | slave | hint | stub | forward ) ;  
[ allow-notify { address_match_list } ; ]  
[ allow-query { address_match_list } ; ]  
[ allow-transfer { address_match_list } ; ]  
[ allow-update { address_match_list } ; ]  
[ update-policy { update_policy_rule [...] } ; ]  
[ allow-update-forwarding { address_match_list } ; ]  
[ alsonotify   
{ ip_addr [port ip_port] ; [ ip_addr [port ip_port] ; ... ] }; ]  
[ check-names (warn|fail|ignore) ; ]  
[ dialup dialup_option ; ]  
[ file string ; ]  
[ forward (only|first) ; ]  
[ forwarders  
{ ip_addr [port ip_port] ; [ ip_addr [port ip_port] ; ... ] }; ]  
[ ixfr-base string ; ]  
[ ixfr-tmp-file string ; ]  
[ maintain-ixfr-base yes_or_no ; ]  
[ masters [port ip_port] { ip_addr [port ip_port] [key key]; [...] } ; ]  
[ max-ixfr-log-size number ; ]  
[ max-transfer-idle-in number ; ]  
[ max-transfer-idle-out number ; ]  
[ max-transfer-time-in number ; ]  
[ max-transfer-time-out number ; ]  
[ notify yes_or_no | explicit ; ]  
[ pubkey number number number string ; ]  
[ transfer-source (ip4_addr | *) [port ip_port] ; ]  
[ transfer-source-v6 (ip6_addr | *) [port ip_port] ; ]  
[ notify-source (ip4_addr | *) [port ip_port] ; ]  
[ notify-source-v6 (ip6_addr | *) [port ip_port] ; ]  
[ zone-statistics yes_or_no ; ]  
[ sig-validity-interval number ; ]  
[ database string ; ]  
[ min-refresh-time number ; ]  
[ max-refresh-time number ; ]  
[ min-retry-time number ; ]  
[ max-retry-time number ; ]  
}];  
```

### 文件类型

**master** 

服务器有一个主域（控制域或主域）的配置文件拷贝，能够为之提供授权解析服务。 

**Slave** 

**辅域（也可以叫次级域）是主域的复制**。主域名服务器定义了一个辅域或多个辅域(次级域联系以更新域拷贝)IP 地址。默认下，传输是从服务器上的 53 端口进行的；对所有的服务器来说这是可变的，通过设定一个在 IP 地址表前或者在 IP 地址之后基于每个服务器设定端口数字。对主域名服务器的鉴别也能通过每个服务器上的 TSIG 键来完成。如果文件被指定了，那么任何主域配置信息改变的时候就要复制文件，并且当**辅服务器重新启动的时候都会从主域名服务器上重新下载文件**。这可能会导致带宽的浪费和服务器重新启动次数的增加。 

注意对每个服务器的数量众多的域来说(数万或者数十万)，最好使用两级方式命名配置。 

例如：一个域的服务器 example.com 可能把域内容放到一个叫做 ex/example.com 的文件中，在此, ex/只是域名前两个字符(如果把 100K 的文件放入一个单独的目录中，大多数操作系统都会反应缓慢) 

**stub** 

子根域与辅域类似,除了**只复制主域的 NS 记录而不是整个域**。根域不是 DNS 的一个标准部分，它们是 BIND 运行的特有性质。 

根域可以用来避免在本机重新获得该域的 NS 记录，代价是保存一个根域入口和一组 named.conf 名称服务器地址。这个用法在新设置中并不建议使用，BIND9 只在有限的情况下才支持它。在 BIND4/8 中当前的域传输包括来自当前域的子根的 NS 记录。

这表明，在某些情况下，用户可以为当前域设置只存在于控制服务器里的子根。BIND9服务器从不以这种方式把来自不同域的数据混合。这样的话，如果一个 BIND9 控制服务器服务于一个已经设定了子根域的母域，所有的当前域的次级服务器都需要设定相同的子根域。子根域也可以用来作为一种促使一个特定域的解答使用一个授权服务器的特定系。例如,在一个使用 RFC2157 地址的私用网络上缓存名服务器可以用子根域进行设置. 

**forward** 

一个”转发域”是一种在每个域基础上进行配置转发的一种方式。forward 类型的域语句包括一个转发语句和转发列表，都应用于在域内的由域名给出的查询。如果当前没有转发器语句，就会给出空列表，在域中就不会转发，也就取消了所有在选项中的转发的作用。如果你要使用此种域来改变整体转发选项的性态(”forward first”，”forward 

only”但是要用同一服务器作为是全局设置 )你需要理解全局转发器的特点。 

**hint** 

**根名称服务器的在最初设置时指定使用一个”hint zone”**。当配置了”hint zone”的服务器启动的时候，它使用根线索的设置找到根的名称服务器并得到根名称服务器的最新表。

如果没有为 IN 类设定线索域，服务器使用一个 compiled-in 的默认根服务器列表。 

### 类 

域名后面的选项可以对应类。如果没有指定类，系统假定为IN类。这在大多数的情况下都是正确的。 

**Hesiod类**是以一个信息服务的名称命名的，信息服务源于MIT的Athena工程。Hesiod类是用来在多系统数据之间共享信息，如用户、组、打印机等等。”HS”对Hesiod来说是相同的类。 

MIT发展的另一个是**CHAOSnet**，一个在70年代中期创立的本地协议。它的域数据可以用**CHAOS类**设定。 

### **zone**选项 

**allow-notify** 

**allow-query**  

**allow-transfer**  

与OPTIONS语句中含义相同。

**allow-update**  

设定哪台主机允许为主域名服务器提交动态DNS更新。默认为拒绝任何主机进行更新。 

**update-policy** 

设定一个”简单安全更新政策”。

**allow-update-forwarding**  

**设定哪个主机能够向辅域名服务器的次级域提交动态域名服务器更新。**默认值为{ none; }，意味着不能进行动态更新转发。要使用更新转发，设定allow-update-forwarding { any; }；设定其他值而不是{ none; } 或者{ any; } 是常常起反作用的，因为主域名服务器拥有接入控制的权利，而辅域名服务器没有。 

注意到激活一台次级服务器上的更新转发性质可能使主域名服务器依赖基于不安全IP地址的接入控制而可能使之受到攻击。 

**also-notify** 

只当本域notify被激活时才是有意义的。能够收到本域DNS NOTIFY信息的计算机的集合是由所有域中列明的名称服务器加上任何由also-notify设定的IP地址。一个端口可能用每个also-notify地址设定以发送通告信息到那个端口而不是默认的53端口。

also-notify对根域是无意义的。默认值为空。 

**database**  

设定储存域数据的数据库的类型。 Database后面的关键词是一列whitespace-delimited(非限制空白空间)词。第一个词定义数据库类型，后续词作为数据库的参数传给数据库，解释为特殊的数据库类型。默认值为"rbt",BIND9的本地native in-memory red-black-tree库，则此数据库没有参数如果其它数据库驱动连接到服务器上的话其他值也是可能的。这些可能的数据库包括分布式的数据库，但缺省是没有连接的。 

**forward**  

**只当域有一个转发器列表的时候才是有意义的**。当配置为”only”时，在转发查询失败和的不到结果时会导致查询失败；在配置为”first”，则在转发查询失败或没有查到结果时，会在本地发起正常查询。 

**forwarders**  

**用来代替全局的转发器列表**。如果如故不在forward类型的域中设定，就不会有这个域查询的被转发；全局的转发设置则没有起作用。 

**zone-statistics**  

如果设为”yes”，服务器将会为本域储存统计信息，可以存储到在服务器选项中定义的统计文件中。

### 动态更新政策 

BIND9支持两个授予用户对一个域执行动态更新权限的备选方案，分别由allow-update 和update-policy设定。 

**allow-update**授予指定用户对域中的任何名称的任何的记录更新的权利。 

**update-policy**允许更多更新控制，定义了一个规则集，规则授予或者取消一个或多个名称被一个或多个用户更新的权利。如果动态更新要求信息被标记(也就是说,可以包含TSIG或SIG(0)记录)，标记人的身份就能被确定。 规则在update-policy域选项中指定，并只对主域有意义。当update-policy语句出现，这是一个allow-update的配置错误.。update-policy语句只检查信息的签名人，与源地址是不相关的。 

这是一则规则的定义： 

```
( grant | deny ) identity nametype name [ types ]
```

每条规则赋予或者取消授权，一旦一条信息成功的匹配一个规则，则马上执行该规则的给予或者取消操作，并且不检查其它的规则。一个规则是匹配的，就是当标记人匹配身份字段，名称匹配名称字段并且类型是在类型字段中定义的时候。 

身份字段定义一个名称或者一个通配符名称，名称类型字段有四个值： 

- **Name** 

  当更新名称与原定义的名称字段相同时匹配。 

- **Subdomain** 

  当更新名称与原定义的子域的一个名称字段相同时匹配。(包含它本身的名字) 

- **Wildcard** 

  当更新名称与原定义的一个位于名称字段中的统配符名称的有效延伸相同时匹配 

- **self** 

  当更新名称与信息标记人的名称相同时匹配。忽略名称字段。 

  如果没有设定任何类型，规则匹配所有类型除了SIG、NS、SOA和NXT；类型可能用名称设定，包括"ANY"。(ANY匹配所有类型除了NXT，NXT不能被更新)。



继续验证：

到此处为止，ZONE `test.com`设置在`/etc/named.rfc1912.zones`，将`test.com`从`named.rfc1912.zones`移除，并仿照`named.rfc1912.zones`重创文件，写入`test.com`部分，最后在`/etc/named.conf`文件中"include"即可。



## 视图

“视图”允许名称服务器**根据询问者的不同有区别的回答DNS查询**。特别是当运行拆分DNS设置而不需要运行多个服务器时特别有用。 

语法如下：

```shell
view view_name [class] {  
match-clients { address_match_list } ;  
match-destinations { address_match_list } ;  
match-recursive-only { yes_or_no } ;  
[ view_option; ...]  
[ zone-statistics yes_or_no ; ]  
[ zone_statement; ...]  
};
```

每个视图定义了一个将会在用户的子集中见到的**DNS名称空间**。 

根据用户的源地址(“address_match_list”)匹配视图定义的“match_clients”和用户的目的地址(“address_match_list”)匹配视图定义的” matach-destinations”。 

如果没有被指定,，match-clients 和match-destinations**默认匹配所有地址**。一个视图也可以做为match-recursive-only来指定，意思是来自**匹配用户的递归请求将会匹配该视图**。

视图语句的**顺序**是很重要的，一位用户的请求将会在它所匹配的第一个视图中被解答。**在视图语句中定义的域只对匹配视图的用户是可用的**。通过在多个视图中用相同名称定义一个域，不同域数据可以传给不同的用户。例如：在拆分DNS设置中的”内部”和”外部”用户。 

许多在named.conf的options里的语句中给出的选项也能在视图语句中使用，仅仅用于使用那个视图解答请求的时候。当view-specific值没有给出，options里的语句值就使用默认值。域选项也可以在视图语句中指定默认值；这些view-specific默认值的优先级高于那些在options里面配置的语句。 

**视图精确到类**。如果没有给定任何类，就假设为IN类。注意所有非-IN视图必须包含一个暗示域，因为只有IN类具有compiled-in默认暗示。 

如果在配置文件中没有**view**语句，在IN类中就会**自动产生一个默认视图**匹配于任何用户，任何指定在配置文件的最高级的zone语句被看作是此默认视图的一部分。如果存在外部**view**语句，所有的域视图必须会在**view**语句内部产生。

下面是一则典型的使用视图语句运行的拆分DNS设置

```shell
view "internal" {  
match-clients { 10.0.0.0/8; };  
// 应该与内部网络匹配.  
// 只对内部用户提供递归服务.  
// 提供example.com zone 的完全视图 
//包括内部主机地址.  
recursion yes;  
zone "example.com" {  
type master;  
file "example-internal.db";  
};  
};

view "external" {  
match-clients { any; };  
// 拒绝对外部用户提供递归服务 
// 提供一个example.com zone 的受限视图 
// 只包括公共可接入主机  
recursion no;  
zone "example.com" {  
type master;  
file "example-external.db";  
};  
}; 
```



验证：

1. `/etc/named.conf`添加内部ACL

   ```shell
   acl innet {
           192.168.1.5;
   };
   ```

   放置在OPTIONS前。

2. 注释`/etc/named.conf`中的zone部分

   ```
   #zone "." IN {
   #       type hint;
   #       file "named.ca";
   #};
   ...
   #include "/etc/named.rfc1912.zones";
   ```

   注释全局zone，以防`named-checkconf`报错

   ```shell
   when using 'view' statements, all zones must be in views
   ```

3. 添加内部view 和 外部view

   ```
   view in {
           match-clients      { innet; };
           recursion yes;
   
           zone "zhidns.com" IN {
                   type master;
                   file "zhidns.com.in";
                   allow-transfer { none; };
                   allow-update { none; };
           };
   };
   view out {
            match-clients      { any; };
            recursion no;
   
            zone "zhidns.com" IN {
                   type master;
                   file "zhidns.com.out";
                   allow-transfer { none; };
                   allow-update { none; };
           };
   
   };
   ```

4. 修改`zhidns.com.in`

   ```
   # vim /var/named/zhidns.com.in
   $TTL 600
   $ORIGIN zhidns.com.
   @       IN      SOA     ns        admin (
                           2012070801
                           1H
                           10M
                           1W
                           1D
   )
           IN      NS      ns
           IN      MX 10   mail
   ns      IN      A       192.168.92.102
   mail    IN      A       192.168.92.100
   www     IN      A       192.168.92.101
   ```

5. 修改`zhidns.com.out`

   ```
   # vim /var/named/zhidns.com.out
   $TTL 600
   $ORIGIN zhidns.com.
   @       IN      SOA     ns        admin (
                           2012070801
                           1H
                           10M
                           1W
                           1D
   )
           IN      NS      ns
           IN      MX 10   mail
   ns      IN      A       172.19.19.102
   mail    IN      A       172.19.19.100
   www     IN      A       172.19.19.101
   ```

6. 重启服务并验证

   ```shell
   # systemctl restart named
   ```

   ```shell
   # dig www.zhidns.com  @192.168.1.5 // host1 解析到 192.168.92.101
   # dig www.zhidns.com  @192.168.1.5 // host2 解析到 172.19.19.101
   ```

   

## 管理工具

管理工具在服务器管理中起整体性作用 

### named-checkconf

named-checkconf 检查 named.conf文件的句法 

named-checkconf [-t directory] [filename]  



### named-checkzone

named-checkzone程序检查host文件的句法和相容性。 

named-checkzone [-dq] [-c class] zone [filename]  



### rndc(Remote Name Daemon Control)

rndc允许系统管理员控制名称管理器的运行。 

如果不使用任何选项来运行rndc将会有一条形如下列的使用信息： 

```shell
rndc [-c config] [-s server] [-p port] [-y key] command [command...]  
```

其中command是下列中的一种:  

- **reload**  

  重新加载配置文件和域（zone）的配置。  

- **reload** **zone [class [view]]**  

  重新加载一个指定的域。 

- **refresh** **zone [class [view]]** 

  定期维护一个指定的域。 

- **reconfig**  

  重新加载namd.conf配置文件和新的域，但不会重新加载已存的域文件，即使域文件已经被修改了也不会加载。特别是当有大量的域的时候，这比全部的reload要快很多，因为这避免了对域文件修改时间的检查。 

- **stats**  

  将统计信息写入到统计文件中。 

- **querylog**  

  启动用户请求的日志纪录。请求的日志记录也可以通过在named.conf中logging部分的queries category和channel来启动。 

- **dumpdb**  

  把服务器缓存中的信息转储到dump文件中去。 

- **stop** 

  服务器停机，且将所有最近通过动态更新或IXFRS作出的修改，都首先存到了更新域中的host文件中。 

- **halt** 

  服务器马上停机。但通过动态更新和IXFR做出的最新修改不会存入host文件，但当服务器重新启动的时候会写入到日志文件中去。 

- **trace**  

  增加一个服务器的debug级别。 

- **trace level**  

  直接设置服务器的debug等级。 

- **notrace**  

  将服务器的debug等级设成0。 

- **flush**  

  清除域名服务器缓存中的内容。 

- **status**  

  显示服务器状况  

这里需要一个配置文件，因为所有和服务器的通信都是利用基于共享加密的数字签名技术来完成的，而除了提供配置文件就没有其它加密的方法了。rndc默认的配置文件位置是在/etc/rndc.conf，但是可以通过-c选项指定改变的位置。如果配置文件没有找到，rndc也会访问etc/rndc.key（或者是在BIND编译时对sysconfdir定义的值）。rndc.key文件是当**rndc-confgen -a**运行的时候产生的。 

配置文件的格式类似named.conf，但被限制在四个部分中：options、key、server和include。这些语句把共享密匙和服务器相联系。语句的顺序是不重要的。

option语句有三个子语句：default-server、default-key和default-port。 

- default-server采用主机名或ip地址，如果在命令行中没有-s选项的话，代表了将会被连接的服务器。default-key把key中定义的密匙名字作为参数。如果在命令行或者server语句中没有指定端口的话，Default-port则指定了rndc和server应该连接的缺省端口。 

- key语句用名字命名了一串字符串。服务器需要这个字符串来认证。Key语句中包含2个字句：**algorithm和secret**。配置分析器可以任何字符串，做为算法(algorithm)的参数，目前只有字符串”hmac-md5”有含义。secret是一个基于64位编码的字符串。 

- server语句使用key的子句来连接key和服务器。server语句的参数是一个服务器名或IP地址（地址必须用双引号）。Key子句中的参数是key语句中定义好的key的名字。port子句可以用来指定rndc和服务器联接的端口。

最小的配置语句举例如下： 

```
key rndc_key {  
algorithm "hmac-md5";  
secret 
"c3Ryb25nIGVub3VnaCBmb3IgYSBtYW4gYnV0IG1hZGUgZm9yIGEgd29tYW4K";  

};  

options {  
default-server localhost;  
default-key rndc_key;  
};  
```

这个文件，如果安装在/etc/rndc.conf，则可以执行命令： 

```shell
$ rndc reload 
```

连接到127.0.0.1的953端口，并重启域名服务器，如果一个域名服务器在本地计算机下运行下列控制语句： 

```shell
controls {  
inet 127.0.0.1 allow { localhost; } keys { rndc_key; };  
};  
```

并且它有一个确定的key语句给rndc_key。 

运行rndc-confgen程序将会很顺利的产生一个rndc.conf，且可以显示出应该配置在named.conf中controls语句里的相关内容。你可以运行rndc-confgen –a来创建rndc.key文件，且并不修改named.conf。 

### 信号（Signals） 

特定的unix信号使域名服务器进行不同的操作，就象下表叙述的一样。这些信号可以通过使用kill命令发出： 

- SIGHUP    使服务器重读name.conf文件，并重新加载数据库。 
- SIGTERM  使服务器清空和退出。 
- SIGINT      使服务器清空和退出。 



## 优秀资料

[CentOS7搭建BIND9 DNS服务器过程](https://blog.51cto.com/11804445/2056629)

[CentOS 7 使用 bind 配置私有网络的 DNS](https://qizhanming.com/blog/2017/05/27/how-to-configure-bind-as-a-private-network-dns-server-on-centos-7)

[How To Configure BIND as a Private Network DNS Server on CentOS 7](https://www.digitalocean.com/community/tutorials/how-to-configure-bind-as-a-private-network-dns-server-on-centos-7)

[CentOS7.4下DNS服务器软件BIND安装及相关的配置](https://blog.51cto.com/liqingbiao/2093064)

[BIND9 管理员参考手册](https://www.centos.bz/manual/BIND9-CHS.pdf)