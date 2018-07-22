---
title: OpenStack 通用技术
date: 2018-04-13 11:44:09
categories: Openstack
tags:
  - openstack
---

摘自 《OpenStack设计与实现》第四章。



## 消息总线

OpenStack遵循这样的设计原则：项目之间通过 RESTful API 进行通信，项目内部，不同服务进程之间的通信，则必须要通过消息总线。这种设计保证了各个项目对外提供服务的接口可以被不同类型的客户端高效支持，同时也保证了项目内部通信接口的可扩展性和可靠性，以支持大规模的部署。

面向过程-> 面向对象 ->面向服务，要求我们去考虑各个服务之间如何传递消息。借鉴硬件总线的概念，消息总线模式被引入。一些服务向总线发送消息，其他服务从总线获取消息。

目前已有多种消息总线的开源实现，OpenStack也对其中的部分实现有所支持，比如RabbitMQ、Qpid等，基于这些消息总线类型，OpenStack oslo.messaging库实现了以下两种方式来完成项目内部各服务进程之间的通信。

- - 远程过程调用（RPC，Remote Procedure Call）

    一个服务进程可以调用其他远程服务进程，并且有两种调用方式：call 和 cast。

    ​	call ，远程方法同步执行，调用者会被阻塞知道结果返回；

    ​	cast ，远程方法异步执行，调用者不会被阻塞但是需要利用其他方式查询结果。

- - 事件通知（Event Notification）

    某个服务进程把事件通知发送到消息总线上，该消息总线上所有对此类事件感兴趣的服务进程，都可以获得此事件通知并进行相应处理，处理结果不会返回给事件发送者。这种通信方式，既可以在同一项目内部各个服务进程间发送通知，也可以实现跨项目的通知发送。Ceilometer利用此方式。

### AMQP

OpenStack所支持的消息总线类型中，大部分都是基于AMQP（Advanced Message Queuing Protocol，高级消息队列协议）。

AMQP是一个异步消息传递所使用的开发的应用层协议规范，主要包括了消息的导向、队列、路由、可靠性和安全性。通过定义消息在网络上传输时的字节流格式，不同的AMQP实现之间可以进行互操作。AMQP的架构如下图所示。

![AMQP架构图.png](/images/openstack通用技术/AMQP架构图.png)

对于一个实现了AMQP的中间件服务（Server/Broker）来说，当不同的消息由生产者（Producer）发送到Server时，它会根据不同的条件把消息传递给不同的消费者（Consumer），如果消费者无法接受消息或接受消息不够快时，它会把消息缓存在内存或者磁盘上。 上述操作由 Exchange（消息交换）和Queue （消息队列）来实现，虚拟主机（Virtual Host）指的是两者的集合。

生产者将消息发送给Exchange，Exchange会查看消息属性、消息头和消息体，从中提取相关信息，然后用此信息（routing key）查询绑定表，把消息转发给不同的Queue（每一个Queue也有一个binding key）或其他Exchange。消费者从Queue中取出消息并进行处理。Exchange不会保存消息，它接收消息，然后根据不同的条件将消息转发到不同的Queue。这里的”条件“也可称为“绑定（binding）”。当条件匹配（routing key 和 binding key 匹配）时，队列Q绑定到交换E上。

不同类型的Exchange使用不同的匹配算法。下图为AMQP中包含的比较重要的Exchange类型。

| 类型   | 说明                                                         |
| ------ | ------------------------------------------------------------ |
| Direct | routing key和binding key必须完全一致，不支持通配符           |
| Topic  | 同上，但支持通配符，“*”匹配一个单字，“#”匹配零个或多个单字，单字之间由“.”分割 |
| Fanout | 忽略routing key和binding key，消息被传递到所有绑定的队列上   |

作为消息的储存和分发实体，Queue会把消息缓存在内存或磁盘上，并按顺序把这些消息分发给一个或多个消费者。

### 基于AMQP实现RPC

![AMQP-RPC](/images/openstack通用技术/AMQP-RPC.bmp)

上图为基于AMQP实现远程过程调用RPC的过程。

### 常见消息总线实现

- RabbitMQ

  实现了AMQP的中间件服务。它包括了Server/Broker，支持多种协议的网关（HTTP、STOMP、MQTT等），支持多种语言（Erlang、Java、.NET Framework等）的客户端开发库，支持用户自定义插件开发的框架以及多种插件。RabbitMQ的 Server/Broker使用Erlang语言编写。详见 http://www.rabbitmq.com。

- Qpid

  分别用C++和Java实现了两种 Server/Broker，Java客户端可以用JMS（Java Message Service）API与Qpid进行通信，其他的如C++/Python客户端可以用Qpid Messaging API进行通信。详见 http://qpid.apache.org/。

- ZeroMQ

  开源的高性能异步消息库，和上述两者不同，ZeroMQ系统可以在没有 Server/Broker的情况下工作，消息发送者负责消息路由以找到正确的消息目的地，消息接受者负责消息的入队出队等操作。

  由于没有集中式的Broker，ZeroMQ可以实现一般AMQP Broker所达不到的很低的延迟和交大的带宽，特别适合消息数量特别巨大的应用场景。

  ZeroMQ使用自己的通信协议ZMTP（ZeroMQ Message Transfer Protocol）来进行通信。ZeroMQ的库使用C++编写。详见 http://www.zeromq.org/。

## SQLAlchemy和数据库

SQLAlchemy是Python编程语言下的一款开源软件，使用MIT许可证发行。SQLAlchemy提供了SQL工具包以及对象关系映射器（Object Relational Mapper，ORM），让Python开发人员简单灵活地运用SQL操作后台数据。

SQLAlchemy主要分为两部分： **SQLAlchemy Core（SQLAlchemy核心）** 和 **SQLAlchemy ORM（SQLAlchemy对象关系映射器）**。SQLAlchemy Core包括SQL语言表达式、数据引擎、连接池等，所有这一切的实现，都是为了连接不同类型的后台数据库、提交查询和更新的SQL请求去后台执行、定义数据库类型和定义Schema等为目的。SQLAlchemy ORM提供数据映射模式，即把程序语言的对象数据库映射成数据库中的关系数据，或把关系数据映射成对象数据。SQLAlchemy架构如下图。

![SQLAlchermy架构](/images/openstack通用技术/SQLAlchermy架构.png)

说明：ORM使开发人员操作和理解数据库更方便灵活，但是程序性能会受到影响（映射是需要开销的）。因此 ORM模块可选。

ORM 在 WEB 应用程序框架中也经常提到，因为它是快速开发栈中的关键组件。现代程序开发语言大多是面向对象的，而现今主流成熟的数据库系统基本上都是关系型数据库。所以，ORM主要解决的问题就是将面向对象型的程序操作映射成对数据库进行操作，而且把关系数据库的查询结果转成对象型数据便于程序访问。

举一个简单的例子，如果数据库中有两张表如下图，

table users

| id   | name  | fullname       | password |
| ---- | ----- | -------------- | -------- |
| 1    | ed    | Ed Jones       | 2356     |
| 2    | wendy | Wendy Williams | 465465   |
| 3    | mary  | Mary Contrary  | 8791     |
| 4    | fred  | Fred Flinstone | 787798   |

table addresses

| id   | user_id | email_address                               |
| ---- | ------- | ------------------------------------------- |
| 1    | 1       | [jones@google.com](mailto:jones@google.com) |
| 2    | 1       | [j25@yahoo.com](mailto:j25@yahoo.com)       |
| 3    | 2       | [wendy@gmail.com](mailto:wendy@gmail.com)   |

两张表通过用户id关联。

下面两个CREATE SQL语句用于建立上面两张表，这是典型的关系数据库SQL语句，是关系型数据的世界。

```sql
CRATE TABLE users (
id INTEGER NOT NULL,
name VARCHAR,
fullname VARCHAR,
password VARCHAR,
PRIMARY KEY (id)
)

CREATE TABLE addresses(
id INTEGER NOT NULL,
email_address VARCHAR NOT NULL,
user_id INTEGER,
PRIMARY KEY (id),
FOREIGN KEY (user_id) REFERENCES users (id)
)
```

从对象模型来看，则是另一个世界。ORM可以把上面的两张表映射成两个类，定义分别是：

```python
from sqlalchemy.ext import declarative
import sqlalchemy as sa

Base =  declarative.declarative_base()
CLASS User(Base):
    
    tablename = 'users'
    id = sa.Column(Integer, primary_key = True)
    name = sa.Column(sa.String)
    fullname = sa.Column(sa.String)
    password = sa.Column(sa.String)

CLASS Address(Base):

    tablename = 'addresses'
    id = sa.Column(sa.Integer, primary_key = True)
    email_address = sa.Column(sa.String,nullable=False)
    user_id = sa.Column(sa.Integer,ForeignKey('users.id'))
    user = relationship('User',backref=backref('addresses',order_by=id))
```

一行记录成为了一个类，一列成为了类的属性。经过模型转换和映射，可以利用Python这样的面向对象语言通过SQLAlchemy生成SQL语句以查询和更新数据库中的数据。实际操作的例子如下。

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

engine = create_engine(...)	#根据用户配置建立相应的数据库引擎
Session = sessionmaker(bind=engine)
session = Session()

for u, a in session.query(User,Address).filter(User.id==Address.user_id).\
filter(Address.email_address=='jones@google.com').all():

	print u, a
