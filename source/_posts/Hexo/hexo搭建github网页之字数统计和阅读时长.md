---
title: hexo搭建github网页之字数统计和阅读时长
date: 2018-04-26 14:28:37
categories: Hexo
tags:
  - 字数统计
  - 阅读时长
---

新版的HEXO NEXT（5.1.4）主题，已经集成了`hexo-wordcount`插件，因此只需要进行简单的几部配置即可。

## 安装

```shell
# npm install hexo-wordcount --save
```

## 配置

在主题配置文件 `_config.yml` 中打开 wordcount 统计功能。

```shell
post_wordcount:
  item_text: true
  wordcount: true		//字数统计
  min2read: true		//阅读时长，min
  totalcount: false
  separated_meta: true
```

## 预览

```shell
# hexo clean; hexo g; hexo s
```

## 优秀资料

[Hexo 添加字数统计、阅读时长](https://sessionch.com/hexo/hexo-common-plug.html)