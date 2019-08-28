---
title: Iptables的限速模块
date: 2018-04-25 16:59:05
categories: Linux工具
tags:
  - limit
  - hashlimit
typora-root-url: ../../../source
---

`limit`和`hashlimit`是'iptables'的扩展模块，初始是用来限制日志次数的，不过现在基本用来限制包的（传入／传出）速率。

## Limit

这个模块必须用`-m limit`或`--match limit`明确指定。它用于限制匹配的速率，例如用于抑制日志消息。它只会匹配每秒给定的次数（**默认情况下每小时3次，突发5次**）。它有两个可选的参数：

- `--limit`

  后面跟一个数字，指定每秒允许的最大平均匹配数。该数字可以使用`/second`、`/minute`、`/hour`或`/day`

  或其中的一部分（所以`5/second`与`5/s`相同）明确指定单位。

- `--limit-burst`

  后面跟一个数字，表示在上述限制开始之前的最大突发。

此匹配通常可以与**日志目标**一起使用，以执行速率限制日志记录。

```shell
# iptables -A FORWARD -m limit -j LOG
```

在第一次达到此规则时，数据包将被记录；实际上，由于默认突发是5，前五个数据包将被记录。之后，20分钟（每小时3次=20分钟）之内，无论多少包到达都不在纪录日志。也就是说，每20分钟会重新获取一次“权限”（默认burst为5）。100分钟没有命中此规则，则回到初始状态。

**Note：**目前不可创建充能时间大于59个小时（类似前面的100分钟）的规则；如果设置limit为`1/day`，则突发率必须小于3。



还可以使用此模块以更快的速度**避免各种拒绝服务攻击（DoS）**，从而提高响应速度。

- Syn-flood protection

  ```shell
  # iptables -A FORWARD -p tcp --syn -m limit --limit 1/s -j ACCEPT
  ```

- Furtive port scanner

  ```shell
  # iptables -A FORWARD -p tcp --tcp-flags SYN,ACK,FIN,RST RST -m limit --limit 1/s -j ACCEPT
  ```

- Ping of death

  ```shell
  # iptables -A FORWARD -p icmp --icmp-type echo-request -m limit --limit 1/s -j ACCEPT
  ```

`limit`仅是iptables的匹配模块，如果要实现限速，还需要结合iptables的其他命令。例如：

```shell
# iptables -A OUTPUT -p icmp -m limit --limit 5/s --limit-burst -j ACCEPT
# iptables -A OUTPUT -p icmp -j DROP
```

利用`ping baidu.com -i 0.05`查看是否生效。

## Hashlimit

`hashlimit`使用散列桶来表示使用单个iptables规则的一组连接的速率限制匹配。可以按每个主机组（源和/或目标地址）和/或每个端口完成分组。它使您能够表达“每个时间段每组的N个数据包”或“每秒N个字节”。

**hashlimit 选项（--hashlimit-upto，--hashlimit-above）和--hashlimit-name是必需的。**

hashlimit的几个参数如下：

- **--hashlimit-upto** *amount*[**/second**|**/minute**|**/hour**|**/day**]

  如果速率低于或等于此值，则匹配。它被指定为一个数字，带有可选的时间后缀（默认值是3/小时），或者指定为每秒数据量（每秒字节数）。

- **--hashlimit-above** *amount*[**/second**|**/minute**|**/hour**|**/day**]

  如果速率高于此值，则匹配。

- **--hashlimit-burst** *amount*

  允许突发的个数(其实就是令牌桶最大容量)。默认为 5。

- **\*--hashlimit-mode** {**srcip**|**srcport**|**dstip**|**dstport**}**,**...*

  一个用逗号分隔的对象列表。如果没有给出--hashlimit-mode选项，'hashlimit' 的行为就像 'limit' 一样，但是在做哈希管理的代价很高。

- **--hashlimit-srcmask** *prefix*

  当mode设置为srcip时, 配置相应的掩码表示一个网段。

- **--hashlimit-dstmask** *prefix*

  当mode设置为dstip时, 配置相应的掩码表示一个网段。

- **--hashlimit-name** *foo*

  定义这条hashlimit规则的名称, 所有的条目(entry)都存放在 `/proc/net/ipt_hashlimit/{foo}` 里。

- **--hashlimit-htable-size** *buckets*

  散列表的桶数（buckets）。

- **--hashlimit-htable-max** *entries*

  散列中的最大条目。