```

程序运行时，SQLAlchemy会产生相应的SELECT SQL查询语句提交给后台数据库查询处理。后台生成的SQL查询语句如下。

```sql
SELECT users.id AS users_id, users.name AS users_name, users.fullname AS users_fullname,
users.password AS users_password, addresses.id AS
addresses_id,addresses.email_address AS addresses_email_address, addresses.user_id AS 	addresses_user_id 
FROM users, addresses WHERE users.id = addresses.user_id AND addresses.email_address = ?('jones@google.com',)
```

打印出的结果为

```shell
<User('ed','Ed Jones', '2356')> <Address('jones@google.com')>
```

结果其实为两个类的实例，要访问该实例的类属性，则可以直接使用u.id等面向对象程序化语句。这样，相当于完成了查询结果从关系型数据模型到对象型数据模型的映射。

```sql
插入操作
ed_user = User('yaed', 'Ed Jones', '46548234')
session.add(ed_user)
session.flush()

后台语句为
INSERT INTO users (name, fullname, password) VALUES (?, ?, ?) ('yaed', 'Ed Jones', '46548234')
```

SQLAlchemy 基本上支持绝大多数数据库SQL操作和特有属性。上面的查询例子，由于表与表、类与类之间已经建立并定义了键与外键的关系，SQLAlchemy 可以直接利用 join() 函数来完成连接查询，而无需列出所有条件。至于 join操作是主动还是被动（Lazy），SQLAlchemy 也有一套参数可以供开发人员用程序进行选择、配置和控制。

另外，大多数数据库的高级功能，比如事务处理（transaction）等，SQLAlchemy 也提供了相应的支持。开发人员可以利用session的 commit() 和 rollback()函数告诉后台数据库，对刚才的数据库改动分别做提交和回退处理。

可以认为，SQLAlchemy 是一座架在Python和各后台数据库之间的桥梁，让开发人员可以很容易地用Python语句查询和更新数据库中的数据，而无须了解更多SQL语句的细节。更重要的是，即使后台数据库类型发生变化，开发人员的程序可以不用修改或做少量配置文件的修改。

OpenStack中，有着大量的数据需要后台数据库保存和维护，目前OpenStack可以提供MySQL、Postgresql等多种数据库后台以供选择，而操作它们基本上都用到了SQLAlchemy 进行封装，这些代码都保存在相应项目的db目录下。

SQLAlchemy 已经支持SQLite、Postgresql、MySQL、Oracle、MS-SQL、Firebird、Sybase等多种数据库。详见 http://www.sqlalchemy.org。

## RESTful API 和 WSGI

OpenStack项目都是通过RESTful API向外提供服务，这使得OpenStack的接口在性能、可扩展性、可移植性、易用性等方面达到比较好的平衡。

### RESTful

RESTful 是目前最流行的一种互联网架构。RESTful 架构一个核心的概念是“资源”（Resource）。从RESTful的角度来看，网络里的任何东西都是资源，每个资源都对应一个特定的URI（Uniform Resource Identifier，统一资源标识符）并用它进行标示，访问这个URI就可以获得这个资源。

资源可以有多种的具体表现形式，也就是资源的“表述”（Representation）。URI只是代表了资源的实体，并不能代表它的表现形式。

互联网里，客户端和服务端之间的互动传递就只是资源的表述。这个互动只能使用无状态协议HTTP，也就是说，服务端必须保存所有状态，客户端可以使用HTTP的几个操作，包括GET（获取）、POST（创建）、PUT（更新）、DELETE（删除），使服务端上的资源发生“状态转化”（State Transfer），也就是“表述性状态转移”。

### RESTful路由

OpenStack各个项目都提供了RESTful架构的API作为对外提供的接口，而RESTful架构的核心是资源与资源上的操作，也就是说，OpenStack定义了很多的资源，并实现了针对这些资源的各种操作函数。OpenStack的API服务进程接收到客户端的HTTP请求时，一个所谓的“路由”模块会将请求的URL转换成相应的资源，并路由到合适的操作函数上。

OpenStack中所使用的路由模块Routes（http://routes.readthedocs.org/）源自于对Rails路由系统的重新实现。Rails（Ruby on Rails）是Ruby语言的Web开发框架，采用MVC（Model-View-Controller）模式，收到浏览器发出的HTTP请求后，Rails路由系统会将这个请求指派到对应的Controller。

```python
#新建一个mapper并创建路由
from routes import Mapper

map = Mapper()
map.connect(None, "/error/{action}/{id}", controller="error")
map.connect("home", "/", controller="main", action="index")

#URL '/error/myapp/4' 能够匹配上面的路由
result = map.match('/error/myapp/4')
#result == {'controller': 'error', 'action': 'myapp', 'id': '4'}
```

每个Controller都对应了一个RESTful资源，代表了对该资源的操作集合，其中包含了很多个Action（函数或者说操作），比如index、show、create、destroy等，每个Action都对应着一个HTTP的请求和回应。比如执行“nova list”命令时，Nova客户端（novaclient）将这个命令转换成HTTP请求发送给Nova的API服务进程，然后被路由到下面的“index”操作。

```python
# nova/api/openstack/conpute/servers.py

class ServersController(wsgi.Controller):

    @extensions.expected_errors((400, 403))
    @validation.query_schema(schema_servers.query_params_v226, '2.26')
    @validation.query_schema(schema_servers.query_params_v21, '2.1', '2.25')

    def index(self, req):

    """返回虚拟机的列表给指定用户"""
    	context = req.environ['nova.context']
		context.can(server_policies.SERVERS % 'index')

		try:
			servers = self._get_servers(req, is_detail=False)
		except exception.Invalid as err:
			raise exc.HTTPBadRequest(explanation=err.format_message())
		return servers
```



### WSGI

RESTful只是设计风格而不是标准，Web服务中通常使用基于HTTP的符合RESTful风格的API。而WSGI（Web Server Gateway Interface，Web服务器网关接口）则是Python语言中所定义的Web服务器和Web应用程序或框架之间的通用接口标准。

WSGI是一个网关，作用就是在协议之间进行转换。换句话说，WSGI是一座桥梁，一端称为服务端或网关端，另一端称为应用端或框架端。当处理一个WSGI请求时，服务端为应用端提供上下文信息和一个回调函数，应用端处理完请求后，使用回调函数返回相对应请求的响应。

作为一个桥梁，WSGI将Web组件分成了三类：**Web服务器（WSGI Server）、Web中间件（WSGI Middleware）与Web应用程序（WSGI Application）**。WSGI Server接收HTTP请求，封装一系列环境变量，安装WSGI接口标准调用注册的 WSGI Application，最后将响应返回给客户端。

WSGI Application是一个可调用的（Callable） Python对象，它接受两个参数：**environ**和**start_response**。比如：

```python
def application(environ, start_response):
    start_response('200 OK', [('Content-Type', 'text/plain')])
    yield 'Hello World\n'
```

参数environ指向一个Python字典，要求里面至少包含了一些在CGI（通用网关接口规范）中定义的环境变量，比如REQUEST_METHOD、SCRIPT_NAME、PATH_INFO、QUERY_STRING等。除此之外，environ里面还至少包含其他7个WSGI定义的环境变量，比如wsgi.version、wsgi.input、wsgi.url_scheme等。WSGI应用可以从environ字典中获取相对应的请求及其执行上下文的所有信息。

参数start_response指向一个回调函数，形如：

```python
start_response(status, response_headers, exec_info=None)
```

status表示响应状态字符串；response_headers，是一个包含了(header_name, header_value)元组的列表，分别表示HTTP响应中的HTTP头及其内容；exec_info一般在出现错误的时候使用，用来让浏览器显示相关错误信息。

参数start_resonse所指向的这个回调函数需要返回另一个形如write(body_data)的可调用对象。这个write对象是为了兼容现有的一些特殊框架设计的，一般情况下不使用。

有请求到来时，WSGI Server会准备好environ和start_response参数，然后调用WSGI Application 获得对应请求的回应。如下：

```python
def call_application(app, environ):

    body = []
    status_headers = [None, None]

    #定义start_response回调函数
    def start_response(status, headers)；

        status_headers[:] = [status, headers]
        return body.append(status_headers)

    #调用WSGI应用端
    app_iter = app(environ, start_response)

    try:
        for item in app_iter:
            body.append(item)
        finally:
            if hasattr(app_iter, 'close'):
                app_iter.close()
    return status_headers[0], status_headers[1], ''.join(body)

#准备environ环境变量，假设CGI相关变量已经在操作系统的上下文中。

environ = os.environ.items()
environ['wsgi.imput'] = sys.stdin.buffer
environ['wsgi.errors'] = sys.stderr
environ['wsgi.version'] = (1, 0)
environ['wsgi.multithread'] = False
environ['wsgi.multiprocess'] = True
environ['wsgi.run_once'] = True

if environ.get('HTTPS', 'off') in ('on', '1'):
	environ['wsgi.url_scheme'] = 'https'
else:
	environ['wsgi.url_scheme'] = 'http'
status, headers, body = call_application(application, environ)
```

WSGI 中间件同时实现了服务端和应用端的API，因此可以在两端之间起协调作用。从服务端看起来，中间件就是一个WSGI应用；从应用端看起来，中间件则是一个WSGI服务器。

WSGI 中间件可以将客户端的HTTP请求，路由给不同的应用对象，然后将应用处理后的结果返回给客户端。

WSGI 中间件也可以看做服务端和应用端交互的一层包装，经过不同中间件的包装，便具有不同的功能，比如URL路由分发、权限认证。不同中间件的组合便形成了WSGI的框架，比如Paste。

### Paste

OpenStack使用Paste的Deploy组件（http://pythonpaste.org/deploy/）来完成WSGI服务器和应用的构建，每个项目源码的etc目录下都有一个Paste配置文件，比如Nova中的etc/nova/api-paste.ini，部署时，这些配置文件会被复制到系统`/etc/<project>/`目录下。Paste Deploy的工作便是基于这些配置文件。

Paste配置文件有其固定的格式，以官网上的配置文件为例。

```json
[composite:main]
use = egg:Paste#urlmap
/ = home
/blog = blog
/wiki = wiki
/cms = config:cms.ini

