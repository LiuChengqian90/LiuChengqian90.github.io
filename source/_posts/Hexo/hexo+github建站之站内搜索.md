---
title: hexo+github建站之站内搜索
date: 2018-07-25 17:26:30
categories: Hexo
tags:
  - local search
  - algolia
typora-root-url: ../../../source
---

随着站内文章数量增加，即使是作者本人查询也是比较困难。而“站内搜索”功能提供了一条便捷之路。
<!--more-->
hexo建站支持多种站内搜索方式，现对几种常用的方式进行简要介绍。

## Local Search

添加百度/谷歌/本地 自定义站点内容搜索。

此方式比较简单，本站即用此方式。

1. 安装 **search插件**，在站点的更目录下，执行

   ```shell
   # npm install hexo-generator-search --save
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

此特性在theme-next版本 5.1.0 中引入，要使用此功能请确保所使用的 NexT 版本在此之后。

先不要按照步骤一块配置，先明确以下两点：

- 如果仅仅支持标题搜索，可跳过`优化`一节；
- `优化`一节讲述如何配置多域搜索（标题、文章内容等）。

### 注册

官网](https://www.algolia.com/) 进行账号注册（可使用github或google账号登录）。

### 创建

开始创建所用API。

![Algolia-dashboard](/images/hexo站内搜索/Algolia-dashboard.png)

#### Search-Only API 

1. 点击`NEW INDEX`，弹出的对话框中输入自己想要的`INDEX NAME`即可。

   ![New-index](/images/hexo站内搜索/New-index.png)

2. API Keys，后面在文件中的配置基本都在这个页面。

   ![API-Keys](/images/hexo站内搜索/API-Keys.png)

3. 更改权限。

   点击ALL API KEYS 找到新建INDEX对应的key， 编辑权限，在弹出框中找到ACL选择勾选`Add records`，`Delete records`，`List indices`，`Delete index`权限，点击update更新。

**如果不想更改此API权限，也可以重新创建一个API**，如下。

#### INDEXING API(可选)

为什么需要`INDEXING API`呢？因为在Algolia平台里，除了默认的`Search-Only API Key`，我们还需要创建一个APIKey，作为执行命令`hexo algolia`的环境变量`HEXO_ALGOLIA_INDEXING_KEY`，该APIKey需要添加删除记录，列举删除索引的权限。

1. 进入Algolia的`API Keys`页面`ALL API KEYS`选项卡。

   ![NEW-API-KEY](/images/hexo站内搜索/NEW-API-KEY.png)

2. 创建APIKey

   - Description：HEXO_ALGOLIA_INDEXING_KEY
   - Indices：**<此处选择之前创建的Index>**
   - ACL：Add records，Delete records，List indices，Delete index

3. 创建完成之后，此页面会有两个 API Key。

### 安装 Hexo Algolia

前往站点根目录，执行命令安装：

```shell
# npm install --save hexo-algolia
```

### 更新站点配置

编辑 `站点配置文件`，新增以下配置：

```yaml
algolia:
  applicationID: 'applicationID'
  apiKey: 'Search-Only API Key(第一个创建的key)'
  adminApiKey: 'Admin API Key'
  indexName: 'index_name'
  chunkSize: 5000
```

### 更新 Index

当配置完成，在站点根目录下执行如下命令更新INDEX。

```shell
# export HEXO_ALGOLIA_INDEXING_KEY='Search-Only API key' or 'INDEXING API KEY'
# hexo algolia
```

输出类似

![INDEX-OUTPUT](/images/hexo站内搜索/INDEX-OUTPUT.png)

### 集成

更改主题配置文件，找到 Algolia Search 配置部分，更改如下：

```
# Algolia Search
algolia_search:
  enable: true
  hits:
    per_page: 10
  labels:
    input_placeholder: Search for Posts
    hits_empty: "We didn't find any results for the search: ${query}"
    hits_stats: "${hits} results found in ${time} ms"
```

### 优化

按照上面的步骤配置完成之后，发现搜索仅能搜索标题而不能搜索文章内的内容，为了可以支持内容搜索，需要**更换**插件：将`hexo-algolia`更换为`hexo-algoliasearch`。

下面仅仅说一下和`hexo-algolia`不一样的地方。

1. 安装插件

   ```shell
   # npm install hexo-algoliasearch --save
   ```

2. 根目录配置文件`_config.yml`

   ```yaml
   algolia:
     applicationID: 'applicationID'
     apiKey: 'Search-Only API Key(第一个创建的key)'
     adminApiKey: 'Admin API Key'
     indexName: 'index_name'
     chunkSize: 5000
     fields:
       - content:strip:truncate,0,500
       - excerpt:strip
       - gallery
       - permalink
       - photos
       - slug
       - tags
       - title
   ```

   **重点注意：**

   有的教程（即使官方插件教程）会让你将`applicationID`改为`appId`，此处先不更改，关于此处的两个问题：

   - `fn = function () { throw arg; };`，这种应该是找不到`applicationID`或`appId`，注意配置。
   - 页面报错`Algolia Settings are invalid`，会定位到文件`source/js/src/algolia.js`中，看到变量由`applicationID`、`apiKey`、`indexName`组成，说明配置中找不到其中的某些变量。要注意看一下目录`node_modules`中插件的具体用的是`applicationID`还是`appId`（error happen 再看），一定要统一。

   如果没有配置`fields`选项，`hexo algolia`会报错`TypeError: Cannot read property 'filter' of undefined`。

3. 更新Index

   ```shell
   # export HEXO_ALGOLIA_INDEXING_KEY='Search-Only API key' or 'INDEXING API KEY'
   # hexo algolia
   ```

现在再部署页面，就会发现搜索完全可以搜索到文章内部。

## 优秀资料

[next主题配置之Algolia](http://theme-next.iissnan.com/third-party-services.html#algolia-search)

[Algolia一直出错](https://github.com/iissnan/theme-next-docs/issues/162)

[hexo-algoliasearch](https://github.com/LouisBarranqueiro/hexo-algoliasearch#hexo-algoliasearch)