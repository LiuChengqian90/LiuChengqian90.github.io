---
title: Linux shell Array详解
date: 2021-03-19 11:24:08
categories: Linux
tags:
  - array
  - shell
---



## 声明

数组中可以存放多个值。Bash Shell 只支持一维数组（不支持多维数组），初始化时不需要定义数组大小。

<!--more-->

```shell
array_name=(value1 value2 ... valuen)
```

**实例**

```shell
my_array=("A" "B" "C" "D")
my_array[0]='value0'
```



## 使用方式

**输出所有的value、长度**

```shell
#1）输出下标
echo ${!myarray[@]}

#1）输出所有value
echo ${my_array[@]}

#2）输出array长度
echo ${#my_array[@]}
或者
echo ${#my_array[*]} 
```



**遍历**

```shell
for var in ${my_array[@]} 
do
   echo "打印的内容："$var 
done
```



若a=(1 2 3 4)表示所有元素，则其只能用${a[*]}或者${a[@]}来表示。在a=(1 2 3 4)中，$a只是表示第一个元素1。

若a="1 2 3 4"表示所有元素，则其可以用${a[*]}或者${a[@]}或者$a来表示。



## 参考资料

[Linux Shell Array的用法](https://blog.csdn.net/h106140873/article/details/97234808) 