[app:homt]
use = egg:Paste#static
document_root = %(here)s/htdocs

[filter-app:bolg]
use = egg:Authentication	#auth
next = blogapp
roles = admin
htpasswd = /home/me/users.htpasswd

[app:blogapp]
use = egg:BlogApp
database = sqlite:/home/me/blog.db

[app:wiki]
use = call:mywiki.main:application
database = sqlite:/home/me/wiki.db
```

Paste配置文件分为多个section，每个section以type:name的格式命名。

- type = composite

  这个类型的section会把URL请求分发到对应的Application，use表明具体的分发方式，比如“egg:Paste#urlmap”表示使用Paste包中的urlmap模块，

  这个section里的其他形如“key = value”的行是使用urlmap分发时的参数。

- type = app

  一个app就是一个具体的WSGI Application，这个app对应的Python代码则有use来指定，共有两种指定方法。

  - ```json
    [app:myapp]
    #从另外一个config.ini文件中寻找app
    use = config:another_config_file.ini#app_name
    
    [app:myanotherapp]
    #从Python EGG中寻找
    use = egg:Myapp
    
    [app:mythirdapp]
    #直接调用另外一个模块中的myapplication
    use = call:my.project:myapplication
    
    [app:mylastapp]
    #从另外一个section中
    use = myotherapp
    ```

    另外一种指定方法是明确指明对应的Python代码，这是必须给出代码所应该符合的格式，比如

    ```json
    paste.app_factory：
    
    [app:myapp]
    #myapp.modulename将被加载，并从中获取app_factory对象
    paste.app_factory = myapp.modulename:app_factory
    ```

    Python Deploy定义了很多factory，这些factory只是为了便于使用针对WSGI标准的一些封装。比如最普通的app_factory格式为：

    ```python
    def composite_factory(loader, golbal_config, **local_conf):
    	return wsgi_app
    ```

- type = filter-app

  接收到一个请求后，首先调用filter-app中的use所指定的app进行过滤，如果这个请求没有被过滤，就会被转发到next指定的app进行下一步处理。

- type = filter

  与filter-app类型的区别就是没有next。

- type = pipeline

  pipeline由一系列filter组成，这个filter链条的末尾是一个app。pipeline类型主要是对filter-app进行简化，否则，如果有多个filter，就需要写多个filter-app，然后使用next进行连接。

  ```json
  [pipeline:main]
  pipeline = filter1 egg:FilterEgg#filter2 filter3 app
  
  [filter:filter1]
  ...
  ```

  使用Paste Deploy的主要目的就是从配置文件中生成一个WSGI Application，有了配置文件之后，只需要使用下面的调用方式：

  ```python
  from paste.deploy import loadapp
  
  wsgi_app = loadapp('config:/path/to/config.ini')
  ```

  对于OpenStack，这里以Nova为例：

  ```python
  #nova/conf/wsgi.py
  #指定默认的Paste配置文件为api-paste.ini
  
  cfg.StrOpt(
          'api_paste_config',
          default="api-paste.ini",
          deprecated_group='DEFAULT',
          help="""
          This option represents a file name for the paste.deploy config for nova-api.
          Possible values:
          \* A string representing file name for the paste.deploy config.
          """)
  
  #nova/wsgi.py
  
  from paste import deploy
  
  class Loader(object):
  #从Paste配置文件加载WSGI应用
  
  	def load_app(self, name):
          """Return the paste URLMap wrapped WSGI application.
          """
          try:
              LOG.debug("Loading app %(name)s from %(path)s",
                        {'name': name, 'path': self.config_path})
              return deploy.loadapp("config:%s" % self.config_path, name=name)
          except LookupError:
              LOG.exception(_LE("Couldn't lookup app: %s"), name)
              raise exception.PasteAppNotFound(name=name, path=self.config_path)
  ```

  

### WebOb

除了Routes与Paste Deploy外，OpenStack中另一个与WSGI密切相关的是WebOb（http://webob.org/）。WebOb通过对WSGI的请求与响应进行封装，来简化WSGI应用的编写。

WebOb中有两个最重要的对象，一是webob.Request，对WSGI请求的environ参数进行封装，一是webob.Response，包含了标准WSGI响应的所有要素。此外，还有一个webob.exc对象，针对HTTP错误代码进行封装。

除了这三个对象，WebObT提供了一个修饰符（decorator）“webob.dec.wsgify”，以便我们可以不使用原始的WSGI参数和返回格式，而全部使用WebOb替代。

```python
@wsgi
def myfunc(req):
	return webob.Response('hey there')
```

​	

调用时可以有两种选择：

```python
app_iter = myfunc(environ, start_response)
```

或

```python
resp = myfunc(req)
```

第一种就是最原始和标准的**WSGI**格式，第二种则是**WebOb**封装过后的格式。

也可以使用参数对wsgify修饰符进行定制，比如使用webob.Request的子类，对真正的Request做一些判断或过滤，比如：

```python
class MyRequest(webob.Request):

	@property
	def is_local(self):
		return self.remote_addr == '127.0.0.1'

@wsgify(RequestClass=MyRequest)
def myfunc(req):
	if req.is_local:
		return Response('hi!')
	else:
		raise webob.exc.HTTPForbidden
```

以Nova为例：

```python
import webob.dec
import webob.exc

class Request(webob.Request):

    def init(self, environ, *args, **kwargs):
        if CONF.wsgi.secure_proxy_ssl_header:
            scheme = environ.get(CONF.wsgi.secure_proxy_ssl_header)
            if scheme:
                environ['wsgi.url_scheme'] = scheme
        super(Request, self).init(environ, *args, **kwargs)

class Middleware(Application):

	@webob.dec.wsgify(RequestClass=Request)
    def call(self, req):
        response = self.process_request(req)
        if response:
            return response

        response = req.get_response(self.application)
        return self.process_response(response)
```

​	

## Eventlet

目前，OpenStack中的绝大部分项目都采用协程（coroutine）模型。从操作系统的角度来看，**一个OpenStack服务只会运行在一个进程中，但在这个进程中，OpenStack利用Python库Eventlet可以产生出多个协程，协程只有在调用到了某些特殊的Eventlet库函数的时候（比如睡眠sleep，I/O调用）才会发生切换。**

​	协程和线程的主要区别是，***多个线程可以同时运行，但是同一时间只能有一个协程在运行，无须考虑锁的问题。线程的执行完全由操作系统控制（进程调度）。而使用协程时，协程的执行顺序与时间完全由程序自己决定。***

​	协程的实现主要是在协程休息时把当前的寄存器保存起来，然后重新工作时再将其恢复。可简单理解为，**在单个线程内部有多个栈去保存切换时的线程上下文，因此，协程可以理解为一个线程内的伪并发方式。**

### Eventlet

​	Eventlet（http://eventlet.net）是一个Python的网络库，它可以通过协程的方式来实现并发。Eventlet将协程又称为GreenThread（绿色线程），所谓并发，就是创建多个GreenThread并对其进行管理。

​	一个简单的例子如下：

​	

```python
import eventlet

	def my_func(param):
		...
		return 0
	
	gt = eventlet.spawn(my_func, work_to_process)
	result = gt.wait()
```

​	

​	eventlet.spawn会新建一个GreenThread来运行my_func函数。由于GreenThread不会进行抢占式调度，所以此时新建的GreenThread只是被标示为可调度，并不会被立即调度执行。只有当**主线程gt.wait()**时，这个GreenThread才会有机会被调度去执行my_func函数。

​	下面开始分析代码来理解其使用。Ceilometer中的compute agent的作用是在部署了nova-compute服务的机器上，定时轮询相关虚拟机实例的一些计量信息，然后将这些计量信息发送给

其他Celiometer服务进行处理。	

```python
#ceilometer/cmd/eventlet/__init__.py liberty（此版本之后移除了eventlet）
import eventlet

eventlet.monkey_patch(socket=True, select=True, thread=True, time=True)
```

​	

​	为了实现GreenThread，Eventlet需要对Python中与网络相关的一些标准库函数进行改写，并以补丁（patch）的方式导入到程序中，这里的eventlet.monkey_patch()函数就是用于这个目的。

​	Monkey Patch就是在运行时修改已有的代码，上面示例中，共有socket、select、thread、time四个Python内置模块被修改。一般来说，Monkey Patch是大部分使用Eventlet函数库的Python

程序都需要做的初始化工作。	

```python
#ceilometer/cmd/eventlet/polling.py

	def main():
		service.prepare_service()
   		os_service.launch(CONF, manager.AgentManager(CONF.polling_namespaces,
                                                 CONF.pollster_list)).wait()
