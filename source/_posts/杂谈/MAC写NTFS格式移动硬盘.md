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

1. 插上硬盘后，查看你的硬盘名称，这里假设名称是FakeDisk；
2. 在终端输入`sudo nano /etc/fstab` 敲击回车；
3. 现在已经进入编辑界面，输入`LABEL=FakeDisk none ntfs rw,auto,nobrowse`，敲回车，再Ctrl+X，再敲击Y，再敲击回车；
4. 推出移动硬盘，再重新插入，但是磁盘没有显示在桌面或Finder之前出现的地方；
5.  打开Finder，`Command+Shift+G`，输入框中输入`/Volumes`，回车；
6. 方便起见，可以直接把磁盘拖到Finder侧边栏中，这样下次使用就不用进入到/Volumes目录打开。



**如果硬盘名称有空格怎么办？**

将将空格替换为`\040`即可。



**参考资料**

[如何将 Mac 里的文件复制到 NTFS 格式的移动硬盘里？](https://www.zhihu.com/question/19571334)