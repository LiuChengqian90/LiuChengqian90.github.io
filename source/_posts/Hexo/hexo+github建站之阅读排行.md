---
title: hexo+github建站之阅读排行
date: 2019-08-30 14:28:37
categories: Hexo
tags:
  - 阅读排行
---

阅读排行基于[leancloud](https://leancloud.cn/)实现，因此**必须用leancloud来统计每篇文章的阅读量**——关掉不算子等统计工具对每篇文章的统计。

## 生成TOP

在博客的根目录执行下面的命令，会生成`top`文件夹。

```shell
# hexo new page top
```

## 修改index.md

修改根目录下`source/top/index.md`文件如下

```json
---
title: 文章热度排行
comments: false
keywords: top,文章阅读量排行榜
description: 博客文章阅读量排行榜
---
<div id="top"></div>
<script src="https://cdn1.lncld.net/static/js/av-core-mini-0.6.4.js"></script>
<script>AV.initialize("App-ID", "App-Key");</script>
<script type="text/javascript">
  var time=0
  var title=""
  var url=""
  var query = new AV.Query('Counter');
  query.notEqualTo('id',0);
  query.descending('time');
  query.limit(1000);
  query.find().then(function (todo) {
    for (var i=0;i<1000;i++){
      var result=todo[i].attributes;
      time=result.time;
      title=result.title;
      url=result.url;
      var content="<font color='#555'>"+"【热度："+time+"℃】</font>"+"<a href='"+"https://chengqian90.com"+url+"'>"+title+"</a>"+"<br />";
      document.getElementById("top").innerHTML+=content
    }
  }, function (error) {
    console.log("error");
  });
</script>

<style>.post-description { display: none; }</style>
```

- `App-ID`和`App-Key`更换为自己注册的leancloud ID和key。
- `url`部分也更换为自己的域名。

## 修改配置文件

编辑主题配置文件 `_config.yml`，添加 top：

```json
menu:
  home: / || home
  top: /top/ || signal
```

新增主题菜单栏的显示名称 `languages/zh-Hans.yml`，同样新增 top 对应的中文：

```json
menu:
  home: 首页
  archives: 归档
  categories: 分类
  tags: 标签
  about: 关于
  search: 搜索
  schedule: 日程表
  sitemap: 站点地图
  commonweal: 公益404
  resources: 资源
  top: 阅读排行
```



## 部署

```shell
# hexo clean; hexo g; hexo d
```

可能需要等待一段时间才能正常显示。