```

​	调用os_service.launch()函数启动一个服务，并调用wait()函数等待该服务的结束。这个服务实际所做的工作由manager.AgentManager类完成。	

```python
#oslo_service/service.py

	def launch(conf, service, workers=1):
	
		if workers is None or workers == 1:
			#新建一个ServiceLauncher对象实例，ServiceLauncher继承自Launcher类
			launcher = ServiceLauncher(conf)
			launcher.launch_service(service)
		...	

	class Launcher(object):

		def init(self, conf):
			#新建一个Services类的对象实例作为Launcher类的成员，并在launch_service()中调用它的add()函数
			self.conf = conf
			conf.register_opts(_options.service_opts)
			self.services = Services()
			self.backdoor_port = (
				eventlet_backdoor.initialize_if_enabled(self.conf))

		def launch_service(self, service):
			_check_service_base(service)
			service.backdoor_port = self.backdoor_port
			self.services.add(service)
	...

	class Services(object):

		def init(self):
			self.services = []
			self.tg = threadgroup.ThreadGroup()
			self.done = event.Event()

		def add(self, service):

			self.services.append(service)
			#调用ThreadGroup对象的add_thread函数新建一个GreenThread，用来执行调用者所传参进来的服务
			self.tg.add_thread(self.run_service, service, self.done)

		@staticmethod
		def run_service(service, done):

			service.start()
			done.wait()
	...
	
	#oslo_service/threadgroup.py
	class ThreadGroup(object):

        def init(self, thread_pool_size=10):
		#真正调用Eventlet的代码在ThreadGroup类中，这里使用了Eventlet中的greenpool模块。GreenPool类代表了包含多个GreenThread（这里是10个）的线程池。
			self.pool = greenpool.GreenPool(thread_pool_size)
			self.threads = []
			self.timers = []
		...

		def add_thread(self, callback, *args, **kwargs):
			#从线程池里分配一个线程运行调用者所传入的实际任务函数。
			gt = self.pool.spawn(callback, *args, **kwargs)
			th = Thread(gt, self)
			self.threads.append(th)
			return th
```



### AsyncIO

​	由于Eventlet本身的一些局限性，比如不支持Python3；只支持CPython，不支持PyPy和Jython等，目前社区正考虑用AsyncIO来代替eventlet。

​	AsyncIO的设计标准定义在PEP3156中，并且在Python3.4中成为了标准內建模块，提供了一套用来写单线程并发代码的基础架构，其中包括了协程、I/O多路复用，以及信号量、队列、锁等一系列同步源语。AsyncIO可看做许多第三方Python库的超集，包括Twisted、Tornado、Gevent、Eventlet等。

​	OpenStack的目标是支持从Python2.6到Python3.5的各个版本，而AsyncIO只在Python3.4及其以后的版本中有支持，Enovance公司开发了trollius库对AsyncIO进行移植。详见https://bitbucket.org/enovance/trollius。

## OpenStack 通用库 Oslo

Oslo包含了众多不需要重复发明的“轮子”。olso-incubator代码仓库中放置的是未“孵化”的项目。

已孵化的项目可直接import，如果使用未孵化的则需要将代码同步到该项目代码openstack/common目录下，类似 “from ceilometer.openstack.common import log”。

### Cliff

​	**Cliff（Commond Line Interface Formulation Framework）**可以用来帮助构建命令行程序。开发中利用Cliff框架可以构建诸如svn、git那样的支持多层命令的命令行程序。

主程序只负责基本的命令行参数的解析，然后调用各个子命令去执行不同的操作。利用Python动态代码载入的特性，Cliff框架中的每个子命令可以和主程序分开来地实现、打包和分发。

​	整个Cliff框架主要包括以下四种不同类型的对象：

- cliff.app.App：主程序对象，用来启动程序，并且负责一些对所有子命令都通用的操作，比如设置日志选项和输入输出等。

- cliff.commandmanager.CommandManager：主要用来载入每个子命令插件。默认是通过Setuptools的entry points来载入。

- cliff.command.Command：用户可以实现Command的子类来实现不同的子命令，这些子命令被注册在Setuptools的entry points中，被CommandManager载入。每个子命令可有自己的参数解析（一般用argparse），同时要实现take_action()方法完成具体的命令。

- cliff.interactive.InteractiveApp:实现交互式命令行。一般使用框架提供的默认实现。



Cliff源码中附带了一个示例demoapp。

```python

#cliff/demoapp/cliffdemo/main.py	

import sys
from cliff.app import App
from cliff.commandmanager import CommandManager

class DemoApp(App):
	def init(self):
        super(DemoApp, self).init(
			description='cliff demo app',
			version='0.1',
			command_manager=CommandManager('cliff.demo'),
			deferred_help=True,
            )

    def initialize_app(self, argv):
        self.LOG.debug('initialize_app')

    def prepare_to_run_command(self, cmd):
        self.LOG.debug('prepare_to_run_command %s', cmd.class.name)

    def clean_up(self, cmd, result, err):
        self.LOG.debug('clean_up %s', cmd.class.name)

        if err:
            self.LOG.debug('got an error: %s', err)

def main(argv=sys.argv[1:]):
    myapp = DemoApp()
    return myapp.run(argv)

if name == 'main':
    sys.exit(main(sys.argv[1:]))
```

主程序新建一个DemoApp对象实例，并且调用其run方法运行。DemoApp是cliff.app.App的子类，它的初始化函数原型为：

```python
class cliff.app.App(self, description, version, command_manager,
                 stdin=None, stdout=None, stderr=None,
                 interactive_app_factory=None,
                 deferred_help=False)
```

​	其中stdin/stdout/stderr可以用来定义用户自己的标准输入/输出/错误，command_manager必须指向一个cliff.commandmanager.CommandManager对象实例，这个实例用来载入各个子命令插件。其初始化函数原型为：

```python
cliff.commandmanager.CommandManager (self, namespace, convert_underscores=True)
```

​	其中namespace用来指定Setuptools entry points的命名空间，CommandManager只会从这个命名空间中载入插件，convert_underscores参数指明是否需要把entry points中的下划线转化为空格。

​	cliff.app.App类的方法initialize_app()做一些初始化工作，这个函数会在主程序解析完用户的命令行参数后被调用，而且只会被调用一次。prepare_to_run_command()可以被用来做一些针对某个具体子命令的初始化工作，在子命令被调用之前调用。clean_up()在具体某个子命令完成后被调用，用来进行一些清理工作。

​	具体某个子命令的实现通过继承cliff.command.Command来完成：	

```python
#cliff/demoapp/cliffdemo/simple.py

import logging
from cliff.command import Command

class Simple(Command):
	"A simple command that prints a message."
	log = logging.getLogger(name)

    def take_action(self, parsed_args):
		self.log.info('sending greeting')
		self.log.debug('debugging')
		self.app.stdout.write('hi!\n')
```

​	子命令的实际工作由tack_action()完成。它的实现代码由cliff.command_manager.CommandManager通过Setuptools entry points来载入：

```python
#cliff/demoapp/setup.py
PROJECT = 'cliffdemo'

# Change docs/sphinx/conf.py too!
VERSION = '0.1'

from setuptools import setup, find_packages
	...
setup(
	name=PROJECT,
	version=VERSION,
	...
	install_requires=['cliff'],
	namespace_packages=[],
	packages=find_packages(),
	...
	entry_points={
		'console_scripts': [
			'cliffdemo = cliffdemo.main:main'
		],
		'cliff.demo': [
			'simple = cliffdemo.simple:Simple',
			...
		],
	},
	zip_safe=False,
)
```

​	在Setuptools entry points 的命名空间cliff.demo中，定义了命令simple所对应 的插件实现是Simple类。Cliff主程序解析用户的输入后，会通过这里所定义的对应关系调用不同的实现类。

### oslo.config

​	oslo.config库用于解析命令行和配置文件中的配置选项。项目主页为https://launchpad.net/oslo.config，参考文档在http://docs.openstack.org/developer/oslo.config。

​	通过几个应用场景来介绍oslo.config的使用方法：

- 定义和注册配置选项

   ```python
   from oslo_config import cfg
   #cfg.CONF是oslo.config中定义的一个全局对象实例
   OPTS = [
   
   		cfg.IntOpt('periodic_interval',
   
              		default=40,
   
              		help=('Seconds between running periodic tasks.')),
   
   		]
   
   #注册配置选项
   
   cfg.CONF.register_opts(OPTS)
   
   #将配置选项注册为命令行选项
   
   CLI_OPTS = [
   
   				cfg.StrOpt('os-tenant-id',
   
              			deprecated_group="DEFAULT",
   
   		   	help=('Tenant ID to use for OpenStack service access.')),
   
   		]
   
   cfg.CONF.register_cli_opts(CLI_OPTS, group="service_credentials")
   ```


   配置选项类型表，如下


| 类名                     | 说明           |
| ------------------------ | -------------- |
| oslo_config.cfg.StrOpt   | 字符串类型     |
| oslo_config.cfg.BoolOpt  | 布尔型         |
| oslo_config.cfg.IntOpt   | 整数类型       |
| oslo_config.cfg.FloatOpt | 浮点数类型     |
| oslo_config.cfg.ListOpt  | 字符串列表类型 |

​	定义后的配置选项，必须要注册才能使用。此外，配置选项还可以注册为命令行选项，之后，这些配置选项的值就可以从命令行读取，并覆盖配置文件中读取的值。

​	注册配置选项时，可以把某些配置选项注册在一个特定的组下。如果没有指定，则默认为"DEFAULT"。

​	在新版本的oslo.config(version>=1.30.0)，增加了另一种新的定义方式：

```python
from oslo_config import cfg
from oslo_config import types

