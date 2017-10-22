---
title: hexo搭建github网页之搜索
date: 2017-10-20 17:26:30
tags:
  - hexo
  - github
---

随着站内文章数量增加，即使是作者本人查询也是比较困难。而“站内搜索”功能提供了一条便捷之路。

hexo建站支持多种站内搜索方式，现对几种常用的方式进行简要介绍。

## Local Search

添加百度/谷歌/本地 自定义站点内容搜索。

此方式比较简单，本站即用此方式。

1. 安装 **hexo-generator-searchdb**，在站点的更目录下，执行

   ```shell
   # npm install hexo-generator-searchdb --save
   ```

2. 编辑 **站点配置文件**，新增以下内容到任意位置：

   ```yaml
   search:
     path: search.xml
     field: post
     format: html
     limit: 10000
   ```

3. 编辑 **主题配置文件**，启用本地搜索功能：

   ```yaml
   # Local search
   local_search:
     enable: true
   ```

## Swiftype 

参考 [**next主题配置之Swiftype**](http://theme-next.iissnan.com/third-party-services.html#swiftype)。

## Algolia

参考 [**next主题配置之Algolia**](http://theme-next.iissnan.com/third-party-services.html#algolia-search)。