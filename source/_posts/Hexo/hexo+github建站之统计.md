---
title: hexo+github建站之统计
date: 2017-10-20 15:48:14
categories: Hexo
tags:
  - 网站统计
---

## 网站统计

[**“不蒜子”**](http://ibruce.info/2015/04/04/busuanzi/)是提供统计网站访问量的第三方插件。
<!--more-->
对于使用了“next”主题的GitHub网页，由于主题源码已经支持“不蒜子”，所以在主题配置文件中进行如下更改即可。

```yaml
busuanzi_count:
  # count values only if the other configs are false
  enable: true
  # custom uv span for the whole site
  site_uv: true
  site_uv_header: <i class="fa fa-user"></i> 访问人数
  site_uv_footer:
  # custom pv span for the whole site
  site_pv: true
  site_pv_header: <i class="fa fa-eye"></i> 总访问量
  site_pv_footer: 次
  # custom pv span for one page only
  page_pv: false
  page_pv_header: <i class="fa fa-file-o"></i>浏览
  page_pv_footer: 次
```

## 文章统计

单独文章的统计量需要第三方插件[**“LeanCloud”**](https://leancloud.cn/)来支持，“next”主题配置文件中“leancloud_visitors”即是此功能的配置域。

由配置而知，其需要两个数值：id 和 key。以下步骤给出如何获取这两个值。

1. “LeanCloud” 中**创建应用**，应用名随意。
2. 点击应用进入，在**“存储”**选项的**“数据”**下**创建Class**，Class名为**“Counter”**（权限默认即可，若之后无计数可调整权限）。
3. **“设置”**选项下的**“应用Key”**中， App ID 和  App Key 即是所需数值。
4. 将其值复制到主题配置文件，并将功能打开即可。

其他主题可参考 “[使用LeanCloud平台为Hexo博客添加文章浏览量统计组件](http://crescentmoon.info/2014/12/11/popular-widget/)”。