PortType = types.Integer(1, 65535)
conmmon_opts = [
	cfg.Opt('bind_port',
		type=PortType(),
		default=9292,
		help='Port number to listen on.')
]
```

这种方式支持值的合法性检查，同时也能自定义选项类型。	

- 使用配置文件和命令行选项指定配置选项

   为了正确使用oslo.config，应用程序一般需要在启动的时候初始化，比如：

   ```python
   from oslo_config import cfg
   
   cfg.conf(sys.argv[1:], project = 'xyz')
   ```


   初始化后才能正常解析配置文件和命令行选项。最终用户可以用默认的命令行选项“--config-file”或“--config-dir”来指定配置文件名或位置。没有明确指定则默认顺序为：

   ```
   ~/.xyz/xyz.conf		~/xyz.conf 	/etc/xyz/xyz.conf	/etc/xyz.conf
   ```

    配置文件中每一个Section对应oslo.config中定义的一个配置选项组。	

- 用其他模块中已经注册过的配置选项

    对于已经注册过的配置选项，开发者可以直接访问：
    	
    ```python
    from oslo.config import cfg
    import service
    
    hostname = cfg.CONF.host
    tenant_id = cfg.CONF.service_credentials.os-tenant-id
    ```
    这个导入service模块是因为host和os-tenant-id是在service模块中注册的。但是从编码风格来看，上述代码比较古怪，导入了service却从没直接用过它。所以，可以直接使用import_opt来申明在别的模块中定义的配置选项：

    ```python
    from oslo.config import cfg	
    
    cfg.CONF.import_opt('host', 'service')
    hostname = cfg.CONF.host	
    ```

### oslo.db

oslo.db是针对SQLAlchemy访问的抽象。参考文档在http://docs.openstack.org/developer/oslo.db。

通过几个范例来了解oslo.db的使用方法。

- 获取SQLAlchemy的engine和session对象实例

  ```python
  from oslo.config import cfg
  from oslo.db.sqlalchemy import session as db_session
  
  _FACADE = None
  
  def _create_facade_lazily():
  	global _FACADE
  	if _FACADE is None:
  		_FACADE = db_session.EngineFacade.from_config(cfg.CONF)
  	return _FACADE
  
  def get_engine():
  	return _create_facade_lazily().get_engine()
  
  def get_session(**kwargs):
  	return _create_facade_lazily().get_session(**kwargs)
  ```

  获取了engine和session对象实例后，开发者就可以按照一般访问SQLAlchemy的方式进行使用。这里的engine对象是共享的，同时也是线程安全的，可以等效成一组数据库连接，而session对象可以看做是数据库交易事务的上下文，它不是线程安全的，不应该被共享使用。

  管理员可以通过配置文件来配置oslo.db的许多选项，如：

  ```json
  [database]
  #connection = mysql://root:123456@localhost/ceilometer?charset=utf8
  connection = mysql+pymysql://neutron:0f6bb223b9374deb@172.16.10.6/neutron
  ```

  常用的配置选项如下图（具体参见[oslo_db](https://github.com/openstack/oslo.db/tree/master/oslo_db)/options.py）

| 配置项=默认值                | 说明                                                        |
| ---------------------------- | ----------------------------------------------------------- |
| backend = sqlalchemy         | （字符串类型）后台数据库标识                                |
| connection = None            | （字符串类型）sqlalchemy用此来连接数据库                    |
| connection_debug = 0         | （整型）sqlalchemy的debug等级，0表示不输出，100表示输出所有 |
| connection_trace = False     | （布尔型）是否把python的调用栈信息加到SQL的注释中           |
| db_inc_retry_interval = True | （布尔型）连接重试时，是否增加重试之间的时间间隔            |
| max_overflow = None          | （整型）如果设置了，这个参数会直接传给sqlalchemy            |
| max_pool_size = None         | （整型）一个连接池中，最大可同时打开的连接数                |

- 使用OpenStack中通用的SQLAlchemy model类

  ```python
  from oslo.db import models
  
  class ProjectSomething(models.TimestampMixin, models.ModelBase):
  	id = Column(Integer, primary_key=True)
  	...
  ```

  models模块目前只定义了两种Mixin：TimestampMixin和SoftDeleteMixin。使用 TimestampMixin时SQLAlchemy model中会多出两列 created_at 和 updated_at，分别表示记录的创建时间和上一次修改的时间。

  SoftDeleteMixin支持soft delete功能，比如：

  ```python
  class ProjectSomething(models.TimestampMixin, models.ModelBase):
  	id = Column(Integer, primary_key=True)
  	...
  ...
  count = model_query(BarModel).find(some_condition).soft_delete()
  ```

- 不同DB后端的支持

  ```python
  from oslo.config import cfg
  from oslo.db import api as db_api
  
  #定义不同backend所对应的实现，如果配置选项conf.database.backend的值为sqlalchemy，就#用project.db.sqlalchemy.api模块中的实现
  
  _BACKEND_MAPPING = {'sqlalchemy': 'project.db.sqlalchemy.api'}
  IMPL = db_api.DBAPI.from_config(cfg.CONF, backend_mapping=_BACKEND_MAPPING)
  
  def get_engine()；
  	return IMPL.get_engine()
  
  def get_session():
  	return IMPL.get_session()
  
  #DB-API method
  def do_something(something_id):
  	return IMPL.do_something(something_id)
  
  不同backend具体实现时，需要定义如下函数返回具体DB API的实现类：
  def get_backend():
  	return MyImplementationClass
  ```

### oslo.i18n

oslo.i18n是对Python gettext模块的封装，主要用于字符串的翻译和国际化。参考文档在http://docs.openstack.org/developer/oslo.i18n/。

使用oslo.i18n前，需要首先创建一个如下的集成模块：

```python
#neutron/_i18n.py

import oslo_i18n
DOMAIN = "neutron"
_translators = oslo_i18n.TranslatorFactory(domain=DOMAIN)

# 主要的翻译函数，类似gettext中的"_"函数
_ = _translators.primary

#不同的log level对应的翻译函数
#对于debug level的log信息，不建议翻译

_LI = _translators.log_info
_LW = _translators.log_warning
_LE = _translators.log_error
_LC = _translators.log_critical

#之后，在程序中就可以比较容易的使用：

from neutron._i18n import _, _LW

LOG = logging.getLogger(name)
LOG.warning(_LW('No routers compatible with L3 agent '
                          'configuration on host %s'), host)
