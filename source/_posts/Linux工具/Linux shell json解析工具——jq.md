---
title: Linux shell json解析工具——jq
date: 2021-04-14 20:30:52
categories: Linux工具
tags:
  - json
  - jq
---



json格式是数据传输过程中一种通用的格式，对于Python而言，由于有多种json包，解析json并不是什么难事。

在Linux shell中，同样有一种强大的json解析工具——jq。jq没有相关依赖，仅一个二进制文件。

<!--more-->

## 安装

官网：https://stedolan.github.io/jq/download/

### Linux

- jq 1.5 is in the official [Debian](https://packages.debian.org/jq) and [Ubuntu](http://packages.ubuntu.com/jq) repositories. Install using `sudo apt-get install jq`.
- jq 1.5 is in the official [Fedora](http://pkgs.fedoraproject.org/cgit/jq.git/) repository. Install using `sudo dnf install jq`.
- jq 1.4 is in the official [openSUSE](https://software.opensuse.org/package/jq) repository. Install using `sudo zypper install jq`.
- jq 1.5 is in the official [Arch](https://www.archlinux.org/packages/?sort=&q=jq&maintainer=&flagged=) repository. Install using `sudo pacman -Sy jq`.

### OS X

- Use [Homebrew](http://brew.sh/) to install jq 1.5 with `brew install jq`.

### FreeBSD

- Use [FreshPorts](https://www.freshports.org/textproc/jq/) to install jq 1.4 with `pkg install jq`.

### Solaris

- `pkgutil -i jq` in [OpenCSW](https://www.opencsw.org/p/jq) for Solaris 10+, Sparc and x86.

### Windows

- Use [Chocolatey NuGet](https://chocolatey.org/) to install jq 1.5 with `chocolatey install jq`.



## 使用

命令格式

```shell
jq [options...] filter [files...]
```



可以使用下面几种格式

```shell
jq -c '' a.json
jq '' a.json

jq -c '.foo' a.json
cat a.json | jq -c '.foo'
```



**参数说明：**
–compact-output / -c
默认情况下，jq会将json格式化为多行树状结构输出，但有时需要将一个json串在一行输出，即可使用该参数



**过滤器说明**

- .foo, .foo.bar
  获取json中key的值，可过滤出多级json串中的key值。

- .foo, .bar
  同时获取json中多个key的值。但过滤出的多个值会分多行显示。
- {foo: .foo, bar: .bar}
  获取json中部分key的值，并组合为新的object形式的json串。foo与bar即新json串的key，.foo与.bar即原json串中需要获取值的key。
  注意，生成的json串内容顺序是倒序的，上例中会生成：{“bar”:””, “foo”:””}
- [.foo, .bar]
  获取json中部分key的值，并组合为新的数组形式的json串。.foo与.bar即原json串中需要获取值的key。
  注意，生成的json串内容顺序是正序的，上例中会生成：[“foov”, “barv”]



jq 通过命令行选项来控制对输入输出的处理。几个重要的选项如下

- `-r` 选项 or `jq --raw-output`。

  该选项控制 jq 是输出 raw 格式内容或 JSON 格式内容。所谓的 JSON 格式是指符合 JSON 标准的格式。例如，假设我们要查询 JSON 字符串{“name”:”tom”}中 name 的值. 使用-r 选项时返回的是’tom’. 不使用-r 选项时，返回的是'”tom”‘.返回值多了一对双引号。即：**输出值无引号**，Print strings without quotes

- `-s` 选项。 

  jq 可以同时处理空格分割的多个 JSON 字符串输入。默认情况下，jq 会将 filter 分别对每个 JSON 输入应用，并返回结果。使用-s 选项，jq 会将所有的 JSON 输入放入一个数组中并在这个数组上使用 filter。“-s”选项不但影响到 filter 的写法。如果在 filter 中需要对数据进行选择和映射，其还会影响最终结果。

- `–arg` 选项。

  jq 通过该选项提供了和宿主脚本语言交互的能力。该选项将值(v)绑定到一个变量(a)上。在后面的 filter 中可以直接通过变量引用这个值。例如，filter ‘.$a’表示查询属性名称等于变量 a 的值的属性。



### JSON format

以下面的字符串为例

```shell
# cat json_raw.txt
{"routeTableId":"rt-kjjhbqkw8dk3","vpcId":"vpc-ydbn98nzsw67","description":{"time_zone":"shanghai"},"routeRules":[{"routeRuleId":"rr-psj2t3mbqhmq","sourceAddress":"192.168.0.0/20","destinationAddress":"0.0.0.0/0","nexthopId":"nat-byqr8xwnbh2e","nexthopType":"nat","description":"","pathType":"normal","routeTableId":"rt-kjjhbqkw8dk3"},{"routeRuleId":"","sourceAddress":"0.0.0.0/0","destinationAddress":"192.168.0.0/20","nexthopId":"","nexthopType":"sys","description":"","routeTableId":"rt-kjjhbqkw8dk3"}]}
```



```shell
# cat json_raw.txt | jq .
{
    "routeTableId":"rt-kjjhbqkw8dk3",
    "vpcId":"vpc-ydbn98nzsw67",
    "description":{
        "time_zone":"shanghai"
    },
    "routeRules":[
        {
            "routeRuleId":"rr-psj2t3mbqhmq",
            "sourceAddress":"192.168.0.0/20",
            "destinationAddress":"0.0.0.0/0",
            "nexthopId":"nat-byqr8xwnbh2e",
            "nexthopType":"nat",
            "description":"",
            "pathType":"normal",
            "routeTableId":"rt-kjjhbqkw8dk3"
        },
        {
            "routeRuleId":"",
            "sourceAddress":"0.0.0.0/0",
            "destinationAddress":"192.168.0.0/20",
            "nexthopId":"",
            "nexthopType":"sys",
            "description":"",
            "routeTableId":"rt-kjjhbqkw8dk3"
        }
    ]
}
```



### JSON parse

根据key获取value

```shell
# cat json_raw.txt | jq ".vpcId"
"vpc-ydbn98nzsw67"

# cat json_raw.txt | jq ".vpcId,.routeTableId"
"vpc-ydbn98nzsw67"
"rt-kjjhbqkw8dk3"
```



key不存在时会返回null

```shell
# cat json_raw.txt | jq ".test"
null
```



### JSON nested parse

```shell
# cat json_raw.txt | jq ".description.time_zone"
"shanghai"
```



### JSON parse array

```shell
# cat json_raw.txt | jq ".routeRules[].sourceAddress"
"192.168.0.0/20"
"0.0.0.0/0"

# cat json_raw.txt | jq ".routeRules[1].sourceAddress"
"0.0.0.0/0"
```



### 内建函数

jq还有一些内建函数如 keys、has。

keys是用来获取JSON中的key元素的

```shell
# cat json_raw.txt | jq 'keys'
[
  "description",
  "routeRules",
  "routeTableId",
  "vpcId"
]
```



has是用来是判断是否存在某个key

```shell
# cat json_raw.txt | jq 'has("description")'
true

# cat json_raw.txt | jq 'has("test")'
false
```



### 其他用法

利用jq的管道取出特定的字段

```shell
$ cat test.json | jq ".LoadBalancers.LoadBalancer | .[0].LoadBalancerId"
"123"


$ cat test.json | jq ".LoadBalancers.LoadBalancer[0].LoadBalancerId"
"123"

```



自定义输出的字段名，拼接取得的字符串成新json：

```shell
$ cat test.json | jq ".LoadBalancers.LoadBalancer | {"id1" : .[0].LoadBalancerId, name1: .[0].LoadBalancerName}"
{
  "name1": "1.test.com",
  "id1": "123"
}
```



```shell
$ cat test.json | jq "[.LoadBalancers.LoadBalancer[] | {"id" : .LoadBalancerId, name: .LoadBalancerName}]"
[
    {
        "name":"1.test.com",
        "id":"123"
    },
    {
        "name":"2.test.com",
        "id":"456"
    },
    {
        "name":"3.test.com",
        "id":"789"
    }
]
```



查看元素个数

```shell
$ cat test.json | jq ".LoadBalancers | length"
1
```

jq功能超级强大，甚至包括index，add，逻辑判断，正则表达式，debug，try-catch，while，split等等，具体可参考 https://stedolan.github.io/jq/manual/。



## 基础表达式

基础表达式（Basic filters)是 jq 提供的基本过滤器，用来访问 JSON 对象中的属性。基础表达式也是实现更复杂查询功能的基础。基础表达式主要有以下几种：

- ‘.’ 符号。单独的一个’.’符号用来表示对作为表达式输入的整个 JSON 对象的引用。
- JSON 对象操作。jq 提供两种基本表达式用来访问 JSON 对象的属性：’.<attributename>’和’.<attributename>?’。正常情况下，这两个表达式的行为相同：都是访问对象属性，如果 JSON 对象不包含指定的属性则返回 null。区别在于，当输入不是 JSON 对象或数组时，第一个表达式会抛出异常。第二个表达式无任何输出。
- 数组操作。jq 提供三种基础表达式来操作数组：
  - 迭代器操作(‘.[]’). 该表达式的输入可以是数组或者 JSON 对象。输出的是基于数组元素或者 JSON 对象属性值的 iterator。
  - 访问特定元素的操作(‘.[index]’或’.[attributename]’)。用来访问数组元素或者 JSON 对象的属性值。输出是单个值
  - 数组切片操作(‘.[startindex:endindex]’)，其行为类似于 python 语言中数组切片操作。
- 表达式操作(‘,’和 ‘|’)。表达式操作是用来关联多个基础表达式。其中逗号表示对同一个输入应用多个表达式。管道符表示将前一个表达式的输出用作后一个表达式的输入。当前一个表达式产生的结果是迭代器时，会将迭代器中的每一个值用作后一个表达式的输入从而形成新的表达式。例如’.[]|.+1′, 在这个表达式中，第一个子表达式’.[]’在输入数组上构建迭代器，第二个子表达式则在迭代器的每个元素上加 1。



## 内置运算支持

jq 内部支持的数据类型有：数字，字符串，数组和对象(object)。并且在这些数据类型的基础上， jq 提供了一些基本的操作符来实现一些基本的运算和数据操作。列举如下：

- 数学运算。对于数字类型，jq 实现了基本的加减乘除(/)和求余(%)运算。对于除法运算，jq 最多支持 16 位小数。
- 字符串操作。jq 提供字符串的连接操作(运算符为’+’，例如：”tom “+”jerry”结果为”tom jerry”)，字符串的复制操作(例如：’a’*3 结果为’aaa’)，以及字符串分割操作(将字符串按照指定的分割符分成数组，例如”sas”/”s”的结果为[“”,”a”,””]，而”sas”/”a”的结果为[“s”,”s”]。
- 数组操作。jq 提供两种数组运算：并集(‘+’)运算，结果数组中包含参与运算的数组的所有元素。差集运算(‘-‘)，例如：有数组 a,b, a-b 的结果为所有在 a 中且不包含在 b 中的元素组成的数组。
- 对象操作。jq 实现了两个 JSON 对象的合并操作(merge)。当两个参与运算的对象包含相同的属性时则保留运算符右侧对象的属性值。有两种合并运算符：’+’和’*’。所不同的是，运算符’+’只做顶层属性的合并，运算符’*’则是递归合并。例如：有对象 a={“a”:{“b”:1}}, b={“a”:{“c”:2}}，a+b 的结果为{“a”:{“c”:2}}，而 a*b 的结果为{“a”:{“b”:1,”c”:2}}
- 比较操作：jq 内部支持的比较操作符有==, !=,>,>=,<=和<。其中，’==’的规则和 javascript 中的恒等(‘===’)类似，只有两个操作数的类型和值均相同时其结果才是 true。
- 逻辑运算符: and/or/not。在 jq 逻辑运算中，除了 false 和 null 外，其余的任何值都等同于 true。
- 默认操作符(‘//’), 表达式’a//b’表示当表达式 a 的值不是 false 或 null 时，a//b 等于 a，否则等于 b。

jq 中有一种很特殊的运算规则：当运算符的一个或两个操作数是迭代器时，其运算以类似与笛卡尔乘积的方式进行，即把两个操作数中的每一个元素拿出来分别运算。例如：

```shell
#result is 5 6 7 8
jq -n '([1,2]|.[])+([4,6]|.[])'
```



jq 内部支持两种控制结构：**判断语句**和**异常处理**。

判断语句的完整结构为 if then-elif then-else-end。当判断条件的结果为多个值时（迭代器），会对每个值执行一次判断。

异常处理语句的结构为 try <表达式 a> catch <表达式 b>. 当表达式 a 发生异常时，执行表达式 b，且输入为捕捉到的异常信息。如果不需要额外的处理，只是简单的抑制异常信息的输入，可以没有 catch 语句（如 try .a)。这时，整个表达式可以简写为'<表达式 a>?'(如：.a?)。



jq 内部还支持函数。在使用 jq 函数时，我们应该注意区分两个概念：输入和参数。输入可能是整个表达式的输入数据也可能是表达式别的部分的输出。而参数和函数一起构成新的 filter 来处理输入。和其他编程语言不同的是，在调用函数时，多个参数之间以分号分隔。jq 通过内置函数提供了数据处理时常用的操作，例如：过滤，映射，路径操作等。



### 映射操作

在数据处理过程中，我们经常需求将数据从一种形式转换成另外一种形式，或者改变数据的值。jq 提供了两个内置映射函数来实现这种转换：map 和 map_values。其中，map 处理的对象是数组，而 map_values 则处理对象属性的值。map 函数的参数为 filter 表达式。在该 filter 表达式中,’.’代表被映射的元素或值。

```shell
#输入：[1,2,3,4]
jq 表达式：jq -r 'map(.+1)'
#输出：[2,3,4,5]
```



### 过滤操作

在 jq 中有两种类型的选择过滤操作。第一种是基于数据类型的过滤，如表达式’.[]|arrays’的结果只包含数组。可以用来过滤的类型过滤器有：arrays, objects, iterables, booleans, numbers, normals, finites, strings, nulls, values, scalars。

第二种是 select 函数。select 接受一个条件表达式作为参数。其输入可以是迭代器，或者和 map 函数配合使用来处理数组。当输入中的某个元素使 select 参数中的条件表达式结果为真时，则在结果中保留该元素，否则不保留该元素。

```shell
#输入：[1,2,3,4]
jq -r 'map(select(.>2))'
#输出：[3,4]
jq -r '.[]|select(.>2)'
#输出：3 4
```



### 路径操作

和 xpath 类似，在 jq 中的 path 也是指从根到某个叶子属性的访问路径。在 jq 中有两种表示路径的方式：数组表示法和属性表示法。属性表示法类似于我们在 filter 中访问某个属性值的方式，如’.a.b’。数组表示法是将路径中的每一部分表示为数组的一个元素。jq 提供了一个内置函数 path 用来实现路径从属性表示法到数组表示法的转换。

jq 还提供了函数用来读取路径的值(getpath), 设置路径的值(setpath)和删除路径(del)。不过遗憾的是，这三个函数对路径的处理并不一致。其中 getpath 和 setpath 只接受数组表示法的路径，而 del 函数只能正确处理属性表示法的路径。

jq 还提供了一个函数 paths 用来枚举可能存在的路径。在没有参数的情况下，paths 函数将输出 JSON 数据中所有可能的路径。paths 函数可以接受一个过滤器，来只输出满足条件的路径。



### 存在判断函数

jq 中提供了一系列的函数用来判断某个元素或者属性是否存在于输入数据中。其中函数 has 和 in 用来判断 JSON 对象或数组是否包含特定的属性或索引。函数 contains 和 inside 用来判断参数是否完全包含在输入数据中。对于不同的数据类型，判断是否完全包含的规则不同。对于字符串，如果 A 是 B 的子字符串，则认为 A 完全包含于 B。对于对象类型，如果对象 A 的所有属性在对象 B 中都能找到且值相同，则认为 A 完全包含于 B。



### 数组函数

除了前面讲述的基本操作符外，jq 提供内置函数用于完成数组的扁平化（flatten），反序（reverse），排序(sort, sort_by)，比较（min,min_by,max,max_by)和查找（indices,index 和 rindex)。其中 indices 函数的输入数据可以是数组，也可以是字符串。和 index 函数不同的是，其结果是一个包含所有参数在输入数据中位置的数组，具体请参看下面的例子。

```shell
#结果是[1,2,3,4]
jq -nr '[1,[2,3],4]|flatten'
#结果是[3,2,1]
jq -nr '[1,2,3]|reverse'
jq -nr '[3,1,2]|sort'
jq -nr '[{"a":1},{"a":2}]|sort_by(.a)'
#下面两个表达式的结果都是[1,3]
jq -nr '"abcb"|indices("b")'
jq -nr '[1,3,2,3]|indices(3)'
```



jq 还提供了许多其他的内置函数，具体请参考 jq 的在线文档。

## jq 高级特性

### 变量

jq 内部支持两种变量的定义方式。第一种我们在前边 jq 的调用部分讲过，可以通过命令行参数（–arg)定义。这种方式用来从外部（如：shell)传入数据以供 filter 表达式使用。

第二种方式，在 jq 表达式内部，我们可以自己声明变量用来保存表达式的结果以供表达式其余部分使用。

jq 中定义变量的语句为: fiterexp as $variablename

### 定义和使用变量

```shell
#在下面的表达式中变量$arraylen 用来保存数组长度，整个表达式结果为 4
jq -nr '[1,2,3]|length as $arraylen|$arraylen+1'
#可以同时定义多个变量
jq -nr '{"firstname":"tom","lastname":"clancy"}|. as {firstname:$fn, lastname:$ln}|"author is "+$fn+"*"+$ln'
```



jq 中同样存在变量作用域问题。在 jq 中，有两种方法分隔变量作用域。第一种是用括号包围部分表达式。括号内部的表达式与外部的表达式不在同一个作用域范围内。第二种方法是定义函数。默认情况下，声明的变量对其后的表达式可见。但是，如果变量在特定作用域内声明，则对作用域外部的表达式不可见，例如：

### 变量作用域

```shell
#会抛出 arraylen 没定义的异常
jq -nr '[1,2,3]|(length as $arraylen|$arraylen)|$arraylen+1'
 
#正常执行，结果为 4.
jq -nr '[1,2,3]|(length as $arraylen|$arraylen+1)'
 
#函数作用域。该表达式会抛出异常，因为变量$fn 是在函数 fname 中定义，对最后一个子表达式##来说，$fn 是不可见的。
jq -nr '{"firstname":"tom","lastname":"clancy"}|def fname:. as {firstname:$fn, lastname:$ln}|$fn; fname|$fn'
```



### Reduce

我们知道 jq 有一种特殊的数据类型：迭代器。通常，有迭代器参与的运算，其结果也是一个迭代器。jq 提供了一些特殊的语法和内置函数用来缩减迭代器运算结果的个数。

reduce 关键字用来通过运算将迭代器的所有值合并为一个值。其调用形式为：reduce <itexp> as $var (INIT; UPDATE)。其中，表达式 itexp 产生的迭代器被赋值给变量 var, UPDATE 是关于变量 var 的表达式。INIT 是该表达式的初始输入。相对于 itexp 结果中的每个元素，UPDATE 表达式被调用一次，计算出结果用作下一次 UPDATE 调用的输入。

#### reduce 关键字

```shell
#结果是 6
jq -nr 'reduce ([1,2,3]|.[]) as $item (0; .+$item)'
#上面的表达式等同于
jq -nr '0 | (3 as $item|.+$item)|(2 as $item | . + $item)|(1 as $item | . + $item)'
```

关键字 foreach 的作用和 reduce 类似。其调用形式为 foreach EXP as $var (INIT; UPDATE; EXTRACT)。和 reduce 关键字不同的是，foreach 关键字的每次迭代是先调用 UPDATE 再调用 EXTRACT，并以一个迭代器保留每一次的中间结果。该迭代器最后作为整个表达式的结果输出。

#### foreach 关键字

```shell
#下面的表达式，结果是 1 3 6
jq -nr 'foreach ([1,2,3]|.[]) as $item (0; .+$item;.)'
```

内置函数 limit(n;exp)用来取得表达式 exp 结果的前 n 个值。

内置函数 first, last 和 nth。这几个函数用来取迭代器中某一个特定的元素。这几个函数既可以以函数的形式调用，也可以作为子表达式调用。请看下面的示例：

#### firs, last 和 nth

```shell
#下面的表达式按照函数的形式调用 first,结果为 1
jq -nr 'first([1,2,3]|.[])'
#下面的表达式以 filter 形式调用 first
jq -nr '[1,2,3]|.[]|first'
 
#nth 函数的使用，结果为 2
jq -nr 'nth(1;[1,2,3]|.[])'
```



### 自定义函数和模块化

作为一个类似于编程语言的表达式系统，jq 也提供了定义函数的能力。其语法规则为：def funcname(arguments) : funcbodyexp; 在定义函数时，需要注意下面几条规则。

- 函数名或者参数列表后面应该跟冒号以标志函数体开始。
- 如果不需要参数，可以直接把整个参数列表部分省去。
- 参数列表中，参数之间以分号(“;”)分隔。
- 函数体只能是一个表达式，且表达式需以分号结尾
- 如果在表达式内部定义函数，整个子表达式部分不能只包含函数定义，否则 jq 会抛出语法错误

在很多情况下，函数的参数都是被当作表达式引用的，类似于编程其他语言中的 callback 函数。

#### map 函数的源代码

```shell
def map(f): [.[] | f];
#下面表达式的结果是 20，因为当作参数传入的表达式在函数 foo 中被引用两次
5|def foo(f): f|f;foo(.*2)
```

如果希望传入的参数只被当作一个简单的值来使用，则需要把参数的值定义为一个同名变量，并按照使用变量的方式引用。

#### 值参数

```shell
#下面表达式结果为 10,传入的表达式'.*2'在函数 foo 中首先被求值。
5|def foo(f): f as $f|$f|$f;foo(.*2)
#上面的表达式可以简写为如下形式,注意，引用参数时必须带$。
5|def foo($f): $f|$f;foo(.*2)
#否则等于直接引用参数中的表达式。
#例如下面的表达式结果为 20
5|def foo($f): $f|f;foo(.*2)
```

函数内部可以定义子函数。利用这个特性我们可以实现递归函数。

#### 递归函数实现数组求和

```shell
#下面表达式的结果是 15
jq -nr '[1,2,3,4,5]|def total: def _t: .|first+(if length>1 then .[1:]|_t else 0 end); _t;total'
```

除了在表达式内部定义函数外，我们可以把自定义函数写在外部文件中形成单独的类库。jq 有一套完整的模块系统来支持自定义类库。

首先，可以通过命令行参数’-L’来指定 jq 搜索模块时需要搜索的路径。

其次，在模块内部，可以通过 import 指令和 include 指令来实现互相引用。在引用指令中，有几个特殊的路径前缀需要说明。

- ‘～’，表示当前用户的 home 目录
- ‘$ORIGIN’表示 jq 命令的可执行文件所在的目录
- ‘.’表示当前目录，该前缀只能用在 include 指令中。

当通过 import 指令引用一个模块 foo/bar 时, jq 会在搜素路径中查找 foo/bar.jq 或者 foo/bar/bar.jq。



转自：[无比强大的shell之json解析工具jq](https://justcode.ikeepstudying.com/2018/02/shell%EF%BC%9A%E6%97%A0%E6%AF%94%E5%BC%BA%E5%A4%A7%E7%9A%84shell%E4%B9%8Bjson%E8%A7%A3%E6%9E%90%E5%B7%A5%E5%85%B7jq-linux%E5%91%BD%E4%BB%A4%E8%A1%8C%E8%A7%A3%E6%9E%90json-jq%E8%A7%A3%E6%9E%90-json/)