---
title: VIM的分屏操作
date: 2019-09-12 19:57:52
categories:
tags:
  - VIM
  - 分屏
---

## 启动时分屏

使用**大写**的O参数来**垂直分屏**

```shell
$ vim -On file1 [file2 ...]
```

使用**小写**的o参数来**水平分屏**

```shell
$ vim -on file1 [file2 ...]
```

**Note**：n是数字，表示分成几个屏。一个文件，多个分屏时，会创建n-1的空屏。

## 启动后分屏

VIM命令模式下进行操作。

```yaml
:sp[lit] {file}     水平分屏
:new {file}         水平分屏
:sv[iew] {file}     水平分屏，以只读方式打开
:vs[plit] {file}    垂直分屏
:clo[se]            关闭当前窗口
```

如未指定file则打开当前文件。

### 快捷键

```yaml
Ctrl+w s        水平分割当前窗口
Ctrl+w v        垂直分割当前窗口
Ctrl+w q        关闭当前窗口
Ctrl+w n        打开一个新窗口（空文件）
Ctrl+w T        当前窗口移动到新标签页
```



## 切换窗口

切换窗口的快捷键就是`Ctrl+w`前缀 + `hjkl`：

```yaml
Ctrl+w h        切换到左边窗口
Ctrl+w j        切换到下边窗口
Ctrl+w k        切换到上边窗口
Ctrl+w l        切换到右边窗口
Ctrl+w w        切换到下一个窗口
Ctrl+w p        切换到上一个窗口
```

还有`t`切换到**最上方**的窗口，`b`切换到**最下方**的窗口。

## 移动分屏

分屏后还可以把当前窗口向任何方向移动，只需要将上述快捷键中的`hjkl`大写：

```yaml
Ctrl+w H        向左移动当前窗口
Ctrl+w J        向下移动当前窗口
Ctrl+w K        向上移动当前窗口
Ctrl+w L        向右移动当前窗口

Ctrl+w r        向下旋转窗口
Ctrl+w R        向上旋转窗口
Ctrl+w x        当前窗口与下一个窗口对调
```



## 分屏尺寸



```yaml
Ctrl+w +        增加窗口高度
Ctrl+w -        减小窗口高度

Ctrl+w <        增加窗口宽度
Ctrl+w >        减小窗口宽度

Ctrl+w =        恢复窗口尺寸
```



## 关闭分屏



```yaml
:only           关闭出当前窗口之外的所有窗口
Ctrl+w o        同only
ctrl+w c        关闭出当前窗口(不可关闭最后一个窗口)
ctrl+w q        关闭出当前窗口(可关闭最后一个窗口)
:qa             关闭所有窗口
```