```

### oslo.messaging

oslo.messaging 库为OpenStack各个项目使用RPC和事件通知（Event Notification）提供了一套统一的接口。为了支持不同的RPC后端实现， oslo.messaging 对如下的对象进行了统一：

- Transport

  Transport（传输层）主要实现了RPC底层的通信（比如Socket）以及事件循环、多线程等其他功能。可以通过URL来获得指向不同transport的句柄。URL格式为：

  ```python
  transport://user:pass@host1:port[,hostN:portN]/virtual_host
  ```

  目前支持的 Transport有 rabbit、qpid与zmq，分别对应不同的后端消息总线。用户可以使用 oslo.messaging.get_transport函数来获得 transport对象实例的句柄。

- Target

  Target 封装了指定某个消息最终目的地的所有信息，下表所示为其所有具有的属性。

| 参数=默认值      | 说明                                                         |
| ---------------- | ------------------------------------------------------------ |
| exchange = None  | （字符串）topic所属的范围，不指定的话默认使用配置文件中的control_exchange选项 |
| topic = None     | （字符串）一个topic可以用来标识服务器所暴露的一组接口（包含多个可被远程调用的的方法）。允许多个服务器暴露同一组接口，消息轮询发送。 |
| namespace = None | （字符串）标识服务器所暴露的特定接口                         |
| version = None   | （字符串）服务器所暴露的接口支持M.N类型的版本号。N增加表示新接口向前兼容，M的增加表示新旧不兼容。RPC服务器可以实现多个不同的主版本号接口 |
| server = None    | （字符串）客户端可指定此参数来要求信息的目的地是某个特定的服务器，而不是一组同属某个topic的服务器中的任意一台 |
| fanout = None    | （布尔型）True时，消息会被发送到同属某个topic的所有服务器上，而不是其中的一台 |

​	在不同的场景下，构造 Target对象需要不同的参数：创建一个RPC服务器时，需要topic和server参数，exchange参数可选；指定一个endpoint的target时，namespace和version是可选的；客户端发送消息时，需要topic参数，其他可选。

- Server

  一个RPC服务器可以暴露多个endpoint，每个endpoing包含一组方法，这组方法是可以被客户端通过某种 Transport对象远程调用的。创建Server对象时，需要指定 Transport、Target和一组endpoint。

- RCP Client

  通过RCP Client，可以远程调用RPC Server上的方法。远程调用时，需要提供一个字典对象来指明调用的上下文，调用的方法的名字和传递给调用方法的参数（用字典表示）。

  有cast 和 call两种远程调用方式。类似 

  ```python
  cctxt.cast(context, 'network_delete', network_id=network_id)
  ```

- Notifier

  Notifier用来通过某种 transport发送通知消息。通知消息遵循如下的格式：

  ```python
  {
   'message_id': six.text_type(uuid.uuid4()),		#消息id号
   'publisher_id': 'compute.host1',				#发送者id
   'timestamp': timeutils.utcow(),					#时间戳
   'priority': 'WARN',							#通知优先级
   'event_type': 'compute.create_instance',		#通知类型
   'payload': {'instance_id': 12,...}				#通知内容
  }
  ```

  可以在不同的优先级上发送通知，这些优先级包括sample critical error warn info debug audit等。

- Notification Listener

  Notification Listener 和 Server类似，一个Notification Listener 对象可以暴露多个endpoint，每个endpoint包含一组方法。但是与Server对象中的endpoint不同的是，这里的endpoint中的方法对应通知消息的不同优先级。比如：

  ```python
  from oslo import messaging
  
  class ErrorEndpoint(object):
  	def error(self, ctxt, publisher_id, event_type, payload, metadata):
  		do_something(payload)
  			return messaging.NotificationResult.HANDLED
  ```

  endpoint中的方法如果返回messaging.NotificationResult.HANDLED或者None，表示这个通知消息已经确认被处理；如果返回messaging.NotificationResult.REQUEUE，表示这个通知消息要重新进入消息队列。

  下面是一个利用oslo.messaging来实现远程过程调用（RPC）的示例。

  ```python
  #server.py 服务器端
  
  from oslo.config import cfg
  from oslo import messaging
  
  class ServerControlEndpoint(object):
  	target = messaging.Target(namespace='control', version='2.0')
  
  	def init(self, server):
  		self.server = server
  
  	def stop(self, ctx):
  		if self.server:
  			self.server.stop()
  
  class TestEndpoint(object):
  
  	def test(self, ctx, arg):
  		return arg
  
  transport = messaging.get_transport(cfg.CONF)
  target = messaging.Target(topic='test', server='server1')
  endpoints = [
  	ServerControlEndpoint(None),
  	TestEndpoint(None),
  ]
  
  server = messaging.get_rpc_server(transport, target, endpoints, executor='blocking')
  server.start()
  server.wait()
  ```

  这个例子里，定义了两个不同的endpoint：ServerControlEndpoint与TestEndpoint。这两endpoint中的方法stop()和test()都可以被客户端远程调用。

  创建rpc server之前，需要先创建transport和target对象，这里使用get_transport()函数来获得transport对象的句柄，get_transport()参数表如下。

| 参数=默认值              | 说明                                                         |
| ------------------------ | ------------------------------------------------------------ |
| conf                     | （oslo_config.cfg.ConfigOpts类型）oslo.config配置项对象      |
| url=None                 | （字符串或oslo.messaging.Transport类型）transport URL。如果为空，采用conf配置中的transport_url项所指定的值 |
| allow_remote_exmods=None | （列表类型）Python模块的列表。客户端可用列表里的模块来deserialize异常 |
| aliases=None             | （字典类型）transport别名和transport名称之间的对应关系       |

conf对象里，除了包含transport_url项外，还可以包含control_exchange项，可以使用set_transport_defaults()函数来修改默认值。

此处构建的Target对象是用来建立RPC server的，所以需要指明topic和server参数。用户定义的endpoint对象也可以包含一个target属性，用来指明这个endpoint所支持的特定的namespace和version。

这里使用get_rpc_server()函数来创建server对象，然后调用server对象的start方法开始接收远程调用。get_rpc_server()函数的参数表如下。

| 参数=默认值         | 说明                                                         |
| ------------------- | ------------------------------------------------------------ |
| transport           | （Transport类型）transport对象                               |
| target              | （Target类型）target对象，用来指明监听的exchange topic 和server |
| endpoint            | （列表类型）包含了endpoints对象实例的列表                    |
| executor='blocking' | （字符串类型）用来指明消息接收的方法的方式，目前支持两种方式：blocking：用户调用start函数后，在start函数中开始请求处理循环：用户线程阻塞，处理下一个请求。知道用户调用了stop函数后，这个处理循环才会退出。消息的接收和分发处理都在调用start函数的线程中完成eventlet：协程GreenThread来处理消息的接收，然后有其他不同的GreenThread来处理不同消息的分发处理。调用start函数的用户线程不会被阻塞 |
| serializer=None     | （Serializer类型）用来序列化/反序列化消息                    |

```python
#client.py 客户端
from oslo.config import cfg
from oslo import messaging

transport = messaging.get_transport(cfg.CONF)
target = messaging.Target(topic='test')
client = messaging.RPCClient(transport, target)
ret = client.call(ctxt = {}, method = 'test', arg = 'myarg')
cctxt = client.prepare(namespace='control', version='2.0')
cctxt.cast({}, 'stop')
```

这里target对象构造时，必须要有的参数只有topic，创建RPCClient对象时，可以接受的参数表如下。

| 参数=默认值      | 说明                                                         |
| ---------------- | ------------------------------------------------------------ |
| transport        | （Transport类型）transport对象                               |
| target           | （Target类型）该client对象的默认target对象                   |
| timeout=None     | （整数或者浮点数）客户端调用call方法时的超时时间（秒）       |
| version_cap=None | （字符串类型）最大支持的版本号。当版本号超过时，会扔出RPCVersionCapError异常 |
| serializer=None  | （Serializer类型）用来序列化/反序列化消息                    |
| retry=None       | （整数）连接重试次数：None 或者 -1 ： 一直重试0 ： 不重试>0 ： 重试次数 |

远程调用时，需要传入调用上下文、调用方法的名字和传给调用方法的参数。

Target对象的属性在RPCClient对象构造以后，还可以通过prepare()方法修改。可以修改的属性包括 exchage topic namespace version server fanout timeout version_cap和retry。修改后的target属性只在这个prepare()方法返回的对象中有效。



再看一个利用oslo.messaging实现消息通知的例子：

```python
#notification_listener.py 消息通知处理

from oslo_config import cfg
import oslo_messaging

class NotificationEndpoint(object):
	def warn(self, ctxt, publisher_id, event_type, payload, metadata):
		do_something(payload)

class ErrorEndpoint(object)；
	def error(self, ctxt, publisher_id, event_type, payload, metadata):
		do_something(payload)

transport = oslo_messaging.get_transport(cfg.CONF)
targets = [
	oslo_messaging.Target(topic='notifications')
	oslo_messaging.Target(topic='notifications_bis')
]

endpoints = [
	NotificationEndpoint(),
	ErrorEndpoint()

]

listener = oslo_messaging.get_notification_listener(transport, targets, endpoints)
listener.start()
listener.wait()
```

通知消息处理的endpoint对象和RPC调用的endpoint对象不同，对象定义的方法需要和通知消息的优先级一一对应。可以为每个endpoint指定所对应的target对象。

最后调用get_notification_listener()函数构造notification listener对象，get_notification_listener的参数表如下。

| 参数=默认值         | 说明                                                         |
| ------------------- | ------------------------------------------------------------ |
| transport           | （Transport类型）transport对象                               |
| target              | （Target类型）target对象的列表，用来指明endpoints列表中的每一个endpoint所侦听处理的exchange 和 topic |
| endpoints           | （列表类型）包含了endpoints对象实例的列表                    |
| executor='blocking' | （字符串类型）用来指明消息接收的方法的方式，目前支持两种方式：blocking：用户调用start函数后，在start函数中开始请求处理循环：用户线程阻塞，处理下一个请求。知道用户调用了stop函数后，这个处理循环才会退出。消息的接收和分发处理都在调用start函数的线程中完成eventlet：协程GreenThread来处理消息的接收，然后有其他不同的GreenThread来处理不同消息的分发处理。调用start函数的用户线程不会被阻塞 |
| serializer=None     | （Serializer类型）用来序列化/反序列化消息                    |

相对应的发送消息通知的代码如下：

```python
#notifier_send.py

from oslo_config import cfg
import oslo_messaging

transport = oslo_messaging.get_transport(cfg.CONF)
notifier = oslo_messaging.Notifier(transport, driver='messaging', topic='notifications')
notifier2 = notifier.prepare(publisher_id='compute')
notifier2.error(ctxt{}, event_type='my_type', payload={'content': 'error_occurred'})
```

发送通知消息时，首先要构造Notifier对象，此时可能需要指定的参数表如下。

| 参数=默认值     | 说明                                                         |
| --------------- | ------------------------------------------------------------ |
| transport       | （Transport类型）transport对象                               |
| target          | （Target类型）target对象的列表，用来指明endpoints列表中的每一个endpoint所侦听处理的exchange 和 topic |
| publish_id=None | （字符串类型）发送者id                                       |
| driver=None     | （字符串类型）后台驱动。一般采用“messaging”。未指定则使用配置文件中的notification_driver的值 |
| topic           | （字符串类型）发送消息的topic。未指定则使用配置文件中的notification_topics的值 |
| serializer=None | （Serializer类型）用来序列化/反序列化消息                    |
| retry=None      | （整数）连接重试次数：None 或者 -1 ： 一直重试0 ： 不重试>0 ： 重试次数 |

初始化Notifier对象的操作比较复杂，所以可以用prepare()方法修改已创建的Notifier对象，prepare()方法返回的是新的Notifier对象的实例。参数表如下。

| 参数=默认值     | 说明                                                         |
| --------------- | ------------------------------------------------------------ |
| publish_id=None | （字符串类型）发送者id                                       |
| retry=None      | （整数）连接重试次数：None 或者 -1 ： 一直重试0 ： 不重试>0 ： 重试次数 |

最后可以调用Notifier对象的不同方法（error，criticial，warn等等）发送不同优先级的消息通知。

### stevedore

利用Python语言的特性，运行时动态载入代码变得更加容易。很多Python应用程序利用这样的特性在运行时发现和载入所谓的“插件”（plugin），使得自己更易于扩展。

Python库stevedore就是在Setuptools的entry points基础上，构造了一层抽象层，使开发者可以更容易地在运行时发现和载入插件。stevedore参考文档在http://stevedore.readthedocs.org/。

entry points的每一个命名空间里，可以包含多个entry point项。stevedore要求每一项都符合如下格式：

```json
name = module:importable
```

左边是插件的名字，右边是它的具体实现，中间用等号分隔开。插件的具体实现用“模块：可导入的对象”的形式来指定。neutron为例：

```json
neutron.ml2.type_drivers =
    flat = neutron.plugins.ml2.drivers.type_flat:FlatTypeDriver
    vlan = neutron.plugins.ml2.drivers.type_vlan:VlanTypeDriver
    gre = neutron.plugins.ml2.drivers.type_gre:GreTypeDriver
    vxlan = neutron.plugins.ml2.drivers.type_vxlan:VxlanTypeDriver
