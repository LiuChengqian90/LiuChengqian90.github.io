---
title: Centos 更改内核启动顺序
date: 2017-11-22 17:47:19
tags:
  - Centos
  - 启动顺序
---

Centos 6.x 和 Centos 7.x的不同在于：前者使用grub引导，而后者使用grub2引导。关于内核升级请查看 [《Centos 内核升级》](http://chengqian90.com/2017/Centos-%E5%8D%87%E7%BA%A7%E5%86%85%E6%A0%B8/) 。

## Centos 6.x

修改 /etc/grub.conf 文件即可。

```shell
default ：启动顺序。内核名称即是以title开始的行，从 0 开始计数。
timeout ：系统启动时的等待时间。此时间段内可更改内核。
title ：内核的标题名（启动时显示），可更改。
```

## Centos 7.x

系统中的可用内核在 /boot/grub2/grub.cfg 文件中，可使用下面的命令查看：

```shell
# cat /boot/grub2/grub.cfg |grep menuentry
if [ x"${feature_menuentry_id}" = xy ]; then
  menuentry_id_option="--id"
  menuentry_id_option=""
export menuentry_id_option
menuentry 'CentOS Linux (3.10.0-693.5.2.el7.x86_64) 7 (Core)' --class centos --class gnu-linux --class gnu --class os --unrestricted $menuentry_id_option 'gnulinux-3.10.0-693.5.2.el7.x86_64-advanced-3e109aa3-f171-4614-ad07-c856f20f9d25' {
menuentry 'CentOS Linux (3.10.0-693.2.2.el7.x86_64) 7 (Core)' --class centos --class gnu-linux --class gnu --class os --unrestricted $menuentry_id_option 'gnulinux-3.10.0-693.2.2.el7.x86_64-advanced-3e109aa3-f171-4614-ad07-c856f20f9d25' {
menuentry 'CentOS Linux (3.10.0-514.26.2.el7.x86_64) 7 (Core)' --class centos --class gnu-linux --class gnu --class os --unrestricted $menuentry_id_option 'gnulinux-3.10.0-514.26.2.el7.x86_64-advanced-3e109aa3-f171-4614-ad07-c856f20f9d25' {
menuentry 'CentOS Linux (3.10.0-514.el7.x86_64) 7 (Core)' --class centos --class gnu-linux --class gnu --class os --unrestricted $menuentry_id_option 'gnulinux-3.10.0-514.el7.x86_64-advanced-3e109aa3-f171-4614-ad07-c856f20f9d25' {
menuentry 'CentOS Linux (0-rescue-b7ab9add9a761df2e33b16b2038dbf9c) 7 (Core)' --class centos --class gnu-linux --class gnu --class os --unrestricted $menuentry_id_option 'gnulinux-0-rescue-b7ab9add9a761df2e33b16b2038dbf9c-advanced-3e109aa3-f171-4614-ad07-c856f20f9d25' {
```

利用命令 grub2-set-default  来修改启动顺序 或者 根据命令原理来修改文件 /etc/default/grub。

```shell
# grub2-set-default 'CentOS Linux (3.10.0-514.26.2.el7.x86_64) 7 (Core)' 
```

查看是否生效：

```shell
# grub2-editenv list
saved_entry=CentOS Linux (3.10.0-514.26.2.el7.x86_64) 7 (Core)
```

设置生效后需要重启设备才能真正应用。