- **--hashlimit-htable-expire** *msec*

  hash规则失效时间, 单位毫秒(milliseconds)。

- **--hashlimit-htable-gcinterval** *msec*

  垃圾回收器回收的间隔时间, 单位毫秒。

使用hashlimit 来进行限速例子(icmp)： 

### **hashlimit-upto**

```shell
# iptables -A OUTPUT -p icmp -m hashlimit --hashlimit-name icmp --hashlimit-upto 5/sec   --hashlimit-burst 10 -j ACCEPT
# iptables -A OUTPUT -p icmp -j DROP
```

![icmp-upto](/images/Iptables的限速模块/icmp-upto.png)

结果如下

![icmp-upto-res](/images/Iptables的限速模块/icmp-upto-res.png)

### **hashlimit-above**

```shell
# iptables -A OUTPUT -p icmp -m hashlimit --hashlimit-name icmp --hashlimit-above 5/sec   --hashlimit-burst 10 -j ACCEPT
# iptables -A OUTPUT -p icmp -j DROP
```

![icmp-above](/images/Iptables的限速模块/icmp-above.png)

结果如下

![icmp-above-res-1](/images/Iptables的限速模块/icmp-above-res-1.png)

![icmp-above-res-2](/images/Iptables的限速模块/icmp-above-res-2.png)

above时，需达到速率才可匹配。

### **hashlimit-mode**

```shell
# iptables -A OUTPUT -p icmp -m hashlimit --hashlimit-name icmp --hashlimit-above 5/sec --hashlimit-burst 10 --hashlimit-mode srcip --hashlimit-srcmask 16 -j ACCEPT
# iptables -A OUTPUT -p icmp -j DROP
```

运行命令 'ping baidu.com -i 0.1' 之后查看文件 '/proc/net/ipt_hashlimit/icmp' 如下

![icmp-file](/images/Iptables的限速模块/icmp-file.png)


说一下`ipt_hashlimit`文件中每列的含义

| 序号（列） | 含义                                                         |
| ---------- | ------------------------------------------------------------ |
| 1          | 显示如果没有匹配的规则数据包，垃圾收集将删除哈希限制条目的时间（以秒为单位）。 |
| 2          | 基于您使用--hashlimit-mode指定的模式，在这种情况下，它是srcip。它在这里显示srcip。 |
| 3          | 当前的“信用”。(每jiffy重新递增1 或者 按照rate速率增长（个人倾向这种）) |
| 4          | 信用上限（“--hashlimit-burst”的成本*设置）。                 |
| 5          | 成本（即每次规则匹配时减少多少信用）。                       |

如果“信用”达到0，那么哈希条目已超过限制。

**注意：**文件的后3项，取决于第一条规则。当有相同 hashlimit-name 而不同的 hashlimit-burst的规则下刷时，后面的规则无论配置是多少，完全与第一条规则有一样的hashlimit-burst。

### 其他选项

```shell
# iptables -A OUTPUT -p icmp -m hashlimit --hashlimit-name icmp --hashlimit-upto 5/sec --hashlimit-burst 10 --hashlimit-mode dstip --hashlimit-dstmask 16 --hashlimit-htable-size 1 --hashlimit-htable-max 1  --hashlimit-htable-expire 12000 -j ACCEPT
# iptables -A OUTPUT -p icmp -j DROP
```

配置mode为 dstip，hash bucket num为 1 ，最大条目为 1，失效时间为 12 秒（12000 ms），文件如下图（环境有杂包）

![mode-1](/images/Iptables的限速模块/mode-1.png)

运行命令 'ping 8.8.8.8 -i 0.02' ，由于刚开始此表已被占用，必须等到此表老化之后才能连通。

![mode-3](/images/Iptables的限速模块/mode-3.png)

![mode-2](/images/Iptables的限速模块/mode-2.png)

## 优秀资料

[packet-filtering-HOWTO-7](https://netfilter.org/documentation/HOWTO/packet-filtering-HOWTO-7.html)

[iptables-extensions](http://ipset.netfilter.org/iptables-extensions.man.html#lbAY)

[iptables的hashlimit模块](https://blog.tankywoo.com/2015/03/18/iptables-hashlimit-module.html)

[Per-IP rate limiting with iptables](https://making.pusher.com/per-ip-rate-limiting-with-iptables/index.html)

[What do the fields in /proc/net/ipt_hashlimit/FILE mean?](https://unix.stackexchange.com/questions/215903/what-do-the-fields-in-proc-net-ipt-hashlimit-file-mean)