neutron.ml2.mechanism_drivers =
    linuxbridge = neutron.plugins.ml2.drivers.linuxbridge.mech_driver.mech_linuxbridge:LinuxbridgeMechanismDriver
    openvswitch = neutron.plugins.ml2.drivers.openvswitch.mech_driver.mech_openvswitch:OpenvswitchMechanismDriver
    l2population = neutron.plugins.ml2.drivers.l2pop.mech_driver:L2populationMechanismDriver
```

示例中显示了两个不同的entry points的命名空间，“neutron.ml2.type_drivers” 和 “neutron.ml2.mechanism_drivers”，分别注册有4个和3个插件。每个插件都符合“名字=模块:可导入对象”的格式。

根据每个插件在entry point中名字和具体实现的数量之间的对应关系不同，stevedore提供了多种不同的类来帮助开发者发现和载入插件，如下表。

| 插件名字：具体实现 | 建议选用stevedore中的类              |
| ------------------ | ------------------------------------ |
| 1:1                | stevedore.driver.DriverManager       |
| 1:n                | stevedore.hook.HookManager           |
| n:m                | stevedore.extension.ExtensionManager |

类实例化可接受的参数请参考代码。

使用stevedore来帮助程序动态载入插件的过程主要分为三个部分：插件的实现、插件的注册，以及插件的载入。

- 实现：Python实现

- 注册：cfg文件中按照格式增加

- 载入：

  ```python
  class MechanismManager(stevedore.named.NamedExtensionManager):
  	def init(self):
          self.mech_drivers = {}
          self.ordered_mech_drivers = []
          super(MechanismManager, self).init('neutron.ml2.mechanism_drivers',
                                                 cfg.CONF.ml2.mechanism_drivers,
                                                 invoke_on_load=True,
                                                 name_order=True)
  
          self._register_mechanisms()
          self.host_filtering_supported = self.is_host_filtering_supported()
  
          if not self.host_filtering_supported:
              LOG.warning(_LW("Host filtering is disabled because at least one "
                              "mechanism doesn't support it."))
  ```

### TaskFlow

通过TaskFlow库，可以更容易地控制任务（Task）的执行。文档在http://docs.openstack.org/developer/taskflow/。

#### task、flow 和 engine

```python
#taskflow/examples/reverting_linear.py

import taskflow.engines
from taskflow.patterns import linear_flow as lf
from taskflow import task

class CallJim(task.Task):
    
    def execute(self, jim_number, *args, **kwargs):
        print("Calling jim %s." % jim_number)

    def revert(self, jim_number, *args, **kwargs):
        print("Calling %s and apologizing." % jim_number)

class CallJoe(task.Task):

    def execute(self, joe_number, *args, **kwargs):
        print("Calling joe %s." % joe_number)

    def revert(self, joe_number, *args, **kwargs):
        print("Calling %s and apologizing." % joe_number)

class CallSuzzie(task.Task):

    def execute(self, suzzie_number, *args, **kwargs):
        raise IOError("Suzzie not home right now.")

flow = lf.Flow('simple-linear').add(
    CallJim(),
    CallJoe(),
    CallSuzzie()
)

try:
    taskflow.engines.run(flow, store=dict(joe_number=444,
                                          jim_number=555,
                                          suzzie_number=666))
except Exception as e:
    print("Flow failed: %s" % e)
```

这个示例首先定义了三个task：CallJim，CallJoe和CallSuzzie。在TaskFlow库中，task是拥有执行（execute）和回滚（revert）功能的最小单位（TaskFlow中最小单位是atom，其他所有类包括Task都是Atom类的子类）。开发者可自定义execute和revert函数。

TaskFlow中支持的流类型如下表所示

| 流类型           | 说明                                                         |
| ---------------- | ------------------------------------------------------------ |
| linear_flow.Flow | 线性流，流中的task/flow按加入顺序执行及回滚                  |
| graph_flow.Flow  | 图流，流中的task/flow按照显示指定的依赖关系，或者通过其间provides和requires属性之间的隐含依赖关系，来执行或回滚 |

流中不仅可以加入任务，还可以嵌套加入其它的流。此外，流还可以通过retry来控制当错误发生时，如何进行重试。TaskFlow自带的retry类型如下表

| Retry类型            | 说明                                                         |
| -------------------- | ------------------------------------------------------------ |
| AlwaysRevert         | 错误发生时，回滚子流                                         |
| AlwaysRevertAll      | 错误发生时，回滚所有的流                                     |
| Times                | 错误发生时，重试子流                                         |
| ForEach              | 每次错误发生时，为子流中的atom提供一个新的值，然后重试，直到成功或者retry中定义的值用完为止 |
| ParameterizedForEach | 类似ForEach，但是是从后台存储中获取重试的值                  |

TaskFlow库中的engine用来载入一个flow，然后驱动改flow中的task/flow运行。可以通过engine_conf来指明不同的engine类型，如下表

| engine类型   | 说明                                                         |
| ------------ | ------------------------------------------------------------ |
| serial       | 所有task都在调用engine.run的那个线程中运行                   |
| parallel     | task可能会被调度到不同的线程中并发运行                       |
| worker-based | task会被调度到不同的worker中运行。一个worker是一个单独的专门用来运行某些特定task的进程，这个worker进程可以在远程机器上，利用AMQP来通信 |

#### task 和 flow的输入、输出

```python
#taskflow/examples/graph_flow.py

import taskflow.engines
from taskflow.patterns import graph_flow as gf
from taskflow.patterns import linear_flow as lf
from taskflow import task

class Adder(task.Task):

    def execute(self, x, y):
        return x + y

flow = gf.Flow('root').add(
    lf.Flow('nested_linear').add(
        # x2 = y3+y4 = 12
        Adder("add2", provides='x2', rebind=['y3', 'y4']),
        # x1 = y1+y2 = 4
        Adder("add1", provides='x1', rebind=['y1', 'y2'])
    ),

    # x5 = x1+x3 = 20
    Adder("add5", provides='x5', rebind=['x1', 'x3']),
    # x3 = x1+x2 = 16
    Adder("add3", provides='x3', rebind=['x1', 'x2']),
    # x4 = x2+y5 = 21
    Adder("add4", provides='x4', rebind=['x2', 'y5']),
    # x6 = x5+x4 = 41
    Adder("add6", provides='x6', rebind=['x5', 'x4']),
    # x7 = x6+x6 = 82
    Adder("add7", provides='x7', rebind=['x6', 'x6']))

# Provide the initial variable inputs using a storage dictionary.
store = {
    "y1": 1,
    "y2": 3,
    "y3": 5,
    "y4": 7,
    "y5": 9,
}

# This is the expected values that should be created.
unexpected = 0

expected = [
    ('x1', 4),
    ('x2', 12),
    ('x3', 16),
    ('x4', 21),
    ('x5', 20),
    ('x6', 41),
    ('x7', 82),
]

result = taskflow.engines.run(flow, engine='serial', store=store)
print("Single threaded engine result %s" % result)
result = taskflow.engines.run(flow, engine='parallel', store=store)
print("Multi threaded engine result %s" % result)
```

上面的例子中，定义了一个Task对象Adder，作用是完成一个加法。接下去生成了一个图类型的流root，其中的task都通过provides和rebind来指明它们的输出和输入。

在engine运行时，通过store参数为流root提供所需要的输入参数，engine会把store中的值都保存在后台存储中；在执行各个task的过程中，各个task的输入都从后台储存中获取，输出都保存在后台存储中。这个程序的输出结果为：

```shell
Single threaded engine result {'y2': 3, 'y5': 9, 'y4': 7, 'y1': 1, 'x2': 12, 'x3': 16, 'y3': 5, 'x1': 4, 'x6': 41, 'x7': 82, 'x4': 21, 'x5': 20}

Multi threaded engine result {'y2': 3, 'y5': 9, 'y4': 7, 'y1': 1, 'x2': 12, 'x3': 16, 'y3': 5, 'x1': 4, 'x6': 41, 'x7': 82, 'x4': 21, 'x5': 20}
```

TaskFlow中的Task和Retry都是Atom的子类。对于任一Atom对象，都可以通过requires属性来了解它所要求的输入参数，和通过provides属性来了解它能够提供的输出结果的名字。

requires和provides的类似都是包含参数名称的**集合（set）**。

Task对象的requires可以由其execute方法获得。上述Adder对象，它的requires为：

```shell
>>>Adder().requires
set(['y','x'])
```

注意，execute方法中的可选参数和*args和**kwargs并不会出现在requires中。

此外，也可以在创建task时明确指定它的输入参数要求，这些参数在调用execute方法时可通过kwargs获得。

在有些情况下，传递给某个task的输入参数名和其所需要的参数名不同，这个时候可以通过rebind来处理:

```python
class SpawnVMTask(task.Task):
	def execute(self, vm_name, vm_image_id, **kwargs):
		pass
