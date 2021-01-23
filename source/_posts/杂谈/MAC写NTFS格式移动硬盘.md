---
title: MAC写NTFS格式移动硬盘
date: 2020-09-04 16:33:21
categories: 杂谈
tags:
  - MAC
---

**无需安装软件即可让MAC读写NTFS格式移动硬盘**

<!--more-->

**详细流程**

1. 插上硬盘后，查看你的硬盘信息

   ```shell
   diskutil info /Volumes/XXX | grep UUID
   ```

   把移动硬盘的名字替换命令里的“XXX”，然后点击确定，就能看见你的硬盘序列号UUID。

2. 修改挂载信息

   ```shell
   echo "UUID=硬盘序列号 none ntfs rw,auto,nobrowse" | sudo tee -a /etc/fstab
   ```

   将上面获得UUID替换命令内的“硬盘序列号”后，点击确定，输入密码。

3. 推出移动硬盘，再重新插入，但是磁盘没有显示在桌面或Finder之前出现的地方；

4. 打开Finder，`Command+Shift+G`，输入框中输入`/Volumes`，回车；

5. 方便起见，可以直接把磁盘拖到Finder侧边栏中，这样下次使用就不用进入到/Volumes目录打开。



**参考资料**

[如何将 Mac 里的文件复制到 NTFS 格式的移动硬盘里？](https://www.zhihu.com/question/19571334)

[Mac 不能写入移动硬盘解决方法](https://www.cnblogs.com/chrdai/p/13582019.html)