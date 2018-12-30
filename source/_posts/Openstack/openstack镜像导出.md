---
title: OpenStack镜像导出
date: 2017-11-09 14:48:42
categories: OpenStack
tags:
  - OpenStack
  - 镜像
---

### 查询镜像信息

```shell
# glance image-show 958aba73-cddd-46e6-ae3c-e90ef0f483f1
+------------------+----------------------------------------------------------------------------------+
| Property         | Value                                                                            |
+------------------+----------------------------------------------------------------------------------+
| checksum         | ecb6ae37e2c8ac57d4f89177a9b216a4                                                 |
| container_format | bare                                                                             |
| created_at       | 2017-11-08T08:57:15Z                                                             |
| direct_url       | rbd://05777380-b983-11e7-b6df-525400017028/images/958aba73-cddd-46e6-ae3c-       |
|                  | e90ef0f483f1/snap                                                                |
| disk_format      | qcow2                                                                            |
| id               | 958aba73-cddd-46e6-ae3c-e90ef0f483f1                                             |
| locations        | [{"url": "rbd://05777380-b983-11e7-b6df-525400017028/images/958aba73-cddd-46e6   |
|                  | -ae3c-e90ef0f483f1/snap", "metadata": {}}]                                       |
| min_disk         | 0                                                                                |
| min_ram          | 0                                                                                |
| name             | test-image                                                                    |
| owner            | a0e2e386e12c4635b2676b7fdd36993e                                                 |
| protected        | False                                                                            |
| size             | 3999126016                                                                       |
| status           | active                                                                           |
| tags             | []                                                                               |
| updated_at       | 2017-11-08T09:03:02Z                                                             |
| virtual_size     | None                                                                             |
| visibility       | public                                                                           |
+------------------+----------------------------------------------------------------------------------+

# rbd info images/958aba73-cddd-46e6-ae3c-e90ef0f483f1
rbd image '958aba73-cddd-46e6-ae3c-e90ef0f483f1':
        size 3813 MB in 960 objects
        order 22 (4096 kB objects)
        block_name_prefix: rbd_data.fe2087216567e2
        format: 2
        features: layering, striping
        flags: 
        stripe unit: 512 kB
        stripe count: 16
# rbd snap ls images/958aba73-cddd-46e6-ae3c-e90ef0f483f1
SNAPID NAME    SIZE 
    30 snap 3813 MB
```

### 镜像导出

```shell
# rbd export images/958aba73-cddd-46e6-ae3c-e90ef0f483f1@snap test-image.qcow2 
Exporting image: 100% complete...done.
# file test-image.qcow2 
test-image.qcow2: QEMU QCOW Image (v3), 10737418240 bytes
# qemu-img info test-image.qcow2 
image: test-image.qcow2
file format: qcow2
virtual size: 10G (10737418240 bytes)
disk size: 3.7G
cluster_size: 65536
Format specific information:
    compat: 1.1
    lazy refcounts: false
    refcount bits: 16
    corrupt: false
```

### 格式转换

```shell
# qemu-img convert -O raw test-image.qcow2 test-image.raw
# qemu-img info test-image.raw 
image: test-image.raw
file format: raw
virtual size: 10G (10737418240 bytes)
disk size: 4.5G
```

至此，导出完成。