```

\#engine执行下面这个task时，会从后台储存中获取名为‘name’的参数值，然后把它当做vm_name参#数传递给task的execute()方法

```python
SpawnVMTask(rebind=('vm_name': 'name'))
```

\#engine执行下面这个task时，会从后台储存中获取名为‘name’，'image_id'和'admin_key_name'的#参数值，并分别当做vm_name，vm_image_id和kwagrs传递给task的execute方法

```python
SpawnVMTask(rebind=('name', 'image_id', 'admin_key_name'))
```

task的输出结果一般是指execute方法的返回值。但是Python的返回值是没有名字的，所以需要通过Task对象的provides属性指明返回值以什么名称存入后台存储中。

根据execute的返回值类型不同，provides可以有不同的方式指定。

- 返回到是一个单一的值：

  ```
  provides='the_answer'
  ```

  执行完毕后

  ```
  storage.fetch('the_answer')
  ```

  

- 返回的是元组tuple：

  ```
  provides=('bits', 'pieces')
  ```

  执行完毕后

  ```
  storage.fetch('bits')
  storage.fetch('pieces')
  ```

- 返回的是一个字典

  ```
  provides=set{['bits','pieces']}
  ```

  执行完毕后

  ```
  storage.fetch('bits')
  storage.fetch('pieces')
  ```

### cookiecutter

可以利用在 https://git.openstack.org/openstack-dev/cookiecutter 的模板，新建一个符合惯例的OpenStack项目。

1. ```shell
   # sudo pip install cookiecutter
   # cookiecutter https://git.openstack.org/openstack-dev/cookiecutter
   #（输入自己的模块名，例如abc）
   #  cd abc
   #  git init
   #  git add . 
   #  git commit -a
   ```

可以看到利用 cookiecutter模板建立起来的项目中，顶层目录下包含下表所示文件和目录

| 文件                  | 说明                                               |
| --------------------- | -------------------------------------------------- |
| abc                   | 代码目录                                           |
| babel.cfg             | babel配置文件。babel是一个用来帮助代码国家化的工具 |
| CONTRIBUTING.rst      | 开发者文件                                         |
| doc                   | 文档目录                                           |
| HACKING.rst           | 编码规范文件                                       |
| LICENSE               | 项目许可证信息                                     |
| MANIFEST.in           | MANIFEST模板文件                                   |
| openstack-common.conf | 项目所用到的oslo-incubator库里的模块               |
| README.rst            | 项目说明文件                                       |
| requirements.txt      | 项目所依赖的第三方python库                         |
| setup.cfg             | setuptools配置文件                                 |
| setup.py              | setuptools主文件                                   |
| test-requirements.txt | 项目测试时所需要依赖的第三方python库               |
| tox.ini               | 项目测试的tox配置文件                              |

### oslo.policy

policy用于控制用户的权限，能够执行什么样的操作。OpenStack的每个项目都有一个/etc/<project>/policy.json文件，通过配置这个文件来实现对用户的权限管理。

将policy操作的公共部分提取出来，就形成了oslo.policy库，它会负责policy的验证和rules的管理。一条rule有两种形式，可以是列表的形式，也可以是policy自定义的形式。

policy模块中有两个专门的方法对两种格式的rules进行解析。rule的两种格式如下：

```json
[["role:admin"], ["project_id:%(project_id)s", "role:projectadmin"]]

role:admin or (project_id:%(project_id)s and role:projectadmin)
```

使用第二种格式，policy规则支持or、and、not等逻辑的组合，而且还可以是带有"http"的url形式的rules。

policy的验证，其实就是对字典key和value的判断，如果匹配成功，则通过policy，否则失败。

各个工程的API通过policy来检测用户身份权限的规则，例如有些API只有管理员权限可以执行，有些普通用户可以执行，在代码中的体现就是判断context的project_id和user_id是不是合法类型的。这里是Nova API的一个示例：

```python
#nova/api/openstack/extensions.py   liberty

def core_authorizer(api_name, extension_name):
    def authorize(context, target=None, action=None):
        if target is None:
            target = {'project_id': context.project_id,
                      'user_id': context.user_id}
            
        if action is None:
            act = '%s:%s' % (api_name, extension_name)
        else:
            act = '%s:%s:%s' % (api_name, extension_name, action)
        nova.policy.enforce(context, act, target)
    return authorize



```

相应的/etc/nova/policy.json文件内容为：

```json
"context_is_admin":  "role:admin",
"admin_or_owner":  "is_admin:True or project_id:%(project_id)s",
"default": "rule:admin_or_owner",
...
"compute_extension:admin_actions:pause": "rule:admin_or_owner",
"compute_extension:admin_actions:unpause": "rule:admin_or_owner",
"compute_extension:admin_actions:suspend": "rule:admin_or_owner",
```

从上面可以看出，nova pause的rule是"is_admin:True or project_id:%(project_id)s"，需要policy验证是不是admin用户或者project_id是不是匹配。

### oslo.rootwrap

oslo.rootwrap可以让其他OpenStack服务以root身份执行shell命令。

oslo.rootwrap首先会从配置文件所定义的Filter文件目录中读入所有Filter的定义，然后检查要运行的shell命令是否和Filter中的定义相匹配，匹配则运行，不匹配就不运行。

- 构造 rootwrap shell 脚本

  使用 rootwrap 需要在一个单独的Python进程中以root身份调用Python函数 oslo.rootwrap.cmd.main()。可以通过 Setuptools 中的 console script 来构造这样一个shell脚本，以nova为例：

  ```python
  #setup.cfg
  
  console_scripts =
  nova-api = nova.cmd.api:main
  	...
  nova-rootwrap = oslo.rootwrap.cmd:main
  ```

  可以看到构造一个名为 nova-rootwrap的 shell 脚本时，会调用 oslo.rootwrap.cmd.main()函数。运行“python setup.py install”之后， nova-rootwrap 脚本就会被生成。

- 调用 rootwrap shell 脚本

  rootwrap 的 shell 脚本需要以 sudo 方式调用，比如：

  ```shell
  # sudo nova-rootwrap /etc/nova/rootwrap.conf COMMAND_LINE
  ```

  其中的 /etc/nova/rootwrap.conf 是 oslo.rootwrap 的配置文件名，COMMAND_LINE是希望以root身份运行的 shell 命令。

  由于 rootwrap shell 需要以sudo 方式运行，所以我们还需要配置sudoers文件：

  ```shell
  nova ALL=(root) NOPASSWD: /usr/bin/nova-rootwrap /etc/nova/rootwrap.conf
  ```

  假设nova服务以nova用户的身份运行，相关的 rootwrap shell 是 /usr/bin/nova-rootwrap。

- rootwrap 配置文件

  rootwrap 配置文件是以 INI 的文件格式存放的，下表所示为相关配置选项：

| 选项=默认值                 | 说明                                                         |
| --------------------------- | ------------------------------------------------------------ |
| filters_path                | 包含Filter定义文件的目录，用逗号分隔，比如filters_path=/etc/nova/rootwrap.d,/usr/share/nova/rootwrap |
| exec_dir=$PATH              | shell可执行命令的搜索目录，用逗号分隔，比如exec_dir=/sbin,/usr/sbin,/bin,/usr/bin。默认为PATH的值 |
| use_syslog=False            | 是否使用syslog                                               |
| use_syslog_rfc_format=False | 是否使用兼容RFC5424的syslog格式                              |
| syslog_log_facility=syslog  | syslog的facility level，可选的其他选项有auth quthpriv syslog user0 user1等 |
| syslog_log_level=ERROR      | 需要记录的syslog等级                                         |

- 定义 Filter

  Filter 定义文件一般以 .filter后缀结尾，放在配置文件选项filters_path所指定的目录中。这些定义文件以ini格式存放， Filter 的定义放在[Filters]节中。定义的格式为：

  ```
  Filter 名:Filter 类, [Filter类参数1,Filter类参数2,...]
  ```

  rootwrap所支持的 Filter 类型如下表所示。

| Filter class         | 说明                                                         |
| -------------------- | ------------------------------------------------------------ |
| CommondFilter        | 只检查运行的shell命令。类参数为：可运行的shell命令以什么身份运行此命令 |
| RegExpFilter         | 首先检查运行的shell命令，然后用正则表达式检查所有的命令参数。类参数为：可运行的shell命令以什么身份运行此命令用以匹配第一个命令行参数的正则表达式用以匹配第二个命令行参数的正则表达式...... |
| PathFilter           | 检查命令行参数中的目录是否合法。类参数为：可运行的shell命令以什么身份运行此命令第一个命令行参数第二个命令行参数......此处命令行参数可以有三种不同类型的参数定义：pass：允许任何命令行参数以‘/’开头的字符串：命令行参数里的目录是在此目录下其他字符串：只允许此字符串为命令行参数 |
| EnvFilter            | 允许设置额外的环境变量。类参数为：env以什么身份运行此命令（多个）允许设置的环境变量名，用“=”结尾可运行的shell命令 |
| ReadFileFilter       | 允许使用cat来读取文件。类参数为：允许以root身份读取的文件    |
| KillFilter           | 允许对特定进程发送特定信号。类参数为：以身份身份运行kill命令只向执行此命令的进程发送信号（多个）允许发送的信号 |
| IpFilter             | 允许运行ip命令（除了ip netns exec之外）。类参数为：ip以什么身份运行ip命令 |
| IpNetnsExecFilter    | 允许运行ip netns exec <namespace> <command> 命令，但是其中的<command>必须要通过其他Filter的检查。类参数为：ip以什么身份运行ip命令 |
| ChainingRegExpFilter | ChainingRegExpFilter首先使用RegExpFilter类的方式检查在此类参数定义的前面几个命令行参数，剩下的命令行参数由其他filter定义检查。类参数为：可运行的shell命令以什么身份运行此命令（多个）命令行参数 |
