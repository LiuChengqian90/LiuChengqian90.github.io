---
title: DNS详解
date: 2019-06-23 15：34：32
categories:
tags:
  - dns
typora-root-url: ../../source
---

[域名系统](https://zh.wikipedia.org/wiki/%E5%9F%9F%E5%90%8D%E7%B3%BB%E7%BB%9F)（英语：Domain Name System，缩写：DNS）是互联网的一项服务。它作为将域名和IP地址相互映射的一个分布式数据库，使人更方便地访问互联网。DNS使用TCP和UDP端口53。当前，对于每一级域名长度的限制是63个字符，域名总长度则不能超过253个字符。

## 体系结构

DNS 是一个分布式数据库。它允许对整个数据库的各个部分进行本地控制；同时整个网络也能通过 **客户-服务器** 方式访问每个部分的数据，借助备份和缓存机制，DNS 将更强壮和足够的性能。
DNS 数据库的结构如图1所示，就象一棵倒挂着的树。

![域名系统](/images/DNS详解/域名系统.png)

### 根域名服务器 

[根域名服务器](https://zh.wikipedia.org/wiki/%E6%A0%B9%E7%B6%B2%E5%9F%9F%E5%90%8D%E7%A8%B1%E4%BC%BA%E6%9C%8D%E5%99%A8)（英语：root name server）是互联网域名解析系统（DNS）中最高级别的域名服务器，**负责返回顶级域的权威域名服务器地址**。它们是互联网基础设施中的重要部分，因为所有域名解析操作均离不开它们。由于DNS和某些协议（未分片的用户数据报协议（UDP）数据包在IPv4内的最大有效大小为512字节）的共同限制，根域名服务器**地址的数量**被限制为13个。幸运的是，采用**任播技术架设镜像服务器**可解决该问题，并使得实际运行的根域名服务器数量大大增加。截至2017年11月，全球共有800台根域名服务器在运行。

```shell
DNS 根域名服务器并不真的只有 13 台，而是 13 个 IP，对应了 A-M 13 个编号，
借由任播（Anycast）技术，编号相同的根服务器使用同一个IP（类似一个集群）。
```

### 顶级域

[顶级域](https://zh.wikipedia.org/wiki/%E9%A0%82%E7%B4%9A%E5%9F%9F)（或顶级域名；英语：Top-level Domain；英文缩写：TLD）是互联网DNS等级之中的最高级的域，它保存于DNS根域的名字空间中。顶级域名是域名的最后一个部分，即域名最后一点之后的字母，例如在example.com这个域名中，顶级域是.com（或.COM），大小写视为相同。

顶级域主要分4类：

- **国家顶级域**

  [国家和地区顶级域名](https://zh.wikipedia.org/wiki/%E5%9C%8B%E5%AE%B6%E5%92%8C%E5%9C%B0%E5%8D%80%E9%A0%82%E7%B4%9A%E5%9F%9F)（Country code top-level domain，英语：ccTLD），简称国家顶级域，又译国码域名、顶级国码域名、国码顶级域名，或顶级国码域名，是用两字母的国家或地区名缩写代称的顶级域，其域名的指定及分配，政治因素考量凌驾在技术和商业因素之上。

  这些顶级域均由两个字母组成，大部分使用[ISO 3166-1](https://zh.wikipedia.org/wiki/ISO_3166-1)标准。

- **通用顶级域**

  [通用顶级域](https://zh.wikipedia.org/wiki/%E9%80%9A%E7%94%A8%E9%A0%82%E7%B4%9A%E5%9F%9F)主要由.com、.info、.net及.org等域名组成。同时，.biz、.name及.pro亦可视作“通用”性质，但这些域名指定为“限制”级别，规定申请者须提供资格证明。

- **基础建设顶级域**

  [.arpa](https://zh.wikipedia.org/wiki/.arpa)，过去曾包括在“通用顶级域”内

  .arpa是互联网域名系统上一个专门用于互联网基础设施配置的顶级域。其名称最初是缩写自高级研究计划局（Advanced Research Projects Agency，ARPA），也就是现在互联网的雏形网络ARPANET的主管部门。现在其标准名称对应为“地址路由参数域（Address and Routing Parameter Area）”。直到2015年，它是IANA顶级域分类中的一个分类，基础设施顶级域（infrastructure top-level domain）内的唯一顶级域。

  现在其有两个二级域名，“in-addr.arpa”和“ip6.arpa”，用于对应IPv4和IPv6的DNS反向查询功能。

- **测试顶级域**

  例如繁体中文的[http://例子.測試/](https://web.archive.org/web/20130720003543/http://例子.測試/)及简体的[http://例子.测试/](https://web.archive.org/web/20130507084326/http://例子.测试/)

DNS 的分布式数据库是以域名为索引的，每个域名实际上就是一棵很大的逆向树中路径，这棵逆向树称为域名空间（domain name space）。如图1所示，树的最大深度不得超过 127 层，树中每个节点都有一个可以长达 63 个字符的文本标号

### 区和域的不同

整个的域名空间可以根据组织划分或管理分类，组织成一个树状结构。树上的**每个节点**叫做 **domain**(**域**)，就是一个标示。一个 domain 的名字就是从 root 开始，到当前节点的所有 domain 标志的集合。从书写的结构上看，就是从右到左依次用"."来区分开。这样域名的标志才能够唯一。



而整个的域名空间被分成的多个区域，叫 **zone**。**它开始于一个顶级 domain，一直到一个子 domain 或是其它 domain 的开始**。zone 通常表示管理界限的划分。实际上，zone 就是DNS 树状结构上的一个标识的点。**一个 zone 包含了那些相邻的域名树结构的部分，并具有此部分的全部信息，并且它是真正授权的。**它包含了这个节点下的所有域名，但不包括其它域里已经制定的。每个树状结构里的节点，在上级域中都有一个或多个 NS 记录。它们是和这个域中的 NS 记录相同的。 



例如，有一个 domain 叫 example.com，它可以包含 host.aaa.example.com 和host.bbb.example.com 这些名字，但是它的 zone 文件中却只有 2 个 zone 的记录aaa.example.com 和 bbb.example.com。**zone 就是一个一级的 domain，也可以是一个多级domain 的一部分。**这个 domain 中的其它 zone，可以指向其它的域名服务器。DNS 树型结构中的每个名字都是一个 domain，当然它也可以是一个没有子域的、最末端的节点。每个子域（subdomain）也是一个 domain，每个 domain 其实也是一个子域（subdomain），当然最上面的 root 节点除外。

## 域名服务器的类型

一个 DNS 服务器可以同时作为多个域的主域名服务器和辅域名服务器，也可以只作为主，或只作为辅，或者做任何域的授权服务器而只使用自己的 cache 来提供查询解析。Master服务器也经常叫做 primary，slave 服务器也经常叫做 secondary。

所有的服务器都会将数据保存在缓存（cache）中，直到针对这些数据的 TTL（Time To Live）值过期。 

### 主域名服务器

primary master server 是一个 domain 信息的最根本的来源。它是所有辅域名服务器进行域传输的源。主域名服务器是从本地硬盘文件中读取域的数据的。

### 辅域名服务器（次级域名服务器）

次级服务器（slave server或secondary server）使用一个叫做**域转输**的复制过程，调入其它服务器中域的内容。通常情况下，数据是直接从主服务器上传输过来的，但也可能是从本地磁盘上的 cache 中读到的。辅域名服务器可以提供必需的冗余服务。所有的辅域名服务器都应该写在这个域的 NS 记录中。 

### 隐藏服务器（stealth server）

stealth server 可以针对一个域的查询返回授权的记录，但是它并没有列在这个域的 NS记录里。Stealth 服务器可以用来针对一个域进行集中分发，这样可以不用在远程服务器上手工编辑这个域的信息了。在这种方式中，一个域的 master 文件在 stealth server 上存储的位置，经常叫做“hidden primary”配置。Stealth 服务器也可以将域文件在本地做一个拷贝，从而可以在所有官方的域名服务器都不能访问的情况下，也能更快地读取域的记录。 

### 高速缓存域名服务器（caching only server）

缓存服务器可以将它收到的信息存储下来，并再将其提供给其它的用户进行查询，直到这些信息过期。它的配置中没有任何本地的授权域的配置信息。它可以响应用户的请求，并询问其它授权的域名服务器，从而得到回答用户请求的信息。 

### 转发服务器（forwarding server）

一台缓存名服务器本身不能进行完全的递归查询。相反，它能从缓存向其它的缓存服务器转发一部分或是所有不能满足的查询，一般被称作转发服务器。 

可能会有一个或多个转发服务器，它们会按照顺序进行请求，直到全部穷尽或者请求得到回答为止。转发服务器一般用于用户不希望站点内的服务器直接和外部服务器通讯的情况下。一个特定的情形是许多 DNS 服务器和一个网络防火墙。服务器不能透过防火墙传送信息，它就会转发给可以传送信息的服务器，那台服务器就会代表内部服务器询问因特网 DNS 服务器。使用转发功能的另一个好处是中心服务器得到了所有用户都可以利用的更加完全的信息缓冲。 

## 解析过程

域名解析总体可分为两大步骤：

1. 本机向本地域名服务器发出一个DNS请求报文，报文里携带需要查询的域名；
2. 本地域名服务器向本机回应一个DNS响应报文，里面包含域名对应的IP地址。而此步又包含了很多小的步骤。

![域名系统](/images/DNS详解/dns-pcap.png)



本地服务器向上解析的时候，有两个不同的行为需要注意：

- **递归查询：**本机向本地域名服务器发出一次查询请求，就静待最终的结果。如果本地域名服务器无法解析，自己会以DNS客户机的身份向其它域名服务器查询，直到得到最终的IP地址告诉本机。
- **迭代查询：**本地域名服务器向根域名服务器查询，根域名服务器告诉它下一步到哪里去查询，然后它再去查，每次它都是以客户机的身份去各个服务器查询。

以[dig](https://en.wikipedia.org/wiki/Dig_(command)) 解析 alibaba.com为例（**更详细的过程可以加`+trace`。**）

```shell
$ dig alibaba.com
```

![域名系统](/images/DNS详解/alibaba.png)

此解析过程包含六段信息：

第一段包含 请求和回应的简略信息

![域名系统](/images/DNS详解/alibaba-sec1.png)

- 第一行为dig的版本信息和需要解析的域名。

- 第二行为dig设置的全局选项。前两行输出可以通过使用`+nocmd`选项来消除，但前提是它是命令行上的第一个参数（甚至在您查询的主机之前）。
- 第三行表示已经获取到结果（无论是否解析到）。
- 第四行和第五行为获取结果中的简略信息
  - opcode ，status 和 会话标识
  - flags、query数、answer数、authority数、additional数



第二段为请求时的**附加域**和**Queries域**信息

![域名系统](/images/DNS详解/alibaba-sec2.png)



第三段为回应时的**回应域**

`alibaba.com.`为需要解析的域名

`300`为此记录的TTL

`IN`为此记录的CLASS

`A`为此记录的类型

`106.11.208.151` 和 `106.11.223.101`为此域名对应的IP

![域名系统](/images/DNS详解/alibaba-sec3.png)



第四段为回应时的**授权域**

表明`alibaba.com`此域名所属的域名服务器

![域名系统](/images/DNS详解/alibaba-sec4.png)



第五段为回应时的**附加域**

表明域名服务器的A记录

![域名系统](/images/DNS详解/alibaba-sec5.png)



第六段是DNS服务器的一些传输信息

第一行为解析花费的时间

第二行为本地域名服务器及端口号

第四行为信息长度：UDP length - UDP header length

![域名系统](/images/DNS详解/alibaba-sec6.png)



## DNS报文格式

![域名系统](/images/DNS详解/dns-protocol-format.jpg)

### 报文头

**会话标识：**DNS报文的ID标识，对于请求报文和其对应的应答报文，这个字段是相同的，通过它可以区分DNS应答报文是哪个请求的响应

**标志：**

标志位总长 16 个位，也就是两个字符。

有相应值的位标记为 1 ，没有的则标记为 0 。

最后这 16 个二进制的位通过进制转换即可变成十六进制的

- **QR 1bit**
  
  - `0` 为客户端请求包
  - `1` 为服务器响应包
  
- **Opcode 4bits**
  
  - `0000` 为普通的 DNS 请求
  - `0001` 为 rDNS 请求
  - `0002` 为服务器状态
  - `0003` 无
  - `0004` 为通知 (Notify)
  - `0005` 为更新 (Update)
- `0006 - 0015` 保留
  
- **AA 1bit**
  - `0` 为应答服务器不是该域名的权威解析服务器
  - `1` 为应答服务器是该域名的权威解析服务器

- **TC 1bit**
  - `0` 为报文未截断
  - `1` 为报文过长被截断 (只返回了前 512 个字节)

- **RD 1bit**
  - `0` 为不期望进行递归查询
  - `1` 为期望进行递归查询 (从域名服务器进行递归查询)

- **RA 1bit**
  - `0` 为应答服务器不支持递归查询
  - `1` 为应答服务器支持递归查询

- **Z 1bit**

  保留位

- **AD 1bit**
  - `0` 为应答服务器未验证了该查询相关的 DNSSEC 数字签名
  - `1` 为应答服务器已经验证了该查询相关的 DNSSEC 数字签名

- **CD 1bit**
  - `0` 为服务器已经进行了相关 DNSSEC 数字签名的验证
  - `1` 为服务器并未进行相关 DNSSEC 数字签名的验证

- **Rcode 4bits**
  - `0000` 为正常
  - `0001` 为格式错误 (NS 无法解析这个请求)
  - `0002` 为服务器错误 (NS 有问题所以无法进行这个请求)
  - `0003` 为名称错误 (请求中的地址并不存在)
  - `0004` 为未实施查询 (NS 服务器不支持这种查询)
  - `0005` 为拒绝 (由于策略原因拒绝执行这个错误)
  - `0006` 为域名出现了但是他不该出现
  - `0007` 为集合 RR 存在但是他不该存在
  - `0008` 为集合 RR 不存在但是他应该存在
  - `0009` 为服务器并不是这个区域的权威服务器
  - `0010` 为该名称并不包含在区域中
  - `0011 - 0015` 保留
  - `0016` 为错误的 OPT 版本或者 TSIG 签名无效
  - `0017` 为无法识别的密钥
  - `0018` 为签名不在时间范围内
  - `0019` 为错误的 TKEY 模式
  - `0020` 为重复的密钥名称
  - `0021` 为该算法不支持
  - `0022` 为错误的截断
  - `0023 - 3840` 保留
  - `3841 - 4095` 私人使用
  - `4096 - 65534` 保留
  - `65535` RFC 6195

**数量字段：**

Questions、Answer RRs、Authority RRs、Additional RRs 各自表示后面的四个区域的数目。

Questions表示查询问题区域节的数量，Answers表示回答区域的数量，Authoritative namesversers表示授权区域的数量，Additional recoreds表示附加区域的数量。

### RECORD域

#### Queries域

![域名系统](/images/DNS详解/dns-package-quey.png)

**查询名**

长度不固定，且不使用填充字节，一般该字段表示的就是需要查询的域名（如果是反向查询，则为IP，反向查询即由IP地址反查域名），一般的格式如下图所示。![域名系统](/images/DNS详解/dns-package-queryname.png)

**查询类型：**

| 类型 | 助记符 | 说明               |
| ---- | ------ | ------------------ |
| 1    | A      | 由域名获得IPv4地址 |
| 2    | NS     | 查询域名服务器     |
| 5    | CNAME  | 查询规范名称       |
| 6    | SOA    | 开始授权           |
| 11   | WKS    | 熟知服务           |
| 12   | PTR    | 把IP地址转换成域名 |
| 13   | HINFO  | 主机信息           |
| 15   | MX     | 邮件交换           |
| 28   | AAAA   | 由域名获得IPv6地址 |
| 252  | AXFR   | 传送整个区的请求   |
| 255  | ANY    | 对所有记录的请求   |

**查询类**

定义有下述 **CLASS** 助记符和值：

| 助记符 | 值   | 含义                     | 备注                                     |
| :----- | :--- | :----------------------- | :--------------------------------------- |
| IN     | 1    | the Internet/互联网      |                                          |
| CS     | 2    | the CSNET class/CSNET 类 | 被废弃，仅在某些被废弃的 RFCs 中用于举例 |
| CH     | 3    | the CHAOS class/CHAOS 类 |                                          |
| HS     | 4    | Hesiod [Dyer 87]         |                                          |

备注：CHAOS 和 Hesiod 请参考 [DNS classes](https://miek.nl/2009/july/31/dns-classes/)

#### **DNS Resource Records**

RR的定义来自 rfc1035 中 3.2 RR definitions。所有的RR都有如下所示的相同的顶层格式：

```
															  				 1  1  1  1  1  1
           0  1  2  3  4  5  6  7  8  9  0  1  2  3  4  5
         +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
         |                                               |
         /                                               /
         /                      NAME                     /
         |                                               |
         +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
         |                      TYPE                     |
         +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
         |                     CLASS                     |
         +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
         |                      TTL                      |
         |                                               |
         +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
         |                   RDLENGTH                    |
         +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--|
         /                     RDATA                     /
         /                                               /
         +--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+--+
```

| 字段     | 格式和描述                                                   |
| :------- | :----------------------------------------------------------- |
| NAME     | 所有者名称（owner name），例如，这个资源记录匹配的节点的名称 |
| TYPE     | 包含 RR TYPE 代码之一的 2 个八位字节（octets）               |
| CLASS    | 包含 RR CLASS 代码之一的 2 个八位字节（octets）              |
| TTL      | 32位有符号整数，指定在再次咨询信息源之前此资源记录可以被缓存的时间间隔。零值被解释为该 RR 仅能用于正在进行的流程，不应当被缓存。例如，总是将零 TTL 分配给 SOA 记录，以便禁止缓存。零值也可以用于极短暂的数据。 |
| RDLENGTH | 无符号 16 位整数，指定以八位字节计的 RDATA 字段的长度。      |
| RDATA    | 可变长度的八位字节字符串，用来描述资源。这个信息的格式取决于资源记录的 TYPE 和 CLASS 。 |

**TYPE 值域**

TYPE 字段用于资源记录。注意，这些类型是 QTYPE 的子集。

| TYPE  | 值   | 含义                                                        | 备注            |
| :---- | :--- | :---------------------------------------------------------- | :-------------- |
| A     | 1    | a host address/主机地址                                     |                 |
| NS    | 2    | an authoritative name server/权威名称服务器                 |                 |
| MD    | 3    | a mail destination/邮件目的地                               | 被废弃，使用 MX |
| MF    | 4    | a mail forwarder/邮件转发器                                 | 被废弃，使用 MX |
| CNAME | 5    | the canonical name for an alias/别名的正则名称              |                 |
| SOA   | 6    | a marks the start of a zone of authority/标记权威区域的开始 |                 |
| MB    | 7    | a mailbox domain name/邮箱域名                              | EXPERIMENTAL    |
| MG    | 8    | a mail group member/邮件组成员                              | EXPERIMENTAL    |
| MR    | 9    | a mail rename domain name/邮件重新命名域名                  | EXPERIMENTAL    |
| NULL  | 10   | a null RR                                                   | EXPERIMENTAL    |
| WKS   | 11   | a well known service description/众所周知的服务描述         |                 |
| PTR   | 12   | a domain name pointer/域名指针                              |                 |
| HINFO | 13   | host information/主机信息                                   |                 |
| MINFO | 14   | mailbox or mail list information/邮箱或邮件列表信息         |                 |
| MX    | 15   | mail exchange/邮件交换                                      |                 |
| TXT   | 16   | text strings/文本字符串                                     |                 |
| SRV   | 33   | service and protocol/服务和协议                             | 在rfc2052中引入 |

**QTYPE 值域**

QTYPE 字段出现在查询的 question 部分。QTYPE 是 TYPE 的超集，因此所有 TYPE 是合 法的 QTYPE。此外，定义有下述 QTYPE：

| QTYPE | 值   | 含义                                                         | 备注            |
| :---- | :--- | :----------------------------------------------------------- | :-------------- |
| AXFR  | 252  | A request for a transfer of an entire zone/请求传送整个区域  |                 |
| MAILB | 253  | A request for mailbox-related records (MB, MG or MR)/请求相关邮箱记录(MB、MG 或 MR) |                 |
| MAILA | 254  | A request for mail agent RRs/请求邮件代理 RR                 | 被废弃，参阅 MX |
| *     | 255  | A request for all records/请求所有记录                       |                 |

```
0             类型0用作SIG RR的特殊指示器。在其他情况下，不得分配普通用途
1 - 127       此范围内的剩余TYPE由IETF Consensus分配给数据类型
128 - 255     此范围内的剩余TYPE由IETF共识分配给Q和Meta TYPE
256 - 32767   由IETF共识分配给 Q或Meta TYPE
32768 - 65279 所需规范见[RFC 2434]
65280 - 65535 私人使用
```

OPT（OPTion）RR，编号41，在[[RFC 2671]](https://tools.ietf.org/html/rfc2671)中规定。 其主要目的是扩展各种DNS字段的有效字段大小，包括RCODE，标签类型，标志位和RDATA大小。 特别是，对于识别它的解析器和服务器，它将RCODE字段从4位扩展到12位。

**QCLASS 值域**

QCLASS 字段出现在查询的 question 部分。QCLASS 值是 CLASS 值的超集；每一个 CLASS 都是合法的 CLASS。除了 CLASS 值以外，定义有下述 QCLASS：

| QCLASS | 值   | 含义             | 备注 |
| :----- | :--- | :--------------- | :--- |
| *      | 255  | any class/任何类 |      |

### 报文示例

#### 请求报文

请求报文中主要Queries域比较主要，标识此请求的目的。

![域名系统](/images/DNS详解/dns-request.png)



#### 回应报文

回应报文比请求报文多了三个域：

- Answers

  对请求的回应。此报文回应两条A记录。

-  Authoritative nameservers

  域名所属的NS。此报文表明`alibaba.com`有两条NS。

-  Additional records

  NS对应的记录。此报文表明Authoritative nameservers中的NS有4条A记录（每个NS两条）。

![域名系统](/images/DNS详解/dns-respond.jpg)

## 优秀资料

[Domain Name System (DNS) IANA Considerations](https://tools.ietf.org/html/rfc2929)

[BIND9 管理员参考手册](https://www.centos.bz/manual/BIND9-CHS.pdf)

[DNS 原理入门](http://www.ruanyifeng.com/blog/2016/06/dns.html)

[DNS协议详解及报文格式分析](https://jocent.me/2017/06/18/dns-protocol-principle.html)

[DNS 标志位简要解析](https://imlonghao.com/40.html)

[DNS classes](https://miek.nl/2009/july/31/dns-classes/)

[为什么域名根服务器只能有13台呢？](https://www.zhihu.com/question/22587247)

[Why 13 DNS root servers?](https://miek.nl/2013/november/10/why-13-dns-root-servers/)

[只有 13 台 DNS 根域名服务器原因](https://jaminzhang.github.io/dns/The-Reason-of-There-Is-Only-13-DNS-Root-Servers/)