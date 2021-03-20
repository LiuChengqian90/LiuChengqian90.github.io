---
title: Linux shell Map详解
date: 2021-03-19 11:24:08
categories: Linux
tags:
  - map
  - shell
---



## 声明

在使用map时，需要先声明，否则结果可能与预期不同，array可以不声明。

<!--more-->

**方式1**

```shell
declare -A myMap
myMap["my03"]="03"
```

**方式2**

```shell
declare -A myMap=(["my01"]="01" ["my02"]="02")
```



## 初始化

与array类似，可以使用括号直接初始化，也可以通过添加的方式来初始化数据，与array不同的是，括号直接初始化时使用的为一个键值对，添加元素时，下标可以不是整数。

```shell
myMap["my03"]="03"
myMap["my04"]="04"
```



**删除**

```shell
d_key='my03'
unset mymap[$d_key]
```



## 使用方式

**输出所有的key、value、长度**

```shell
# 1）输出所有的key
#若未使用declare声明map，则此处将输出0，与预期输出不符，此处输出语句格式比arry多了一个！
echo ${!myMap[@]}

#2）输出所有value
#与array输出格式相同
echo ${myMap[@]}

#3）输出map长度
#与array输出格式相同
echo ${#myMap[@]}
```



**遍历**

```shell
#1)遍历，根据key找到对应的value
for key in ${!myMap[*]};do
 echo $key
 echo ${myMap[$key]}
done

#2)遍历所有的key
for key in ${!myMap[@]};do
 echo $key
 echo ${myMap[$key]}
done

#3)遍历所有的value
for val in ${myMap[@]};do
 echo $val
done
```



## 参考资料

[Linux Shell Map的用法详解](https://www.jb51.net/article/186118.htm)