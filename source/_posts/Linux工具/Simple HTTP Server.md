---
title: Simple HTTP Server
date: 2022-03-31 18:22:52
categories: Linux工具
tags:
  - http
typora-root-url: ../../../source
---

工作中，经常有需要开启某个端口进行业务模拟的需要，因此对一些直接开启端口的命令或者脚本做了个总结。

<!--more-->

## PYTHON2

> 基于python 2.7

### IPv4

```shell
python -m SimpleHTTPServer <port_number>  // port_number默认为8000
```

此命令会在 0.0.0.0:<port_number>启动httpserver服务。



但是在本机有多个地址的情况下， SimpleHTTPServer 模块不支持设置监听某个地址，因此需要对 SimpleHTTPServer 做个改造

修改文件 `/usr/lib64/python2.7BaseHTTPServer.py` 中 test 函数，前几行修改为

```shell
    if sys.argv[1:]:
        port = int(sys.argv[1])
    else:
        port = 8000

    if sys.argv[2:]:
        ip_listened = str(sys.argv[2])
    else:
        ip_listened = ''
    server_address = (ip_listened, port)
```



或者，更简单一点

```shell
python -c 'import BaseHTTPServer, SimpleHTTPServer; BaseHTTPServer.HTTPServer(("192.168.0.147", 8080), SimpleHTTPServer.SimpleHTTPRequestHandler).serve_forever()'
```



### IPv6

```python
import BaseHTTPServer
import SimpleHTTPServer
import socket

class HTTPServer6(BaseHTTPServer.HTTPServer):
    address_family = socket.AF_INET6

if __name__ == '__main__':
    SimpleHTTPServer.test(ServerClass=HTTPServer6)
```

或者直接一条命令

```shell
echo -e 'import BaseHTTPServer\nimport SimpleHTTPServer\nimport socket\nclass HTTPServer6(BaseHTTPServer.HTTPServer):\n address_family = socket.AF_INET6\nif __name__ == "__main__":\n SimpleHTTPServer.test(ServerClass=HTTPServer6)' | python2
```



更简洁的方式

```shell
python -c "import socket,SocketServer,CGIHTTPServer;SocketServer.TCPServer.address_family=socket.AF_INET6;CGIHTTPServer.test()" 8080
```



## PYTHON3

> 基于 python 3.8

### IPv4

```shell
python3 -m http.server <port_number>
```

针对多地址，可以再后面加 --bind 参数，例如

```shell
python3 -m http.server <port_number> --bind 192.168.0.146
```



### IPv6

```shell
python -m http.server -b *your-ipv6-addr* *your-port*
```



或者自编脚本实现

```python
from http.server import HTTPServer
from http.server import SimpleHTTPRequestHandler
import socket

class HTTPServerV6(HTTPServer):
    address_family = socket.AF_INET6

server = HTTPServerV6(('::', 8080), SimpleHTTPRequestHandler)
server.serve_forever()
```



## 参考

[Python 3: Does http.server support ipv6?](https://stackoverflow.com/questions/25817848/python-3-does-http-server-support-ipv6)

[SimpleHTTPServer6.py](https://gist.github.com/chrisklaiber/54511886e8e4c18126792fc634f44d57)
